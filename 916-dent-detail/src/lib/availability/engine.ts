// Pure availability engine: per-tech calendars, travel buffers, blackout dates, admin blocks, weather holds,
// no double booking, America/Los_Angeles with DST-safe stepping. No I/O: callers pass everything in.
import { bookingConfig, TIMEZONE } from '@/config/booking';
import { travelMinutes as geoTravelMinutes } from '@/lib/geo';
import { addDays, formatTime, localToUtc, utcToLocal, weekdayOf } from './tz';

export type Window = { start: number; end: number }; // local minutes since midnight
export type TechInfo = { id: string; name?: string; active: boolean; homeZip?: string | null; weekly: Record<number, Window[]> };
export type Blackout = { date: string; techId: string | null };
export type Block = { techId: string | null; start: number; end: number; reason?: string }; // UTC ms
export type LiveBooking = {
  id: string; techId: string | null; start: number; end: number; zip?: string | null;
  status: string; holdExpiresAt?: number | null;
};
export const LIVE_STATUSES = ['pending_deposit', 'confirmed', 'on_the_way', 'in_progress'] as const;

export type AvailabilityConfig = {
  slotStepMin: number; minLeadHours: number; horizonDays: number; bufferMin: number; maxJobsPerTechPerDay: number;
  timezone: string; travelMinutes: (a: string | null | undefined, b: string | null | undefined) => number;
};
export const defaultAvailabilityConfig = (): AvailabilityConfig => ({
  slotStepMin: bookingConfig.slotStepMin, minLeadHours: bookingConfig.minLeadHours, horizonDays: bookingConfig.horizonDays,
  bufferMin: bookingConfig.bufferMin, maxJobsPerTechPerDay: bookingConfig.maxJobsPerTechPerDay, timezone: TIMEZONE,
  travelMinutes: (a, b) => geoTravelMinutes(a, b),
});

export type AvailabilityInput = {
  now: number;
  techs: TechInfo[];
  blackouts?: Blackout[];
  blocks?: Block[];
  bookings?: LiveBooking[];
  /** local date -> reason. Exterior work is not offered on these dates. */
  weatherFlags?: Record<string, string>;
  request: {
    durationMin: number;
    zip?: string | null;
    exterior: boolean;
    fromDate?: string; // local date, default today
    days?: number;
    excludeBookingId?: string;
    preferredTechId?: string | null;
  };
  config?: Partial<AvailabilityConfig>;
};

export type Slot = { start: number; end: number; startISO: string; endISO: string; date: string; label: string; techId: string; techIds: string[] };
export type DayStatus = 'open' | 'full' | 'closed' | 'blackout' | 'weather_hold' | 'past';
export type DayInfo = { date: string; status: DayStatus; slotCount: number; weatherReason?: string };

const MIN = 60_000;

function isLive(b: LiveBooking, now: number, excludeId?: string): boolean {
  if (b.id === excludeId || !b.techId) return false;
  if (!(LIVE_STATUSES as readonly string[]).includes(b.status)) return false;
  if (b.status === 'pending_deposit' && b.holdExpiresAt != null && b.holdExpiresAt <= now) return false; // hold lapsed
  return true;
}

