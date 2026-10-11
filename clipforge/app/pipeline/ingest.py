"""Stage 1: get the source video onto disk and normalised.

- URL      → yt-dlp download (best ≤ max_height mp4), remuxed/transcoded to source.mp4
- upload   → copied into the job dir, remuxed/transcoded to source.mp4
Then: ffprobe metadata → source.json, and a 16 kHz mono WAV for the analysis stages.
"""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Callable, Optional

from .. import settings
from . import ffmpeg_tools as ff

ProgressFn = Callable[[float, str], None]

SOURCE_MP4 = "source.mp4"
AUDIO_WAV = "audio.wav"
SOURCE_JSON = "source.json"

_URL_RE = re.compile(r"^https?://", re.I)


def _noop(_: float, __: str) -> None:
    pass


def is_url(s: str | None) -> bool:
    return bool(s and _URL_RE.match(s.strip()))


def _download(url: str, job_dir: Path, progress: ProgressFn, max_height: int) -> tuple[Path, dict]:
    import yt_dlp  # imported lazily so tests that never download don't pay for it

    out_tmpl = str(job_dir / "download.%(ext)s")
    info_holder: dict = {}

    def hook(d: dict) -> None:
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            done = d.get("downloaded_bytes") or 0
            frac = (done / total) if total else 0.0
            progress(0.05 + 0.60 * max(0.0, min(1.0, frac)), f"downloading {int(frac * 100)}%")
        elif d.get("status") == "finished":
            progress(0.68, "download finished, merging")

    ydl_opts = {
        "outtmpl": out_tmpl,
        "format": (f"bv*[height<={max_height}][ext=mp4]+ba[ext=m4a]/"
                   f"b[height<={max_height}][ext=mp4]/"
                   f"bv*[height<={max_height}]+ba/b[height<={max_height}]/b"),
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [hook],
        "retries": 3,
        "fragment_retries": 3,
        "writesubtitles": False,
        "writethumbnail": False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        info_holder = ydl.sanitize_info(info)

    # Find whatever yt-dlp produced (the merge may change the extension).
    candidates = sorted(job_dir.glob("download.*"), key=lambda p: p.stat().st_size, reverse=True)
    candidates = [c for c in candidates if c.suffix.lower() not in (".part", ".ytdl", ".json")]
    if not candidates:
        raise RuntimeError("yt-dlp finished but no media file was produced")
    meta = {
        "title": info_holder.get("title"),
        "uploader": info_holder.get("uploader") or info_holder.get("channel"),
        "webpage_url": info_holder.get("webpage_url") or url,
        "extractor": info_holder.get("extractor"),
        "upload_date": info_holder.get("upload_date"),
        "description": (info_holder.get("description") or "")[:2000],
        "tags": (info_holder.get("tags") or [])[:30],
        "duration": info_holder.get("duration"),
        "view_count": info_holder.get("view_count"),
        "thumbnail": info_holder.get("thumbnail"),
    }
    return candidates[0], meta


def _needs_transcode(info: ff.MediaInfo) -> bool:
    if not info.has_video:
        raise RuntimeError("source has no video stream")
    ok_video = info.video_codec in ("h264",)
    ok_audio = (not info.has_audio) or info.audio_codec in ("aac",)
    ok_container = "mp4" in info.container or "mov" in info.container
    return not (ok_video and ok_audio and ok_container)


def ingest(job_dir: str | Path, *, url: Optional[str] = None, upload_path: Optional[str | Path] = None,
           upload_name: Optional[str] = None, progress: ProgressFn = _noop,
           max_height: int | None = None) -> dict:
    """Run the ingest stage. Returns the contents written to source.json."""
    job_dir = Path(job_dir)
    job_dir.mkdir(parents=True, exist_ok=True)
    max_height = max_height or settings.MAX_DOWNLOAD_HEIGHT

    if url:
        if not is_url(url):
            raise ValueError(f"not a valid http(s) URL: {url!r}")
        progress(0.02, "starting download")
        raw, remote_meta = _download(url.strip(), job_dir, progress, max_height)
        source_type = "url"
    elif upload_path:
        src = Path(upload_path)
        if not src.exists():
            raise FileNotFoundError(str(src))
        raw = job_dir / ("upload" + (src.suffix.lower() or ".bin"))
        if src.resolve() != raw.resolve():
            progress(0.05, "copying upload")
            shutil.copy2(src, raw)
        remote_meta = {"title": Path(upload_name or src.name).stem, "webpage_url": None}
        source_type = "upload"
    else:
        raise ValueError("ingest needs either url or upload_path")

    progress(0.70, "probing")
    raw_info = ff.probe(raw)
    if raw_info.duration <= 0.5:
        raise RuntimeError("source is empty or too short")

    out = job_dir / SOURCE_MP4
    if _needs_transcode(raw_info) or raw_info.height > max_height:
        progress(0.72, "transcoding to h264 mp4")
        ff.transcode_to_mp4(raw, out, max_height=max_height)
        normalised = "transcode"
    else:
        progress(0.72, "remuxing")
        ff.remux_to_mp4(raw, out)
        normalised = "remux"
    if raw.resolve() != out.resolve():
        raw.unlink(missing_ok=True)

    progress(0.90, "extracting audio")
    info = ff.probe(out)
    if info.has_audio:
        ff.extract_audio_wav(out, job_dir / AUDIO_WAV)

    meta = {
        "source_type": source_type,
        "normalised": normalised,
        "title": remote_meta.get("title") or "untitled",
        "remote": remote_meta,
        "media": info.to_dict(),
        "files": {
            "video": SOURCE_MP4,
            "audio": AUDIO_WAV if info.has_audio else None,
        },
    }
    (job_dir / SOURCE_JSON).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    progress(1.0, "ingest complete")
    return meta


def load_source_meta(job_dir: str | Path) -> dict:
    return json.loads((Path(job_dir) / SOURCE_JSON).read_text(encoding="utf-8"))
