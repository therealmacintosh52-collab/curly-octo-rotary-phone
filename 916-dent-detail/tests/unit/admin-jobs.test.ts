// Tech-view lifecycle on the real booking service + mock repo: on my way, start, add-ons, payment, finish, invoice,
// review request, referral credits, idempotent replays.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { repo } from '@/lib/db';
import { createBooking, confirmDeposit } from '@/lib/booking/service';
import { availabilityFor } from '@/lib/booking/loader';
import type { CreateBookingInput } from '@/lib/booking/schema';
import { localToUtc } from '@/lib/availability/tz';
import { computeDuration } from '@/lib/pricing';
import { emailOutbox } from '@/lib/email';
import { smsOutbox } from '@/lib/sms';
import { dispatchDue } from '@/lib/notify';
import { depositAmount, addonPrices, fixedPrices, referralCredit } from '@/config/pricing';
import { editJobLines, ensureJobForBooking, finishJob, loadJobBundle, makePayLink, demoPayLink, sendOnMyWay, startJobForBooking, takePayment } from '@/lib/admin/jobs';
import { ensureReferralCode, validateReferralCode, applyReferralToCustomer } from '@/lib/referrals';

const H = 3_600_000;
const NOW = localToUtc('2026-10-15', 10 * 60)!;
const A = 'owner:test';

async function book(phone: string, name: string, over: Partial<CreateBookingInput> = {}, key = `idem-${Math.random().toString(36).slice(2, 12)}`, day = 2) {
  const r = await availabilityFor(NOW, { durationMin: computeDuration({ services: ['interior'], sizeClass: 'sedan' }), zip: '95624', exterior: true });
  const dates = [...new Set(r.slots.map((s) => s.date))];
  const slot = r.slots.filter((s) => s.date === dates[day])[0]!;
  const input: CreateBookingInput = {
    services: ['interior'], addons: [], sizeClass: 'sedan', vehicle: { year: 2020, make: 'Toyota', model: 'Camry' }, photoPaths: [], zip: '95624', startsAt: slot.startISO,
    contact: { name, phone, email: `${name.split(' ')[0]!.toLowerCase()}@example.com`, addressLine: '123 Main St', smsConsent: true }, ...over,
  };
  const b = await createBooking(input, key, NOW);
  return confirmDeposit(b.booking.id, NOW);
}

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
afterAll(() => { vi.useRealTimers(); });
beforeEach(async () => { vi.setSystemTime(NOW); await repo().reset!(); smsOutbox().length = 0; emailOutbox().length = 0; });

