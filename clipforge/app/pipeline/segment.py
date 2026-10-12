"""Stage 3: analysis + candidate segmentation.

Produces analysis.json  {scenes: [cut times], energy: {hop: s, values: [...]}, sentences: [...]}
     and candidates.json [ {start, end, text, sentence_start, sentence_end, n_words} ... ]

Candidates are windows that begin and end on sentence boundaries (when a transcript exists)
and fall inside the configured clip-length range. Without a transcript we fall back to fixed
windows snapped to scene cuts.
"""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import Callable

import numpy as np

from .. import settings

log = logging.getLogger("clipforge.segment")

ANALYSIS_JSON = "analysis.json"
CANDIDATES_JSON = "candidates.json"
ENERGY_HOP_S = 0.1
ProgressFn = Callable[[float, str], None]


def _noop(_: float, __: str) -> None:
    pass


# ----------------------------------------------------------------------------- signals

def detect_scenes(video_path: str | Path, threshold: float = 27.0, frame_skip: int = 1) -> list[float]:
    """Return shot-cut timestamps (seconds) using PySceneDetect's ContentDetector."""
    from scenedetect import ContentDetector, SceneManager, open_video
    video = open_video(str(video_path))
    sm = SceneManager()
    sm.add_detector(ContentDetector(threshold=threshold))
    sm.detect_scenes(video, frame_skip=frame_skip, show_progress=False)
    scenes = sm.get_scene_list()
    return [round(start.seconds, 3) for start, _ in scenes[1:]]


def audio_energy(audio_path: str | Path, hop_s: float = ENERGY_HOP_S) -> dict:
    """Normalised RMS loudness curve sampled every hop_s seconds."""
    import librosa
    y, sr = librosa.load(str(audio_path), sr=16000, mono=True)
    hop = max(1, int(sr * hop_s))
    rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop)[0]
    if rms.size == 0:
        return {"hop": hop_s, "values": []}
    # Log-compress then scale to 0..1 against the 5th/98th percentiles so a single bang
    # doesn't flatten everything else.
    db = 20 * np.log10(rms + 1e-6)
    lo, hi = np.percentile(db, 5), np.percentile(db, 98)
    norm = np.clip((db - lo) / max(1e-6, hi - lo), 0.0, 1.0)
    return {"hop": hop_s, "values": [round(float(v), 4) for v in norm]}


def energy_window(energy: dict, start: float, end: float) -> float:
    vals = energy.get("values") or []
    if not vals:
        return 0.5
    hop = energy.get("hop", ENERGY_HOP_S)
    a, b = int(start / hop), max(int(start / hop) + 1, int(end / hop))
    seg = vals[a:b]
    return float(np.mean(seg)) if seg else 0.5


# ----------------------------------------------------------------------------- sentences

def build_sentences(words: list[dict], *, max_gap: float = 1.2, max_len: float = 18.0,
                    end_chars: tuple[str, ...] = (".", "!", "?")) -> list[dict]:
    """Group word dicts into sentence-like units on punctuation, long pauses, or length."""
    sentences: list[dict] = []
    cur: list[dict] = []

    def flush() -> None:
        if cur:
            sentences.append({
                "start": cur[0]["start"], "end": cur[-1]["end"],
                "text": " ".join(w["word"] for w in cur), "n_words": len(cur),
            })
            cur.clear()

    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        ends_punct = w["word"].rstrip('"\')').endswith(end_chars)
        long_gap = nxt is not None and (nxt["start"] - w["end"]) > max_gap
        too_long = (w["end"] - cur[0]["start"]) > max_len
        if ends_punct or long_gap or too_long or nxt is None:
            flush()
    return sentences


# ----------------------------------------------------------------------------- candidates

def _snap(t: float, cuts: list[float], tolerance: float) -> float:
    best = None
    for c in cuts:
        if abs(c - t) <= tolerance and (best is None or abs(c - t) < abs(best - t)):
            best = c
    return best if best is not None else t


