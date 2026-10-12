"""Feedback loop: thumbs up/down on clips nudges the scoring weights.

Each rating stores the clip's feature vector. Re-learning runs a tiny gradient step per feature:
    w_k += lr * sum(rating * (feature_k - 0.5)) / sqrt(n)
so features that were high on liked clips (and low on disliked ones) gain weight, and consistent
evidence keeps nudging (bounded by the clamp) while noisy evidence cancels out. Weights are
clamped and renormalised to keep the same total as the config, then saved to the kv table where
score.effective_weights() picks them up for every later job.
"""
from __future__ import annotations

import math

from .. import db, settings

KV_KEY = "scoring_weights"


def record(clip_id: str, rating: int, note: str | None = None) -> dict:
    clip = db.get_clip(clip_id)
    if not clip:
        raise KeyError(clip_id)
    rating = max(-1, min(1, int(rating)))
    feats = (clip.get("score_breakdown") or {}).get("features") or {}
    fb = db.add_feedback(clip_id, clip["job_id"], rating, note, feats)
    fb["weights"] = relearn()
    return fb


def relearn(cfg: dict | None = None) -> dict:
    cfg = cfg or settings.load_config("scoring")
    base = dict(cfg["weights"])
    fcfg = cfg.get("feedback", {})
    lr = float(fcfg.get("learning_rate", 0.15))
    lo, hi = float(fcfg.get("min_weight", 0.02)), float(fcfg.get("max_weight", 0.5))
    rows = [r for r in db.list_feedback() if r["rating"] != 0 and r.get("features")]
    if not rows:
        db.kv_set(KV_KEY, base)
        return base
    new = {}
    for k, w in base.items():
        grads = [r["rating"] * (float(r["features"].get(k, 0.5)) - 0.5) for r in rows]
        g = sum(grads) / math.sqrt(len(grads))
        new[k] = max(lo, min(hi, w + lr * g))
    total_base, total_new = sum(base.values()), sum(new.values())
    if total_new > 0:
        new = {k: round(v * total_base / total_new, 4) for k, v in new.items()}
    db.kv_set(KV_KEY, new)
    return new


def current_weights(cfg: dict | None = None) -> dict:
    cfg = cfg or settings.load_config("scoring")
    learned = db.kv_get(KV_KEY)
    return {"config": cfg["weights"], "learned": learned, "n_feedback": len(db.list_feedback())}


def reset() -> dict:
    with db.connect() as c:
        c.execute("DELETE FROM kv WHERE key=?", (KV_KEY,))
    return current_weights()
