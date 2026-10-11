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


STAGES: list[Stage] = [
    ("ingest", _run_ingest),
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
