"""Per-platform duration fitting.

Every platform has its own hard limits and an "ideal" window its algorithm rewards. Given a
selected clip (the master cut), this module derives one variant per platform:

  master    - the clip already fits; the platform shares the master render
  trimmed   - clip too long: the best-scoring sub-window of whole sentences inside the master
              that fits the platform, preferring to keep the opening hook and land near ideal
  extended  - clip too short: neighbouring sentences are added until the minimum is met
  hard_cut  - no sentence structure to work with: cut at the last word (or second) before the cap
  too_short - the source itself can't reach the platform minimum; flagged, not rendered

Variants with identical ranges share one rendered file.
"""
from __future__ import annotations

from typing import Callable, Optional

from .. import settings

Scorer = Callable[[float, float, str, int], float]


def _covering_sentences(sentences: list[dict], start: float, end: float, eps: float = 0.6) -> list[int]:
    return [i for i, s in enumerate(sentences) if s["start"] >= start - eps and s["end"] <= end + eps]


def _range(sentences: list[dict], a: int, b: int, pad_b: float, pad_a: float, duration: float) -> tuple[float, float, str, int]:
    start = max(0.0, sentences[a]["start"] - pad_b)
    end = min(duration, sentences[b]["end"] + pad_a)
    text = " ".join(s["text"] for s in sentences[a:b + 1])
    return round(start, 3), round(end, 3), text, sum(s["n_words"] for s in sentences[a:b + 1])


def _hard_cut_end(start: float, limit: float, words: list[dict], duration: float) -> float:
    """End of the last word that finishes before start+limit (so we never cut mid-word)."""
    cap = min(duration, start + limit)
    best = None
    for w in words:
        if w["start"] >= start and w["end"] <= cap - 0.1:
            best = w["end"] + 0.25
    return round(min(cap, best) if best and best > start + 3 else cap, 3)


def _best_subwindow(sentences, i0, j0, lo, hi, ideal, *, pad_b, pad_a, duration, scorer, hook_bonus, ideal_w):
    best, best_score = None, -1.0
    for a in range(i0, j0 + 1):
        for b in range(a, j0 + 1):
            s, e, t, n = _range(sentences, a, b, pad_b, pad_a, duration)
            dur = e - s
            if dur > hi:
                break
            if dur < lo:
                continue
            sc = scorer(s, e, t, n) + (hook_bonus if a == i0 else 0.0) - ideal_w * abs(dur - ideal) / max(1.0, hi)
            if sc > best_score:
                best, best_score = (s, e, t), sc
    return best


def _extend(sentences, idx, start, end, text, lo, hi, *, pad_b, pad_a, duration):
    """Grow the window with neighbouring sentences (forward first) until it reaches lo, staying <= hi."""
    if not idx:
        return None
    a, b = idx[0], idx[-1]
    n = len(sentences)
    s, e, t = start, end, text
    while e - s < lo:
        if b + 1 < n:
            b += 1
        elif a - 1 >= 0:
            a -= 1
        else:
            return None
        s2, e2, t2, _ = _range(sentences, a, b, pad_b, pad_a, duration)
        if e2 - s2 > hi:
            return None
        s, e, t = s2, e2, t2
    return (s, e, t)


def fit_variants(start: float, end: float, text: str, *, platforms: list[str], sentences: list[dict],
                 words: list[dict], duration: float, scorer: Scorer, pconf: Optional[dict] = None,
                 scfg: Optional[dict] = None, mode: Optional[str] = None) -> dict[str, dict]:
    """One variant per platform. mode "ideal" (default) aims for each platform's ideal_range and falls
    back to its hard limits; mode "limits" only enforces min/max_duration."""
    pconf = pconf or settings.load_config("platforms")
    scfg = scfg or settings.load_config("scoring")
    d = pconf["defaults"]
    mode = mode or d.get("fit_mode", "ideal")
    hook_bonus = float(d.get("variant_hook_bonus", 0.15))
    ideal_w = float(d.get("variant_ideal_weight", 0.25))
    pad_b, pad_a = float(scfg["clip_length"].get("pad_before", 0.3)), float(scfg["clip_length"].get("pad_after", 0.4))
    master_dur = end - start
    idx = _covering_sentences(sentences, start, end)
    kw = dict(pad_b=pad_b, pad_a=pad_a, duration=duration)
    out: dict[str, dict] = {}

    for platform in platforms:
        pc = pconf["platforms"].get(platform, {})
        lo, hi = float(pc.get("min_duration", 0)), float(pc.get("max_duration", 10**6))
        ideal = float(pc.get("ideal_duration", (lo + hi) / 2))
        irange = pc.get("ideal_range")
        if mode == "ideal" and irange:
            tlo, thi = max(lo, float(irange[0])), min(hi, float(irange[1]))
        else:
            tlo, thi = lo, hi
        v: dict = {"platform": platform, "fits": True, "reason": "master", "start": round(start, 3),
                   "end": round(end, 3), "text": text, "target": [tlo, thi], "limits": [lo, hi]}

        if tlo <= master_dur <= thi:
            pass  # already in the sweet spot
        elif master_dur > thi:
            best = None
            if idx:
                i0, j0 = idx[0], idx[-1]
                best = _best_subwindow(sentences, i0, j0, tlo, thi, ideal, scorer=scorer, hook_bonus=hook_bonus, ideal_w=ideal_w, **kw)
                if best is None and (tlo, thi) != (lo, hi) and master_dur > hi:
                    best = _best_subwindow(sentences, i0, j0, lo, hi, ideal, scorer=scorer, hook_bonus=hook_bonus, ideal_w=ideal_w, **kw)
            if best:
                v.update(start=best[0], end=best[1], text=best[2], reason="trimmed")
            elif master_dur <= hi:
                v["reason"] = "master"  # over ideal but legal; nothing cleaner to cut to
            else:
                e = _hard_cut_end(start, hi, words, duration)
                v.update(end=e, text=" ".join(w["word"] for w in words if start <= w["start"] and w["end"] <= e), reason="hard_cut")
        else:  # shorter than the target window
            grown = _extend(sentences, idx, start, end, text, tlo, thi, **kw)
            if grown is None and (tlo, thi) != (lo, hi) and master_dur < lo:
                grown = _extend(sentences, idx, start, end, text, lo, hi, **kw)
            if grown:
                v.update(start=round(grown[0], 3), end=round(grown[1], 3), text=grown[2], reason="extended")
            elif master_dur >= lo:
                v["reason"] = "master"  # under ideal but legal
            else:
                s2, e2 = max(0.0, start - (lo - master_dur) / 2), min(duration, end + (lo - master_dur) / 2)
                if e2 - s2 < lo:
                    s2, e2 = max(0.0, e2 - lo), e2
                if lo <= e2 - s2 <= hi:
                    v.update(start=round(s2, 3), end=round(e2, 3),
                             text=" ".join(w["word"] for w in words if s2 <= w["start"] and w["end"] <= e2), reason="extended")
                else:
                    v.update(fits=False, reason="too_short")
        v["duration"] = round(v["end"] - v["start"], 3)
        out[platform] = v
    return out


def unique_ranges(variants: dict[str, dict], master: tuple[float, float]) -> dict[tuple[float, float], list[str]]:
    """Group platforms by (start, end) so identical variants render once. Master range is excluded."""
    groups: dict[tuple[float, float], list[str]] = {}
    for platform, v in variants.items():
        if not v.get("fits", True):
            continue
        key = (round(v["start"], 3), round(v["end"], 3))
        if key == (round(master[0], 3), round(master[1], 3)):
            continue
        groups.setdefault(key, []).append(platform)
    return groups