describe('job lifecycle', () => {
  it('seeds lines from config, runs on-my-way -> start -> add-on -> cash -> finish -> invoice + review request', async () => {
    const b = await book('(916) 555-0142', 'Sam Rivera');
    const job = await ensureJobForBooking(b.id);
    const lines0 = (await loadJobBundle(job.id))!.lines;
    expect(lines0.find((l) => l.kind === 'service')!.amount).toBe(fixedPrices.interior!.sedan);

    const eta = await sendOnMyWay(b.id, A, 20);
    expect(eta).toEqual({ etaMinutes: 20, alreadySent: false });
    expect((await repo().bookings.get(b.id))!.status).toBe('on_the_way');
    expect((await sendOnMyWay(b.id, A, 20)).alreadySent).toBe(true);
    expect(smsOutbox().filter((m) => /on the way/i.test(m.body))).toHaveLength(1); // not texted twice

    await startJobForBooking(b.id, A);
    await startJobForBooking(b.id, A); // replay
    expect((await repo().bookings.get(b.id))!.status).toBe('in_progress');
    expect((await repo().leads.list())[0]!.stage).toBe('in_progress');

    await editJobLines(job.id, { op: 'add_addon', id: 'l-addon-1', addonId: 'pet-hair' }, A);
    await editJobLines(job.id, { op: 'add_addon', id: 'l-addon-1', addonId: 'pet-hair' }, A); // replay: no duplicate
    const bundle = (await loadJobBundle(job.id))!;
    expect(bundle.lines.filter((l) => l.kind === 'addon')).toHaveLength(1);
    expect(bundle.lines.find((l) => l.kind === 'addon')!.amount).toBe(addonPrices['pet-hair']);
    const subtotal = fixedPrices.interior!.sedan + addonPrices['pet-hair'];
    expect(bundle.math.subtotal).toBe(subtotal);
    expect(bundle.math.total).toBe(subtotal - depositAmount);

    const paid = await takePayment(job.id, { amount: subtotal - depositAmount, method: 'cash', actor: A, opId: 'pay-1' });
    expect(paid.math.balance).toBe(0);
    expect(paid.invoice.status).toBe('paid');
    await takePayment(job.id, { amount: 1, method: 'cash', actor: A, opId: 'pay-1' }).catch(() => undefined); // replayed opId: still one payment
    expect((await repo().payments.list({ where: { kind: 'balance' } }))).toHaveLength(1);

    const fin = await finishJob(job.id, A, { now: NOW + 3 * H });
    expect(fin.replay).toBe(false);
    expect(fin.invoice.status).toBe('paid');
    expect(fin.invoice.number).toBe('INV-2026-0001');
    const again = await finishJob(job.id, A, { now: NOW + 3 * H });
    expect(again.replay).toBe(true);
    expect(await repo().invoices.list()).toHaveLength(1);

    const after = (await repo().bookings.get(b.id))!;
    expect(after.status).toBe('completed');
    expect((await repo().jobs.get(job.id))!).toMatchObject({ stage: 'done', final_price: subtotal });
    expect((await repo().leads.list())[0]!.stage).toBe('done');
    const q = await repo().notification_queue.list({ where: { booking_id: b.id } });
    expect(q.filter((x) => x.kind === 'review_request' || x.kind === 'rebook_6mo')).toHaveLength(2);
    expect(q.find((x) => x.kind === 'review_request')!.payload.invoiceUrl).toMatch(/\/invoice\//);
    vi.setSystemTime(NOW + 6 * H);
    await dispatchDue(NOW + 6 * H, 20);
    expect((await repo().notification_queue.get(q.find((x) => x.kind === 'review_request')!.id))!.status).toBe('sent');
  });

  it('refuses to finish without a price (dent work), and refuses to finish a cancelled booking', async () => {
    const b = await book('(916) 555-0143', 'Pat Lee');
    const job = await ensureJobForBooking(b.id);
    await editJobLines(job.id, { op: 'remove', id: (await loadJobBundle(job.id))!.lines.find((l) => l.kind === 'service')!.id }, A);
    await expect(finishJob(job.id, A)).rejects.toMatchObject({ status: 409, code: 'no_price' });
    await repo().bookings.update(b.id, { status: 'cancelled' });
    await editJobLines(job.id, { op: 'add_custom', id: 'c1', label: 'Door ding', amount: 175 }, A);
    await expect(finishJob(job.id, A)).rejects.toMatchObject({ code: 'bad_state' });
  });

  it('unpaid balance leaves the invoice "sent"; pay link demo settles it', async () => {
    const b = await book('(916) 555-0144', 'Kim Park');
    const job = await ensureJobForBooking(b.id);
    await startJobForBooking(b.id, A);
    const link = await makePayLink(job.id, 'http://localhost:3000', A);
    expect(link.mock).toBe(true);
    expect(link.url).toMatch(/demo-pay\/cs_mock_/);
    expect(link.amount).toBe(fixedPrices.interior!.sedan - depositAmount);
    const fin = await finishJob(job.id, A);
    expect(fin.invoice.status).toBe('sent');
    const settled = await demoPayLink(job.id, A);
    expect(settled.invoice.status).toBe('paid');
    expect((await repo().payments.list({ where: { kind: 'balance' } }))[0]).toMatchObject({ method: 'stripe_link', mock: true });
  });

  it('overpaying is refused', async () => {
    const b = await book('(916) 555-0145', 'Lee Wu');
    const job = await ensureJobForBooking(b.id);
    await expect(takePayment(job.id, { amount: 99999, method: 'cash', actor: A })).rejects.toMatchObject({ code: 'overpay' });
  });
});

describe('referrals', () => {
  it('validates codes (format, unknown, self, existing customer) and runs the two-sided credit once', async () => {
    const a = await book('(916) 555-0150', 'Ann Referrer');
    const refCust = (await repo().customers.get(a.customer_id!))!;
    const code = await ensureReferralCode(refCust.id);
    expect((await ensureReferralCode(refCust.id)).id).toBe(code.id);
    expect(code.credit_amount).toBe(referralCredit);
    expect(await validateReferralCode('nope!!')).toMatchObject({ valid: false, reason: 'invalid_format' });
    expect(await validateReferralCode('ZZZZZZ')).toMatchObject({ valid: false, reason: 'unknown' });
    expect(await validateReferralCode(code.code.toLowerCase(), { customerId: refCust.id })).toMatchObject({ valid: false, reason: 'self' });
    expect(await validateReferralCode(` ${code.code.slice(0, 3)}-${code.code.slice(3)} `, { phone: '(916) 555-0199' })).toMatchObject({ valid: true, creditAmount: referralCredit });

    // referred customer books with the code: first invoice gets the discount
    const b = await book('(916) 555-0151', 'Ben Referred', { attribution: { ref: code.code } });
    const bc = (await repo().customers.get(b.customer_id!))!;
    expect(bc.referral_code_used).toBe(code.code);
    const jb = await ensureJobForBooking(b.id);
    const bundle = (await loadJobBundle(jb.id))!;
    expect(bundle.referralPreview).toHaveLength(1);
    expect(bundle.math.subtotal).toBe(fixedPrices.interior!.sedan - referralCredit);
    await startJobForBooking(b.id, A);
    const fin = await finishJob(jb.id, A);
    expect(fin.math.subtotal).toBe(fixedPrices.interior!.sedan - referralCredit);
    // referrer earned an available credit, exactly one
    const credits = await repo().referral_credits.list();
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({ status: 'available', amount: referralCredit, referred_customer_id: bc.id });

    // referrer's next job redeems it
    const a2 = await book('(916) 555-0150', 'Ann Referrer', {}, undefined, 4);
    const ja = await ensureJobForBooking(a2.id);
    const ab = (await loadJobBundle(ja.id))!;
    expect(ab.referralPreview.map((l) => l.amount)).toEqual([-referralCredit]);
    await startJobForBooking(a2.id, A);
    await finishJob(ja.id, A);
    expect((await repo().referral_credits.list())[0]!.status).toBe('redeemed');
    expect((await repo().referral_credits.list())[0]!.redeemed_booking_id).toBe(a2.id);
    // a used code cannot discount the same customer twice
    expect((await applyReferralToCustomer(bc.id, code.code)).valid).toBe(false); // now an existing customer
  });
});
