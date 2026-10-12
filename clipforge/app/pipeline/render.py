"""Stage 5: cut, reframe to 9:16, burn captions, normalise loudness, grab a cover frame.

Reframe modes (job option `reframe`, default from platforms.json → "auto"):
  auto   - Haar-cascade face detection on sampled frames; crop centred on the median face,
           falling back to a centre crop when no face is found consistently
  center - centre crop
  blur   - keep the whole frame, letterboxed over a blurred, zoomed copy of itself
"""
from __future__ import annotations

import json
import logging
import math
import re
import threading
from pathlib import Path
from typing import Callable, Optional

import numpy as np

from .. import settings
from . import ffmpeg_tools as ff

log = logging.getLogger("clipforge.render")
ProgressFn = Callable[[float, str], None]

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
_detector = None          # ("yunet", FaceDetectorYN) | ("haar", CascadeClassifier)
_detector_lock = threading.Lock()   # OpenCV detectors are not safe for concurrent use


def _noop(_: float, __: str) -> None:
    pass


# ----------------------------------------------------------------------------- face detection

def _load_detector():
    """YuNet (DNN, handles profiles and small faces) when the ONNX model is present and OpenCV
    supports it; otherwise OpenCV's Haar cascade. Cached per process."""
    global _detector
    if _detector is not None:
        return _detector
    import cv2
    yunet = ASSETS_DIR / "face_detection_yunet_2023mar.onnx"
    if yunet.exists() and hasattr(cv2, "FaceDetectorYN"):
        try:
            det = cv2.FaceDetectorYN.create(str(yunet), "", (320, 320), 0.7, 0.3, 50)
            _detector = ("yunet", det)
            return _detector
        except Exception as exc:  # noqa: BLE001
            log.warning("YuNet unavailable (%s); trying Haar cascade", exc)
    if hasattr(cv2, "CascadeClassifier"):
        candidates = []
        try:
            candidates.append(Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml")
        except Exception:  # noqa: BLE001
            pass
        candidates.append(ASSETS_DIR / "haarcascade_frontalface_default.xml")
        path = next((c for c in candidates if c.exists()), None)
        if path is not None:
            casc = cv2.CascadeClassifier(str(path))
            if not casc.empty():
                _detector = ("haar", casc)
                return _detector
    raise RuntimeError("no face detector available (need app/assets YuNet onnx or a Haar cascade)")


def detector_name() -> str | None:
    try:
        return _load_detector()[0]
    except Exception:  # noqa: BLE001
        return None


def _detect_faces_in_frame(frame_bgr) -> list[tuple[int, int, int, int]]:
    """Return face boxes (x, y, w, h) in the given frame. Split out so tests can stub it."""
    import cv2
    h, w = frame_bgr.shape[:2]
    scale = 640.0 / max(1, w)
    small = cv2.resize(frame_bgr, (int(w * scale), int(h * scale))) if scale < 1 else frame_bgr
    sh, sw = small.shape[:2]
    inv = 1.0 / scale if scale < 1 else 1.0
    with _detector_lock:
        kind, det = _load_detector()
        if kind == "yunet":
            det.setInputSize((sw, sh))
            _, faces = det.detect(small)
            if faces is None:
                return []
            return [(int(f[0] * inv), int(f[1] * inv), int(f[2] * inv), int(f[3] * inv)) for f in faces]
        gray = cv2.equalizeHist(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY))
        faces = det.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(32, 32))
        return [(int(x * inv), int(y * inv), int(fw * inv), int(fh * inv)) for (x, y, fw, fh) in faces]


