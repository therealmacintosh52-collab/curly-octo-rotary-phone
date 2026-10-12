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


def _text_with_search(system: str, user: str, *, max_uses: int = 4, max_tokens: int = 6000, effort: str = "medium",
                      max_continuations: int = 4) -> Optional[dict]:
    """A plain-text answer where the model may run server-side web searches first.
    Returns {"text": str, "sources": [urls]} or None."""
    import anthropic

    tools = [{"type": "web_search_20260209", "name": "web_search", "max_uses": max_uses}]
    messages: list[dict] = [{"role": "user", "content": user}]
    try:
        client = _get_client()
        resp = None
        for _ in range(max_continuations + 1):
            resp = client.beta.messages.create(
                model=settings.LLM_MODEL, max_tokens=max_tokens, system=system, messages=messages, tools=tools,
                output_config={"effort": effort}, betas=["server-side-fallback-2026-07-01"], fallbacks="default",
            )
            if resp.stop_reason != "pause_turn":
                break
            messages = [{"role": "user", "content": user}, {"role": "assistant", "content": resp.content}]
        if resp is None or resp.stop_reason == "refusal":
            return None
        text_parts, sources = [], []
        for b in resp.content:
            if b.type == "text":
                text_parts.append(b.text)
            elif b.type == "web_search_tool_result":
                content = getattr(b, "content", None)
                if isinstance(content, list):
                    for r in content:
                        url = getattr(r, "url", None)
                        if url and url not in sources:
                            sources.append(url)
        text = "".join(text_parts).strip()
        return {"text": text, "sources": sources[:12]} if text else None
    except anthropic.APIStatusError as exc:
        log.warning("web-search call failed %s: %s", exc.status_code, exc.message)
    except Exception as exc:  # noqa: BLE001
        log.warning("web-search call failed: %s", exc)
    return None


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

def _brief_block(brief: dict | None) -> str:
    if not brief:
        return ""
    lines = [f"Subject: {brief.get('subject', '')}", f"Niche: {brief.get('niche_label', brief.get('niche', ''))}",
             f"Ideal audience: {brief.get('audience', '')}", f"Core promise: {brief.get('promise', '')}",
             f"Tone: {brief.get('tone', '')}"]
    if brief.get("entities"):
        lines.append("Names/jargon to spell correctly: " + ", ".join(brief["entities"][:15]))
    if brief.get("keywords"):
        lines.append("Search keywords: " + ", ".join(brief["keywords"][:12]))
    tr = brief.get("trends") or {}
    if tr.get("summary"):
        lines.append(f"Current trends for this niche (checked {tr.get('checked_at', 'recently')}): {tr['summary'][:1200]}")
    if tr.get("hashtags"):
        lines.append("Currently active hashtags: " + ", ".join(tr["hashtags"][:12]))
    return "\n".join(lines)


SCORE_SYSTEM = """You rate candidate segments from a longer video for their potential as standalone
short-form vertical clips (TikTok, Reels, Shorts). Score 0-100 on: a strong hook in the first
two seconds, a self-contained idea with a payoff, emotional or informational punch, and
quotability. Penalise segments that depend on context the viewer won't have, that trail off,
or that are filler. Be decisive: use the full 0-100 range and separate the best from the rest.
For each candidate give a 3-8 word on-screen hook line and a one-sentence reason."""


def score_candidates(candidates: list[dict], *, title: str | None = None,
                     keywords: list[str] | None = None, brief: dict | None = None) -> Optional[list[dict]]:
    """Rate candidates for the brief's audience. Returns [{index, score (0..1), hook, reason}] or None."""
    if not candidates:
        return None
    lines = []
    for c in candidates:
        lines.append(f"[{c['index']}] {c['start']:.1f}s-{c['end']:.1f}s ({c['end'] - c['start']:.0f}s)\n"
                     f"{(c.get('text') or '(no speech)')[:900]}")
    user = (f"Video title: {title or 'untitled'}\n"
            f"Recurring topics: {', '.join((keywords or [])[:12]) or 'n/a'}\n"
            + (("\nVideo brief:\n" + _brief_block(brief) + "\n") if brief else "")
            + "\nRate every candidate below for THIS audience. Return one rating per index.\n\n" + "\n\n".join(lines))
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


