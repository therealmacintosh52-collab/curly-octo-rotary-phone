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
    db.fail_stale_clips("server restarted mid-render")
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
        "niches": settings.load_config("niches"),
        "playbook": settings.load_config("playbook"),
        "timezone": settings.TIMEZONE,
    }


# ----------------------------------------------------------------------------- jobs

_rerender_locks: set[str] = set()      # clip ids with an in-flight re-render
_rerender_guard = threading.Lock()

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
    if job["status"] == "running" or runner.is_active(job_id):
        raise HTTPException(409, "job already running")
    with _rerender_guard:
        busy = [c["id"] for c in db.list_clips(job_id) if c["id"] in _rerender_locks]
    if busy:
        raise HTTPException(409, "a clip of this job is still re-rendering; wait for it to finish")
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
        if runner.is_active(clip["job_id"]):
            raise HTTPException(409, "job is still processing; trim after it finishes")
        start = body.start_s if body.start_s is not None else clip["start_s"]
        end = body.end_s if body.end_s is not None else clip["end_s"]
        job = db.get_job(clip["job_id"]) or {}
        dur = float(((job.get("meta") or {}).get("source") or {}).get("media", {}).get("duration") or 1e9)
        if not (0 <= start < end <= dur + 0.01) or end - start < 3:
            raise HTTPException(400, "invalid trim: need 0 <= start < end <= source duration and at least 3 s")
        fields.update(start_s=float(start), end_s=float(end))
        fields["transcript"] = _transcript_for_range(clip["job_id"], float(start), float(end)) or clip.get("transcript")
    if body.copy_edits is not None:
        merged = dict(clip.get("copy") or {})
        for platform, data in body.copy_edits.items():
            if platform in merged and isinstance(data, dict):
                merged[platform] = {**merged[platform], **data, "source": "edited"}
        fields["copy"] = merged
    db.update_clip(clip_id, **fields)
    if "start_s" in fields:
        try:
            runner.fit_clip_variants(clip["job_id"], db.get_clip(clip_id) or clip)
        except Exception as exc:  # noqa: BLE001 - analysis files may be gone; variants stay as they were
            log.warning("could not refit variants for %s: %s", clip_id, exc)
    return _clip_or_404(clip_id)


def _transcript_for_range(job_id: str, start: float, end: float) -> Optional[str]:
    from .pipeline import transcribe as transcribe_mod
    t = transcribe_mod.load_transcript(runner.job_dir_for(job_id)) or {}
    words = [w["word"] for w in t.get("words") or [] if w["start"] >= start - 0.05 and w["end"] <= end + 0.05]
    return " ".join(words) if words else None


@app.post("/api/clips/{clip_id}/rerender")
def rerender_clip(clip_id: str, reframe: Optional[str] = Query(None, pattern="^(auto|center|blur)$")) -> dict:
    clip = _clip_or_404(clip_id)
    if runner.is_active(clip["job_id"]):
        raise HTTPException(409, "job is still processing; re-render after it finishes")
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


class BriefPatch(BaseModel):
    subject: Optional[str] = Field(None, max_length=200)
    audience: Optional[str] = Field(None, max_length=300)
    promise: Optional[str] = Field(None, max_length=300)
    tone: Optional[str] = Field(None, max_length=100)
    niche: Optional[str] = Field(None, max_length=60)
    rewrite_copy: bool = True


@app.get("/api/jobs/{job_id}/brief")
def get_brief(job_id: str) -> dict:
    if not db.get_job(job_id):
        raise HTTPException(404, "job not found")
    from .pipeline import brief as brief_mod
    return brief_mod.load_brief(runner.job_dir_for(job_id)) or {}


