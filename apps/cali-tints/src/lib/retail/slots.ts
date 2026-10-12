import type { Slot } from "@/lib/db/types";

/**
 * Calendar helpers shared by the staff calendar, the booking wizard and the
 * manage page. Everything is shown in the shop's timezone
 * (companies.timezone), whatever the phone is set to; the database does the
 * slot maths (find_slots), these only lay the results out.
 */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = tz + JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts });
    fmtCache.set(key, f);
  }
  return f;
}

/** yyyy-MM-dd of an instant in the shop's timezone. */
export function dayKeyIn(iso: string | Date, tz: string): string {
  const parts = fmt(tz, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "8:00 AM" in the shop's timezone. */
export function timeIn(iso: string | Date, tz: string): string {
  return fmt(tz, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** "Mon, Oct 20" / "Monday, October 20" in the shop's timezone. */
export function dayLabelIn(iso: string | Date, tz: string, long = false): string {
  return fmt(tz, long ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
}

/** "Mon, Oct 20 · 8:00 AM" */
export function whenIn(iso: string | Date, tz: string): string {
  return `${dayLabelIn(iso, tz)} · ${timeIn(iso, tz)}`;
}

/** Minutes past midnight of an instant in the shop's timezone (for laying blocks out on a day grid). */
export function minutesOfDayIn(iso: string | Date, tz: string): number {
  const parts = fmt(tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** Slots grouped by the shop's day, in order. */
export function groupSlotsByDay(slots: Slot[], tz: string): { day: string; label: string; slots: Slot[] }[] {
  const out: { day: string; label: string; slots: Slot[] }[] = [];
  for (const s of slots) {
    const day = dayKeyIn(s.starts_at, tz);
    let g = out.find((x) => x.day === day);
    if (!g) {
      g = { day, label: dayLabelIn(s.starts_at, tz), slots: [] };
      out.push(g);
    }
    g.slots.push(s);
  }
  return out;
}

/** Add days to a yyyy-MM-dd key (no timezone involved). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** The Monday on or before a yyyy-MM-dd key. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}

/** Seconds left on a hold, never negative. */
export function holdSecondsLeft(expiresAt: string | null | undefined, now: number = Date.now()): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
}

/** "12:34" */
export function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** May the customer still move or cancel it under the policy? Mirrors `can_change` in the database. */
export function canChange(startsAt: string, cancelHours: number, now: number = Date.now()): boolean {
  return new Date(startsAt).getTime() > now + cancelHours * 3600000;
}

/** "2 h 30 min" / "45 min" */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
