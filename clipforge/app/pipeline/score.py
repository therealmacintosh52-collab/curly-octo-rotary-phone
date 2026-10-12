"""Stage 4: feature extraction, heuristic scoring, optional LLM blend, and clip selection.

Every feature is in 0..1. Weights come from config/scoring.json, optionally overridden by
weights learned from feedback (stored in the DB kv table under "scoring_weights").
"""
from __future__ import annotations

import json
import logging
import math
import re
from collections import Counter
from pathlib import Path
from typing import Callable, Optional

from .. import db, settings
from . import llm as llm_mod
from .segment import energy_window

log = logging.getLogger("clipforge.score")

SCORES_JSON = "scores.json"
ProgressFn = Callable[[float, str], None]

STOPWORDS = set("""
a an the and or but so if then than that this these those there here is are was were be been being am
i me my we our you your he she it its they them their his her of to in on at by for with from as into
about over under up down out off just very really also not no yes do does did done have has had having
can could will would should may might must shall what which who whom whose when where why how all any
some more most much many few one two three get got go going went come came like know think say said see
saw thing things way well now even still back only own same other another because while after before
""".split())

CONTINUATION_STARTS = {"and", "but", "so", "or", "because", "which", "that", "then", "also", "nor", "yet"}


def _noop(_: float, __: str) -> None:
    pass


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


def _content_tokens(text: str) -> list[str]:
    return [t for t in _tokens(text) if len(t) >= 4 and "'" not in t and t not in STOPWORDS]


def top_keywords(full_text: str, n: int = 30) -> list[str]:
    counts = Counter(_content_tokens(full_text))
    return [w for w, c in counts.most_common(n) if c >= 2]


def _sat(x: float, k: float) -> float:
    """Saturating 0..1 curve: 1 - exp(-x/k)."""
    return 1.0 - math.exp(-max(0.0, x) / k)


def _count_phrases(text_l: str, phrases: list[str]) -> int:
    return sum(1 for p in phrases if p in text_l)


# ----------------------------------------------------------------------------- features

