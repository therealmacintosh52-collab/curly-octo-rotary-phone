"""Stage: understand the video before cutting it.

Produces brief.json: subject, niche, audience, core promise, tone, entities (names/jargon to keep
captions accurate), seed keywords, per-platform angle, and (LLM + web search) current trends for
the niche. The heuristic version uses config/niches.json; the LLM version starts from it and adds
judgement plus live research. Everything downstream (scoring, copy, subtitle polish) reads it.
"""
from __future__ import annotations

import json
import logging
import re
from collections import Counter
from pathlib import Path
from typing import Optional

from .. import settings
from . import llm as llm_mod
from .score import STOPWORDS, _content_tokens, top_keywords

log = logging.getLogger("clipforge.brief")
BRIEF_JSON = "brief.json"


def detect_niche(text: str, remote_meta: dict | None = None, niches: dict | None = None) -> tuple[str, dict, dict[str, int]]:
    """Score every niche by keyword hits in the transcript + title/description/tags."""
    niches = niches or settings.load_config("niches")
    blob = (text or "").lower()
    rm = remote_meta or {}
    extra = " ".join([str(rm.get("title") or ""), str(rm.get("description") or ""), " ".join(rm.get("tags") or [])]).lower()
    scores: dict[str, int] = {}
    for key, n in niches["niches"].items():
        hits = 0
        for kw in n["keywords"]:
            kw_l = kw.lower()
            hits += len(re.findall(r"\b" + re.escape(kw_l) + r"\b", blob))
            hits += 3 * len(re.findall(r"\b" + re.escape(kw_l) + r"\b", extra))   # metadata is a strong signal
        scores[key] = hits
    best = max(scores, key=scores.get) if scores else None
    if not best or scores[best] < 2:
        return "general", dict(niches["default"], key="general"), scores
    return best, dict(niches["niches"][best], key=best), scores


def extract_entities(words: list[dict] | None, text: str) -> list[str]:
    """Capitalised tokens that aren't sentence starts, plus ALL-CAPS acronyms: names and jargon."""
    toks = re.findall(r"[A-Za-z][A-Za-z'\-]+", text or "")
    counts: Counter = Counter()
    prev_end = True
    for t in toks:
        if (t[0].isupper() and not prev_end and t.lower() not in STOPWORDS and len(t) > 2) or (t.isupper() and len(t) >= 2):
            counts[t] += 1
        prev_end = t.endswith((".", "!", "?"))
    return [w for w, _ in counts.most_common(20)]


def heuristic_brief(text: str, *, remote_meta: dict | None = None, hint: str | None = None,
                    words: list[dict] | None = None) -> dict:
    niches = settings.load_config("niches")
    key, niche, scores = detect_niche((text or "") + " " + (hint or ""), remote_meta, niches)
    keywords = top_keywords(text or "")
    sents = re.split(r"(?<=[.!?])\s+", (text or "").strip())
    title = (remote_meta or {}).get("title") or ""
    subject = hint or title or (" ".join(keywords[:4]).title() if keywords else "this video")
    promise = next((s for s in sents if any(k in s.lower() for k in ("how to", "the secret", "the biggest", "you need", "here's"))), sents[0] if sents and sents[0] else "")
    return {
        "source": "heuristic", "subject": subject.strip()[:140], "niche": key, "niche_label": niche["label"],
        "audience": niche["audience"], "tone": niche["tone"], "promise": promise.strip()[:220],
        "entities": extract_entities(words, text), "keywords": keywords[:15],
        "hashtags": niche["hashtags"], "cta": niche["cta"], "hint": hint or None,
        "niche_scores": {k: v for k, v in sorted(scores.items(), key=lambda kv: -kv[1])[:5] if v},
        "trends": None, "platform_angles": {},
    }


def build_brief(job_dir: str | Path, *, text: str, words: list[dict] | None, remote_meta: dict | None,
                platforms: list[str], hint: str | None = None, use_llm: Optional[bool] = None,
                web_search: Optional[bool] = None) -> dict:
    brief = heuristic_brief(text, remote_meta=remote_meta, hint=hint, words=words)
    if use_llm is None:
        use_llm = settings.llm_enabled()
    if use_llm and (text or "").strip():
        trends = None
        if web_search if web_search is not None else settings.LLM_WEB_SEARCH:
            trends = llm_mod.research_trends(subject=brief["subject"], niche_label=brief["niche_label"],
                                             audience=brief["audience"], platforms=platforms)
        llm_brief = llm_mod.generate_brief(text=text, remote_meta=remote_meta or {}, seed=brief, platforms=platforms,
                                           trends=trends, hint=hint)
        if llm_brief:
            niches = settings.load_config("niches")
            key = llm_brief.get("niche") if llm_brief.get("niche") in niches["niches"] else brief["niche"]
            ncfg = niches["niches"].get(key, niches["default"])
            merged = dict(brief)
            merged.update({k: v for k, v in llm_brief.items() if v not in (None, "", [], {})})
            merged.update({"source": "llm", "niche": key, "niche_label": ncfg["label"],
                           "hashtags": (llm_brief.get("hashtags") or brief["hashtags"])[:12], "trends": trends})
            brief = merged
        elif trends:
            brief["trends"] = trends
    (Path(job_dir) / BRIEF_JSON).write_text(json.dumps(brief, ensure_ascii=False, indent=2), encoding="utf-8")
    return brief


def load_brief(job_dir: str | Path) -> Optional[dict]:
    p = Path(job_dir) / BRIEF_JSON
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
