import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { repo } from '@/lib/db';
import { SEED_TECH_IDS } from '@/lib/db/seed';
import { localToUtc } from '@/lib/availability/tz';
import { availabilityFor } from '@/lib/booking/loader';
import { computeDuration } from '@/lib/pricing';
import { addBlackout, addBlock, adminCancel, adminReschedule, bookingsAffectedByWeather, createManualBooking, loadCalendar, policyPreview, toggleWeather } from '@/lib/admin/schedule';
import { mergeSettings, primeSettings, resetSettings, saveSettings, settingsSchema, diffFromConfig } from '@/lib/admin/settings';
import { durations, bookingConfig } from '@/config/booking';
import { depositAmount } from '@/config/pricing';
import { smsOutbox } from '@/lib/sms';
import { emailOutbox } from '@/lib/email';

const H = 3_600_000;
const NOW = localToUtc('2026-10-15', 10 * 60)!;
const A = 'owner:t';
let n = 0;

async function cust(name = 'Sam Rivera', phone = '+19165550142') {
  return repo().customers.insert({ name, phone, email: `${name.split(' ')[0]!.toLowerCase()}@example.com`, sms_opt_in: true, sms_opt_in_at: new Date().toISOString(), sms_opt_in_text: 'x' });
}
async function firstSlots(day = 2, services = ['interior']) {
  const r = await availabilityFor(NOW, { durationMin: computeDuration({ services, sizeClass: 'sedan' }), zip: '95624', exterior: true });
  const dates = [...new Set(r.slots.map((s) => s.date))];
  return r.slots.filter((s) => s.date === dates[day]);
}
const input = (customerId: string, startsAt: string, over: Record<string, unknown> = {}) => ({
  customerId, services: ['interior'], sizeClass: 'sedan', startsAt, zip: '95624', addressLine: '123 Main St', deposit: 'none' as const, notifyCustomer: true, idempotencyKey: `manual-key-${++n}-padding`, ...over,
});

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
afterAll(() => { vi.useRealTimers(); });
beforeEach(async () => { vi.setSystemTime(NOW); await repo().reset!(); smsOutbox().length = 0; emailOutbox().length = 0; await resetSettings(A); });

describe('manual booking', () => {
  it('books a listed slot through the same engine; job + lead + reminders created; replays by key; double booking refused', async () => {
    const c = await cust();
    const slot = (await firstSlots())[0]!;
    const key = 'manual-key-fixed-0001';
    const r = await createManualBooking(input(c.id, slot.startISO, { idempotencyKey: key, techId: slot.techId, source: 'door_knock' }) as never, A, NOW);
    expect(r.booking).toMatchObject({ status: 'confirmed', deposit_status: 'none', tech_id: slot.techId });
    expect((await repo().jobs.list())).toHaveLength(1);
    const lead = (await repo().leads.list())[0]!;
    expect(lead).toMatchObject({ stage: 'booked', source: 'door_knock' });
    expect((await repo().notification_queue.list()).map((q) => q.kind)).toContain('confirmation');
    expect(emailOutbox()).toHaveLength(1);
    const again = await createManualBooking(input(c.id, slot.startISO, { idempotencyKey: key }) as never, A, NOW);
    expect(again.replay).toBe(true);
    expect(await repo().bookings.list()).toHaveLength(1);
    // the same slot for the same tech: not offered any more, and even an override cannot double book
    const c2 = await cust('Pat Lee', '+19165550143');
    await expect(createManualBooking(input(c2.id, slot.startISO, { techId: slot.techId }) as never, A, NOW)).rejects.toMatchObject({ code: 'slot_unavailable' });
    await expect(createManualBooking(input(c2.id, slot.startISO, { techId: slot.techId, override: true }) as never, A, NOW)).rejects.toMatchObject({ code: 'slot_unavailable' });
    expect(await repo().bookings.list()).toHaveLength(1);
  });

  it('override books outside hours (8pm) but still on a free tech; no notification when notifyCustomer=false', async () => {
    const c = await cust();
    const date = (await firstSlots())[0]!.date;
    const eight = localToUtc(date, 20 * 60)!;
    await expect(createManualBooking(input(c.id, new Date(eight).toISOString()) as never, A, NOW)).rejects.toMatchObject({ code: 'slot_unavailable' });
    const r = await createManualBooking(input(c.id, new Date(eight).toISOString(), { override: true, notifyCustomer: false, techId: SEED_TECH_IDS[0] }) as never, A, NOW);
    expect(r.booking.status).toBe('confirmed');
    expect(emailOutbox()).toHaveLength(0);
    expect(await repo().notification_queue.list()).toHaveLength(0);
  });

  it('records an offline deposit and refuses out-of-area unless overridden', async () => {
    const c = await cust();
    const slot = (await firstSlots())[0]!;
    const r = await createManualBooking(input(c.id, slot.startISO, { deposit: 'collected', depositMethod: 'zelle' }) as never, A, NOW);
    expect(r.booking).toMatchObject({ deposit_status: 'paid', deposit_amount: depositAmount });
    expect((await repo().payments.list())[0]).toMatchObject({ kind: 'deposit', method: 'zelle', status: 'succeeded' });
    const slot2 = (await firstSlots(3))[0]!;
    await expect(createManualBooking(input(c.id, slot2.startISO, { zip: '90210' }) as never, A, NOW)).rejects.toMatchObject({ code: 'out_of_area' });
  });
});

