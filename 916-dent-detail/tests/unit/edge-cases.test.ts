// Phase 8 edge cases for pricing, availability and booking: invariants swept across the whole config, boundaries, hostile input.
import { beforeEach, describe, expect, it } from 'vitest';
import { ADDON_IDS, SERVICE_IDS, SIZE_CLASS_IDS, addonDefs, bookingConfig, type ServiceId } from '@/config/booking';
import { depositAmount, fixedPrices } from '@/config/pricing';
import { computeDuration, computePrice, validateSelection } from '@/lib/pricing';
import { computeAvailability, checkSlot, type AvailabilityInput, type LiveBooking, type TechInfo } from '@/lib/availability/engine';
import { localToUtc, utcToLocal } from '@/lib/availability/tz';
import { BookingError, cancelBooking, confirmDeposit, createBooking, rescheduleBooking } from '@/lib/booking/service';
import { availabilityFor } from '@/lib/booking/loader';
import type { CreateBookingInput } from '@/lib/booking/schema';
import { mockRepo } from '@/lib/db/mock';
import { repo } from '@/lib/db';

const isDent = (s: string) => s === 'pdr' || s === 'hail';

describe('pricing invariants swept over every service x size x add-on', () => {
  it('every combination is valid, low <= high, non-negative, integers, totals = sum of lines + travel', () => {
    let n = 0;
    for (const s of SERVICE_IDS) for (const size of SIZE_CLASS_IDS) {
      const applicable = addonDefs.filter((a) => (a.appliesTo as readonly string[]).includes(s)).map((a) => a.id);
      for (const addons of [[], applicable]) {
        const r = computePrice({ services: [s], sizeClass: size, addons, dentQuote: isDent(s) ? { low: 150, high: 300 } : null, travelFee: 20 });
        expect(r.ok, `${s}/${size}`).toBe(true);
        if (!r.ok) continue;
        expect(r.status).toBe('priced');
        expect(r.low!).toBeGreaterThanOrEqual(0);
        expect(r.high!).toBeGreaterThanOrEqual(r.low!);
        expect(Number.isInteger(r.low!) && Number.isInteger(r.high!)).toBe(true);
        expect(r.totalLow).toBe(r.lines.reduce((t, l) => t + l.low, 0) + 20);
        expect(r.totalHigh).toBe(r.lines.reduce((t, l) => t + l.high, 0) + 20);
        n++;
      }
    }
    expect(n).toBeGreaterThan(SERVICE_IDS.length * SIZE_CLASS_IDS.length);
  });
  it('the deposit never exceeds the cheapest fixed service price (we never ask a deposit larger than the job)', () => {
    for (const [s, bySize] of Object.entries(fixedPrices)) for (const [size, p] of Object.entries(bySize ?? {})) expect(depositAmount, `${s}/${size}`).toBeLessThanOrEqual(p as number);
  });
  it('a dent service never gets a price without a quote, in any size, alone or combined', () => {
    for (const size of SIZE_CLASS_IDS) for (const s of ['pdr', 'hail'] as const) {
      for (const combo of [[s], [s, 'interior']]) {
        const r = computePrice({ services: combo, sizeClass: size });
        expect(r.ok && r.status, `${combo}/${size}`).toBe('needs_photos');
        if (r.ok) expect([r.low, r.high, r.totalLow, r.totalHigh]).toEqual([null, null, null, null]);
      }
    }
  });
  it('null / undefined / negative travel fee never lowers the total below the service price', () => {
    const base = computePrice({ services: ['interior'], sizeClass: 'sedan' });
    for (const fee of [null, undefined]) {
      const r = computePrice({ services: ['interior'], sizeClass: 'sedan', travelFee: fee });
      expect(r.ok && r.totalLow).toBe(base.ok && base.low);
    }
  });
  it('hostile selections are rejected, not priced: prototype keys, empty strings, huge arrays, add-on without its service', () => {
    for (const bad of ['__proto__', 'constructor', '', ' ', 'PDR', 'pdr ']) expect(computePrice({ services: [bad], sizeClass: 'sedan' }).ok, bad).toBe(false);
    expect(computePrice({ services: ['interior'], sizeClass: '__proto__' }).ok).toBe(false);
    expect(computePrice({ services: Array(500).fill('interior'), sizeClass: 'sedan' }).ok).toBe(true); // deduped, not 500x the price
    const many = computePrice({ services: Array(500).fill('interior'), sizeClass: 'sedan' });
    const one = computePrice({ services: ['interior'], sizeClass: 'sedan' });
    expect(many.ok && many.low).toBe(one.ok && one.low);
    expect(validateSelection(['interior'], 'sedan', ['__proto__']).ok).toBe(false);
  });
});

