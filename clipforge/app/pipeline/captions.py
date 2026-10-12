"""Burned-in caption generation.

Words inside [start, end] are re-based to the clip's own timeline, grouped into short lines,
and written as:
  - .ass  (libass, used by ffmpeg's `subtitles` filter) with the spoken word highlighted
  - .srt  (plain line-level captions for upload to platforms that accept caption files)
"""
from __future__ import annotations

import re
from pathlib import Path

from .. import settings


def words_in_range(words: list[dict], start: float, end: float) -> list[dict]:
    """Words overlapping the window, re-based so the clip starts at 0 and clamped to its length."""
    dur = end - start
    out = []
    for w in words:
        if w["end"] <= start or w["start"] >= end:
            continue
        ws = max(0.0, w["start"] - start)
        we = min(dur, w["end"] - start)
        if we - ws < 0.04:
            we = min(dur, ws + 0.12)
        out.append({"start": round(ws, 3), "end": round(we, 3), "word": w["word"]})
    return out


def chunk_words(words: list[dict], max_words: int = 4, max_seconds: float = 2.4) -> list[list[dict]]:
    """Group words into caption lines: break on punctuation, word count, duration, or long pauses."""
    lines: list[list[dict]] = []
    cur: list[dict] = []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        span = w["end"] - cur[0]["start"]
        gap = (nxt["start"] - w["end"]) if nxt else 0.0
        if (len(cur) >= max_words or span >= max_seconds or gap > 0.9
                or w["word"].rstrip('"\')').endswith((".", "!", "?", ",", ";", ":")) or nxt is None):
            lines.append(cur)
            cur = []
    return lines


def _ts_ass(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600); m = int((t % 3600) // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _ts_srt(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600); m = int((t % 3600) // 60); s = int(t % 60); ms = int(round((t - int(t)) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _ass_colour(hex_rgb: str, alpha: str = "00") -> str:
    """'RRGGBB' → ASS '&HAABBGGRR'."""
    hex_rgb = hex_rgb.strip("#")
    r, g, b = hex_rgb[0:2], hex_rgb[2:4], hex_rgb[4:6]
    return f"&H{alpha}{b}{g}{r}".upper()


def _esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")")


def build_ass(words: list[dict], clip_duration: float, *, width: int = 1080, height: int = 1920,
              cfg: dict | None = None) -> str:
    """ASS document: one Dialogue event per spoken word, showing its whole line with that word popped."""
    d = (cfg or settings.load_config("platforms"))["defaults"]
    font = d.get("caption_font", "DejaVu Sans")
    size = int(d.get("caption_font_size", 66))
    primary = _ass_colour(d.get("caption_colour", "FFFFFF"))
    hi = d.get("caption_highlight_colour", "FFE11A")
    outline = int(d.get("caption_outline_px", 4))
    margin_v = int(height * float(d.get("caption_safe_bottom_pct", 0.22)))
    upper = bool(d.get("caption_uppercase", False))
    lines = chunk_words(words, int(d.get("caption_max_words_per_line", 4)), float(d.get("caption_max_line_seconds", 2.4)))

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{font},{size},{primary},{primary},&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,{outline},1,2,70,70,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    hi_tag = f"{{\\c{_ass_colour(hi)}\\fscx108\\fscy108}}"
    reset_tag = f"{{\\c{primary}\\fscx100\\fscy100}}"
    events = []
    for line in lines:
        for i, w in enumerate(line):
            start = w["start"]
            end = line[i + 1]["start"] if i + 1 < len(line) else min(clip_duration, w["end"] + 0.25)
            if end <= start:
                end = start + 0.1
            parts = []
            for j, x in enumerate(line):
                t = _esc(x["word"].upper() if upper else x["word"])
                parts.append(f"{hi_tag}{t}{reset_tag}" if j == i else t)
            events.append(f"Dialogue: 0,{_ts_ass(start)},{_ts_ass(end)},Cap,,0,0,0,,{' '.join(parts)}")
    return header + "\n".join(events) + ("\n" if events else "")


def build_srt(words: list[dict], cfg: dict | None = None) -> str:
    d = (cfg or settings.load_config("platforms"))["defaults"]
    lines = chunk_words(words, int(d.get("caption_max_words_per_line", 4)) + 2, 3.5)
    out = []
    for n, line in enumerate(lines, 1):
        out.append(f"{n}\n{_ts_srt(line[0]['start'])} --> {_ts_srt(line[-1]['end'])}\n"
                   f"{' '.join(w['word'] for w in line)}\n")
    return "\n".join(out)


def write_captions(job_dir: str | Path, clip_idx: int, words_all: list[dict], start: float, end: float,
                   cfg: dict | None = None, suffix: str | None = None) -> dict:
    """Write captions/clip_NN[_suffix].ass and .srt; returns relative paths and the clip's word list."""
    job_dir = Path(job_dir)
    cap_dir = job_dir / "captions"
    cap_dir.mkdir(exist_ok=True)
    words = words_in_range(words_all, start, end)
    stem = f"clip_{clip_idx + 1:02d}" + (f"_{suffix}" if suffix else "")
    ass_rel, srt_rel = f"captions/{stem}.ass", f"captions/{stem}.srt"
    (job_dir / ass_rel).write_text(build_ass(words, end - start, cfg=cfg), encoding="utf-8")
    (job_dir / srt_rel).write_text(build_srt(words, cfg=cfg), encoding="utf-8")
    return {"ass": ass_rel, "srt": srt_rel, "n_words": len(words), "words": words}