describe('reschedule, cancel, no-show', () => {
  async function booked(deposit: 'none' | 'collected' = 'collected', day = 3) {
    const c = await cust();
    const slot = (await firstSlots(day))[0]!;
    return (await createManualBooking(input(c.id, slot.startISO, { deposit }) as never, A, NOW)).booking;
  }
  it('reschedule moves the booking, swaps reminders, never counts against the customer limit', async () => {
    const b = await booked();
    const target = (await firstSlots(5))[0]!;
    const moved = await adminReschedule(b.id, { startsAt: target.startISO, notifyCustomer: true }, A, NOW);
    expect(moved.starts_at).toBe(target.startISO);
    expect(moved.reschedule_count).toBe(0);
    const q = await repo().notification_queue.list({ where: { booking_id: b.id } });
    expect(q.filter((x) => x.status === 'pending' && x.kind === 'reminder_24h')).toHaveLength(1);
    expect(q.filter((x) => x.status === 'pending' && x.kind === 'reminder_24h')[0]!.run_at).toBe(new Date(Date.parse(target.startISO) - 24 * H).toISOString());
    await expect(adminReschedule(b.id, { startsAt: target.startISO, notifyCustomer: false, techId: 'nope' }, A, NOW)).rejects.toBeTruthy();
  });
  it('cancel: customer-initiated >=48h refunds, 24-48h credits, <24h keeps; "we cancelled" refunds; override choice wins', async () => {
    const mk = async (hoursOut: number) => { const b = await booked('collected', 4); await repo().bookings.update(b.id, { starts_at: new Date(NOW + hoursOut * H).toISOString(), ends_at: new Date(NOW + hoursOut * H + H).toISOString() }); return (await repo().bookings.get(b.id))!; };
    expect(policyPreview(await mk(60), NOW).outcome).toBe('refund');
    expect(policyPreview(await mk(30), NOW).outcome).toBe('credit');
    expect(policyPreview(await mk(10), NOW).outcome).toBe('forfeit');
    const b1 = await mk(10);
    expect((await adminCancel(b1.id, { reason: 'sick', initiatedBy: 'customer', choice: 'policy', notifyCustomer: true }, A, NOW)).outcome).toBe('forfeit');
    expect((await repo().bookings.get(b1.id))!).toMatchObject({ status: 'cancelled', deposit_status: 'forfeited' });
    const b2 = await mk(10);
    const r2 = await adminCancel(b2.id, { reason: 'we are sick', initiatedBy: 'us', choice: 'policy', notifyCustomer: true }, A, NOW);
    expect(r2.outcome).toBe('refund');
    expect((await repo().payments.list({ where: { kind: 'refund' } }))).toHaveLength(1);
    const b3 = await mk(10);
    expect((await adminCancel(b3.id, { reason: 'goodwill', initiatedBy: 'customer', choice: 'credit', notifyCustomer: false }, A, NOW)).outcome).toBe('credit');
    await expect(adminCancel(b3.id, { reason: 'again', initiatedBy: 'us', choice: 'policy', notifyCustomer: false }, A, NOW)).rejects.toMatchObject({ code: 'not_changeable' });
    for (const id of [b1.id, b2.id, b3.id]) expect((await repo().leads.get((await repo().bookings.get(id))!.lead_id!))!.stage).toBe('lost');
  });
  it('no-show forfeits the deposit and frees the calendar', async () => {
    const b = await booked();
    const r = await adminCancel(b.id, { reason: 'no answer', initiatedBy: 'customer', choice: 'policy', noShow: true, notifyCustomer: true }, A, NOW);
    expect(r.outcome).toBe('forfeit');
    expect(r.booking.status).toBe('no_show');
    const slot = (await firstSlots(3)).find((s) => s.startISO === b.starts_at);
    expect(slot).toBeTruthy();
  });
});