export function computeAvailability(input: AvailabilityInput): { slots: Slot[]; days: DayInfo[] } {
  const cfg: AvailabilityConfig = { ...defaultAvailabilityConfig(), ...input.config };
  const { now, request } = input;
  // a zero, negative, NaN or absurd (> 24 h) duration can never fit a day: no slots (and no RangeError from date math)
  if (!Number.isFinite(request.durationMin) || request.durationMin <= 0 || request.durationMin > 24 * 60) return { slots: [], days: [] };
  const today = utcToLocal(now, cfg.timezone).date;
  const first = request.fromDate && request.fromDate > today ? request.fromDate : today;
  const horizonEnd = addDays(today, cfg.horizonDays);
  const nDays = Math.min(request.days ?? cfg.horizonDays, cfg.horizonDays + 1);
  const earliest = now + cfg.minLeadHours * 60 * MIN;
  const durMs = request.durationMin * MIN;
  const live = (input.bookings ?? []).filter((b) => isLive(b, now, request.excludeBookingId));
  const slots: Slot[] = [];
  const days: DayInfo[] = [];

  for (let i = 0; i < nDays; i++) {
    const date = addDays(first, i);
    if (date > horizonEnd) break;
    if (date < today) { days.push({ date, status: 'past', slotCount: 0 }); continue; }
    const weather = input.weatherFlags?.[date];
    if (weather && request.exterior) { days.push({ date, status: 'weather_hold', slotCount: 0, weatherReason: weather }); continue; }

    const wd = weekdayOf(date);
    const byStart = new Map<number, string[]>();
    let anyOpenTech = false;
    let allBlackout = true;

    for (const tech of input.techs) {
      if (!tech.active) continue;
      const out = (input.blackouts ?? []).some((b) => b.date === date && (b.techId === null || b.techId === tech.id));
      if (out) continue;
      allBlackout = false;
      const windows = tech.weekly[wd] ?? [];
      if (!windows.length) continue;
      anyOpenTech = true;

      const techBookings = live.filter((b) => b.techId === tech.id).sort((a, b) => a.start - b.start);
      const dayCount = techBookings.filter((b) => utcToLocal(b.start, cfg.timezone).date === date).length;
      if (dayCount >= cfg.maxJobsPerTechPerDay) continue;
      const techBlocks = (input.blocks ?? []).filter((b) => b.techId === null || b.techId === tech.id);

      for (const w of windows) {
        const wEnd = localToUtc(date, w.end, cfg.timezone);
        if (wEnd === null) continue;
        for (let m = w.start; m < w.end; m += cfg.slotStepMin) {
          const start = localToUtc(date, m, cfg.timezone);
          if (start === null) continue; // wall time does not exist (DST gap)
          const end = start + durMs; // real elapsed time, so DST days stay correct
          if (end > wEnd || start < earliest) continue;
          if (techBlocks.some((b) => start < b.end && end > b.start)) continue;
          let ok = true;
          for (const b of techBookings) {
            const gapBefore = (cfg.bufferMin + cfg.travelMinutes(b.zip, request.zip)) * MIN;
            const gapAfter = (cfg.bufferMin + cfg.travelMinutes(request.zip, b.zip)) * MIN;
            // existing job b must end (plus gap) before we start, or start (minus gap) after we end
            if (start < b.end + gapBefore && end + gapAfter > b.start) { ok = false; break; }
          }
          if (!ok) continue;
          const arr = byStart.get(start) ?? [];
          arr.push(tech.id);
          byStart.set(start, arr);
        }
      }
    }

    const dayLoad = (techId: string) => live.filter((b) => b.techId === techId && utcToLocal(b.start, cfg.timezone).date === date).length;
    let count = 0;
    for (const start of [...byStart.keys()].sort((a, b) => a - b)) {
      const techIds = byStart.get(start)!;
      const pref = request.preferredTechId && techIds.includes(request.preferredTechId) ? request.preferredTechId : null;
      const assigned = pref ?? [...techIds].sort((a, b) => dayLoad(a) - dayLoad(b) || a.localeCompare(b))[0]!;
      const end = start + durMs;
      slots.push({ start, end, startISO: new Date(start).toISOString(), endISO: new Date(end).toISOString(), date, label: formatTime(start, cfg.timezone), techId: assigned, techIds });
      count++;
    }
    const status: DayStatus = count > 0 ? 'open' : allBlackout && input.techs.some((t) => t.active) ? 'blackout' : anyOpenTech ? 'full' : 'closed';
    days.push({ date, status, slotCount: count });
  }
  return { slots, days };
}

/** Is this exact start still bookable (optionally for a specific tech)? Used at booking and reschedule time. */
export function checkSlot(input: AvailabilityInput, startMs: number, techId?: string | null):
  { ok: true; techId: string; slot: Slot } | { ok: false; reason: 'slot_unavailable' | 'tech_unavailable' } {
  const cfg = { ...defaultAvailabilityConfig(), ...input.config };
  const date = utcToLocal(startMs, cfg.timezone).date;
  const { slots } = computeAvailability({ ...input, request: { ...input.request, fromDate: date, days: 1 } });
  const slot = slots.find((s) => s.start === startMs && s.date === date);
  if (!slot) return { ok: false, reason: 'slot_unavailable' };
  if (techId) {
    if (!slot.techIds.includes(techId)) return { ok: false, reason: 'tech_unavailable' };
    return { ok: true, techId, slot };
  }
  return { ok: true, techId: slot.techId, slot };
}
