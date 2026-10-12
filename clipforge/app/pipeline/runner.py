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
from . import captions as captions_stage
from . import copy as copy_stage
from . import fit as fit_stage
from . import ingest as ingest_stage
from . import render as render_stage
from . import schedule as schedule_stage
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


def _platforms_for(job: dict) -> list[str]:
    return job.get("options", {}).get("platforms") or list(settings.load_config("platforms")["platforms"])


def fit_clip_variants(job_id: str, clip: dict) -> dict:
    """Derive per-platform cuts for one clip from the job's analysis; stores and returns them."""
    job = db.get_job(job_id)
    if not job:
        raise KeyError(job_id)
    job_dir = job_dir_for(job_id)
    analysis = segment_stage.load_analysis(job_dir)
    transcript = transcribe_stage.load_transcript(job_dir) or {}
    scores = score_stage.load_scores(job_dir) or {}
    cfg = settings.load_config("scoring")
    weights = scores.get("weights") or score_stage.effective_weights(cfg)
    keywords = scores.get("keywords") or []

    def scorer(s: float, e: float, text: str, n_words: int) -> float:
        feats = score_stage.features_for({"start": s, "end": e, "text": text, "n_words": n_words},
                                         energy=analysis.get("energy", {}), scenes=analysis.get("scenes", []),
                                         keywords=keywords, cfg=cfg)
        return score_stage.heuristic_score(feats, weights)

    variants = fit_stage.fit_variants(clip["start_s"], clip["end_s"], clip.get("transcript") or "",
                                      platforms=_platforms_for(job), sentences=analysis.get("sentences", []),
                                      words=transcript.get("words") or [], duration=float(analysis["duration"]),
                                      scorer=scorer)
    db.update_clip(clip["id"], variants=variants)
    return variants


def _run_fit(ctx: JobContext) -> None:
    clips = db.list_clips(ctx.job_id)
    n_trim = 0
    for i, clip in enumerate(clips):
        ctx.progress(i / max(1, len(clips)), f"fitting clip {i + 1} to each platform")
        variants = fit_clip_variants(ctx.job_id, clip)
        n_trim += sum(1 for v in variants.values() if v["reason"] != "master")
    ctx.set_meta(fit={"n_clips": len(clips), "n_platform_cuts": n_trim})
    ctx.progress(1.0, "platform cuts planned")


def render_one_clip(job_id: str, clip: dict, *, reframe: str | None = None, progress=None) -> dict:
    """Render a clip's master cut plus every distinct platform variant (used by the render stage
    and the re-render endpoint)."""
    job = db.get_job(job_id)
    if not job:
        raise KeyError(job_id)
    job_dir = job_dir_for(job_id)
    media = (job.get("meta", {}).get("source") or ingest_stage.load_source_meta(job_dir))["media"]
    transcript = transcribe_stage.load_transcript(job_dir) or {}
    words = transcript.get("words") or []
    reframe = reframe or job["options"].get("reframe") or settings.load_config("platforms")["defaults"].get("reframe", "auto")
    progress = progress or (lambda f, m: None)
    db.update_clip(clip["id"], status="rendering", error=None)
    try:
        variants = dict(clip.get("variants") or {})
        groups = fit_stage.unique_ranges(variants, (clip["start_s"], clip["end_s"]))
        total = 1 + len(groups)

        def sub(k: int):
            return lambda f, m: progress((k + f) / total, m)

        caps = captions_stage.write_captions(job_dir, clip["idx"], words, clip["start_s"], clip["end_s"])
        res = render_stage.render_clip(job_dir, idx=clip["idx"], start=clip["start_s"], end=clip["end_s"],
                                       src_media=media, captions_ass=caps["ass"] if caps["n_words"] else None,
                                       reframe=reframe, progress=sub(0))
        master_paths = {"video_path": res["video_path"], "cover_path": res["cover_path"], "captions_path": caps["srt"]}
        for platform, v in variants.items():
            if v.get("fits", True) and (round(v["start"], 3), round(v["end"], 3)) == (round(clip["start_s"], 3), round(clip["end_s"], 3)):
                v.update(master_paths, shared=True)

        for k, ((vs, ve), plats) in enumerate(groups.items(), start=1):
            suffix = plats[0]
            vcaps = captions_stage.write_captions(job_dir, clip["idx"], words, vs, ve, suffix=suffix)
            vres = render_stage.render_clip(job_dir, idx=clip["idx"], start=vs, end=ve, src_media=media,
                                            captions_ass=vcaps["ass"] if vcaps["n_words"] else None,
                                            reframe=reframe, progress=sub(k), suffix=suffix, face_hint=res["reframe"])
            for pl in plats:
                variants[pl].update(video_path=vres["video_path"], cover_path=vres["cover_path"],
                                    captions_path=vcaps["srt"], shared=False)

        db.update_clip(clip["id"], status="done", variants=variants, **master_paths)
        meta = dict(db.get_clip(clip["id"]).get("score_breakdown") or {})
        meta["render"] = {"reframe": res["reframe"], "duration": res["duration"], "n_caption_words": caps["n_words"],
                          "n_variant_renders": len(groups)}
        db.update_clip(clip["id"], score_breakdown=meta)
        return res
    except JobCancelled:
        db.update_clip(clip["id"], status="pending", error=None)
        raise
    except Exception as exc:  # noqa: BLE001
        log.error("clip %s render failed: %s", clip["id"], exc)
        db.update_clip(clip["id"], status="failed", error=str(exc)[:1500])
        raise


