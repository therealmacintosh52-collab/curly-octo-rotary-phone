"""ClipForge FastAPI app. Run with ./run.sh or: uvicorn app.main:app --port 8000"""
from __future__ import annotations

import io
import json
import logging
import shutil
import threading
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from pydantic import BaseModel, Field

from . import __version__, cleanup as cleanup_mod, db, settings
from .pipeline import feedback as feedback_mod
from .pipeline import ffmpeg_tools as ff
from .pipeline import ingest, runner, schedule as schedule_mod

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("clipforge")

ALLOWED_UPLOAD_EXT = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".mp3", ".m4a", ".wav", ".ts"}
PLATFORM_IDS = list(settings.load_config("platforms")["platforms"].keys())


def _whisper_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_dirs()
    db.init_db()
    info = ff.check_ffmpeg()  # raises FFmpegMissing → uvicorn refuses to start, with install hints
    log.info("ffmpeg %s at %s", info["version"], info["ffmpeg"])
    log.info("jobs dir: %s | db: %s | LLM: %s | whisper model: %s",
             settings.JOBS_DIR, settings.DB_PATH, "on" if settings.llm_enabled() else "off (heuristics only)",
             settings.WHISPER_MODEL)
    # Anything left 'running' from a previous process died with it.
    for j in db.list_jobs():
        if j["status"] in ("running", "queued"):
            db.update_job(j["id"], status="failed", error="server restarted mid-job", message="interrupted")
    yield


app = FastAPI(title="ClipForge", version=__version__, lifespan=lifespan)


# ----------------------------------------------------------------------------- pages

@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    return HTMLResponse((settings.STATIC_DIR / "index.html").read_text(encoding="utf-8"))


@app.get("/static/{name}")
def static_file(name: str) -> FileResponse:
    p = (settings.STATIC_DIR / name).resolve()
    if settings.STATIC_DIR.resolve() not in p.parents or not p.is_file():
        raise HTTPException(404)
    return FileResponse(p)


# ----------------------------------------------------------------------------- meta

@app.get("/api/health")
def health() -> dict:
    try:
        ffinfo = ff.check_ffmpeg()
    except ff.FFmpegMissing as e:
        ffinfo = {"error": str(e)}
    return {
        "ok": "error" not in ffinfo,
        "version": __version__,
        "ffmpeg": ffinfo,
        "whisper_available": _whisper_available(),
        "whisper_model": settings.WHISPER_MODEL,
        "llm_enabled": settings.llm_enabled(),
        "llm_model": settings.LLM_MODEL if settings.llm_enabled() else None,
        "jobs_dir": str(settings.JOBS_DIR),
        "retention_days": settings.RETENTION_DAYS,
        "active_jobs": runner.active_job_ids(),
        "stages": [name for name, _ in runner.STAGES],
    }


@app.get("/api/config")
def config() -> dict:
    return {
        "platforms": settings.load_config("platforms"),
        "scoring": settings.load_config("scoring"),
        "schedule": settings.load_config("schedule"),
        "timezone": settings.TIMEZONE,
    }


# ----------------------------------------------------------------------------- jobs

def _parse_options(raw: Optional[str], platforms: Optional[str]) -> dict:
    opts: dict = {}
    if raw:
        try:
            opts = json.loads(raw)
            if not isinstance(opts, dict):
                raise ValueError
        except ValueError:
            raise HTTPException(400, "options must be a JSON object")
    if platforms:
        wanted = [p.strip() for p in platforms.split(",") if p.strip()]
        bad = [p for p in wanted if p not in PLATFORM_IDS]
        if bad:
            raise HTTPException(400, f"unknown platform(s): {bad}; valid: {PLATFORM_IDS}")
        opts["platforms"] = wanted
    opts.setdefault("platforms", PLATFORM_IDS)
    return opts


