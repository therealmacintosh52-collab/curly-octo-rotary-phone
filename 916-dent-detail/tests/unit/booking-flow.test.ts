// Integration tests over the real booking service + mock repo + mock providers (no network, no keys).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { repo } from '@/lib/db';
import { BookingError, cancelBooking, confirmDeposit, createBooking, loadByToken, releaseHold, rescheduleBooking, verifyAndConfirm, viewFor } from '@/lib/booking/service';
import { availabilityFor } from '@/lib/booking/loader';
import type { CreateBookingInput } from '@/lib/booking/schema';
import { dispatchDue } from '@/lib/notify';
import { emailOutbox } from '@/lib/email';
import { smsOutbox } from '@/lib/sms';
import { confirmMockPayment } from '@/lib/stripe';
import { localToUtc } from '@/lib/availability/tz';
import { computeDuration } from '@/lib/pricing';
import { bookingConfig } from '@/config/booking';

const H = 3_600_000;
const NOW = localToUtc('2026-10-15', 10 * 60)!; // Thu 10:00 PDT
const A_PATH = 'quotes/11111111-1111-4111-8111-111111111111.jpg';

function input(over: Partial<CreateBookingInput> & { startsAt: string }): CreateBookingInput {
  return {
    services: ['interior'], addons: [], sizeClass: 'sedan', vehicle: { year: 2020, make: 'Toyota', model: 'Camry' }, photoPaths: [], zip: '95624',
    contact: { name: 'Sam Rivera', phone: '(916) 555-0142', email: 'sam@example.com', addressLine: '123 Main St', smsConsent: true },
    ...over,
  };
}
async function firstSlot(services = ['interior'], day = 0) {
  const r = await availabilityFor(NOW, { durationMin: computeDuration({ services, sizeClass: 'sedan' }), zip: '95624', exterior: true });
  const dates = [...new Set(r.slots.map((s) => s.date))];
  return r.slots.filter((s) => s.date === dates[day]).map((s) => ({ ...s, startsAt: s.startISO }));
}

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
afterAll(() => { vi.useRealTimers(); });
beforeEach(async () => { vi.setSystemTime(NOW); await repo().reset!(); smsOutbox().length = 0; emailOutbox().length = 0; });

describe('create + deposit + confirm', () => {
  it('creates a held booking, then confirm schedules reminders and sends confirmation (SMS + email)', async () => {
    const slots = await firstSlot(['interior'], 2); // far enough ahead for both reminders
    const r = await createBooking(input({ startsAt: slots[0]!.startsAt }), 'idem-key-0001', NOW);
    expect(r.booking.status).toBe('pending_deposit');
    expect(r.payment.mode).toBe('mock'); expect(r.payment.intentId).toMatch(/^pi_mock_/);
    expect(r.booking.hold_expires_at).toBeTruthy();
    expect(await repo().notification_queue.list()).toHaveLength(0); // nothing is sent before the deposit

    expect(confirmMockPayment(r.payment.intentId)).toBe(true);
    const c = await verifyAndConfirm(r.booking.id);
    expect(c.status).toBe('confirmed'); expect(c.deposit_status).toBe('paid');
    const q = await repo().notification_queue.list();
    expect(q.map((x) => x.kind).sort()).toEqual(['confirmation', 'reminder_24h', 'reminder_2h'].sort());
    expect(emailOutbox()).toHaveLength(1);
    expect(smsOutbox()).toHaveLength(1);
    expect(smsOutbox()[0]!.body).toMatch(/STOP/);
    expect((await repo().payments.list())).toHaveLength(1);
    expect((await repo().jobs.list())).toHaveLength(1);
    expect((await repo().leads.list())[0]!.stage).toBe('booked');
  });
  it('verifyAndConfirm refuses until the payment actually succeeded', async () => {
    const r = await createBooking(input({ startsAt: (await firstSlot())[0]!.startsAt }), 'idem-key-0002', NOW);
    await expect(verifyAndConfirm(r.booking.id)).rejects.toMatchObject({ code: 'payment_incomplete' });
  });
  it('confirmDeposit is idempotent (webhook replay): one payment, one set of notifications', async () => {
    const r = await createBooking(input({ startsAt: (await firstSlot(['interior'], 2))[0]!.startsAt }), 'idem-key-0003', NOW);
    await confirmDeposit(r.booking.id, NOW); await confirmDeposit(r.booking.id, NOW); await confirmDeposit(r.booking.id, NOW);
    expect(await repo().payments.list()).toHaveLength(1);
    expect(await repo().notification_queue.list()).toHaveLength(3);
    expect(emailOutbox()).toHaveLength(1);
  });
  it('idempotency key replays the same booking', async () => {
    const s = (await firstSlot())[0]!.startsAt;
    const a = await createBooking(input({ startsAt: s }), 'idem-key-0004', NOW);
    const b = await createBooking(input({ startsAt: s }), 'idem-key-0004', NOW);
    expect(b.replay).toBe(true); expect(b.booking.id).toBe(a.booking.id);
    expect(await repo().bookings.list()).toHaveLength(1);
  });
  it('rejects a bad idempotency key', async () => {
    await expect(createBooking(input({ startsAt: (await firstSlot())[0]!.startsAt }), 'x', NOW)).rejects.toMatchObject({ code: 'bad_idempotency_key' });
  });
});