def generate_candidates(sentences: list[dict], duration: float, scenes: list[float], cfg: dict) -> list[dict]:
    cl = cfg["clip_length"]
    min_s, max_s = float(cl["min_seconds"]), float(cl["max_seconds"])
    pad_b, pad_a = float(cl.get("pad_before", 0.3)), float(cl.get("pad_after", 0.4))
    out: list[dict] = []
    n = len(sentences)
    for i in range(n):
        for j in range(i, n):
            span = sentences[j]["end"] - sentences[i]["start"]
            if span > max_s:
                break
            if span < min_s:
                continue
            start = max(0.0, sentences[i]["start"] - pad_b)
            end = min(duration, sentences[j]["end"] + pad_a)
            # Prefer a nearby shot cut as the in/out point: it hides the seam.
            start = _snap(start, scenes, 0.6) if start > 0 else start
            end = _snap(end, scenes, 0.6) if end < duration else end
            if end - start < min_s * 0.9:
                continue
            out.append({
                "start": round(start, 3), "end": round(end, 3),
                "text": " ".join(s["text"] for s in sentences[i:j + 1]),
                "sentence_start": i, "sentence_end": j,
                "n_words": sum(s["n_words"] for s in sentences[i:j + 1]),
            })
    return out


def fallback_candidates(duration: float, scenes: list[float], cfg: dict) -> list[dict]:
    """No transcript: target-length windows on a half-step grid plus one starting at every shot cut,
    with both ends snapped to nearby cuts."""
    cl = cfg["clip_length"]
    target = float(cl["target_seconds"])
    min_s, max_s = float(cl["min_seconds"]), float(cl["max_seconds"])
    starts: list[float] = []
    t = 0.0
    while t < duration - min_s:
        starts.append(t)
        t += target / 2
    starts.extend(c for c in scenes if c < duration - min_s)
    seen: set[tuple[float, float]] = set()
    out: list[dict] = []
    for t in sorted(starts):
        start = _snap(t, scenes, 2.0)
        end = _snap(min(duration, start + target), scenes, 2.0)
        key = (round(start, 3), round(end, 3))
        if min_s <= end - start <= max_s and key not in seen:
            seen.add(key)
            out.append({"start": key[0], "end": key[1], "text": "",
                        "sentence_start": -1, "sentence_end": -1, "n_words": 0})
    return out


# ----------------------------------------------------------------------------- stage entry

def analyze(job_dir: str | Path, *, video: str = "source.mp4", audio: str | None = "audio.wav",
            transcript: dict | None = None, duration: float, progress: ProgressFn = _noop,
            cfg: dict | None = None, scene_threshold: float = 27.0) -> tuple[dict, list[dict]]:
    job_dir = Path(job_dir)
    cfg = cfg or settings.load_config("scoring")

    progress(0.02, "detecting shot changes")
    try:
        scenes = detect_scenes(job_dir / video, threshold=scene_threshold)
    except Exception as exc:  # noqa: BLE001
        log.warning("scene detection failed: %s", exc)
        scenes = []

    progress(0.55, "measuring audio energy")
    energy = {"hop": ENERGY_HOP_S, "values": []}
    if audio and (job_dir / audio).exists():
        try:
            energy = audio_energy(job_dir / audio)
        except Exception as exc:  # noqa: BLE001
            log.warning("audio energy failed: %s", exc)

    progress(0.80, "building candidate segments")
    words = (transcript or {}).get("words") or []
    sentences = build_sentences(words, end_chars=tuple(cfg.get("sentence_end_chars", [".", "!", "?"])))
    if sentences:
        candidates = generate_candidates(sentences, duration, scenes, cfg)
        mode = "transcript"
    else:
        candidates = fallback_candidates(duration, scenes, cfg)
        mode = "fallback"

    analysis = {
        "duration": duration, "mode": mode,
        "scenes": scenes, "n_scenes": len(scenes) + 1,
        "energy": energy,
        "sentences": sentences, "n_words": len(words),
        "n_candidates": len(candidates),
    }
    (job_dir / ANALYSIS_JSON).write_text(json.dumps(analysis), encoding="utf-8")
    (job_dir / CANDIDATES_JSON).write_text(json.dumps(candidates), encoding="utf-8")
    progress(1.0, f"{len(candidates)} candidates from {len(sentences)} sentences, {len(scenes)} cuts")
    return analysis, candidates


def load_analysis(job_dir: str | Path) -> dict:
    return json.loads((Path(job_dir) / ANALYSIS_JSON).read_text(encoding="utf-8"))


def load_candidates(job_dir: str | Path) -> list[dict]:
    return json.loads((Path(job_dir) / CANDIDATES_JSON).read_text(encoding="utf-8"))
