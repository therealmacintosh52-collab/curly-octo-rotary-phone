import { describe, expect, it } from 'vitest';
import { checkSlot, computeAvailability, type AvailabilityInput, type LiveBooking, type TechInfo } from '@/lib/availability/engine';
import { addDays, localToUtc, utcToLocal } from '@/lib/availability/tz';

const MIN = 60_000;
const weekly = (start = 8 * 60, end = 17 * 60) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, d === 0 ? [] : [{ start, end }]]));
const tech = (id: string, over: Partial<TechInfo> = {}): TechInfo => ({ id, active: true, homeZip: '95624', weekly: weekly(), ...over });
// "now" = Mon 2026-10-19 06:00 PDT; with a 12h lead the first slot is 18:00 that day, i.e. effectively Tuesday.
const NOW = localToUtc('2026-10-19', 6 * 60)!;
const cfg = { minLeadHours: 0, bufferMin: 20, slotStepMin: 30, horizonDays: 30, maxJobsPerTechPerDay: 4, travelMinutes: () => 10 };
const base = (over: Partial<AvailabilityInput> = {}, req: Partial<AvailabilityInput['request']> = {}): AvailabilityInput => ({
  now: NOW, techs: [tech('a')], config: cfg,
  request: { durationMin: 120, zip: '95624', exterior: true, fromDate: '2026-10-20', days: 1, ...req }, ...over,
});
const booking = (id: string, techId: string, date: string, startMin: number, durMin: number, over: Partial<LiveBooking> = {}): LiveBooking => {
  const start = localToUtc(date, startMin)!;
  return { id, techId, start, end: start + durMin * MIN, zip: '95624', status: 'confirmed', ...over };
};
const starts = (i: AvailabilityInput) => computeAvailability(i).slots.map((s) => utcToLocal(s.start).minutes);

describe('availability: basics', () => {
  it('offers every step inside working hours that fits the duration', () => {
    const s = starts(base());
    expect(s[0]).toBe(8 * 60);
    expect(s.at(-1)).toBe(15 * 60); // 15:00 + 2h = 17:00
    expect(s).toHaveLength(15);
  });
  it('closed on Sunday', () => {
    const r = computeAvailability(base({}, { fromDate: '2026-10-25' }));
    expect(r.slots).toHaveLength(0); expect(r.days[0]!.status).toBe('closed');
  });
  it('inactive tech gives nothing', () => expect(starts(base({ techs: [tech('a', { active: false })] }))).toEqual([]));
  it('respects minimum lead time', () => {
    const slots = computeAvailability(base({ config: { ...cfg, minLeadHours: 30 } }, { fromDate: '2026-10-19', days: 2 })).slots;
    expect(slots[0]!.start).toBeGreaterThanOrEqual(NOW + 30 * 60 * MIN);
  });
  it('never offers the past or beyond the horizon', () => {
    const r = computeAvailability(base({ config: { ...cfg, horizonDays: 3 } }, { fromDate: '2026-10-19', days: 10 }));
    expect(r.days.every((d) => d.date <= addDays('2026-10-19', 3))).toBe(true);
    expect(r.slots.every((s) => s.start >= NOW)).toBe(true);
  });
  it('duration longer than the window yields no slots', () => expect(starts(base({}, { durationMin: 10 * 60 }))).toEqual([]));
});

