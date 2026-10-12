"""Background job runner.

Each job runs on its own worker thread through an ordered list of stages. A stage is a callable
``stage(ctx) -> None`` where ctx is a JobContext. Stages report progress via ctx.progress().
Later phases append stages to STAGES; Phase 1 only has ingest.
"""
from __future__ import annotations

import logging
import threading
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from .. import db, settings
from . import ingest as ingest_stage
from . import score as score_stage
from . import segment as segment_stage
from . import transcribe as transcribe_stage

log = logging.getLogger("clipforge.runner")


@dataclass
class JobContext:
    job: dict
    job_dir: Path
    stage_name: str = ""
    stage_index: int = 0
    stage_count: int = 1
    cancelled: threading.Event = field(default_factory=threading.Event)

    @property
    def job_id(self) -> str:
        return self.job["id"]

    @property
    def options(self) -> dict:
        return self.job.get("options", {})

    def progress(self, frac: float, message: str = "") -> None:
        """frac is 0..1 within the current stage; mapped to overall job progress."""
        frac = max(0.0, min(1.0, frac))
        overall = (self.stage_index + frac) / max(1, self.stage_count)
        db.update_job(self.job_id, progress=round(overall, 4), message=message or None)
        if self.cancelled.is_set():
            raise JobCancelled()

    def set_meta(self, **meta) -> None:
        self.job["meta"] = db.merge_job_meta(self.job_id, **meta)


class JobCancelled(Exception):
    pass


Stage = tuple[str, Callable[[JobContext], None]]


def _run_ingest(ctx: JobContext) -> None:
    job = ctx.job
    meta = ingest_stage.ingest(
        ctx.job_dir,
        url=job.get("source_url"),
        upload_path=job["options"].get("upload_path"),
        upload_name=job.get("source_name"),
        progress=ctx.progress,
    )
    db.update_job(ctx.job_id, title=meta.get("title"))
    ctx.set_meta(source=meta)


def _source_media(ctx: JobContext) -> dict:
    return (ctx.job.get("meta", {}).get("source") or ingest_stage.load_source_meta(ctx.job_dir))["media"]


def _run_transcribe(ctx: JobContext) -> None:
    media = _source_media(ctx)
    audio = ctx.job_dir / ingest_stage.AUDIO_WAV
    out = ctx.job_dir / transcribe_stage.TRANSCRIPT_JSON
    if not audio.exists():
        out.write_text('{"available": false, "error": "source has no audio", "segments": [], "words": [], "text": ""}')
        ctx.set_meta(transcript={"available": False, "error": "no audio"})
        return
    result = transcribe_stage.transcribe(
        audio, out, progress=ctx.progress, duration_hint=media.get("duration"),
        model_size=ctx.options.get("whisper_model"), language=ctx.options.get("language"),
    )
    ctx.set_meta(transcript={
        "available": result.get("available", False), "error": result.get("error"),
        "language": result.get("language"), "n_words": len(result.get("words", [])),
        "model": result.get("model"),
    })


def _run_analyze(ctx: JobContext) -> None:
    media = _source_media(ctx)
    transcript = transcribe_stage.load_transcript(ctx.job_dir)
    analysis, candidates = segment_stage.analyze(
        ctx.job_dir, transcript=transcript, duration=float(media["duration"]),
        audio=ingest_stage.AUDIO_WAV if media.get("has_audio") else None, progress=ctx.progress,
    )
    ctx.set_meta(analysis={"mode": analysis["mode"], "n_scenes": analysis["n_scenes"],
                           "n_sentences": len(analysis["sentences"]), "n_candidates": len(candidates)})


def _run_score(ctx: JobContext) -> None:
    analysis = segment_stage.load_analysis(ctx.job_dir)
    candidates = segment_stage.load_candidates(ctx.job_dir)
    transcript = transcribe_stage.load_transcript(ctx.job_dir) or {}
    result = score_stage.score_candidates(
        candidates, analysis=analysis, full_text=transcript.get("text", ""),
        title=ctx.job.get("title"), options=ctx.options, progress=ctx.progress,
        use_llm=ctx.options.get("use_llm"),
    )
    score_stage.save_scores(ctx.job_dir, result)
    db.delete_clips(ctx.job_id)  # re-runs start clean
    for idx, c in enumerate(result["selected"]):
        db.create_clip(ctx.job_id, idx, c["start"], c["end"], score=c["score"], transcript=c.get("text"),
                       score_breakdown={"features": c["features"], "heuristic": c["heuristic"],
                                        "llm": c["llm"], "llm_hook": c["llm_hook"], "llm_reason": c["llm_reason"]})
    ctx.set_meta(scoring={"llm_used": result["llm_used"], "n_candidates": result["n_candidates"],
                          "n_selected": len(result["selected"]), "keywords": result["keywords"][:12]})


STAGES: list[Stage] = [
    ("ingest", _run_ingest),
    ("transcribe", _run_transcribe),
    ("analyze", _run_analyze),
    ("score", _run_score),
]

_active: dict[str, JobContext] = {}
_active_lock = threading.Lock()


def job_dir_for(job_id: str) -> Path:
    return settings.JOBS_DIR / job_id


def _worker(job_id: str) -> None:
    job = db.get_job(job_id)
    if not job:
        return
    ctx = JobContext(job=job, job_dir=job_dir_for(job_id), stage_count=len(STAGES))
    with _active_lock:
        _active[job_id] = ctx
    try:
        ctx.job_dir.mkdir(parents=True, exist_ok=True)
        db.update_job(job_id, status="running", error=None)
        for i, (name, fn) in enumerate(STAGES):
            ctx.stage_name, ctx.stage_index = name, i
            db.update_job(job_id, stage=name, message=f"{name} starting")
            log.info("job %s: stage %s", job_id, name)
            fn(ctx)
            ctx.job = db.get_job(job_id) or ctx.job
        db.update_job(job_id, status="done", stage="done", progress=1.0, message="complete")
    except JobCancelled:
        db.update_job(job_id, status="cancelled", message="cancelled")
    except Exception as exc:  # noqa: BLE001 - we want the failure recorded on the job
        log.error("job %s failed in %s: %s\n%s", job_id, ctx.stage_name, exc, traceback.format_exc())
        db.update_job(job_id, status="failed", error=f"{ctx.stage_name}: {exc}"[:2000],
                      message=f"failed during {ctx.stage_name}")
    finally:
        with _active_lock:
            _active.pop(job_id, None)


def start_job(job_id: str) -> threading.Thread:
    t = threading.Thread(target=_worker, args=(job_id,), name=f"job-{job_id}", daemon=True)
    t.start()
    return t


def run_job_sync(job_id: str) -> dict:
    """Run a job on the calling thread (tests, CLI)."""
    _worker(job_id)
    return db.get_job(job_id)  # type: ignore[return-value]


def cancel_job(job_id: str) -> bool:
    with _active_lock:
        ctx = _active.get(job_id)
    if ctx:
        ctx.cancelled.set()
        return True
    return False


def active_job_ids() -> list[str]:
    with _active_lock:
        return list(_active)