def detect_face_center(video_path: str | Path, start: float, end: float, samples: int = 12) -> dict:
    """Sample frames across the clip and return the median face centre (normalised 0..1)."""
    import cv2
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return {"found": False, "cx": 0.5, "cy": 0.5, "hits": 0, "samples": 0}
    cxs, cys, hits, n = [], [], 0, 0
    try:
        for t in np.linspace(start + 0.2, max(start + 0.2, end - 0.2), samples):
            cap.set(cv2.CAP_PROP_POS_MSEC, float(t) * 1000.0)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue
            n += 1
            h, w = frame.shape[:2]
            faces = _detect_faces_in_frame(frame)
            if faces:
                x, y, fw, fh = max(faces, key=lambda b: b[2] * b[3])
                cxs.append((x + fw / 2) / w)
                cys.append((y + fh / 2) / h)
                hits += 1
    finally:
        cap.release()
    found = hits >= max(2, int(0.3 * max(1, n)))
    return {"found": found, "cx": float(np.median(cxs)) if found else 0.5,
            "cy": float(np.median(cys)) if found else 0.5, "hits": hits, "samples": n}


# ----------------------------------------------------------------------------- filters

def crop_filter(src_w: int, src_h: int, cx: float = 0.5, *, mode: str = "crop",
                out_w: int = 1080, out_h: int = 1920) -> str:
    """ffmpeg -vf fragment that turns the source into out_w x out_h (9:16)."""
    target = out_w / out_h
    if mode == "blur":
        return (f"split[bg][fg];"
                f"[bg]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,crop={out_w}:{out_h},"
                f"boxblur=luma_radius=28:luma_power=2:chroma_radius=14:chroma_power=2[bgb];"
                f"[fg]scale={out_w}:-2:flags=lanczos[fgs];"
                f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2,format=yuv420p")
    if src_w / src_h > target:  # wider than 9:16 → crop sides around cx
        crop_w = int(round(src_h * target)) // 2 * 2
        x = int(round(cx * src_w - crop_w / 2))
        x = max(0, min(src_w - crop_w, x))
        return f"crop={crop_w}:{src_h}:{x}:0,scale={out_w}:{out_h}:flags=lanczos,format=yuv420p"
    # already tall (or exactly 9:16): scale to width, crop/pad vertically around centre
    return (f"scale={out_w}:-2:flags=lanczos,"
            f"crop={out_w}:'min(ih,{out_h})':0:'(ih-min(ih,{out_h}))/2',"
            f"pad={out_w}:{out_h}:0:(oh-ih)/2:color=black,format=yuv420p")


# ----------------------------------------------------------------------------- loudness

_JSON_RE = re.compile(r"\{[^{}]*\}", re.S)


def measure_loudness(src: str | Path, start: float, dur: float, target_i: float, target_tp: float,
                     cwd: str | Path | None = None) -> Optional[dict]:
    """First loudnorm pass: returns measured values for the accurate linear second pass."""
    import subprocess
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-ss", f"{start:.3f}", "-i", str(src), "-t", f"{dur:.3f}", "-vn",
           "-af", f"loudnorm=I={target_i}:TP={target_tp}:LRA=11:print_format=json", "-f", "null", "-"]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=cwd, check=False)
    blocks = _JSON_RE.findall(proc.stderr or "")
    for b in reversed(blocks):
        try:
            data = json.loads(b)
            if "input_i" in data:
                return data
        except json.JSONDecodeError:
            continue
    return None


def loudnorm_filter(measured: Optional[dict], target_i: float, target_tp: float) -> str:
    base = f"loudnorm=I={target_i}:TP={target_tp}:LRA=11"
    if not measured:
        return base
    try:
        vals = {k: float(measured[k]) for k in ("input_i", "input_tp", "input_lra", "input_thresh")}
        vals["offset"] = float(measured.get("target_offset", 0.0))
    except (KeyError, ValueError, TypeError):
        return base
    if not all(math.isfinite(v) for v in vals.values()):
        return base  # digitally silent audio measures as -inf; single-pass handles it without blowing up
    return (f"{base}:measured_I={vals['input_i']:.2f}:measured_TP={vals['input_tp']:.2f}"
            f":measured_LRA={vals['input_lra']:.2f}:measured_thresh={vals['input_thresh']:.2f}"
            f":offset={vals['offset']:.2f}:linear=true")


