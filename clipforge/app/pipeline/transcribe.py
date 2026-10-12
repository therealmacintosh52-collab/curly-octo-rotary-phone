"""Stage 2: transcription with word-level timestamps via faster-whisper.

Output transcript.json:
{
  "available": true, "language": "en", "language_probability": 0.98, "duration": 123.4,
  "model": "small", "text": "...",
  "segments": [{"start": 0.0, "end": 4.2, "text": "...", "words": [{"start","end","word","prob"}]}],
  "words":    [flat list of the same word dicts]
}
If the model cannot be loaded (no network on first run, bad config) the stage writes
{"available": false, "error": "..."} and the pipeline continues on audio/scene signals only.
"""
from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Callable, Optional

from .. import settings

log = logging.getLogger("clipforge.transcribe")

TRANSCRIPT_JSON = "transcript.json"
ProgressFn = Callable[[float, str], None]

_model = None
_model_key: tuple | None = None
_model_lock = threading.Lock()


def _noop(_: float, __: str) -> None:
    pass


def get_model(size: str | None = None, device: str | None = None, compute: str | None = None):
    """Load (and cache) the WhisperModel. `size` may also be a local model directory."""
    global _model, _model_key
    size = size or settings.WHISPER_MODEL
    device = device or settings.WHISPER_DEVICE
    compute = compute or settings.WHISPER_COMPUTE
    key = (size, device, compute)
    with _model_lock:
        if _model is not None and _model_key == key:
            return _model
        from faster_whisper import WhisperModel  # heavy import, keep lazy
        log.info("loading whisper model %s (%s/%s)", size, device, compute)
        t0 = time.time()
        _model = WhisperModel(size, device=device, compute_type=compute)
        _model_key = key
        log.info("whisper model ready in %.1fs", time.time() - t0)
        return _model


def transcribe(audio_path: str | Path, out_path: str | Path | None = None, *, progress: ProgressFn = _noop,
               model_size: str | None = None, language: str | None = None,
               duration_hint: float | None = None, model=None) -> dict:
    """Transcribe a 16 kHz mono WAV. `model` can be injected for tests."""
    audio_path = Path(audio_path)
    progress(0.0, "loading speech model")
    try:
        model = model or get_model(model_size)
    except Exception as exc:  # noqa: BLE001 - degrade, don't abort the job
        log.warning("whisper unavailable: %s", exc)
        result = {"available": False, "error": f"whisper model could not be loaded: {exc}"[:500],
                  "segments": [], "words": [], "text": "", "language": None}
        if out_path:
            Path(out_path).write_text(json.dumps(result), encoding="utf-8")
        return result

    progress(0.05, "transcribing")
    seg_iter, info = model.transcribe(
        str(audio_path),
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 400},
        beam_size=5,
        language=language,
        condition_on_previous_text=False,
    )
    total = duration_hint or getattr(info, "duration", None) or 0.0
    segments: list[dict] = []
    words: list[dict] = []
    for seg in seg_iter:
        seg_words = []
        for w in (seg.words or []):
            wd = {"start": round(float(w.start), 3), "end": round(float(w.end), 3),
                  "word": w.word.strip(), "prob": round(float(getattr(w, "probability", 1.0)), 3)}
            if wd["word"]:
                seg_words.append(wd)
        text = seg.text.strip()
        if not text:
            continue
        segments.append({"start": round(float(seg.start), 3), "end": round(float(seg.end), 3),
                         "text": text, "words": seg_words})
        words.extend(seg_words)
        if total:
            progress(0.05 + 0.93 * min(1.0, float(seg.end) / total), f"transcribing {int(100 * seg.end / total)}%")

    result = {
        "available": True,
        "language": getattr(info, "language", None),
        "language_probability": round(float(getattr(info, "language_probability", 0.0) or 0.0), 3),
        "duration": round(float(getattr(info, "duration", 0.0) or total), 3),
        "model": model_size or settings.WHISPER_MODEL,
        "text": " ".join(s["text"] for s in segments),
        "segments": segments,
        "words": words,
    }
    if out_path:
        Path(out_path).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    progress(1.0, f"transcribed {len(words)} words")
    return result


def load_transcript(job_dir: str | Path) -> Optional[dict]:
    p = Path(job_dir) / TRANSCRIPT_JSON
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))