describe('double booking and capacity', () => {
  it('two customers racing for the same slot with two techs: both succeed on different techs; a third is refused', async () => {
    const s = (await firstSlot())[0]!.startsAt;
    const a = await createBooking(input({ startsAt: s }), 'idem-race-0001', NOW);
    const b = await createBooking(input({ startsAt: s, contact: { ...input({ startsAt: s }).contact, phone: '(916) 555-0143', email: 'b@example.com' } }), 'idem-race-0002', NOW);
    expect(a.booking.tech_id).not.toBe(b.booking.tech_id);
    await expect(createBooking(input({ startsAt: s, contact: { ...input({ startsAt: s }).contact, phone: '(916) 555-0144', email: 'c@example.com' } }), 'idem-race-0003', NOW))
      .rejects.toMatchObject({ code: 'slot_unavailable', status: 409 });
  });
  it('the DB layer itself refuses overlap even if the engine is bypassed', async () => {
    const s = (await firstSlot())[0]!.startsAt;
    const a = await createBooking(input({ startsAt: s }), 'idem-race-0004', NOW);
    await expect(repo().bookingsX.createChecked({ ...a.booking, id: undefined, idempotency_key: 'other' } as never)).rejects.toMatchObject({ name: 'SlotTakenError' });
  });
  it('a booked slot disappears from availability; releasing the hold brings it back', async () => {
    const slots = await firstSlot();
    const s = slots[0]!.startsAt;
    const a = await createBooking(input({ startsAt: s }), 'idem-hold-0001', NOW);
    const b = await createBooking(input({ startsAt: s, contact: { ...input({ startsAt: s }).contact, phone: '(916) 555-0143' } }), 'idem-hold-0002', NOW);
    const after = await firstSlot();
    expect(after.find((x) => x.startsAt === s)).toBeUndefined();
    await releaseHold(a.token); await releaseHold(b.token);
    expect((await firstSlot()).find((x) => x.startsAt === s)).toBeDefined();
  });
  it('unpaid hold lapses after holdMinutes and the cron expires it', async () => {
    const s = (await firstSlot())[0]!.startsAt;
    const a = await createBooking(input({ startsAt: s }), 'idem-exp-00001', NOW);
    const later = NOW + (bookingConfig.holdMinutes + 1) * 60_000;
    const sum = await dispatchDue(later);
    expect(sum.expiredHolds).toBe(1);
    expect((await repo().bookings.get(a.booking.id))!.status).toBe('expired');
    await expect(confirmDeposit(a.booking.id, later)).rejects.toMatchObject({ code: 'hold_expired' });
  });
});