@app.patch("/api/jobs/{job_id}/brief")
def patch_brief(job_id: str, body: BriefPatch) -> dict:
    """Correct the brief (subject, audience, niche...) and optionally rewrite every clip's copy from it."""
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    if runner.is_active(job_id):
        raise HTTPException(409, "job is still processing")
    from .pipeline import brief as brief_mod, copy as copy_mod
    brief = brief_mod.load_brief(runner.job_dir_for(job_id)) or {}
    niches = settings.load_config("niches")
    for k in ("subject", "audience", "promise", "tone"):
        val = getattr(body, k)
        if val:
            brief[k] = val.strip()
    if body.niche:
        if body.niche not in niches["niches"] and body.niche != "general":
            raise HTTPException(400, f"unknown niche; valid: {list(niches['niches'])}")
        n = niches["niches"].get(body.niche, niches["default"])
        brief.update(niche=body.niche, niche_label=n["label"], hashtags=n["hashtags"], cta=n["cta"])
    brief["source"] = "edited"
    (runner.job_dir_for(job_id) / brief_mod.BRIEF_JSON).write_text(json.dumps(brief, ensure_ascii=False, indent=2), encoding="utf-8")
    db.merge_job_meta(job_id, brief={**(job["meta"].get("brief") or {}), **{k: brief.get(k) for k in ("source", "subject", "niche", "niche_label", "audience", "promise", "tone", "hashtags", "cta")}})
    if body.rewrite_copy:
        platforms = job["options"].get("platforms") or list(settings.load_config("platforms")["platforms"])
        keywords = (job["meta"].get("scoring") or {}).get("keywords") or []
        for clip in db.list_clips(job_id):
            db.update_clip(clip["id"], copy=copy_mod.generate_copy(clip, platforms=platforms, keywords=keywords,
                                                                   video_title=job.get("title"), brief=brief))
    return brief


# ----------------------------------------------------------------------------- export

def _export_bundle(job_id: str) -> dict:
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    clips = db.list_clips(job_id)
    return {"job": {k: job[k] for k in ("id", "title", "source_url", "source_name", "status", "created_at", "options")},
            "clips": [{k: c[k] for k in ("id", "idx", "start_s", "end_s", "duration", "score", "status", "transcript",
                                          "video_path", "cover_path", "captions_path", "copy", "schedule", "variants")} for c in clips]}


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


def _copy_text(platform: str, label: str, c: dict) -> str:
    data = (c.get("copy") or {}).get(platform) or {}
    v = (c.get("variants") or {}).get(platform) or {}
    when = (c.get("schedule") or {}).get(platform, {}).get("local", "")
    lines = [f"{label} — clip {c['idx'] + 1}", f"Post: {when}" if when else "", f"Cut: {v.get('start', c['start_s']):.1f}s–{v.get('end', c['end_s']):.1f}s "
             f"({v.get('duration', c['duration']):.1f}s, {v.get('reason', 'master')})", ""]
    if data.get("title"):
        lines += ["TITLE", data["title"], ""]
    if data.get("title_options"):
        lines += ["TITLE / HOOK OPTIONS TO TEST"] + [f"  - {t}" for t in data["title_options"]] + [""]
    lines += ["CAPTION", data.get("caption", ""), ""]
    if data.get("description"):
        lines += ["DESCRIPTION", data["description"], ""]
    lines += ["HASHTAGS", " ".join(data.get("hashtags", [])), "", "KEYWORDS", ", ".join(data.get("keywords", [])), ""]
    if data.get("rationale"):
        lines += ["WHY", data["rationale"], ""]
    sp = data.get("spec") or {}
    if sp.get("checks"):
        lines += ["COPY CHECKS"] + [f"  [{'ok' if ch['ok'] else 'FAIL'}] {ch['name']}: {ch['value']} (limit {ch['limit']})" for ch in sp["checks"]]
    rs = v.get("spec") or {}
    if rs.get("checks"):
        lines += ["", "FILE CHECKS"] + [f"  [{'ok' if ch['ok'] else 'FAIL'}] {ch['name']}: {ch['value']}{ch.get('unit', '')} (limit {ch['limit']})" for ch in rs["checks"]]
    return "\n".join(l for l in lines if l is not None) + "\n"