def _run_render(ctx: JobContext) -> None:
    clips = db.list_clips(ctx.job_id)
    if not clips:
        ctx.progress(1.0, "no clips to render")
        return
    n = len(clips)
    failures = 0
    for i, clip in enumerate(clips):
        def prog(f: float, m: str, i=i) -> None:
            ctx.progress((i + f) / n, m)
        try:
            render_one_clip(ctx.job_id, clip, progress=prog)
        except JobCancelled:
            raise
        except Exception:  # noqa: BLE001 - recorded on the clip; keep going
            failures += 1
    if failures == n:
        raise RuntimeError("every clip failed to render; see clip errors")
    ctx.set_meta(render={"n_clips": n, "n_failed": failures})


def _run_copy(ctx: JobContext) -> None:
    clips = db.list_clips(ctx.job_id)
    platforms = ctx.options.get("platforms") or list(settings.load_config("platforms")["platforms"])
    keywords = (ctx.job.get("meta", {}).get("scoring") or {}).get("keywords") or []
    llm_hits = 0
    for i, clip in enumerate(clips):
        ctx.progress(i / max(1, len(clips)), f"writing copy for clip {i + 1}")
        copy = copy_stage.generate_copy(clip, platforms=platforms, keywords=keywords, video_title=ctx.job.get("title"),
                                        use_llm=ctx.options.get("use_llm"))
        llm_hits += sum(1 for v in copy.values() if v.get("source") == "llm")
        db.update_clip(clip["id"], copy=copy)
    ctx.set_meta(copy={"n_clips": len(clips), "llm_platforms": llm_hits})
    ctx.progress(1.0, "copy written")


def _run_schedule(ctx: JobContext) -> None:
    clips = db.list_clips(ctx.job_id)
    platforms = ctx.options.get("platforms") or list(settings.load_config("platforms")["platforms"])
    plan = schedule_stage.build_schedule(clips, platforms)
    for clip in clips:
        db.update_clip(clip["id"], schedule=plan.get(clip["id"], {}))
    ctx.set_meta(schedule={"n_posts": sum(len(v) for v in plan.values()), "timezone": settings.TIMEZONE})
    ctx.progress(1.0, "schedule built")


STAGES: list[Stage] = [
    ("ingest", _run_ingest),
    ("transcribe", _run_transcribe),
    ("analyze", _run_analyze),
    ("score", _run_score),
    ("fit", _run_fit),
    ("render", _run_render),
    ("copy", _run_copy),
    ("schedule", _run_schedule),
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


def is_active(job_id: str) -> bool:
    with _active_lock:
        return job_id in _active