describe('validation rules', () => {
  it('dent services need photos to book', async () => {
    const s = (await firstSlot(['pdr']))[0]!.startsAt;
    await expect(createBooking(input({ services: ['pdr'], startsAt: s }), 'idem-dent-0001', NOW)).rejects.toMatchObject({ code: 'photos_required' });
  });
  it('dent with photos books and is flagged for review when there is no quote', async () => {
    const s = (await firstSlot(['pdr']))[0]!.startsAt;
    const photos = [A_PATH, 'quotes/22222222-2222-4222-8222-222222222222.jpg'];
    const r = await createBooking(input({ services: ['pdr'], photoPaths: photos, startsAt: s }), 'idem-dent-0002', NOW);
    expect(r.booking.needs_review).toBe(true);
    expect(r.booking.price_low).toBeNull(); // never a fixed price without a photo quote
  });
  it('out-of-area and unknown ZIPs cannot book online', async () => {
    const s = (await firstSlot())[0]!.startsAt;
    await expect(createBooking(input({ zip: '90210', startsAt: s }), 'idem-zip-00001', NOW)).rejects.toMatchObject({ code: 'out_of_area' });
  });
  it('invalid phone, unknown service, off-grid time', async () => {
    const s = (await firstSlot())[0]!.startsAt;
    await expect(createBooking(input({ startsAt: s, contact: { ...input({ startsAt: s }).contact, phone: '12' } }), 'idem-val-00001', NOW)).rejects.toMatchObject({ code: 'invalid_phone' });
    await expect(createBooking(input({ startsAt: s, services: ['nope'] }), 'idem-val-00002', NOW)).rejects.toMatchObject({ code: 'invalid_selection' });
    await expect(createBooking(input({ startsAt: new Date(Date.parse(s) + 7 * 60_000).toISOString() }), 'idem-val-00003', NOW)).rejects.toMatchObject({ code: 'slot_unavailable' });
  });
  it('SMS consent is recorded with the exact wording; no consent means no texts', async () => {
    const s = (await firstSlot())[0]!.startsAt;
    const yes = await createBooking(input({ startsAt: s }), 'idem-sms-00001', NOW);
    const cust = await repo().customers.get(yes.booking.customer_id!);
    expect(cust!.sms_opt_in).toBe(true); expect(cust!.sms_opt_in_text).toMatch(/Reply STOP/); expect(cust!.sms_opt_in_at).toBeTruthy();

    const s2 = (await firstSlot())[3]!.startsAt;
    const no = await createBooking(input({ startsAt: s2, contact: { ...input({ startsAt: s2 }).contact, phone: '(916) 555-0177', email: 'n@example.com', smsConsent: false } }), 'idem-sms-00002', NOW);
    await confirmDeposit(no.booking.id, NOW);
    expect(smsOutbox()).toHaveLength(0); expect(emailOutbox().length).toBeGreaterThan(0);
  });
  it('captures lead source from attribution', async () => {
    const s = (await firstSlot())[0]!.startsAt;
    await createBooking(input({ startsAt: s, attribution: { utm_source: 'google', utm_medium: 'cpc', gclid: 'abc', landing_page: '/services' } }), 'idem-utm-00001', NOW);
    const lead = (await repo().leads.list())[0]!;
    expect(lead).toMatchObject({ source: 'google', utm_medium: 'cpc', gclid: 'abc', landing_page: '/services' });
  });
});