COPY_SYSTEM = """You write platform-native copy for short vertical video clips, aimed at a specific audience,
built to earn the signals each platform's recommendation system rewards (completion, rewatch,
shares/sends, saves, comments). You receive: a brief about the whole video (subject, niche, ideal
audience, promise, names/jargon, search keywords, current trends with a checked date), a per-platform
playbook of what works right now, the clip's own transcript, and the platform limits.

For each platform return:
- title: keyword-first, specific, under the limit, pays off in the clip (YouTube only; empty elsewhere)
- title_options: 3 alternative titles/hook lines worth A/B testing (strings)
- hook: 3-8 words for the cover frame and the first caption line
- caption: first line is the hook and fits before the fold limit; then 1-2 lines of value written
  for the ideal audience; then one CTA tied to a ranking signal; hashtags on the last line
- description: 2-4 lines for YouTube's description box (keywords + a question); empty elsewhere
- hashtags: 1 broad + 2-3 exact-niche + at most 1 current/trending from the brief, no '#', within the limit
- keywords: search terms this clip should rank for
- rationale: one sentence on why this copy fits the audience and the platform right now

Match each platform's voice (TikTok casual and searchable, Instagram clean and send-worthy, YouTube
searchable, Facebook plain and share-worthy). Spell names and jargon exactly as the brief gives them.
Never invent facts, trends or audio references that aren't in the transcript or brief."""


def _copy_schema(platforms: list[str]) -> dict:
    per = {
        "type": "object",
        "properties": {
            "title": {"type": "string"}, "title_options": {"type": "array", "items": {"type": "string"}},
            "hook": {"type": "string"}, "caption": {"type": "string"}, "description": {"type": "string"},
            "hashtags": {"type": "array", "items": {"type": "string"}},
            "keywords": {"type": "array", "items": {"type": "string"}},
            "rationale": {"type": "string"},
        },
        "required": ["title", "title_options", "hook", "caption", "description", "hashtags", "keywords", "rationale"],
        "additionalProperties": False,
    }
    return {"type": "object", "properties": {p: per for p in platforms}, "required": list(platforms),
            "additionalProperties": False}


def generate_copy(clip: dict, *, platforms: list[str], platform_config: dict, keywords: list[str] | None = None,
                  video_title: str | None = None, brief: dict | None = None, playbook: dict | None = None,
                  clip_texts: dict | None = None) -> Optional[dict]:
    """Per-platform copy for one clip, or None. clip_texts maps platform → that platform's cut transcript."""
    limits = []
    pb = playbook or {}
    for p in platforms:
        c = platform_config.get(p, {})
        ppb = (pb.get("platforms") or {}).get(p, {})
        limits.append(f"- {p}: title max {c.get('title_max_chars') or 'n/a (no title field)'} chars, caption max "
                      f"{c.get('caption_max_chars')} chars, first caption line visible up to {c.get('caption_first_line_chars', 125)} chars, "
                      f"{c.get('hashtag_max', c.get('hashtag_count'))} hashtags max, {c.get('keyword_count')} keywords. "
                      f"{c.get('notes', '')} Playbook: {ppb.get('notes', '')} Hashtags: {ppb.get('hashtags', '')}. CTA: {ppb.get('cta', '')}")
    general = pb.get("general") or {}
    pb_text = ""
    if general:
        pb_text = (f"\nWhat ranks right now (playbook as of {pb.get('as_of', 'n/a')}): " + "; ".join(general.get("ranking_signals", [])) +
                   "\nHook formulas: " + " | ".join(general.get("hook_formulas", [])) +
                   "\nAvoid: " + "; ".join(general.get("avoid", [])))
    texts = ""
    if clip_texts:
        diff = {p: t for p, t in clip_texts.items() if t and t != (clip.get("transcript") or "")}
        if diff:
            texts = "\n\nPlatform-specific cuts say (write that platform's copy for this):\n" + "\n".join(f"- {p}: {t[:1200]}" for p, t in diff.items())
    user = (f"Video title: {video_title or 'untitled'}\n"
            f"Recurring topics: {', '.join((keywords or [])[:12]) or 'n/a'}\n"
            + (("\nVideo brief:\n" + _brief_block(brief) + "\n") if brief else "")
            + pb_text +
            f"\n\nClip length: {clip['end_s'] - clip['start_s']:.0f}s\n\nPlatform limits and playbook:\n" + "\n".join(limits) +
            f"\n\nClip transcript:\n{(clip.get('transcript') or '')[:3000]}" + texts)
    data = _structured(COPY_SYSTEM, user, _copy_schema(platforms), max_tokens=6000, effort="medium")
    if not isinstance(data, dict):
        return None
    return {p: data[p] for p in platforms if isinstance(data.get(p), dict)}