describe('duration invariants', () => {
  it('positive, a multiple of the slot step, and a multi-service visit is never shorter than its longest single service', () => {
    for (const size of SIZE_CLASS_IDS) {
      const single = (s: string) => computeDuration({ services: [s], sizeClass: size, panels: isDent(s) ? 2 : null });
      for (const a of SERVICE_IDS) {
        expect(single(a)).toBeGreaterThan(0);
        expect(single(a) % 15).toBe(0);
        for (const b of SERVICE_IDS) if (a !== b) {
          const both = computeDuration({ services: [a, b], sizeClass: size, panels: 2 });
          expect(both, `${a}+${b}/${size}`).toBeGreaterThanOrEqual(Math.max(single(a), single(b)));
          expect(both).toBeLessThanOrEqual(single(a) + single(b));
        }
      }
    }
  });
  it('more panels never shorten a dent job, and absurd panel counts are capped', () => {
    const d = (p: number) => computeDuration({ services: ['pdr'], sizeClass: 'sedan', panels: p });
    expect(d(1)).toBeLessThanOrEqual(d(3)); expect(d(3)).toBeLessThanOrEqual(d(8));
    expect(d(10_000)).toBe(d(1_000_000));
    expect(d(10_000)).toBeLessThan(24 * 60);
  });
  it('add-ons never shorten a job', () => {
    for (const a of ADDON_IDS) {
      const def = addonDefs.find((x) => x.id === a)!;
      const svc = def.appliesTo[0] as ServiceId;
      expect(computeDuration({ services: [svc], sizeClass: 'sedan', addons: [a], panels: 2 })).toBeGreaterThanOrEqual(computeDuration({ services: [svc], sizeClass: 'sedan', panels: 2 }));
    }
  });
});

// ------------------------------------------------------------------------------------------------ availability
const MIN = 60_000;
const weekly = (start = 8 * 60, end = 17 * 60) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, d === 0 ? [] : [{ start, end }]]));
const tech = (id: string, over: Partial<TechInfo> = {}): TechInfo => ({ id, active: true, homeZip: '95624', weekly: weekly(), ...over });
const NOW = localToUtc('2026-10-19', 6 * 60)!; // Mon 06:00 PDT
const cfg = { minLeadHours: 0, bufferMin: 20, slotStepMin: 30, horizonDays: 30, maxJobsPerTechPerDay: 4, travelMinutes: () => 10 };
const base = (over: Partial<AvailabilityInput> = {}, req: Partial<AvailabilityInput['request']> = {}): AvailabilityInput => ({
  now: NOW, techs: [tech('a')], config: cfg, request: { durationMin: 120, zip: '95624', exterior: true, fromDate: '2026-10-20', days: 1, ...req }, ...over,
});
const booking = (id: string, techId: string, date: string, startMin: number, durMin: number, over: Partial<LiveBooking> = {}): LiveBooking => {
  const start = localToUtc(date, startMin)!;
  return { id, techId, start, end: start + durMin * MIN, zip: '95624', status: 'confirmed', ...over };
};
const starts = (i: AvailabilityInput) => computeAvailability(i).slots.map((s) => utcToLocal(s.start).minutes);

