"""Stage 6: per-platform titles, captions, hashtags, keywords.

Heuristic generator always runs; when an Anthropic key is present the LLM version is tried first
and the heuristic output is kept as the fallback. Output per clip:
{
  "<platform>": {"title": str, "caption": str, "hashtags": [..], "keywords": [..],
                 "hook": str, "fits": bool, "fit_note": str|None, "source": "llm"|"heuristic"}
}
"""
from __future__ import annotations

import logging
import re
from collections import Counter
from typing import Optional

from .. import settings
from . import llm as llm_mod
from . import spec as spec_mod
from .score import STOPWORDS, _content_tokens

log = logging.getLogger("clipforge.copy")

PLATFORM_TAGS = {
    "youtube_shorts": ["shorts"],
    "instagram_reels": ["reels"],
    "tiktok": ["fyp"],
    "facebook_reels": ["reels"],
}
CTA = {
    "youtube_shorts": "Subscribe for more.",
    "instagram_reels": "Save this for later.",
    "tiktok": "Follow for part two.",
    "facebook_reels": "Share this with someone who needs it.",
}


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", (text or "").strip())
    return [p.strip() for p in parts if p.strip()]


def _clean_title(s: str, limit: int) -> str:
    s = re.sub(r"\s+", " ", s).strip().strip('"')
    s = re.sub(r"^(um|uh|so|and|but|okay|ok|well|like|you know),?\s+", "", s, flags=re.I)
    if s:
        s = s[0].upper() + s[1:]
    if len(s) > limit:
        cut = s[:limit - 1].rsplit(" ", 1)[0]
        s = cut.rstrip(",;:- ") + "…"
    return s.rstrip(".")


def _hashtag(word: str) -> str:
    return "#" + re.sub(r"[^a-z0-9]", "", word.lower())


def hashtags_for(keywords: list[str], platform: str, n: int) -> list[str]:
    tags: list[str] = []
    for k in keywords:
        t = _hashtag(k)
        if len(t) > 3 and t not in tags:
            tags.append(t)
        if len(tags) >= max(0, n - 1):
            break
    for extra in PLATFORM_TAGS.get(platform, []):
        if len(tags) < n:
            tags.append("#" + extra)
    return tags[:n]


def heuristic_copy(clip: dict, *, platform: str, pcfg: dict, keywords: list[str],
                   video_title: str | None = None) -> dict:
    text = clip.get("transcript") or ""
    sents = _sentences(text)
    hook_src = (clip.get("score_breakdown") or {}).get("llm_hook") or (sents[0] if sents else (video_title or "Watch this"))
    title_limit = int(pcfg.get("title_max_chars") or 70) or 70
    title = _clean_title(hook_src, min(title_limit, 70))
    hook_line = _clean_title(hook_src, 60)

    # Caption: hook, a short summary from the middle, a CTA, then hashtags.
    body = ""
    if len(sents) >= 2:
        mid = sents[1:3]
        body = " ".join(mid)
        if len(body) > 220:
            body = body[:220].rsplit(" ", 1)[0] + "…"
    # Keyword order: words this clip actually says (by in-clip frequency, then global rank), then
    # the video's recurring topics. Hashtags prefer 5+ letter words so "four"/"next" don't become tags.
    clip_counts = Counter(t for t in _content_tokens(text) if t not in STOPWORDS)
    rank = {k: i for i, k in enumerate(keywords)}
    clip_kw = sorted(clip_counts, key=lambda k: (-clip_counts[k], rank.get(k, 10**6), k))
    seen: list[str] = []
    for k in clip_kw + list(keywords):
        if k not in seen and len(k) >= 4:
            seen.append(k)
    order = {k: i for i, k in enumerate(seen)}
    seen.sort(key=lambda k: (len(k) < 5, order[k]))
    kw_count = int(pcfg.get("keyword_count", 6))
    tags = hashtags_for(seen, platform, int(pcfg.get("hashtag_count", 4)))
    parts = [hook_line + ("" if hook_line.endswith(("!", "?", ".", "…")) else ".")]
    if body:
        parts.append(body)
    parts.append(CTA.get(platform, ""))
    caption = "\n\n".join(p for p in parts if p).strip()
    if tags:
        caption += "\n\n" + " ".join(tags)
    cap_limit = int(pcfg.get("caption_max_chars") or 2200)
    if len(caption) > cap_limit:
        caption = caption[:cap_limit - 1].rstrip() + "…"
    if platform == "youtube_shorts" and "#shorts" not in title.lower() and len(title) + 8 <= title_limit:
        title = f"{title} #Shorts"
    return {"title": title if pcfg.get("title_max_chars", 0) else hook_line, "hook": hook_line,
            "caption": caption, "hashtags": tags, "keywords": seen[:kw_count], "source": "heuristic"}