@app.post("/api/jobs", status_code=201)
async def create_job(
    url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    platforms: Optional[str] = Form(None, description="comma-separated platform ids"),
    options: Optional[str] = Form(None, description="JSON object of pipeline options"),
    run: bool = Form(True, description="start processing immediately"),
) -> dict:
    url = (url or "").strip() or None
    if not url and file is None:
        raise HTTPException(400, "provide a video url or upload a file")
    if url and not ingest.is_url(url):
        raise HTTPException(400, "url must start with http:// or https://")
    opts = _parse_options(options, platforms)

    job_id = db.new_id()
    job_dir = runner.job_dir_for(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)

    source_name = None
    if file is not None and file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_UPLOAD_EXT:
            shutil.rmtree(job_dir, ignore_errors=True)
            raise HTTPException(400, f"unsupported upload type {ext!r}; allowed: {sorted(ALLOWED_UPLOAD_EXT)}")
        dest = job_dir / f"upload{ext}"
        with dest.open("wb") as fh:
            while chunk := await file.read(1024 * 1024):
                fh.write(chunk)
        opts["upload_path"] = str(dest)
        source_name = file.filename

    job = db.create_job("url" if url else "upload", source_url=url, source_name=source_name,
                        options=opts, job_id=job_id)
    if run:
        runner.start_job(job_id)
    return job


@app.get("/api/jobs")
def list_jobs(limit: int = Query(100, ge=1, le=1000)) -> list[dict]:
    return db.list_jobs(limit=limit)


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    job["clips"] = db.list_clips(job_id)
    return job


@app.post("/api/jobs/{job_id}/run")
def run_job(job_id: str) -> dict:
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    if job["status"] == "running":
        raise HTTPException(409, "job already running")
    db.update_job(job_id, status="queued", progress=0.0, error=None, message="queued")
    runner.start_job(job_id)
    return db.get_job(job_id)  # type: ignore[return-value]


@app.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str) -> dict:
    if not db.get_job(job_id):
        raise HTTPException(404, "job not found")
    return {"cancelling": runner.cancel_job(job_id)}


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str) -> dict:
    if not db.get_job(job_id):
        raise HTTPException(404, "job not found")
    runner.cancel_job(job_id)
    shutil.rmtree(runner.job_dir_for(job_id), ignore_errors=True)
    db.delete_job(job_id)
    return {"deleted": job_id}


@app.get("/api/jobs/{job_id}/files/{rel_path:path}")
def job_file(job_id: str, rel_path: str) -> FileResponse:
    """Serve a file from ./jobs/<id>/ (source video, clips, covers, captions...)."""
    if not db.get_job(job_id):
        raise HTTPException(404, "job not found")
    base = runner.job_dir_for(job_id).resolve()
    target = (base / rel_path).resolve()
    if base != target and base not in target.parents:
        raise HTTPException(400, "invalid path")
    if not target.is_file():
        raise HTTPException(404, "file not found")
    return FileResponse(target)


# ----------------------------------------------------------------------------- clips

class ClipPatch(BaseModel):
    model_config = {"populate_by_name": True}
    start_s: Optional[float] = Field(None, ge=0)
    end_s: Optional[float] = Field(None, gt=0)
    copy_edits: Optional[dict] = Field(None, alias="copy")


class FeedbackIn(BaseModel):
    rating: int = Field(..., ge=-1, le=1)
    note: Optional[str] = Field(None, max_length=1000)


_rerender_locks: set[str] = set()
_rerender_guard = threading.Lock()


def _clip_or_404(clip_id: str) -> dict:
    clip = db.get_clip(clip_id)
    if not clip:
        raise HTTPException(404, "clip not found")
    return clip


@app.get("/api/clips/{clip_id}")
def get_clip(clip_id: str) -> dict:
    return _clip_or_404(clip_id)


@app.patch("/api/clips/{clip_id}")
def patch_clip(clip_id: str, body: ClipPatch) -> dict:
    """Edit copy text or trim the clip boundaries (trim takes effect on the next re-render)."""
    clip = _clip_or_404(clip_id)
    fields: dict = {}
    if body.start_s is not None or body.end_s is not None:
        start = body.start_s if body.start_s is not None else clip["start_s"]
        end = body.end_s if body.end_s is not None else clip["end_s"]
        job = db.get_job(clip["job_id"]) or {}
        dur = float(((job.get("meta") or {}).get("source") or {}).get("media", {}).get("duration") or 1e9)
        if not (0 <= start < end <= dur + 0.01) or end - start < 3:
            raise HTTPException(400, "invalid trim: need 0 <= start < end <= source duration and at least 3 s")
        fields.update(start_s=float(start), end_s=float(end))
    if body.copy_edits is not None:
        merged = dict(clip.get("copy") or {})
        for platform, data in body.copy_edits.items():
            if platform in merged and isinstance(data, dict):
                merged[platform] = {**merged[platform], **data, "source": "edited"}
        fields["copy"] = merged
    db.update_clip(clip_id, **fields)
    return _clip_or_404(clip_id)