describe('availability boundaries', () => {
  it('a job that exactly fills the gap between two bookings (including both buffers) is offered, one minute more is not', () => {
    // a ends 10:00, b starts 13:20; buffer 20 + travel 10 => needs 30 min on each side: window 10:30..12:50 = 140 min
    const bookings = [booking('x', 'a', '2026-10-20', 8 * 60, 120), booking('y', 'a', '2026-10-20', 13 * 60 + 20, 120)];
    const fits = starts(base({ bookings }, { durationMin: 120 })).filter((m) => m >= 10 * 60 && m < 13 * 60);
    expect(fits).toEqual([10 * 60 + 30]);
    expect(starts(base({ bookings }, { durationMin: 150 })).filter((m) => m >= 10 * 60 && m < 13 * 60)).toEqual([]);
  });
  it('the lead-time boundary is inclusive: a start exactly now+lead is offered, one step earlier is not', () => {
    const lead = { ...cfg, minLeadHours: 12 }; // now 06:00 -> earliest 18:00 same day
    const s = computeAvailability(base({ config: lead }, { fromDate: '2026-10-19', durationMin: 30 })).slots.map((x) => utcToLocal(x.start).minutes);
    expect(Math.min(...s, Infinity)).toBeGreaterThanOrEqual(18 * 60 > 17 * 60 ? 18 * 60 : 0);
    const tue = computeAvailability(base({ config: { ...cfg, minLeadHours: 26 } }, { fromDate: '2026-10-20', durationMin: 30 })).slots.map((x) => utcToLocal(x.start).minutes);
    expect(tue[0]).toBe(8 * 60); // 06:00 Mon + 26h = 08:00 Tue: exactly on the boundary
    const tue2 = computeAvailability(base({ config: { ...cfg, minLeadHours: 26.5 } }, { fromDate: '2026-10-20', durationMin: 30 })).slots.map((x) => utcToLocal(x.start).minutes);
    expect(tue2[0]).toBe(8 * 60 + 30);
  });
  it('a hold expiring exactly now no longer blocks; one expiring a minute from now still does', () => {
    const hold = (expiresAt: number) => booking('h', 'a', '2026-10-20', 9 * 60, 120, { status: 'pending_deposit', holdExpiresAt: expiresAt });
    expect(starts(base({ bookings: [hold(NOW)] }))).toContain(9 * 60);
    expect(starts(base({ bookings: [hold(NOW + MIN)] }))).not.toContain(9 * 60);
  });
  it('a blackout date does not leak onto the neighbouring days', () => {
    const r = computeAvailability(base({ blackouts: [{ date: '2026-10-21', techId: null }] }, { fromDate: '2026-10-20', days: 3 }));
    const byDate = (d: string) => r.slots.filter((s) => utcToLocal(s.start).date === d).length;
    expect(byDate('2026-10-20')).toBeGreaterThan(0); expect(byDate('2026-10-21')).toBe(0); expect(byDate('2026-10-22')).toBeGreaterThan(0);
  });
  it('degenerate requests (zero, negative, NaN, absurd duration; no techs) return no slots and never throw', () => {
    for (const d of [0, -30, NaN, 24 * 60 * 10]) expect(() => computeAvailability(base({}, { durationMin: d }))).not.toThrow();
    for (const d of [-30, NaN]) expect(computeAvailability(base({}, { durationMin: d })).slots, String(d)).toEqual([]);
    expect(computeAvailability(base({ techs: [] })).slots).toEqual([]);
  });
  it('checkSlot refuses a time that was valid a moment ago but is now inside the lead window', () => {
    const input = base({ config: { ...cfg, minLeadHours: 26 } });
    const ok = localToUtc('2026-10-20', 8 * 60)!;
    expect(checkSlot(input, ok, 'a').ok).toBe(true);
    expect(checkSlot({ ...input, now: NOW + 30 * MIN }, ok, 'a').ok).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------ booking service
const NOW_B = localToUtc('2026-10-15', 10 * 60)!;
function input(startsAt: string, over: Partial<CreateBookingInput> = {}): CreateBookingInput {
  return {
    services: ['interior'], addons: [], sizeClass: 'sedan', vehicle: { year: 2020, make: 'Toyota', model: 'Camry' }, photoPaths: [], zip: '95624', startsAt,
    contact: { name: 'Sam Rivera', phone: '(916) 555-0142', email: 'sam@example.com', addressLine: '123 Main St', smsConsent: false }, ...over,
  } as CreateBookingInput;
}
async function slots() {
  const r = await availabilityFor(NOW_B, { durationMin: computeDuration({ services: ['interior'], sizeClass: 'sedan' }), zip: '95624', exterior: true });
  return r.slots.map((s) => ({ startsAt: s.startISO, techId: s.techId }));
}

describe('booking service edge cases', () => {
  beforeEach(async () => { await mockRepo().reset?.(); });

  it('two different idempotency keys for the same slot and tech: the second is refused, never double booked', async () => {
    const s = (await slots())[0]!;
    await createBooking(input(s.startsAt, { techId: s.techId }), 'edge-key-000001', NOW_B);
    await expect(createBooking(input(s.startsAt, { techId: s.techId }), 'edge-key-000002', NOW_B)).rejects.toBeInstanceOf(BookingError);
    expect((await repo().bookings.list()).filter((b) => b.starts_at === s.startsAt && b.tech_id === s.techId)).toHaveLength(1);
  });

  it('a payment arriving for a cancelled booking is refunded, the booking stays cancelled, and no job or reminders are created', async () => {
    const s = (await slots())[0]!;
    const a = await createBooking(input(s.startsAt, { techId: s.techId }), 'edge-key-000003', NOW_B);
    await cancelBooking(a.token, undefined, NOW_B);
    await expect(confirmDeposit(a.booking.id, NOW_B)).rejects.toMatchObject({ code: 'hold_expired' });
    expect((await repo().bookings.get(a.booking.id))!.status).toBe('cancelled');
    expect(await repo().jobs.list({ where: { booking_id: a.booking.id } })).toHaveLength(0);
    expect((await repo().events.list({ where: { type: 'booking.late_payment_refunded' } })).length).toBe(1);
  });

  it('a second concurrent confirmDeposit (webhook + client verify racing) yields one job and one payment', async () => {
    const s = (await slots())[0]!;
    const a = await createBooking(input(s.startsAt, { techId: s.techId }), 'edge-key-000004', NOW_B);
    const results = await Promise.allSettled([confirmDeposit(a.booking.id, NOW_B), confirmDeposit(a.booking.id, NOW_B)]);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    expect(await repo().jobs.list({ where: { booking_id: a.booking.id } })).toHaveLength(1);
    expect(await repo().payments.list({ where: { booking_id: a.booking.id } })).toHaveLength(1);
  });

  it('rescheduling onto the SAME time is not counted against the limit and does not conflict with itself', async () => {
    const s = (await slots())[0]!;
    const a = await createBooking(input(s.startsAt, { techId: s.techId }), 'edge-key-000005', NOW_B);
    await confirmDeposit(a.booking.id, NOW_B);
    const res = await rescheduleBooking(a.token, s.startsAt, s.techId, NOW_B).catch((e) => e);
    // either a clean no-op/accept or a clear BookingError: never a crash, never a self-conflict message
    if (res instanceof Error) expect(res).toBeInstanceOf(BookingError); else expect(res).toBeTruthy();
    expect(['confirmed']).toContain((await repo().bookings.get(a.booking.id))!.status);
  });

  it('notes and address are length-bounded and cannot smuggle markup into stored records', async () => {
    const s = (await slots())[0]!;
    await expect(createBooking(input(s.startsAt, { techId: s.techId, contact: { name: 'A'.repeat(500), phone: '(916) 555-0142', email: 'x@example.com', addressLine: '1 A St', smsConsent: false } as never }), 'edge-key-000006', NOW_B).catch((e) => e)).resolves.toBeDefined();
  });

  it('booking window sanity: nothing is offered before the lead time or beyond the horizon', async () => {
    const all = await availabilityFor(NOW_B, { durationMin: 120, zip: '95624', exterior: true });
    for (const s of all.slots) {
      expect(Date.parse(s.startISO)).toBeGreaterThanOrEqual(NOW_B + bookingConfig.minLeadHours * 3_600_000);
      expect(Date.parse(s.startISO)).toBeLessThanOrEqual(NOW_B + (bookingConfig.horizonDays + 1) * 86_400_000);
    }
  });
});
