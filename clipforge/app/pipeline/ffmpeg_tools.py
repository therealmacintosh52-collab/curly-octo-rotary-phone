"""Thin subprocess wrappers around ffmpeg / ffprobe shared by every pipeline stage."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Sequence


class FFmpegMissing(RuntimeError):
    pass


class FFmpegError(RuntimeError):
    pass


def check_ffmpeg() -> dict:
    """Verify ffmpeg and ffprobe are on PATH. Raises FFmpegMissing with install hints otherwise."""
    missing = [b for b in ("ffmpeg", "ffprobe") if shutil.which(b) is None]
    if missing:
        raise FFmpegMissing(
            f"{', '.join(missing)} not found on PATH. Install ffmpeg:\n"
            "  macOS:   brew install ffmpeg\n"
            "  Ubuntu:  sudo apt install ffmpeg\n"
            "  Windows: winget install Gyan.FFmpeg   (then reopen the terminal)"
        )
    out = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, check=False).stdout
    m = re.search(r"ffmpeg version (\S+)", out)
    return {"ffmpeg": shutil.which("ffmpeg"), "ffprobe": shutil.which("ffprobe"),
            "version": m.group(1) if m else "unknown"}


def run(cmd: Sequence[str], *, timeout: int | None = None) -> subprocess.CompletedProcess:
    """Run an ffmpeg/ffprobe command, raising FFmpegError with stderr tail on failure."""
    proc = subprocess.run(list(cmd), capture_output=True, text=True, timeout=timeout, check=False)
    if proc.returncode != 0:
        tail = "\n".join(proc.stderr.strip().splitlines()[-12:])
        raise FFmpegError(f"command failed ({proc.returncode}): {' '.join(cmd[:6])} ...\n{tail}")
    return proc


@dataclass
class MediaInfo:
    path: str
    duration: float
    width: int
    height: int
    fps: float
    video_codec: str | None
    audio_codec: str | None
    audio_channels: int
    audio_sample_rate: int
    container: str
    size_bytes: int
    has_video: bool
    has_audio: bool

    def to_dict(self) -> dict:
        return asdict(self)


def _parse_fps(rate: str | None) -> float:
    if not rate or rate in ("0/0", "N/A"):
        return 0.0
    if "/" in rate:
        num, den = rate.split("/", 1)
        try:
            return float(num) / float(den) if float(den) else 0.0
        except ValueError:
            return 0.0
    try:
        return float(rate)
    except ValueError:
        return 0.0


def probe(path: str | Path) -> MediaInfo:
    p = Path(path)
    proc = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(p)])
    data = json.loads(proc.stdout or "{}")
    fmt = data.get("format", {})
    streams = data.get("streams", [])
    v = next((s for s in streams if s.get("codec_type") == "video"), None)
    a = next((s for s in streams if s.get("codec_type") == "audio"), None)
    duration = float(fmt.get("duration") or (v or {}).get("duration") or (a or {}).get("duration") or 0.0)
    return MediaInfo(
        path=str(p),
        duration=duration,
        width=int((v or {}).get("width") or 0),
        height=int((v or {}).get("height") or 0),
        fps=_parse_fps((v or {}).get("avg_frame_rate") or (v or {}).get("r_frame_rate")),
        video_codec=(v or {}).get("codec_name"),
        audio_codec=(a or {}).get("codec_name"),
        audio_channels=int((a or {}).get("channels") or 0),
        audio_sample_rate=int((a or {}).get("sample_rate") or 0),
        container=str(fmt.get("format_name", "")),
        size_bytes=int(fmt.get("size") or p.stat().st_size),
        has_video=v is not None,
        has_audio=a is not None,
    )


def extract_audio_wav(src: str | Path, dst: str | Path, sample_rate: int = 16000) -> Path:
    """Mono 16 kHz PCM WAV, the format both faster-whisper and librosa want."""
    dst = Path(dst)
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", str(sample_rate),
         "-c:a", "pcm_s16le", str(dst)])
    return dst


def transcode_to_mp4(src: str | Path, dst: str | Path, *, max_height: int = 1080, crf: int = 20) -> Path:
    """Normalise any input into an H.264/AAC MP4 so later stages only deal with one format."""
    dst = Path(dst)
    vf = f"scale=-2:'min({max_height},ih)'"
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src),
         "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf), "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dst)])
    return dst


def remux_to_mp4(src: str | Path, dst: str | Path) -> Path:
    """Stream-copy into an MP4 container (fast path when codecs are already h264/aac)."""
    dst = Path(dst)
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-c", "copy", "-movflags", "+faststart", str(dst)])
    return dst


def make_test_video(dst: str | Path, duration: float = 20.0, width: int = 1280, height: int = 720,
                    fps: int = 30, with_audio: bool = True) -> Path:
    """Generate a synthetic test clip (colour bars + tone bursts). Used by the test suite."""
    dst = Path(dst)
    cmd = ["ffmpeg", "-y", "-v", "error",
           "-f", "lavfi", "-i", f"testsrc=size={width}x{height}:rate={fps}"]
    if with_audio:
        # Alternating loud/quiet tone so audio-energy analysis has something to find.
        cmd += ["-f", "lavfi", "-i",
                f"sine=frequency=440:sample_rate=44100,volume='if(lt(mod(t,6),3),1.0,0.15)':eval=frame"]
    cmd += ["-t", f"{duration}", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"]
    if with_audio:
        cmd += ["-c:a", "aac", "-b:a", "128k", "-shortest"]
    cmd += [str(dst)]
    run(cmd)
    return dst


def make_scene_test_video(dst: str | Path, segment_seconds: float = 4.0, colors: Sequence[str] = ("red", "green", "blue"),
                          width: int = 640, height: int = 360, fps: int = 25) -> Path:
    """Synthetic clip with hard cuts between flat colours (plus a tone) for scene-detection tests."""
    dst = Path(dst)
    cmd = ["ffmpeg", "-y", "-v", "error"]
    for c in colors:
        cmd += ["-f", "lavfi", "-i", f"color=c={c}:s={width}x{height}:r={fps}:d={segment_seconds}"]
    cmd += ["-f", "lavfi", "-i", f"sine=frequency=440:sample_rate=16000:d={segment_seconds * len(colors)}"]
    n = len(colors)
    concat = "".join(f"[{i}:v]" for i in range(n)) + f"concat=n={n}:v=1:a=0[v]"
    cmd += ["-filter_complex", concat, "-map", "[v]", "-map", f"{n}:a",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(dst)]
    run(cmd)
    return dst