@app.post("/api/clips/{clip_id}/rerender")
def rerender_clip(clip_id: str, reframe: Optional[str] = Query(None, pattern="^(auto|center|blur)$")) -> dict:
    clip = _clip_or_404(clip_id)
    with _rerender_guard:
        if clip_id in _rerender_locks:
            raise HTTPException(409, "clip is already rendering")
        _rerender_locks.add(clip_id)
    db.update_clip(clip_id, status="rendering", error=None)

    def work() -> None:
        try:
            runner.render_one_clip(clip["job_id"], db.get_clip(clip_id) or clip, reframe=reframe)
        except Exception:  # noqa: BLE001 - recorded on the clip
            pass
        finally:
            with _rerender_guard:
                _rerender_locks.discard(clip_id)

    threading.Thread(target=work, name=f"rerender-{clip_id}", daemon=True).start()
    return {"rendering": clip_id, "reframe": reframe}


@app.post("/api/clips/{clip_id}/feedback", status_code=201)
def clip_feedback(clip_id: str, body: FeedbackIn) -> dict:
    _clip_or_404(clip_id)
    return feedback_mod.record(clip_id, body.rating, body.note)


@app.get("/api/feedback/weights")
def feedback_weights() -> dict:
    return feedback_mod.current_weights()


@app.post("/api/feedback/reset")
def feedback_reset() -> dict:
    return feedback_mod.reset()


# ----------------------------------------------------------------------------- export

def _export_bundle(job_id: str) -> dict:
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    clips = db.list_clips(job_id)
    return {"job": {k: job[k] for k in ("id", "title", "source_url", "source_name", "status", "created_at", "options")},
            "clips": [{k: c[k] for k in ("id", "idx", "start_s", "end_s", "duration", "score", "status", "transcript",
                                          "video_path", "cover_path", "captions_path", "copy", "schedule")} for c in clips]}


@app.get("/api/jobs/{job_id}/export.json")
def export_json(job_id: str) -> dict:
    return _export_bundle(job_id)


@app.get("/api/jobs/{job_id}/schedule.ics")
def export_ics(job_id: str) -> Response:
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    labels = {k: v["label"] for k, v in settings.load_config("platforms")["platforms"].items()}
    ics = schedule_mod.to_ics(job, db.list_clips(job_id), labels)
    return Response(ics, media_type="text/calendar",
                    headers={"Content-Disposition": f'attachment; filename="clipforge-{job_id}.ics"'})


@app.get("/api/jobs/{job_id}/export.zip")
def export_zip(job_id: str) -> Response:
    bundle = _export_bundle(job_id)
    base = runner.job_dir_for(job_id)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for c in bundle["clips"]:
            for key in ("video_path", "cover_path", "captions_path"):
                rel = c.get(key)
                if rel and (base / rel).is_file():
                    z.write(base / rel, rel)
        z.writestr("clips.json", json.dumps(bundle, indent=2))
        labels = {k: v["label"] for k, v in settings.load_config("platforms")["platforms"].items()}
        z.writestr("schedule.ics", schedule_mod.to_ics(bundle["job"], db.list_clips(job_id), labels))
        md = [f"# {bundle['job'].get('title') or job_id}\n"]
        for c in bundle["clips"]:
            md.append(f"## Clip {c['idx'] + 1}  ({c['start_s']:.1f}s – {c['end_s']:.1f}s, score {c['score'] * 100:.0f})\n")
            for platform, data in (c.get("copy") or {}).items():
                when = (c.get("schedule") or {}).get(platform, {}).get("local", "")
                md.append(f"### {labels.get(platform, platform)}  —  {when}\n")
                if data.get("title"):
                    md.append(f"**Title:** {data['title']}\n")
                md.append(f"{data.get('caption', '')}\n")
                md.append(f"Keywords: {', '.join(data.get('keywords', []))}\n")
        z.writestr("copy.md", "\n".join(md))
    buf.seek(0)
    return Response(buf.read(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="clipforge-{job_id}.zip"'})


# ----------------------------------------------------------------------------- maintenance

@app.post("/api/cleanup")
def api_cleanup(days: Optional[float] = Query(None, ge=0), dry_run: bool = Query(False)) -> dict:
    return cleanup_mod.cleanup(days, dry_run=dry_run)


@app.exception_handler(ff.FFmpegMissing)
async def _ffmpeg_missing(_, exc: ff.FFmpegMissing) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": str(exc)})