describe('blocks, blackout, weather', () => {
  it('a block removes slots; a blackout closes the day; weather hides exterior slots and flags affected bookings', async () => {
    const c = await cust();
    const day = (await firstSlots(2))[0]!.date;
    const before = (await firstSlots(2)).length;
    await addBlock({ startsAt: new Date(localToUtc(day, 9 * 60)!).toISOString(), endsAt: new Date(localToUtc(day, 12 * 60)!).toISOString(), reason: 'dentist' }, A);
    expect((await firstSlots(2)).length).toBeLessThan(before);
    await expect(addBlock({ startsAt: '2026-10-20T10:00:00Z', endsAt: '2026-10-20T09:00:00Z' }, A)).rejects.toMatchObject({ code: 'bad_range' });
    const slot = (await firstSlots(3, ['decon']))[0]!; // exterior work
    await createManualBooking(input(c.id, slot.startISO, { services: ['decon'] }) as never, A, NOW);
    expect(await bookingsAffectedByWeather()).toHaveLength(0);
    expect(await toggleWeather(slot.date, 'rain', A)).toBe(true);
    expect((await bookingsAffectedByWeather())).toHaveLength(1);
    expect((await availabilityFor(NOW, { durationMin: 60, zip: '95624', exterior: true })).slots.some((s) => s.date === slot.date)).toBe(false);
    expect(await toggleWeather(slot.date, null, A)).toBe(false);
    await addBlackout({ date: day, reason: 'holiday' }, A);
    expect((await firstSlots(2)).some((s) => s.date === day)).toBe(false);
    const cal = await loadCalendar(day, 3);
    expect(cal.days).toHaveLength(3);
    expect(cal.days[0]!.blackout).toHaveLength(1);
    expect(cal.techs).toHaveLength(2);
  });
});

describe('settings overrides', () => {
  it('merge falls back to config; schema rejects junk; saved durations and buffers change the engine; reset restores config', async () => {
    expect(mergeSettings(null).durations.interior.sedan).toBe(durations.interior.sedan);
    expect(settingsSchema.safeParse({ bufferMin: -1 }).success).toBe(false);
    expect(settingsSchema.safeParse({ nonsense: 1 }).success).toBe(false);
    expect(settingsSchema.safeParse({ durations: { interior: { sedan: 10 } } }).success).toBe(false);
    const base = computeDuration({ services: ['interior'], sizeClass: 'sedan' });
    await saveSettings({ durations: { interior: { sedan: durations.interior.sedan + 60 } } }, A);
    expect(computeDuration({ services: ['interior'], sizeClass: 'sedan' })).toBe(base + 60);
    expect(computeDuration({ services: ['interior'], sizeClass: 'suv' })).toBe(durations.interior.suv); // untouched keys fall back
    const eff = await saveSettings({ bufferMin: bookingConfig.bufferMin + 40, durations: { interior: { sedan: durations.interior.sedan + 60 } } }, A);
    expect(eff.bufferMin).toBe(bookingConfig.bufferMin + 40);
    expect(diffFromConfig(eff)).toMatchObject({ bufferMin: bookingConfig.bufferMin + 40 });
    // wider buffer between jobs => fewer same-day slots after one booking
    const c = await cust();
    const slots = await firstSlots(2);
    await createManualBooking(input(c.id, slots[0]!.startISO, { techId: slots[0]!.techId }) as never, A, NOW);
    const withBuffer = (await firstSlots(2)).filter((s) => s.techIds.includes(slots[0]!.techId)).length;
    await resetSettings(A);
    expect(computeDuration({ services: ['interior'], sizeClass: 'sedan' })).toBe(base);
    const without = (await firstSlots(2)).filter((s) => s.techIds.includes(slots[0]!.techId)).length;
    expect(without).toBeGreaterThanOrEqual(withBuffer);
    await primeSettings(true);
  });
  it('a corrupt override row never breaks booking (falls back to config)', async () => {
    await repo().settings.insert({ id: 'booking', value: { bufferMin: 'lots' } });
    const e = await primeSettings(true);
    expect(e.bufferMin).toBe(bookingConfig.bufferMin);
  });
});
