"""Per-platform specifications: build a render profile for a platform (or the strictest profile that
satisfies several), fingerprint it so identical specs share a render, and verify finished files and
copy against the platform's limits."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Optional

from .. import settings
from . import ffmpeg_tools as ff

STRICT_MIN = ("video_maxrate_mbps", "max_file_mb", "fps_max", "crf_max")
STRICT_MAX = ("fps_min",)


def profile_for(platform: str, pconf: Optional[dict] = None) -> dict:
    """defaults.render + defaults.safe_zone overridden by the platform's own entries."""
    pconf = pconf or settings.load_config("platforms")
    d = pconf["defaults"]
    pc = pconf["platforms"].get(platform, {})
    render = {**d.get("render", {}), **pc.get("render", {})}
    safe = {**d.get("safe_zone", {}), **pc.get("safe_zone", {})}
    return {"platforms": [platform], "render": render, "safe_zone": safe,
            "caption_font_size": pc.get("caption_font_size", d.get("caption_font_size", 66)),
            "min_duration": pc.get("min_duration", 0), "max_duration": pc.get("max_duration", 10**6)}


def universal_profile(platforms: list[str], pconf: Optional[dict] = None) -> dict:
    """One profile that satisfies every listed platform: the largest safe margins, the lowest caps."""
    profs = [profile_for(p, pconf) for p in platforms]
    render = dict(profs[0]["render"])
    for k in STRICT_MIN:
        vals = [pr["render"][k] for pr in profs if k in pr["render"]]
        if vals:
            render[k] = min(vals)
    for k in STRICT_MAX:
        vals = [pr["render"][k] for pr in profs if k in pr["render"]]
        if vals:
            render[k] = max(vals)
    render["fps"] = min(int(render.get("fps", 30)), int(render.get("fps_max", 60)))
    safe = {k: max(pr["safe_zone"].get(k, 0.0) for pr in profs) for k in ("top_pct", "bottom_pct", "left_pct", "right_pct")}
    return {"platforms": list(platforms), "render": render, "safe_zone": safe,
            "caption_font_size": min(pr["caption_font_size"] for pr in profs),
            "min_duration": max(pr["min_duration"] for pr in profs), "max_duration": min(pr["max_duration"] for pr in profs)}


def profile_key(profile: dict) -> str:
    """Stable fingerprint of what affects the rendered file (not the platform names)."""
    core = {"render": profile["render"], "safe_zone": profile["safe_zone"], "caption_font_size": profile["caption_font_size"]}
    return hashlib.sha1(json.dumps(core, sort_keys=True).encode()).hexdigest()[:10]


# ----------------------------------------------------------------------------- verification

def _check(name: str, ok: bool, value, limit, unit: str = "") -> dict:
    return {"name": name, "ok": bool(ok), "value": value, "limit": limit, "unit": unit}


def check_render(path: str | Path, profile: dict, *, expected_duration: float | None = None,
                 measure_loudness: bool = True) -> dict:
    """Probe a rendered file and compare it with the profile. Returns {ok, checks: [...]}."""
    r = profile["render"]
    info = ff.probe(path)
    size_mb = info.size_bytes / 1048576
    checks = [
        _check("resolution", (info.width, info.height) == (int(r["width"]), int(r["height"])),
               f"{info.width}x{info.height}", f"{r['width']}x{r['height']}"),
        _check("video codec", info.video_codec == r.get("video_codec", "h264"), info.video_codec, r.get("video_codec", "h264")),
        _check("audio codec", (not info.has_audio) or info.audio_codec == r.get("audio_codec", "aac"),
               info.audio_codec or "none", r.get("audio_codec", "aac")),
        _check("frame rate", float(r.get("fps_min", 1)) - 0.05 <= info.fps <= float(r.get("fps_max", 120)) + 0.05,
               round(info.fps, 2), f"{r.get('fps_min', 1)}-{r.get('fps_max', 120)}", "fps"),
        _check("duration", float(profile.get("min_duration", 0)) - 0.5 <= info.duration <= float(profile.get("max_duration", 10**6)) + 0.5,
               round(info.duration, 2), f"{profile.get('min_duration', 0)}-{profile.get('max_duration')}", "s"),
        _check("file size", size_mb <= float(r.get("max_file_mb", 10**6)), round(size_mb, 2), r.get("max_file_mb"), "MB"),
    ]
    if info.duration > 0:
        mbps = info.size_bytes * 8 / info.duration / 1e6
        checks.append(_check("bitrate", mbps <= float(r.get("video_maxrate_mbps", 50)) * 1.15 + 0.3, round(mbps, 2),
                             r.get("video_maxrate_mbps"), "Mbps"))
    if expected_duration is not None:
        checks.append(_check("cut length", abs(info.duration - expected_duration) <= 0.35, round(info.duration, 2),
                             round(expected_duration, 2), "s"))
    if measure_loudness and info.has_audio:
        from .render import measure_loudness as _ml
        m = _ml(path, 0.0, info.duration + 1, float(r.get("loudness_lufs", -14)), float(r.get("true_peak_dbtp", -1)))
        try:
            lufs = float(m["input_i"]) if m else None
        except (KeyError, ValueError, TypeError):
            lufs = None
        if lufs is not None and lufs > -70:
            checks.append(_check("loudness", abs(lufs - float(r.get("loudness_lufs", -14))) <= 1.5, round(lufs, 1),
                                 r.get("loudness_lufs"), "LUFS"))
    return {"ok": all(c["ok"] for c in checks), "checks": checks}


def check_copy(entry: dict, platform: str, pconf: Optional[dict] = None) -> dict:
    pconf = pconf or settings.load_config("platforms")
    pc = pconf["platforms"].get(platform, {})
    checks = []
    tmax = int(pc.get("title_max_chars") or 0)
    if tmax:
        checks.append(_check("title length", len(entry.get("title") or "") <= tmax, len(entry.get("title") or ""), tmax, "chars"))
    cmax = int(pc.get("caption_max_chars") or 0)
    cap = entry.get("caption") or ""
    if cmax:
        checks.append(_check("caption length", len(cap) <= cmax, len(cap), cmax, "chars"))
    first = int(pc.get("caption_first_line_chars") or 0)
    if first:
        line = cap.splitlines()[0] if cap else ""
        checks.append(_check("hook visible before fold", len(line) <= first, len(line), first, "chars"))
    hmax = int(pc.get("hashtag_max") or pc.get("hashtag_count") or 0)
    if hmax:
        checks.append(_check("hashtag count", len(entry.get("hashtags") or []) <= hmax, len(entry.get("hashtags") or []), hmax))
    if platform == "youtube_shorts":
        blob = ((entry.get("title") or "") + " " + cap).lower()
        checks.append(_check("#shorts tag present", "#shorts" in blob, "#shorts" in blob, True))
    return {"ok": all(c["ok"] for c in checks), "checks": checks}