# ----------------------------------------------------------------------------- brief, research, subtitle polish

RESEARCH_SYSTEM = """You are a short-form video strategist doing quick, current research. Use web search to find
what is working RIGHT NOW (this month) for the given niche and audience on the listed platforms:
active hashtags, phrasings and formats people are searching for, recurring hook styles, and any
platform changes creators are talking about. Prefer sources from the last 60 days. Be concrete and
short. Finish with a line 'HASHTAGS: tag1, tag2, ...' (no '#', 6-12 tags) and a line
'PHRASES: phrase1; phrase2; ...' (3-8 searchable phrases). Do not invent trends you did not find."""


def research_trends(*, subject: str, niche_label: str, audience: str, platforms: list[str]) -> Optional[dict]:
    """Live research for the niche. Returns {summary, hashtags, phrases, sources, checked_at} or None."""
    import datetime as _dt
    user = (f"Subject of the video: {subject}\nNiche: {niche_label}\nIdeal audience: {audience}\n"
            f"Platforms: {', '.join(platforms)}\nToday: {_dt.date.today().isoformat()}\n\n"
            "Research what is current for this niche on these platforms and summarise in under 250 words.")
    res = _text_with_search(RESEARCH_SYSTEM, user, max_uses=4, effort="medium")
    if not res:
        return None
    text = res["text"]
    tags, phrases = [], []
    for line in text.splitlines():
        up = line.strip().upper()
        if up.startswith("HASHTAGS:"):
            tags = [t.strip().lstrip("#").lower() for t in line.split(":", 1)[1].split(",") if t.strip()]
        elif up.startswith("PHRASES:"):
            phrases = [t.strip() for t in line.split(":", 1)[1].split(";") if t.strip()]
    summary = "\n".join(l for l in text.splitlines() if not l.strip().upper().startswith(("HASHTAGS:", "PHRASES:"))).strip()
    return {"summary": summary[:2500], "hashtags": tags[:12], "phrases": phrases[:8], "sources": res["sources"],
            "checked_at": _dt.date.today().isoformat()}


BRIEF_SYSTEM = """You analyse a video transcript (plus any metadata and research notes) and produce a brief that
everything downstream will rely on: what the video is really about, which niche it belongs to, who
the ideal viewer is (specific, not 'everyone'), the single core promise, the tone, the names and
jargon that must be spelled correctly in captions, the search keywords, and a one-line angle per
platform. Only state what the transcript supports."""