@app.get("/api/jobs/{job_id}/export.zip")
def export_zip(job_id: str, platform: Optional[str] = Query(None)) -> Response:
    """Everything, grouped by platform. Files shared by every platform sit in universal/; a file two
    platforms share sits in a folder named after both. ?platform=tiktok builds that platform's pack only
    (its own files, plus any shared file it uses)."""
    bundle = _export_bundle(job_id)
    base = runner.job_dir_for(job_id)
    pconf = settings.load_config("platforms")
    labels = {k: v["label"] for k, v in pconf["platforms"].items()}
    if platform and platform not in labels:
        raise HTTPException(400, f"unknown platform {platform!r}")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        added: set[str] = set()

        def put(rel: Optional[str], arc: str) -> None:
            if rel and arc not in added and (base / rel).is_file():
                z.write(base / rel, arc)
                added.add(arc)

        for c in bundle["clips"]:
            nn = f"clip_{c['idx'] + 1:02d}"
            for pl, v in (c.get("variants") or {}).items():
                if platform and pl != platform:
                    continue
                if not v.get("video_path"):
                    continue
                folder = v.get("folder") or pl
                dest = pl if platform else folder          # single-platform pack: flatten into that platform's folder
                put(v["video_path"], f"{dest}/{nn}.mp4")
                put(v.get("cover_path"), f"{dest}/{nn}_cover.jpg")
                put(v.get("cover_hook_path"), f"{dest}/{nn}_cover_hook.jpg")
                put(v.get("captions_path"), f"{dest}/{nn}.srt")
                z.writestr(f"{pl}/{nn}_copy.txt", _copy_text(pl, labels.get(pl, pl), c))
            if not c.get("variants") and c.get("video_path"):
                put(c["video_path"], f"universal/{nn}.mp4"); put(c.get("cover_path"), f"universal/{nn}_cover.jpg"); put(c.get("captions_path"), f"universal/{nn}.srt")
        clips_db = db.list_clips(job_id)
        if platform:
            for c in clips_db:
                c["schedule"] = {k: v for k, v in (c.get("schedule") or {}).items() if k == platform}
        z.writestr("schedule.ics", schedule_mod.to_ics(bundle["job"], clips_db, labels))
        z.writestr("clips.json", json.dumps(bundle, indent=2))
        brief = (db.get_job(job_id) or {}).get("meta", {}).get("brief") or {}
        if brief:
            z.writestr("brief.txt", "\n".join([f"Subject: {brief.get('subject', '')}", f"Niche: {brief.get('niche_label', '')}",
                                               f"Audience: {brief.get('audience', '')}", f"Promise: {brief.get('promise', '')}",
                                               f"Tone: {brief.get('tone', '')}", f"Keywords: {', '.join(brief.get('keywords') or [])}",
                                               f"Entities: {', '.join(brief.get('entities') or [])}", "",
                                               "Trends: " + (((brief.get('trends') or {}).get('summary')) or 'no live research (no API key or web search off)'),
                                               "Sources: " + ", ".join(((brief.get('trends') or {}).get('sources')) or [])]) + "\n")
        readme = ["ClipForge export", "", "Layout: <platform>/ holds files built to that platform's spec (safe zones, encode, "
                  "loudness, size cap). universal/ holds a file that passed every selected platform's spec; a folder named "
                  "a+b holds a file shared by just those platforms. Each platform folder has clip_NN_copy.txt with the title, "
                  "caption, hashtags, keywords, posting time and the spec checks for that platform."]
        z.writestr("README.txt", "\n".join(readme) + "\n")
    buf.seek(0)
    name = f"clipforge-{job_id}" + (f"-{platform}" if platform else "")
    return Response(buf.read(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{name}.zip"'})


# ----------------------------------------------------------------------------- maintenance

@app.post("/api/cleanup")
def api_cleanup(days: Optional[float] = Query(None, ge=0), dry_run: bool = Query(False)) -> dict:
    return cleanup_mod.cleanup(days, dry_run=dry_run)


@app.exception_handler(ff.FFmpegMissing)
async def _ffmpeg_missing(_, exc: ff.FFmpegMissing) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": str(exc)})