describe('reschedule and cancel (deposit policy)', () => {
  async function confirmed(dayOffset = 0, key = 'idem-conf-0001') {
    const slots = await firstSlot(['interior'], dayOffset);
    const r = await createBooking(input({ startsAt: slots[2]!.startsAt }), key, NOW);
    await confirmDeposit(r.booking.id, NOW);
    return { ...r, slots };
  }
  it('reschedule far ahead moves the booking, bumps the counter, replaces reminders', async () => {
    const { booking, token } = await confirmed(3);
    const other = (await firstSlot(['interior'], 5))[0]!;
    const before = (await repo().notification_queue.list({ where: { status: 'pending' } })).map((x) => x.dedupe_key);
    const moved = await rescheduleBooking(token, other.startsAt, null, NOW);
    expect(moved.starts_at).toBe(other.startsAt); expect(moved.reschedule_count).toBe(1);
    const cancelled = await repo().notification_queue.list({ where: { status: 'cancelled' } });
    expect(cancelled.map((x) => x.kind).sort()).toEqual(['reminder_24h', 'reminder_2h']);
    const pending = (await repo().notification_queue.list({ where: { status: 'pending' } })).map((x) => x.dedupe_key);
    expect(pending.some((k) => before.includes(k))).toBe(false);
    expect(pending.length).toBe(2);
    expect(booking.id).toBe(moved.id);
    expect(emailOutbox().some((e) => /Rescheduled/.test(e.subject))).toBe(true);
  });
  it('cannot reschedule onto a taken slot, nor past the reschedule limit', async () => {
    const { token } = await confirmed(3);
    const taken = (await firstSlot(['interior'], 5))[0]!;
    await createBooking(input({ startsAt: taken.startsAt, contact: { ...input({ startsAt: taken.startsAt }).contact, phone: '(916) 555-0150' } }), 'idem-other-001', NOW);
    await createBooking(input({ startsAt: taken.startsAt, contact: { ...input({ startsAt: taken.startsAt }).contact, phone: '(916) 555-0151' } }), 'idem-other-002', NOW);
    await expect(rescheduleBooking(token, taken.startsAt, null, NOW)).rejects.toMatchObject({ code: 'slot_unavailable' });
    for (let i = 0; i < 2; i++) await rescheduleBooking(token, (await firstSlot(['interior'], 6 + i))[0]!.startsAt, null, NOW);
    await expect(rescheduleBooking(token, (await firstSlot(['interior'], 9))[0]!.startsAt, null, NOW)).rejects.toMatchObject({ code: 'too_many_reschedules' });
  });
  it('reschedule inside the cutoff is refused', async () => {
    const { token, booking } = await confirmed(1);
    const nearNow = Date.parse(booking.starts_at) - 2 * H;
    vi.setSystemTime(nearNow);
    await expect(rescheduleBooking(token, (await firstSlot(['interior'], 6))[0]!.startsAt, null, nearNow)).rejects.toMatchObject({ code: 'closed_window' });
  });
  it('cancel 48h+ ahead refunds the deposit and cancels reminders', async () => {
    const { token, booking } = await confirmed(5);
    const r = await cancelBooking(token, 'plans changed', NOW);
    expect(r.depositOutcome).toBe('refund');
    const b = await repo().bookings.get(booking.id);
    expect(b).toMatchObject({ status: 'cancelled', deposit_status: 'refunded' });
    expect((await repo().notification_queue.list({ where: { status: 'pending' } }))).toHaveLength(0);
    expect(emailOutbox().some((e) => /cancelled/i.test(e.subject))).toBe(true);
  });
  it('cancel under 24h forfeits; 24-48h credits', async () => {
    const a = await confirmed(1, 'idem-conf-00a1');
    const start = Date.parse(a.booking.starts_at);
    vi.setSystemTime(start - 10 * H);
    expect((await cancelBooking(a.token, undefined, start - 10 * H)).depositOutcome).toBe('forfeit');
    expect((await repo().bookings.get(a.booking.id))!.deposit_status).toBe('forfeited');
    vi.setSystemTime(NOW);
    const b = await confirmed(6, 'idem-conf-00b1');
    const sb = Date.parse(b.booking.starts_at);
    vi.setSystemTime(sb - 30 * H);
    expect((await cancelBooking(b.token, undefined, sb - 30 * H)).depositOutcome).toBe('credit');
    expect((await repo().bookings.get(b.booking.id))!.deposit_status).toBe('credited');
  });
  it('a cancelled slot is bookable again; cancelling twice fails', async () => {
    const { token, booking } = await confirmed(5);
    await cancelBooking(token, undefined, NOW);
    await expect(cancelBooking(token, undefined, NOW)).rejects.toBeInstanceOf(BookingError);
    expect((await firstSlot(['interior'], 5)).find((s) => s.startsAt === booking.starts_at)).toBeDefined();
  });
  it('tokens: tampered link is rejected; view exposes policy text and permissions', async () => {
    const { token } = await confirmed(5);
    await expect(loadByToken(token.slice(0, -2) + 'xx')).rejects.toMatchObject({ code: 'invalid_link' });
    const v = await viewFor(await loadByToken(token), NOW);
    expect(v.canCancel && v.canReschedule).toBe(true);
    expect(v.policy.join(' ')).toMatch(/refunded in full/);
    expect(v.estimateLabel).toBe('Estimate — final price confirmed on inspection.');
  });
});