def _brief_schema(platforms: list[str], niche_keys: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {
            "subject": {"type": "string"},
            "niche": {"type": "string", "enum": niche_keys},
            "audience": {"type": "string"},
            "promise": {"type": "string"},
            "tone": {"type": "string"},
            "entities": {"type": "array", "items": {"type": "string"}},
            "keywords": {"type": "array", "items": {"type": "string"}},
            "hashtags": {"type": "array", "items": {"type": "string"}},
            "platform_angles": {"type": "object", "properties": {p: {"type": "string"} for p in platforms},
                                "required": list(platforms), "additionalProperties": False},
        },
        "required": ["subject", "niche", "audience", "promise", "tone", "entities", "keywords", "hashtags", "platform_angles"],
        "additionalProperties": False,
    }


def generate_brief(*, text: str, remote_meta: dict, seed: dict, platforms: list[str], trends: dict | None = None,
                   hint: str | None = None) -> Optional[dict]:
    niches = settings.load_config("niches")["niches"]
    keys = list(niches)
    niche_lines = "\n".join(f"- {k}: {v['label']}" for k, v in niches.items())
    user = (f"Known metadata: title={remote_meta.get('title') or 'n/a'}; uploader={remote_meta.get('uploader') or 'n/a'}; "
            f"tags={', '.join((remote_meta.get('tags') or [])[:15]) or 'n/a'}\n"
            f"Description (first 600 chars): {(remote_meta.get('description') or '')[:600]}\n"
            + (f"The creator says the video is about: {hint}\n" if hint else "")
            + f"Heuristic guess: niche={seed.get('niche')}, keywords={', '.join(seed.get('keywords', [])[:12])}\n"
            + (f"Research notes (checked {trends.get('checked_at')}): {trends.get('summary', '')[:1500]}\n" if trends else "")
            + f"\nNiche keys you may choose from:\n{niche_lines}\n\nTranscript (may be truncated):\n{(text or '')[:60000]}")
    data = _structured(BRIEF_SYSTEM, user, _brief_schema(platforms, keys), max_tokens=3000, effort="medium")
    if not isinstance(data, dict):
        return None
    data["hashtags"] = [t.lstrip("#").lower() for t in data.get("hashtags") or [] if t.strip()]
    return data


POLISH_SYSTEM = """You correct automatic speech-recognition transcripts. You get numbered words from a video plus a
brief with the correct spelling of names and jargon. Fix misheard words, names, brand names, numbers
and obvious ASR errors so the burned-in captions read correctly. Keep the SAME number of items in the
SAME order; change only the words that are wrong; keep punctuation attached as it was. Never add,
drop, merge or split words."""


def polish_words(words: list[dict], *, brief: dict | None, chunk: int = 160) -> Optional[list[dict]]:
    """Return corrected copies of the word dicts (timings untouched) or None if the model's output
    cannot be validated. Only `word` text changes."""
    if not words:
        return None
    out = [dict(w) for w in words]
    changed = 0
    schema = {"type": "object", "properties": {"words": {"type": "array", "items": {"type": "string"}}},
              "required": ["words"], "additionalProperties": False}
    for start in range(0, len(words), chunk):
        part = words[start:start + chunk]
        numbered = "\n".join(f"{i}: {w['word']}" for i, w in enumerate(part))
        user = (("Brief:\n" + _brief_block(brief) + "\n\n") if brief else "") + \
               f"Return exactly {len(part)} words in order.\n\n{numbered}"
        data = _structured(POLISH_SYSTEM, user, schema, max_tokens=4000, effort="low")
        fixed = (data or {}).get("words") if isinstance(data, dict) else None
        if not isinstance(fixed, list) or len(fixed) != len(part):
            log.warning("subtitle polish chunk %d rejected (got %s items, wanted %d)", start, len(fixed) if isinstance(fixed, list) else "none", len(part))
            continue
        for i, new in enumerate(fixed):
            new = str(new).strip()
            if new and " " not in new and new != part[i]["word"]:
                out[start + i]["word"] = new
                changed += 1
    log.info("subtitle polish changed %d of %d words", changed, len(words))
    return out if changed else None