describe('availability: conflicts and buffers', () => {
  it('no double booking: an existing job removes overlapping starts', () => {
    const s = starts(base({ bookings: [booking('b1', 'a', '2026-10-20', 10 * 60, 120)] }));
    expect(s).not.toContain(10 * 60); expect(s).not.toContain(11 * 60); expect(s).not.toContain(9 * 60);
  });
  it('travel + buffer gap is enforced on both sides (back-to-back needs 30 min)', () => {
    // existing 10:00-12:00; need end+30min gap => earliest next start 12:30; latest earlier start ends by 09:30 => start 07:30 (<8) none
    const s = starts(base({ bookings: [booking('b1', 'a', '2026-10-20', 10 * 60, 120)] }));
    expect(s).not.toContain(12 * 60);
    expect(s).toContain(12 * 60 + 30);
    const s2 = starts(base({ bookings: [booking('b1', 'a', '2026-10-20', 12 * 60, 120)] }, { durationMin: 60 }));
    expect(s2).toContain(10 * 60 + 30); // 10:30-11:30 + 30 gap = 12:00 ok
    expect(s2).not.toContain(11 * 60);
  });
  it('longer drive between ZIPs widens the gap', () => {
    const far = { ...cfg, travelMinutes: (a?: string | null, b?: string | null) => (a === b ? 5 : 60) };
    const s = starts(base({ config: far, bookings: [booking('b1', 'a', '2026-10-20', 10 * 60, 120, { zip: '95746' })] }));
    expect(s).not.toContain(12 * 60 + 30); // needs 20+60 = 80 min
    expect(s).toContain(13 * 60 + 30);
  });
  it('two techs: busy tech A still lets tech B take the slot; slot lists both techs', () => {
    const input = base({ techs: [tech('a'), tech('b')], bookings: [booking('b1', 'a', '2026-10-20', 8 * 60, 120)] });
    const r = computeAvailability(input);
    const eight = r.slots.find((s) => utcToLocal(s.start).minutes === 8 * 60)!;
    expect(eight.techIds).toEqual(['b']); expect(eight.techId).toBe('b');
    const noon = r.slots.find((s) => utcToLocal(s.start).minutes === 12 * 60)!;
    expect(noon.techIds.sort()).toEqual(['a', 'b']);
  });
  it('assignment balances load: the less busy tech is preferred', () => {
    const input = base({ techs: [tech('a'), tech('b')], bookings: [booking('b1', 'a', '2026-10-20', 8 * 60, 60)] });
    const slot = computeAvailability(input).slots.find((s) => utcToLocal(s.start).minutes === 14 * 60)!;
    expect(slot.techId).toBe('b');
  });
  it('preferred tech is honored when free', () => {
    const slot = computeAvailability(base({ techs: [tech('a'), tech('b')] }, { preferredTechId: 'b' })).slots[0]!;
    expect(slot.techId).toBe('b');
  });
  it("cancelled / completed / expired bookings don't block", () => {
    for (const status of ['cancelled', 'completed', 'expired', 'no_show']) {
      expect(starts(base({ bookings: [booking('b1', 'a', '2026-10-20', 8 * 60, 600, { status })] }))).toHaveLength(15);
    }
  });
  it('pending_deposit blocks until the hold lapses', () => {
    const held = booking('b1', 'a', '2026-10-20', 8 * 60, 600, { status: 'pending_deposit', holdExpiresAt: NOW + 10 * MIN });
    expect(starts(base({ bookings: [held] }))).toEqual([]);
    expect(starts(base({ now: NOW + 11 * MIN, bookings: [held] }, { fromDate: '2026-10-20' }))).toHaveLength(15);
  });
  it('excludeBookingId frees the booking being rescheduled', () => {
    const b = booking('b1', 'a', '2026-10-20', 8 * 60, 600);
    expect(starts(base({ bookings: [b] }))).toEqual([]);
    expect(starts(base({ bookings: [b] }, { excludeBookingId: 'b1' }))).toHaveLength(15);
  });
  it('max jobs per tech per day', () => {
    const bs = [8, 10, 12, 14].map((h, i) => booking(`b${i}`, 'a', '2026-10-20', h * 60, 30));
    const r = computeAvailability(base({ bookings: bs }, { durationMin: 30 }));
    expect(r.slots).toHaveLength(0); expect(r.days[0]!.status).toBe('full');
  });
});

describe('availability: blocks, blackout, weather', () => {
  it('admin block (all techs) removes overlapping starts', () => {
    const blk = { techId: null, start: localToUtc('2026-10-20', 12 * 60)!, end: localToUtc('2026-10-20', 13 * 60)! };
    const s = starts(base({ blocks: [blk] }));
    expect(s).not.toContain(11 * 60); expect(s).not.toContain(12 * 60); expect(s).toContain(13 * 60);
    expect(s).toContain(10 * 60); // 10:00-12:00 touches the block start exactly: allowed
  });
  it('admin block for one tech leaves the other', () => {
    const blk = { techId: 'a', start: localToUtc('2026-10-20', 8 * 60)!, end: localToUtc('2026-10-20', 17 * 60)! };
    const slots = computeAvailability(base({ techs: [tech('a'), tech('b')], blocks: [blk] })).slots;
    expect(slots.every((s) => s.techIds.join() === 'b')).toBe(true);
  });
  it('blackout date: global and per-tech', () => {
    const g = computeAvailability(base({ blackouts: [{ date: '2026-10-20', techId: null }] }));
    expect(g.slots).toHaveLength(0); expect(g.days[0]!.status).toBe('blackout');
    const p = computeAvailability(base({ techs: [tech('a'), tech('b')], blackouts: [{ date: '2026-10-20', techId: 'a' }] }));
    expect(p.slots.every((s) => s.techIds.join() === 'b')).toBe(true);
  });
  it('weather flag blocks exterior work but not interior-only', () => {
    const wf = { '2026-10-20': 'rain' };
    const ext = computeAvailability(base({ weatherFlags: wf }));
    expect(ext.slots).toHaveLength(0); expect(ext.days[0]).toMatchObject({ status: 'weather_hold', weatherReason: 'rain' });
    expect(computeAvailability(base({ weatherFlags: wf }, { exterior: false })).slots.length).toBeGreaterThan(0);
  });
  it('split windows (lunch) are respected', () => {
    const t = tech('a', { weekly: { ...weekly(), 2: [{ start: 8 * 60, end: 12 * 60 }, { start: 13 * 60, end: 17 * 60 }] } });
    const s = starts(base({ techs: [t] }, { durationMin: 120 }));
    expect(s).toContain(10 * 60); expect(s).not.toContain(11 * 60); expect(s).toContain(13 * 60);
  });
});