def fit_check(duration: float, pcfg: dict) -> tuple[bool, Optional[str]]:
    lo, hi = float(pcfg.get("min_duration", 0)), float(pcfg.get("max_duration", 10**6))
    if duration > hi:
        return False, f"{duration:.0f}s exceeds the {hi:.0f}s limit; trim before posting"
    if duration < lo:
        return False, f"{duration:.0f}s is under the {lo:.0f}s minimum"
    return True, None


def generate_copy(clip: dict, *, platforms: list[str], keywords: list[str], video_title: str | None = None,
                  use_llm: Optional[bool] = None, pconf: dict | None = None) -> dict:
    pconf = pconf or settings.load_config("platforms")
    out: dict = {}
    variants = clip.get("variants") or {}
    for p in platforms:
        pcfg = pconf["platforms"].get(p, {})
        v = variants.get(p)
        pclip = dict(clip)
        if v and v.get("fits", True) and v.get("text"):
            pclip["transcript"] = v["text"]  # write copy for what this platform's cut actually says
        out[p] = heuristic_copy(pclip, platform=p, pcfg=pcfg, keywords=keywords, video_title=video_title)
        dur = float(v["duration"]) if v else clip["end_s"] - clip["start_s"]
        fits, note = fit_check(dur, pcfg)
        if v and not v.get("fits", True):
            fits, note = False, f"source too short for this platform's {pcfg.get('min_duration', 0)}s minimum"
        out[p].update({"fits": fits, "fit_note": note, "duration": round(dur, 3), "cut": (v or {}).get("reason", "master")})

    if use_llm is None:
        use_llm = settings.llm_enabled()
    if use_llm and (clip.get("transcript") or "").strip():
        llm_out = llm_mod.generate_copy(clip, platforms=platforms, platform_config=pconf["platforms"],
                                        keywords=keywords, video_title=video_title)
        if llm_out:
            for p, data in llm_out.items():
                if p in out:
                    pcfg = pconf["platforms"].get(p, {})
                    title_limit = int(pcfg.get("title_max_chars") or 70)
                    merged = dict(out[p])
                    merged.update({
                        "title": _clean_title(data.get("title") or merged["title"], title_limit),
                        "hook": _clean_title(data.get("hook") or merged["hook"], 60),
                        "caption": (data.get("caption") or merged["caption"])[: int(pcfg.get("caption_max_chars") or 2200)],
                        "hashtags": [t if t.startswith("#") else "#" + t for t in (data.get("hashtags") or merged["hashtags"])][: int(pcfg.get("hashtag_count", 4)) + 1],
                        "keywords": (data.get("keywords") or merged["keywords"])[: int(pcfg.get("keyword_count", 6))],
                        "source": "llm",
                    })
                    out[p] = merged
    for p in platforms:
        check = spec_mod.check_copy(out[p], p, pconf)
        out[p]["spec"] = check
        if not check["ok"]:
            out[p]["fits"] = False
            out[p]["fit_note"] = "; ".join(f"{c['name']} {c['value']} > {c['limit']}" for c in check["checks"] if not c["ok"]) or out[p].get("fit_note")
    return out
