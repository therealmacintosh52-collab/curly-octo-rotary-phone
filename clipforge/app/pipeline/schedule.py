"""Stage 7: posting schedule.

Clips are ranked by score and dealt into each platform's best posting windows starting
`start_day_offset` days from now, honouring per-day caps, minimum spacing on a platform,
and a stagger between platforms so the same clip doesn't go live everywhere at once.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .. import settings

log = logging.getLogger("clipforge.schedule")


def resolve_tz(name: str | None):
    """IANA zone → tzinfo, falling back to UTC (e.g. Windows without the tzdata package)."""
    try:
        return ZoneInfo(name or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        log.warning("timezone %r not found (install the tzdata package); scheduling in UTC", name)
        return timezone.utc

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _slots_for(platform: str, cfg: dict, tz, now: datetime, days: int) -> list[datetime]:
    pcfg = cfg["platforms"].get(platform) or {}
    windows = pcfg.get("best_windows", [])
    first = (now + timedelta(days=int(cfg.get("start_day_offset", 1)))).replace(hour=0, minute=0, second=0, microsecond=0)
    slots: list[datetime] = []
    for d in range(days):
        day = first + timedelta(days=d)
        key = DAY_KEYS[day.weekday()]
        for w in windows:
            if key not in [k.lower()[:3] for k in w.get("days", [])]:
                continue
            for t in w.get("times", []):
                hh, mm = [int(x) for x in t.split(":")]
                slots.append(day.replace(hour=hh, minute=mm))
    slots = sorted(s for s in slots if s > now)
    return slots


def build_schedule(clips: list[dict], platforms: list[str], *, cfg: dict | None = None,
                   now: Optional[datetime] = None, horizon_days: int = 21) -> dict[str, dict[str, dict]]:
    """Returns {clip_id: {platform: {"at": iso, "local": "Tue Oct 14, 12:00 PM", "weekday": "tue"}}}"""
    cfg = cfg or settings.load_config("schedule")
    tz = resolve_tz(settings.TIMEZONE or cfg.get("timezone", "UTC"))
    now = (now or datetime.now(tz)).astimezone(tz)
    max_per_day = int(cfg.get("max_posts_per_platform_per_day", 2))
    min_gap = timedelta(hours=float(cfg.get("min_hours_between_posts_same_platform", 6)))
    stagger = timedelta(minutes=float(cfg.get("stagger_minutes_between_platforms", 20)))

    ranked = sorted(clips, key=lambda c: c.get("score", 0), reverse=True)
    out: dict[str, dict[str, dict]] = {c["id"]: {} for c in clips}
    for p_i, platform in enumerate(platforms):
        slots = _slots_for(platform, cfg, tz, now, horizon_days)
        used: list[datetime] = []
        per_day: dict = {}
        s_i = 0
        for clip in ranked:
            chosen = None
            while s_i < len(slots):
                cand = slots[s_i]
                s_i += 1
                day = cand.date()
                if per_day.get(day, 0) >= max_per_day:
                    continue
                if used and (cand - used[-1]) < min_gap:
                    continue
                chosen = cand
                break
            if chosen is None:  # ran out of good windows: push to the next day at noon
                last = used[-1] if used else now
                chosen = (last + timedelta(days=1)).replace(hour=12, minute=0, second=0, microsecond=0)
            used.append(chosen)
            per_day[chosen.date()] = per_day.get(chosen.date(), 0) + 1
            at = chosen + stagger * p_i
            out[clip["id"]][platform] = {
                "at": at.isoformat(timespec="minutes"),
                "local": at.strftime("%a %b %d, %I:%M %p").replace(" 0", " "),
                "weekday": DAY_KEYS[at.weekday()],
                "timezone": str(tz),
            }
    return out


def to_ics(job: dict, clips: list[dict], platform_labels: dict[str, str]) -> str:
    """Minimal iCalendar export: one event per clip per platform."""
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ClipForge//EN", "CALSCALE:GREGORIAN"]
    for c in clips:
        for platform, s in (c.get("schedule") or {}).items():
            try:
                dt = datetime.fromisoformat(s["at"]).astimezone(timezone.utc)
            except (KeyError, ValueError):
                continue
            title = (c.get("copy") or {}).get(platform, {}).get("title") or f"Clip {c['idx'] + 1}"
            stamp = dt.strftime("%Y%m%dT%H%M%SZ")
            desc = ((c.get("copy") or {}).get(platform, {}).get("caption") or "").replace("\n", "\\n")
            lines += ["BEGIN:VEVENT", f"UID:{c['id']}-{platform}@clipforge", f"DTSTAMP:{stamp}",
                      f"DTSTART:{stamp}", f"DTEND:{(dt + timedelta(minutes=15)).strftime('%Y%m%dT%H%M%SZ')}",
                      f"SUMMARY:Post {platform_labels.get(platform, platform)}: {title}",
                      f"DESCRIPTION:{desc}", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