# ----------------------------------------------------------------------------- render

def render_clip(job_dir: str | Path, *, idx: int, start: float, end: float, src_media: dict,
                captions_ass: Optional[str], reframe: str = "auto", cfg: dict | None = None,
                progress: ProgressFn = _noop, source: str = "source.mp4") -> dict:
    """Render clips/clip_NN.mp4 (+ cover jpg). Paths returned are relative to job_dir."""
    job_dir = Path(job_dir)
    d = (cfg or settings.load_config("platforms"))["defaults"]
    out_w, out_h, fps = int(d["width"]), int(d["height"]), int(d["fps"])
    dur = end - start
    stem = f"clip_{idx + 1:02d}"
    (job_dir / "clips").mkdir(exist_ok=True)
    out_rel, cover_rel = f"clips/{stem}.mp4", f"clips/{stem}_cover.jpg"
    src_w, src_h = int(src_media["width"]), int(src_media["height"])
    has_audio = bool(src_media.get("has_audio"))

    # 1. reframe decision
    progress(0.02, f"clip {idx + 1}: framing")
    face = {"found": False, "cx": 0.5, "cy": 0.5, "hits": 0, "samples": 0}
    mode = "crop"
    if reframe == "blur":
        mode = "blur"
    elif reframe == "auto" and src_w / src_h > out_w / out_h:
        try:
            face = detect_face_center(job_dir / source, start, end)
        except Exception as exc:  # noqa: BLE001
            log.warning("face detection failed, using centre crop: %s", exc)
    cx = face["cx"] if face["found"] else 0.5
    vf = crop_filter(src_w, src_h, cx, mode=mode, out_w=out_w, out_h=out_h)
    if captions_ass:
        vf += f",subtitles={captions_ass}"  # relative path, ffmpeg runs with cwd=job_dir

    # 2. loudness (two-pass)
    af = None
    if has_audio:
        progress(0.08, f"clip {idx + 1}: measuring loudness")
        measured = measure_loudness(source, start, dur, float(d["loudness_lufs"]), float(d["true_peak_dbtp"]), cwd=job_dir)
        af = loudnorm_filter(measured, float(d["loudness_lufs"]), float(d["true_peak_dbtp"]))

    # 3. encode
    cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-i", source, "-t", f"{dur:.3f}",
           "-vf", vf, "-r", str(fps), "-c:v", "libx264", "-preset", str(d.get("render_preset", "veryfast")),
           "-crf", str(d.get("render_crf", 20)), "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
    if has_audio:
        cmd += ["-af", af, "-c:a", "aac", "-b:a", str(d.get("audio_bitrate", "192k")), "-ar", "48000"]
    else:
        cmd += ["-an"]
    cmd += [out_rel]
    progress(0.12, f"clip {idx + 1}: encoding")
    ff.run_with_progress(cmd, total_seconds=dur, cwd=job_dir,
                         on_progress=lambda f: progress(0.12 + 0.80 * f, f"clip {idx + 1}: encoding {int(f * 100)}%"))

    # 4. cover frame from the rendered clip
    progress(0.94, f"clip {idx + 1}: cover frame")
    cover_t = min(max(0.0, dur * float(d.get("cover_time_pct", 0.15))), max(0.0, dur - 0.1))
    ff.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{cover_t:.3f}", "-i", out_rel, "-frames:v", "1", "-q:v", "2", cover_rel],
           cwd=job_dir)
    info = ff.probe(job_dir / out_rel)
    progress(1.0, f"clip {idx + 1}: done")
    return {"video_path": out_rel, "cover_path": cover_rel, "duration": info.duration,
            "width": info.width, "height": info.height,
            "reframe": {"mode": mode, "requested": reframe, "face": face, "cx": cx}, "loudnorm": af}
