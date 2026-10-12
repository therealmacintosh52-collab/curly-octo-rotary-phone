"""ClipForge FastAPI app. Run with ./run.sh or: uvicorn app.main:app --port 8000"""
from __future__ import annotations

import json
import logging
import shutil
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from . import __version__, cleanup as cleanup_mod, db, settings
from .pipeline import ffmpeg_tools as ff
from .pipeline import ingest, runner

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


# ----------------------------------------------------------------------------- maintenance

@app.post("/api/cleanup")
def api_cleanup(days: Optional[float] = Query(None, ge=0), dry_run: bool = Query(False)) -> dict:
    return cleanup_mod.cleanup(days, dry_run=dry_run)


@app.exception_handler(ff.FFmpegMissing)
async def _ffmpeg_missing(_, exc: ff.FFmpegMissing) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": str(exc)})