def features_for(cand: dict, *, energy: dict, scenes: list[float], keywords: list[str], cfg: dict) -> dict:
    cl = cfg["clip_length"]
    start, end = float(cand["start"]), float(cand["end"])
    dur = max(0.1, end - start)
    text = cand.get("text") or ""
    text_l = text.lower()
    toks = _tokens(text)
    n_words = cand.get("n_words") or len(toks)
    head = " ".join(toks[: max(8, len(toks) // 5)])  # opening ~20% of the clip

    f: dict[str, float] = {}
    f["audio_energy"] = energy_window(energy, start, end)
    f["speech_density"] = min(1.0, (n_words / dur) / 3.2) if n_words else 0.0

    hooks = cfg.get("hook_phrases", [])
    opening_hooks = _count_phrases(head, hooks)
    all_hooks = _count_phrases(text_l, hooks)
    f["hook_phrases"] = min(1.0, 0.6 * _sat(opening_hooks, 1.0) + 0.4 * _sat(all_hooks, 2.0))

    first_sentence = re.split(r"(?<=[.!?])\s", text.strip(), maxsplit=1)[0] if text.strip() else ""
    f["question"] = 1.0 if "?" in first_sentence else (0.5 if "?" in text else 0.0)

    emph = cfg.get("emphasis_words", [])
    n_emph = sum(1 for t in toks if t in emph) + text.count("!")
    f["emphasis"] = _sat(n_emph, 2.5)

    cuts_in = sum(1 for c in scenes if start < c < end)
    f["scene_change_density"] = min(1.0, (cuts_in / dur * 10.0) / 3.0)

    ctoks = _content_tokens(text)
    kw = set(keywords)
    f["keyword_density"] = min(1.0, (sum(1 for t in ctoks if t in kw) / len(ctoks)) / 0.35) if ctoks else 0.0

    starts_clean = bool(toks) and toks[0] not in CONTINUATION_STARTS
    ends_clean = text.strip().endswith((".", "!", "?"))
    f["self_contained"] = (0.5 if starts_clean else 0.0) + (0.5 if ends_clean else 0.0) if text else 0.3

    target = float(cl["target_seconds"])
    span = max(1.0, float(cl["max_seconds"]) - float(cl["min_seconds"]))
    f["length_fit"] = max(0.0, 1.0 - abs(dur - target) / span)

    fillers = cfg.get("filler_words", [])
    n_fill = _count_phrases(" " + text_l + " ", [f" {w} " for w in fillers]) if fillers else 0
    f["filler_penalty"] = min(0.3, (n_fill / max(1, n_words)) * 3.0) if n_words else 0.0
    return {k: round(v, 4) for k, v in f.items()}


def effective_weights(cfg: dict) -> dict:
    weights = dict(cfg["weights"])
    learned = db.kv_get("scoring_weights")
    if isinstance(learned, dict):
        for k, v in learned.items():
            if k in weights and isinstance(v, (int, float)):
                weights[k] = float(v)
    return weights


def heuristic_score(features: dict, weights: dict) -> float:
    total_w = sum(weights.values()) or 1.0
    s = sum(weights[k] * features.get(k, 0.0) for k in weights) / total_w
    s -= features.get("filler_penalty", 0.0)
    return max(0.0, min(1.0, s))


# ----------------------------------------------------------------------------- selection

def _overlap_frac(a: dict, b: dict) -> float:
    inter = max(0.0, min(a["end"], b["end"]) - max(a["start"], b["start"]))
    shorter = max(0.1, min(a["end"] - a["start"], b["end"] - b["start"]))
    return inter / shorter


def select_clips(scored: list[dict], *, max_clips: int, min_gap: float, max_overlap: float = 0.15) -> list[dict]:
    """Greedy non-maximum suppression by score."""
    picked: list[dict] = []
    for c in sorted(scored, key=lambda x: x["score"], reverse=True):
        if len(picked) >= max_clips:
            break
        ok = all(_overlap_frac(c, p) <= max_overlap and abs(c["start"] - p["start"]) >= min_gap for p in picked)
        if ok:
            picked.append(c)
    picked.sort(key=lambda x: x["start"])
    return picked


# ----------------------------------------------------------------------------- stage entry

def score_candidates(candidates: list[dict], *, analysis: dict, full_text: str, cfg: dict | None = None,
                     title: str | None = None, options: dict | None = None,
                     progress: ProgressFn = _noop, use_llm: Optional[bool] = None) -> dict:
    cfg = cfg or settings.load_config("scoring")
    options = options or {}
    weights = effective_weights(cfg)
    keywords = top_keywords(full_text)
    energy, scenes = analysis.get("energy", {}), analysis.get("scenes", [])

    progress(0.05, f"scoring {len(candidates)} candidates")
    scored: list[dict] = []
    for i, c in enumerate(candidates):
        feats = features_for(c, energy=energy, scenes=scenes, keywords=keywords, cfg=cfg)
        h = heuristic_score(feats, weights)
        scored.append({**c, "index": i, "features": feats, "heuristic": round(h, 4), "llm": None,
                       "llm_hook": None, "llm_reason": None, "score": round(h, 4)})

    # Optional LLM pass over the heuristically-strongest candidates.
    llm_cfg = cfg.get("llm", {})
    if use_llm is None:
        use_llm = settings.llm_enabled() and llm_cfg.get("enabled_when_key_present", True)
    llm_used = False
    if use_llm and scored:
        top = sorted(scored, key=lambda x: x["heuristic"], reverse=True)[: int(llm_cfg.get("max_candidates_sent", 24))]
        progress(0.5, f"asking LLM to rate {len(top)} candidates")
        ratings = llm_mod.score_candidates(top, title=title, keywords=keywords)
        if ratings:
            llm_used = True
            w = float(llm_cfg.get("blend_weight", 0.5))
            by_index = {r["index"]: r for r in ratings}
            for c in scored:
                r = by_index.get(c["index"])
                if r:
                    c["llm"] = round(r["score"], 4)
                    c["llm_hook"] = r.get("hook")
                    c["llm_reason"] = r.get("reason")
                    c["score"] = round((1 - w) * c["heuristic"] + w * c["llm"], 4)

    max_clips = int(options.get("max_clips") or cfg.get("max_clips", 8))
    selected = select_clips(scored, max_clips=max_clips, min_gap=float(cfg.get("min_gap_seconds", 5)))
    progress(1.0, f"selected {len(selected)} clips")
    return {"weights": weights, "keywords": keywords, "llm_used": llm_used,
            "n_candidates": len(scored), "selected": selected,
            "all": sorted(scored, key=lambda x: x["score"], reverse=True)[:200]}


def save_scores(job_dir: str | Path, result: dict) -> None:
    (Path(job_dir) / SCORES_JSON).write_text(json.dumps(result), encoding="utf-8")
