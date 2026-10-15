// Date ranges for reports. All boundaries are Pacific-time calendar days; `to` is INCLUSIVE in the UI and `endMs`
// is the exclusive upper bound used for filtering. Pure.
import { TIMEZONE } from '@/config/booking';
import { addDays, localToUtc, utcToLocal } from '@/lib/availability/tz';

export const PRESETS = ['7d', '30d', '90d', 'mtd', 'last_month', 'ytd', 'custom'] as const;
export type Preset = (typeof PRESETS)[number];
export const PRESET_LABEL: Record<Preset, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', mtd: 'This month', last_month: 'Last month', ytd: 'Year to date', custom: 'Custom' };

export type DateRange = { preset: Preset; from: string; to: string; startMs: number; endMs: number; label: string; days: number };

const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const firstOfMonth = (d: string) => `${d.slice(0, 7)}-01`;

export function resolveRange(preset: string | undefined, custom: { from?: string; to?: string } = {}, now = Date.now()): DateRange {
  const today = utcToLocal(now, TIMEZONE).date;
  let p: Preset = (PRESETS as readonly string[]).includes(preset ?? '') ? (preset as Preset) : '30d';
  let from: string, to: string = today;
  switch (p) {
    case '7d': from = addDays(today, -6); break;
    case '30d': from = addDays(today, -29); break;
    case '90d': from = addDays(today, -89); break;
    case 'mtd': from = firstOfMonth(today); break;
    case 'ytd': from = `${today.slice(0, 4)}-01-01`; break;
    case 'last_month': { const first = firstOfMonth(today); to = addDays(first, -1); from = firstOfMonth(to); break; }
    case 'custom':
      if (isDate(custom.from) && isDate(custom.to) && custom.from <= custom.to && daysBetween(custom.from, custom.to) <= 731) { from = custom.from; to = custom.to; }
      else { p = '30d'; from = addDays(today, -29); }
      break;
  }
  const startMs = localToUtc(from, 0, TIMEZONE) ?? Date.parse(`${from}T08:00:00Z`);
  const endMs = localToUtc(addDays(to, 1), 0, TIMEZONE) ?? Date.parse(`${addDays(to, 1)}T08:00:00Z`);
  return { preset: p, from, to, startMs, endMs, label: p === 'custom' ? `${from} to ${to}` : PRESET_LABEL[p], days: daysBetween(from, to) + 1 };
}

export const inRange = (iso: string | null | undefined, r: Pick<DateRange, 'startMs' | 'endMs'>): boolean => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return t >= r.startMs && t < r.endMs;
};
export const dateInRange = (d: string, r: Pick<DateRange, 'from' | 'to'>): boolean => d >= r.from && d <= r.to;

/** Monday-start week key (local date of that Monday) for an instant. */
export function weekKey(ms: number): string {
  const d = utcToLocal(ms, TIMEZONE).date;
  const dow = (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7; // Mon=0
  return addDays(d, -dow);
}
/** All week keys that touch the range, oldest first (so empty weeks still render as zero bars). */
export function weeksIn(r: Pick<DateRange, 'from' | 'to'>): string[] {
  const out: string[] = [];
  const first = (() => { const dow = (new Date(`${r.from}T12:00:00Z`).getUTCDay() + 6) % 7; return addDays(r.from, -dow); })();
  for (let w = first; w <= r.to; w = addDays(w, 7)) out.push(w);
  return out;
}