describe('dispatch worker', () => {
  async function setup() {
    const slots = await firstSlot(['interior'], 4);
    const r = await createBooking(input({ startsAt: slots[1]!.startsAt }), 'idem-disp-0001', NOW);
    await confirmDeposit(r.booking.id, NOW);
    smsOutbox().length = 0; emailOutbox().length = 0;
    return r;
  }
  it('sends the 24h reminder once when due, never twice', async () => {
    const r = await setup();
    const t = Date.parse(r.booking.starts_at) - 24 * H + 60_000;
    // keep the clock in daytime so quiet hours do not defer
    expect((await dispatchDue(t)).sent).toBeGreaterThanOrEqual(1);
    const count = smsOutbox().length;
    expect((await dispatchDue(t + 1000)).claimed).toBe(0);
    expect(smsOutbox().length).toBe(count);
  });
  it('defers a text that comes due in quiet hours to 8:00 local, but still emails now', async () => {
    const r = await setup();
    await repo().notification_queue.update((await repo().notification_queue.list({ where: { kind: 'reminder_24h' } }))[0]!.id, { run_at: new Date(localToUtc('2026-10-18', 22 * 60)!).toISOString() });
    const night = localToUtc('2026-10-18', 22 * 60 + 5)!;
    const sum = await dispatchDue(night);
    expect(sum.deferred).toBe(1);
    expect(smsOutbox()).toHaveLength(0); expect(emailOutbox()).toHaveLength(1);
    const row = (await repo().notification_queue.list({ where: { kind: 'reminder_24h' } }))[0]!;
    expect(row.status).toBe('pending');
    expect(Date.parse(row.run_at)).toBe(localToUtc('2026-10-19', 8 * 60));
    // morning: SMS goes out, email is NOT repeated
    await dispatchDue(localToUtc('2026-10-19', 8 * 60 + 1)!);
    expect(smsOutbox()).toHaveLength(1); expect(emailOutbox()).toHaveLength(1);
    void r;
  });
  it('STOP on file: never texts, still emails', async () => {
    const r = await setup();
    await repo().customers.update(r.booking.customer_id!, { sms_opt_out_at: new Date(NOW).toISOString() });
    await dispatchDue(Date.parse(r.booking.starts_at) - 24 * H + 60_000);
    expect(smsOutbox()).toHaveLength(0); expect(emailOutbox().length).toBeGreaterThan(0);
  });
  it('skips reminders for cancelled bookings (stale rows)', async () => {
    const r = await setup();
    await repo().bookings.update(r.booking.id, { status: 'cancelled' });
    const sum = await dispatchDue(Date.parse(r.booking.starts_at) - 1 * H);
    expect(sum.sent).toBe(0); expect(sum.skipped).toBeGreaterThan(0);
  });
});

describe('referral code entry (BookingFlow helper + server contract)', () => {
  it('normalises input the way the server does, so what the customer sees validated is what is stored', async () => {
    const { normalizeReferralInput } = await import('@/app/book/state');
    const { normalizeCode } = await import('@/lib/referrals');
    for (const raw of ['abc-234', ' abc 234 ', 'AbC234', 'abc\t234']) expect(normalizeReferralInput(raw)).toBe(normalizeCode(raw));
    expect(normalizeReferralInput(undefined)).toBe('');
    expect(normalizeReferralInput('x'.repeat(40)).length).toBe(20);
  });
  it('changing the code after a hold makes a new hold (it is part of the booking fingerprint)', async () => {
    const { bookingFingerprint, initialFlow } = await import('@/app/book/state');
    const f = initialFlow();
    const a = bookingFingerprint(f);
    expect(bookingFingerprint({ ...f, contact: { ...f.contact, referralCode: 'ab-cd12' } })).not.toBe(a);
    expect(bookingFingerprint({ ...f, contact: { ...f.contact, referralCode: ' AB CD12 ' } })).toBe(bookingFingerprint({ ...f, contact: { ...f.contact, referralCode: 'abcd12' } }));
  });
  it('a booking carrying attribution.ref stores it as referral_code_used and /api/referral/validate accepts a real code', async () => {
    const { ensureReferralCode } = await import('@/lib/referrals');
    const { POST } = await import('@/app/api/referral/validate/route');
    const owner = await repo().customers.insert({ name: 'Ref Erer', phone: '+19165550166', sms_opt_in: false });
    const code = (await ensureReferralCode(owner.id)).code;
    const res = await POST(new Request('http://x/api/referral/validate', { method: 'POST', body: JSON.stringify({ code: code.toLowerCase(), phone: '(916) 555-0177' }), headers: { 'content-type': 'application/json' } }));
    expect(await res.json()).toMatchObject({ valid: true });
    const bad = await POST(new Request('http://x/api/referral/validate', { method: 'POST', body: JSON.stringify({ code: 'NOPE9999' }), headers: { 'content-type': 'application/json' } }));
    expect(await bad.json()).toMatchObject({ valid: false, reason: 'unknown' });
    const slot = (await firstSlot())[0]!;
    const r = await createBooking(input({ startsAt: slot.startsAt, techId: slot.techId, attribution: { ref: code } as never, contact: { name: 'New Guy', phone: '(916) 555-0188', email: 'n@example.com', addressLine: '1 A St', smsConsent: false } }), 'ref-key-0000001', NOW);
    expect((await repo().customers.get(r.booking.customer_id!))!.referral_code_used).toBe(code);
  });
});
