// DST-safe local-time helpers for one IANA zone (default America/Los_Angeles). Instants are UTC epoch ms;
// "local" values are a YYYY-MM-DD date plus minutes since local midnight. Never add 24h to step a day.
import { TIMEZONE } from '@/config/booking';

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmtCache.set(tz, f);
  }
  return f;
}

export type LocalParts = { date: string; minutes: number; weekday: number; hour: number; minute: number };

export function utcToLocal(ms: number, tz: string = TIMEZONE): LocalParts {
  const p: Record<string, string> = {};
  for (const part of fmt(tz).formatToParts(new Date(ms))) p[part.type] = part.value;
  const hour = Number(p.hour) % 24;
  const minute = Number(p.minute);
  const date = `${p.year}-${p.month}-${p.day}`;
  return { date, minutes: hour * 60 + minute, weekday: weekdayOf(date), hour, minute };
}

/** Offset (local - UTC) in ms at an instant. */
export function tzOffsetMs(ms: number, tz: string = TIMEZONE): number {
  const p: Record<string, string> = {};
  for (const part of fmt(tz).formatToParts(new Date(ms))) p[part.type] = part.value;
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Local wall-clock time to UTC ms. Returns null when that wall time does not exist (spring-forward gap).
 * When it happens twice (fall-back overlap) the earlier instant (daylight time) is returned.
 */
export function localToUtc(date: string, minutes: number, tz: string = TIMEZONE): number | null {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const offsets = new Set([tzOffsetMs(guess - 36 * 3600_000, tz), tzOffsetMs(guess + 36 * 3600_000, tz)]);
  const valid: number[] = [];
  for (const off of offsets) {
    const t = guess - off;
    const back = utcToLocal(t, tz);
    if (back.date === date && back.minutes === minutes) valid.push(t);
  }
  return valid.length ? Math.min(...valid) : null;
}

export const parseHHMM = (s: string): number => {
  const [h, m] = s.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

export function formatLocal(ms: number, opts: Intl.DateTimeFormatOptions, tz: string = TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(ms));
}
export const formatTime = (ms: number, tz: string = TIMEZONE) => formatLocal(ms, { hour: 'numeric', minute: '2-digit' }, tz);
export const formatDay = (ms: number, tz: string = TIMEZONE) => formatLocal(ms, { weekday: 'long', month: 'long', day: 'numeric' }, tz);

/** "now" adjusted so `date + months` keeps the day-of-month where possible (Jan 31 + 1 month = Feb 28/29). */
export function addMonthsLocalDate(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const total = m - 1 + months;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