describe('availability: DST', () => {
  const dstCfg = { ...cfg, slotStepMin: 30 };
  it('fall-back day (2026-11-01, Sunday) works when the tech has hours; duration is real elapsed time', () => {
    const t = tech('a', { weekly: { ...weekly(), 0: [{ start: 0, end: 8 * 60 }] } });
    const r = computeAvailability({ now: localToUtc('2026-10-30', 6 * 60)!, techs: [t], config: dstCfg, request: { durationMin: 60, exterior: false, fromDate: '2026-11-01', days: 1 } });
    // 00:00-08:00 local is 9 real hours; every 30-min step from 00:00 to 07:00 fits, plus the repeated 01:30 appears once
    const mins = r.slots.map((s) => utcToLocal(s.start).minutes);
    expect(mins[0]).toBe(0); expect(mins.at(-1)).toBe(7 * 60);
    expect(new Set(r.slots.map((s) => s.start)).size).toBe(r.slots.length);
    // a 3h job starting 06:00 PST must end by 08:00 PST: 2h available only
    const long = computeAvailability({ now: localToUtc('2026-10-30', 6 * 60)!, techs: [t], config: dstCfg, request: { durationMin: 180, exterior: false, fromDate: '2026-11-01', days: 1 } });
    expect(long.slots.map((s) => utcToLocal(s.start).minutes).at(-1)).toBe(5 * 60);
  });
  it('spring-forward day (2027-03-14): nonexistent wall times are skipped, no slot at 02:00/02:30', () => {
    const t = tech('a', { weekly: { ...weekly(), 0: [{ start: 0, end: 6 * 60 }] } });
    const r = computeAvailability({ now: localToUtc('2027-03-12', 6 * 60)!, techs: [t], config: dstCfg, request: { durationMin: 30, exterior: false, fromDate: '2027-03-14', days: 1 } });
    const mins = r.slots.map((s) => utcToLocal(s.start).minutes);
    expect(mins).not.toContain(2 * 60); expect(mins).not.toContain(2 * 60 + 30);
    expect(mins).toContain(3 * 60);
    // 00:00-06:00 local is only 5 real hours; last 30-min start is 05:30
    expect(mins.at(-1)).toBe(5 * 60 + 30);
  });
  it('a normal 9am slot is 9am local on both sides of the change', () => {
    const r = computeAvailability({ now: localToUtc('2026-10-29', 6 * 60)!, techs: [tech('a')], config: dstCfg, request: { durationMin: 60, exterior: false, fromDate: '2026-10-31', days: 3 } });
    const nine = r.slots.filter((s) => utcToLocal(s.start).minutes === 540);
    expect(nine.map((s) => s.date)).toEqual(['2026-10-31', '2026-11-02']);
  });
  it('back-to-back across the fall-back night uses elapsed time for buffers', () => {
    const b = booking('b1', 'a', '2026-10-31', 16 * 60, 60);
    const r = computeAvailability({ now: localToUtc('2026-10-29', 6 * 60)!, techs: [tech('a')], bookings: [b], config: dstCfg, request: { durationMin: 60, exterior: false, fromDate: '2026-10-31', days: 1 } });
    const mins = r.slots.map((s) => utcToLocal(s.start).minutes);
    expect(mins).not.toContain(16 * 60);
  });
});

describe('checkSlot', () => {
  it('accepts a free slot and rejects a taken one', () => {
    const input = base({ bookings: [booking('b1', 'a', '2026-10-20', 8 * 60, 120)] });
    expect(checkSlot(input, localToUtc('2026-10-20', 8 * 60)!).ok).toBe(false);
    const ok = checkSlot(input, localToUtc('2026-10-20', 13 * 60)!);
    expect(ok.ok && ok.techId).toBe('a');
  });
  it('rejects a tech who is not free even if another is', () => {
    const input = base({ techs: [tech('a'), tech('b')], bookings: [booking('b1', 'a', '2026-10-20', 8 * 60, 120)] });
    const r = checkSlot(input, localToUtc('2026-10-20', 8 * 60)!, 'a');
    expect(r).toEqual({ ok: false, reason: 'tech_unavailable' });
    expect(checkSlot(input, localToUtc('2026-10-20', 8 * 60)!, 'b').ok).toBe(true);
  });
  it('rejects off-grid and out-of-hours times', () => {
    expect(checkSlot(base(), localToUtc('2026-10-20', 8 * 60 + 7)!).ok).toBe(false);
    expect(checkSlot(base(), localToUtc('2026-10-20', 22 * 60)!).ok).toBe(false);
  });
});
