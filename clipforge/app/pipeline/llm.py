"""Optional Anthropic API helpers. Every public function returns None on any failure so the
pipeline can fall back to heuristics. Nothing here is imported unless a key is configured.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from .. import settings

log = logging.getLogger("clipforge.llm")

_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic  # lazy: not needed when running heuristics only
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, max_retries=2, timeout=120.0)
    return _client


def _structured(system: str, user: str, schema: dict, *, max_tokens: int = 8000, effort: str = "low") -> Optional[Any]:
    """One structured-output call. Returns the parsed JSON or None."""
    import anthropic

    try:
        client = _get_client()
        resp = client.beta.messages.create(
            model=settings.LLM_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        if resp.stop_reason == "refusal":
            log.warning("LLM refused the request (%s)", getattr(resp.stop_details, "category", None))
            return None
        if resp.stop_reason == "max_tokens":
            log.warning("LLM output truncated at max_tokens")
            return None
        text = next((b.text for b in resp.content if b.type == "text"), "")
        return json.loads(text)
    except anthropic.AuthenticationError:
        log.error("Anthropic API key rejected; continuing with heuristics")
    except anthropic.RateLimitError:
        log.warning("Anthropic rate limit hit; continuing with heuristics")
    except anthropic.APIStatusError as exc:
        log.warning("Anthropic API error %s: %s", exc.status_code, exc.message)
    except anthropic.APIConnectionError as exc:
        log.warning("Anthropic connection error: %s", exc)
    except (json.JSONDecodeError, StopIteration, AttributeError) as exc:
        log.warning("LLM returned unusable output: %s", exc)
    except Exception as exc:  # noqa: BLE001
        log.warning("LLM call failed: %s", exc)
    return None


SCORE_SCHEMA = {
    "type": "object",
    "properties": {
        "ratings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "score": {"type": "integer", "minimum": 0, "maximum": 100},
                    "hook": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["index", "score", "hook", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["ratings"],
    "additionalProperties": False,
}

SCORE_SYSTEM = """You rate candidate segments from a longer video for their potential as standalone
short-form vertical clips (TikTok, Reels, Shorts). Score 0-100 on: a strong hook in the first
two seconds, a self-contained idea with a payoff, emotional or informational punch, and
quotability. Penalise segments that depend on context the viewer won't have, that trail off,
or that are filler. Be decisive: use the full 0-100 range and separate the best from the rest.
For each candidate give a 3-8 word on-screen hook line and a one-sentence reason."""


def score_candidates(candidates: list[dict], *, title: str | None = None,
                     keywords: list[str] | None = None) -> Optional[list[dict]]:
    """Rate candidates. Returns [{index, score (0..1), hook, reason}] or None."""
    if not candidates:
        return None
    lines = []
    for c in candidates:
        lines.append(f"[{c['index']}] {c['start']:.1f}s-{c['end']:.1f}s ({c['end'] - c['start']:.0f}s)\n"
                     f"{(c.get('text') or '(no speech)')[:900]}")
    user = (f"Video title: {title or 'untitled'}\n"
            f"Recurring topics: {', '.join((keywords or [])[:12]) or 'n/a'}\n\n"
            f"Rate every candidate below. Return one rating per index.\n\n" + "\n\n".join(lines))
    data = _structured(SCORE_SYSTEM, user, SCORE_SCHEMA, max_tokens=6000, effort="low")
    if not data:
        return None
    out = []
    valid = {c["index"] for c in candidates}
    for r in data.get("ratings", []):
        if r.get("index") in valid:
            out.append({"index": int(r["index"]), "score": max(0, min(100, int(r["score"]))) / 100.0,
                        "hook": (r.get("hook") or "")[:80], "reason": (r.get("reason") or "")[:300]})
    return out or None


COPY_SYSTEM = """You write platform-native copy for short vertical video clips. You receive the clip's
transcript, the overall video title, recurring topics, and per-platform limits. For each platform
return: a title (YouTube Shorts only, keyword-first, under the limit, no clickbait lies), a hook
line (3-8 words, what would be on the cover), a caption whose first line is the hook (then one or
two sentences of value, then a soft call to action; hashtags go at the end on their own line),
a hashtag list (niche before broad, without the '#'), and SEO keywords. Match each platform's
tone: TikTok casual and punchy, Instagram clean, YouTube searchable, Facebook plain and warm.
Never invent facts that aren't in the transcript."""


def _copy_schema(platforms: list[str]) -> dict:
    per = {
        "type": "object",
        "properties": {
            "title": {"type": "string"}, "hook": {"type": "string"}, "caption": {"type": "string"},
            "hashtags": {"type": "array", "items": {"type": "string"}},
            "keywords": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["title", "hook", "caption", "hashtags", "keywords"],
        "additionalProperties": False,
    }
    return {"type": "object", "properties": {p: per for p in platforms}, "required": list(platforms),
            "additionalProperties": False}


def generate_copy(clip: dict, *, platforms: list[str], platform_config: dict, keywords: list[str] | None = None,
                  video_title: str | None = None) -> Optional[dict]:
    """Per-platform copy for one clip, or None."""
    limits = []
    for p in platforms:
        c = platform_config.get(p, {})
        limits.append(f"- {p}: title max {c.get('title_max_chars') or 'n/a (no title field)'} chars, caption max "
                      f"{c.get('caption_max_chars')} chars, {c.get('hashtag_count')} hashtags, "
                      f"{c.get('keyword_count')} keywords. {c.get('notes', '')}")
    user = (f"Video title: {video_title or 'untitled'}\n"
            f"Recurring topics: {', '.join((keywords or [])[:12]) or 'n/a'}\n"
            f"Clip length: {clip['end_s'] - clip['start_s']:.0f}s\n\nPlatform limits:\n" + "\n".join(limits) +
            f"\n\nClip transcript:\n{(clip.get('transcript') or '')[:3000]}")
    data = _structured(COPY_SYSTEM, user, _copy_schema(platforms), max_tokens=4000, effort="medium")
    if not isinstance(data, dict):
        return None
    return {p: data[p] for p in platforms if isinstance(data.get(p), dict)}
