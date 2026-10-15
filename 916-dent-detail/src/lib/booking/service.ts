// Booking orchestration: create (with hold + deposit intent), confirm deposit, reschedule, cancel, release.
// The only module that writes bookings. Everything external goes through lib/stripe, lib/notify, lib/db.
import { SMS_CONSENT_TEXT, bookingConfig, depositPolicy, serviceById } from '@/config/booking';
import { ESTIMATE_LABEL, depositAmount } from '@/config/pricing';
import { deriveSource } from '@/lib/attribution';
import { formatDay, formatTime } from '@/lib/availability/tz';
import { log } from '@/lib/api/log';
import { repo, SlotTakenError, type BookingRow, type Customer } from '@/lib/db';
import { assessZip } from '@/lib/geo';
import { cancelReminders, enqueuePlanned, scheduleForBooking } from '@/lib/notify';
import { dispatchDue } from '@/lib/notify/dispatch';
import { computeDuration, computePrice, validateSelection } from '@/lib/pricing';
import { cancelIntent, createDepositIntent, intentStatus, isStripeLive, refundIntent } from '@/lib/stripe';
import { normalizePhone } from '@/lib/sms';
import { syncBookingEvent } from './gcal';
import { loadAvailabilityInput } from './loader';
import { checkSlot } from '@/lib/availability/engine';
import { decisionMessage, evaluateCancel, evaluateReschedule, policyLines } from './policy';
import { transition, type BookingStatus } from './state';
import type { CreateBookingInput } from './schema';
import { signBookingToken, verifyBookingToken } from './tokens';
import { primeSettings } from '@/lib/admin/settings';

const MIN = 60_000;
const HOUR = 3_600_000;

export class BookingError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); this.name = 'BookingError'; }
}

export type PaymentInfo = { mode: 'mock' | 'live'; clientSecret: string; intentId: string; amount: number; publishableKey?: string };

const tokenFor = (b: BookingRow) => signBookingToken(b.id, Math.max(Date.parse(b.starts_at), Date.now()) + 7 * 24 * HOUR);

async function upsertCustomer(c: CreateBookingInput['contact'], phone: string, attribution?: CreateBookingInput['attribution']): Promise<Customer> {
  const db = repo();
  const now = new Date().toISOString();
  const existing = await db.customers.first({ where: { phone } });
  const consent = c.smsConsent
    ? { sms_opt_in: true, sms_opt_in_at: now, sms_opt_in_text: SMS_CONSENT_TEXT, sms_opt_out_at: null }
    : {};
  if (existing) return db.customers.update(existing.id, { name: c.name, email: c.email, ...consent });
  return db.customers.insert({
    name: c.name, email: c.email, phone, sms_opt_in: c.smsConsent, sms_opt_in_at: c.smsConsent ? now : null,
    sms_opt_in_text: c.smsConsent ? SMS_CONSENT_TEXT : null, referral_code_used: attribution?.ref ?? null,
  });
}

export async function paymentFor(b: BookingRow): Promise<PaymentInfo | null> {
  if (!b.payment_intent_id) return null;
  const live = isStripeLive() && !b.payment_intent_id.startsWith('pi_mock_');
  // clientSecret for an existing live intent is re-fetched lazily by the route when needed; mock secrets are derivable.
  return { mode: live ? 'live' : 'mock', clientSecret: live ? '' : `${b.payment_intent_id}_secret_mock`, intentId: b.payment_intent_id, amount: b.deposit_amount, publishableKey: live ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : undefined };
}

export async function createBooking(input: CreateBookingInput, idempotencyKey: string, now = Date.now()): Promise<{ booking: BookingRow; token: string; payment: PaymentInfo; replay: boolean }> {
  const db = repo();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey)) throw new BookingError('bad_idempotency_key', 'Missing or invalid idempotency key.');

  // Idempotent replay: same key returns the same booking instead of creating another.
  const prior = await db.bookings.first({ where: { idempotency_key: idempotencyKey } });
  if (prior) {
    let payment = await paymentFor(prior);
    if (payment && payment.mode === 'live' && prior.status === 'pending_deposit') payment = { ...payment, clientSecret: await liveSecret(prior.payment_intent_id!) };
    return { booking: prior, token: tokenFor(prior), payment: payment!, replay: true };
  }

  await primeSettings(); // P3: owner duration overrides must be loaded before computeDuration
  const sel = validateSelection(input.services, input.sizeClass, input.addons);
  if (!sel.ok) throw new BookingError('invalid_selection', sel.error);
  const phone = normalizePhone(input.contact.phone);
  if (!phone) throw new BookingError('invalid_phone', 'Enter a valid US mobile number.');

  const needsPhotos = sel.services.some((s) => serviceById(s)?.requiresPhotos);
  if (needsPhotos && input.photoPaths.length < bookingConfig.photos.minForDents) {
    throw new BookingError('photos_required', `Dent work needs at least ${bookingConfig.photos.minForDents} photos before booking.`);
  }

  const area = assessZip(input.zip);
  if (area.status !== 'in_area') throw new BookingError('out_of_area', area.message, 422);

  // Quote (if the customer ran one) supplies the dent range + panel count.
  const quote = input.quoteId ? await db.quotes.get(input.quoteId) : null;
  const dentQuote = quote && quote.low != null && quote.high != null ? { low: quote.low, high: quote.high } : null;
  const panels = quote && Array.isArray(quote.panels) ? quote.panels.length || null : null;
  const price = computePrice({ services: sel.services, sizeClass: sel.sizeClass, addons: sel.addons, dentQuote, travelFee: area.travelFee });
  if (!price.ok) throw new BookingError('pricing_error', price.error);
  const duration = computeDuration({ services: sel.services, sizeClass: sel.sizeClass, addons: sel.addons, panels });
  const exterior = sel.services.some((s) => serviceById(s)?.exterior);

  const startMs = Date.parse(input.startsAt);
  const req = { durationMin: duration, zip: input.zip, exterior, preferredTechId: input.techId ?? null };
  const avail = await loadAvailabilityInput(now, req);
  const slot = checkSlot(avail, startMs, input.techId ?? null);
  if (!slot.ok) throw new BookingError('slot_unavailable', 'That time is no longer available. Please pick another.', 409);

  const customer = await upsertCustomer(input.contact, phone, input.attribution);
  const vehicle = await db.vehicles.insert({ customer_id: customer.id, year: input.vehicle.year, make: input.vehicle.make, model: input.vehicle.model, size_class: sel.sizeClass, color: input.vehicle.color ?? null });
  const a = input.attribution ?? {};
  const lead = await db.leads.insert({
    customer_id: customer.id, name: input.contact.name, phone, email: input.contact.email, zip: input.zip, stage: 'quoted', source: deriveSource(a),
    utm_source: a.utm_source ?? null, utm_medium: a.utm_medium ?? null, utm_campaign: a.utm_campaign ?? null, utm_term: a.utm_term ?? null, utm_content: a.utm_content ?? null,
    gclid: a.gclid ?? null, fbclid: a.fbclid ?? null, referrer: a.referrer ?? null, landing_page: a.landing_page ?? null, first_touch: input.firstTouch ?? null,
    area_status: area.status,
  });

  const holdMs = bookingConfig.holdMinutes * MIN;
  let booking: BookingRow;
  try {
    booking = await db.bookingsX.createChecked({
      customer_id: customer.id, vehicle_id: vehicle.id, lead_id: lead.id, quote_id: quote?.id ?? null, tech_id: slot.techId, status: 'pending_deposit',
      services: sel.services, addons: sel.addons, size_class: sel.sizeClass,
      starts_at: new Date(startMs).toISOString(), ends_at: new Date(startMs + duration * MIN).toISOString(), duration_min: duration,
      hold_expires_at: new Date(now + holdMs).toISOString(),
      zip: input.zip, address_line: input.contact.addressLine, city: area.city ?? null, area_status: area.status,
      travel_fee: area.travelFee ?? 0, price_low: price.totalLow, price_high: price.totalHigh, needs_review: needsPhotos && !dentQuote,
      deposit_amount: depositAmount, deposit_status: 'pending', idempotency_key: idempotencyKey, reschedule_count: 0,
      customer_notes: input.contact.notes ?? null,
    });
  } catch (e) {
    if (e instanceof SlotTakenError) throw new BookingError('slot_unavailable', 'That time was just taken. Please pick another.', 409);
    throw e;
  }

  const intent = await createDepositIntent({ amount: depositAmount, bookingId: booking.id, email: input.contact.email, idempotencyKey });
  booking = await db.bookings.update(booking.id, { payment_intent_id: intent.id });
  await db.events.insert({ type: 'booking.created', entity_type: 'booking', entity_id: booking.id, actor: 'customer', data: { services: sel.services, source: lead.source, mock_payment: intent.mock } });
  log('info', 'booking.created', { booking: booking.id, services: sel.services, mockPayment: intent.mock });

  return {
    booking, token: tokenFor(booking), replay: false,
    payment: { mode: intent.mock ? 'mock' : 'live', clientSecret: intent.clientSecret, intentId: intent.id, amount: intent.amount, publishableKey: intent.mock ? undefined : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY },
  };
}

async function liveSecret(intentId: string): Promise<string> {
  const Stripe = (await import('stripe')).default;
  const pi = await new Stripe(process.env.STRIPE_SECRET_KEY!).paymentIntents.retrieve(intentId);
  return pi.client_secret ?? '';
}

/** Deposit confirmed (webhook, client verification, or mock button). Idempotent. */
export async function confirmDeposit(bookingId: string, now = Date.now()): Promise<BookingRow> {
  const db = repo();
  const b = await db.bookings.get(bookingId);
  if (!b) throw new BookingError('not_found', 'Booking not found.', 404);
  if (b.status === 'confirmed' || b.status === 'on_the_way' || b.status === 'in_progress' || b.status === 'completed') return b;
  if (b.status === 'expired' || b.status === 'cancelled') {
    // Late payment on a lapsed hold: refund rather than double-book a slot we may have released.
    if (b.payment_intent_id) await refundIntent(b.payment_intent_id);
    await db.events.insert({ type: 'booking.late_payment_refunded', entity_type: 'booking', entity_id: b.id, actor: 'system', data: {} });
    throw new BookingError('hold_expired', 'This reservation expired before payment arrived. Your deposit is being refunded. Please book again.', 409);
  }
  const next = transition(b.status as BookingStatus, 'deposit_paid');
  const updated = await db.bookings.update(b.id, { status: next, deposit_status: 'paid', hold_expires_at: null });
  if (b.payment_intent_id && !(await db.payments.first({ where: { stripe_payment_intent_id: b.payment_intent_id } }))) {
    await db.payments.insert({ booking_id: b.id, customer_id: b.customer_id ?? null, kind: 'deposit', amount: b.deposit_amount, status: 'succeeded', method: 'card', stripe_payment_intent_id: b.payment_intent_id, mock: b.payment_intent_id.startsWith('pi_mock_') });
  }
  if (b.lead_id) await db.leads.update(b.lead_id, { stage: 'booked' }).catch(() => undefined);
  await db.jobs.insert({ booking_id: b.id, customer_id: b.customer_id ?? null, vehicle_id: b.vehicle_id ?? null, tech_id: b.tech_id ?? null, stage: 'booked' });
  await scheduleForBooking(b.id, { now });
  const tech = b.tech_id ? await db.techs.get(b.tech_id) : null;
  const eventId = await syncBookingEvent('upsert', updated, tech);
  if (eventId && eventId !== updated.gcal_event_id) await db.bookings.update(b.id, { gcal_event_id: eventId });
  await db.events.insert({ type: 'booking.confirmed', entity_type: 'booking', entity_id: b.id, actor: 'system', data: {} });
  await dispatchDue(now, 10); // send the confirmation right away (cron also picks it up)
  return (await db.bookings.get(b.id))!;
}

/** Verify with the payment provider, then confirm. Used by the client after Stripe's confirmPayment resolves. */
export async function verifyAndConfirm(bookingId: string): Promise<BookingRow> {
  const b = await repo().bookings.get(bookingId);
  if (!b || !b.payment_intent_id) throw new BookingError('not_found', 'Booking not found.', 404);
  if (b.status !== 'pending_deposit') return confirmDeposit(bookingId);
  const st = await intentStatus(b.payment_intent_id);
  if (st !== 'succeeded') throw new BookingError('payment_incomplete', 'Payment has not completed yet.', 402);
  return confirmDeposit(bookingId);
}

export async function loadByToken(token: string, now = Date.now()): Promise<BookingRow> {
  const v = verifyBookingToken(token, now);
  if (!v.ok) throw new BookingError(v.reason === 'expired' ? 'link_expired' : 'invalid_link', v.reason === 'expired' ? 'This link has expired. Please call or text us.' : 'This link is not valid.', v.reason === 'expired' ? 410 : 404);
  const b = await repo().bookings.get(v.bookingId);
  if (!b) throw new BookingError('not_found', 'Booking not found.', 404);
  return b;
}

export type BookingView = {
  id: string; status: BookingStatus; services: { id: string; plain: string }[]; startsAt: string; endsAt: string; dayLabel: string; timeLabel: string;
  city: string | null; zip: string | null; vehicle: string | null; depositAmount: number; depositStatus: string; priceLow: number | null; priceHigh: number | null; travelFee: number;
  estimateLabel: string; policy: string[]; payment: PaymentInfo | null;
  canReschedule: boolean; rescheduleMessage: string; canCancel: boolean; cancelMessage: string; cancelOutcome: string;
  slotQuery: { services: string[]; addons: string[]; sizeClass: string; zip: string; panels?: number };
  mock: boolean;
};

export async function viewFor(b: BookingRow, now = Date.now()): Promise<BookingView> {
  const db = repo();
  const veh = b.vehicle_id ? await db.vehicles.get(b.vehicle_id) : null;
  const pol = { status: b.status as BookingStatus, startsAt: Date.parse(b.starts_at), depositPaid: b.deposit_status === 'paid', rescheduleCount: b.reschedule_count };
  const rs = evaluateReschedule(pol, now);
  const cn = evaluateCancel(pol, now);
  const start = Date.parse(b.starts_at);
  const quote = b.quote_id ? await db.quotes.get(b.quote_id) : null;
  return {
    id: b.id, status: b.status as BookingStatus,
    services: b.services.map((s) => ({ id: s, plain: serviceById(s)?.plain ?? s })),
    startsAt: b.starts_at, endsAt: b.ends_at, dayLabel: formatDay(start), timeLabel: formatTime(start),
    city: b.city ?? null, zip: b.zip ?? null, vehicle: veh ? [veh.year, veh.make, veh.model].filter(Boolean).join(' ') : null,
    depositAmount: b.deposit_amount, depositStatus: b.deposit_status, priceLow: b.price_low ?? null, priceHigh: b.price_high ?? null, travelFee: b.travel_fee,
    estimateLabel: ESTIMATE_LABEL, policy: policyLines(depositPolicy), payment: b.status === 'pending_deposit' ? await paymentFor(b) : null,
    canReschedule: rs.allowed, rescheduleMessage: decisionMessage(rs),
    canCancel: cn.allowed, cancelMessage: decisionMessage(cn), cancelOutcome: cn.allowed ? cn.depositOutcome : 'none',
    slotQuery: { services: b.services, addons: b.addons, sizeClass: b.size_class ?? 'sedan', zip: b.zip ?? '', panels: quote && Array.isArray(quote.panels) && quote.panels.length ? quote.panels.length : undefined },
    mock: Boolean(b.payment_intent_id?.startsWith('pi_mock_')),
  };
}

export async function rescheduleBooking(token: string, startsAtISO: string, techId: string | null, now = Date.now()): Promise<BookingRow> {
  const db = repo();
  const b = await loadByToken(token, now);
  const pol = { status: b.status as BookingStatus, startsAt: Date.parse(b.starts_at), depositPaid: b.deposit_status === 'paid', rescheduleCount: b.reschedule_count };
  const d = evaluateReschedule(pol, now);
  if (!d.allowed) throw new BookingError(d.reason, decisionMessage(d), 409);
  const startMs = Date.parse(startsAtISO);
  const exterior = b.services.some((s) => serviceById(s)?.exterior);
  const avail = await loadAvailabilityInput(now, { durationMin: b.duration_min, zip: b.zip, exterior, excludeBookingId: b.id, preferredTechId: techId ?? b.tech_id });
  const slot = checkSlot(avail, startMs, techId);
  if (!slot.ok) throw new BookingError('slot_unavailable', 'That time is not available. Please pick another.', 409);
  let moved: BookingRow;
  try {
    moved = await db.bookingsX.moveChecked(b.id, { starts_at: new Date(startMs).toISOString(), ends_at: new Date(startMs + b.duration_min * MIN).toISOString(), tech_id: slot.techId });
  } catch (e) {
    if (e instanceof SlotTakenError) throw new BookingError('slot_unavailable', 'That time was just taken. Please pick another.', 409);
    throw e;
  }
  moved = await db.bookings.update(b.id, { reschedule_count: b.reschedule_count + 1 });
  await cancelReminders(b.id);
  await scheduleForBooking(b.id, { now, rescheduled: true });
  const tech = moved.tech_id ? await db.techs.get(moved.tech_id) : null;
  const ev = await syncBookingEvent('upsert', moved, tech);
  if (ev && ev !== moved.gcal_event_id) await db.bookings.update(b.id, { gcal_event_id: ev });
  await db.events.insert({ type: 'booking.rescheduled', entity_type: 'booking', entity_id: b.id, actor: 'customer', data: { late: d.late } });
  await dispatchDue(now, 10);
  return (await db.bookings.get(b.id))!;
}

export async function cancelBooking(token: string, reason: string | undefined, now = Date.now()): Promise<{ booking: BookingRow; depositOutcome: string }> {
  const db = repo();
  const b = await loadByToken(token, now);
  const pol = { status: b.status as BookingStatus, startsAt: Date.parse(b.starts_at), depositPaid: b.deposit_status === 'paid', rescheduleCount: b.reschedule_count };
  const d = evaluateCancel(pol, now);
  if (!d.allowed) throw new BookingError(d.reason, decisionMessage(d), 409);
  const nextStatus = transition(b.status as BookingStatus, 'cancel');
  let depositStatus = b.deposit_status;
  if (b.deposit_status === 'paid') {
    if (d.depositOutcome === 'refund') { if (b.payment_intent_id) await refundIntent(b.payment_intent_id); depositStatus = 'refunded'; }
    else if (d.depositOutcome === 'credit') depositStatus = 'credited';
    else if (d.depositOutcome === 'forfeit') depositStatus = 'forfeited';
  } else if (b.payment_intent_id) await cancelIntent(b.payment_intent_id);
  const updated = await db.bookings.update(b.id, { status: nextStatus, deposit_status: depositStatus, cancelled_at: new Date(now).toISOString(), cancel_reason: reason?.slice(0, 200) ?? null });
  await db.queue.cancelPending(b.id);
  if (b.lead_id) await db.leads.update(b.lead_id, { stage: 'lost' }).catch(() => undefined);
  if (b.deposit_status === 'paid') {
    const tech = b.tech_id ? await db.techs.get(b.tech_id) : null;
    await syncBookingEvent('delete', b, tech);
    await enqueuePlanned(b.id, [{ kind: 'cancellation', runAt: now, dedupeKey: `${b.id}:cancellation` }], { depositOutcome: d.depositOutcome });
    await dispatchDue(now, 10);
  }
  await db.events.insert({ type: 'booking.cancelled', entity_type: 'booking', entity_id: b.id, actor: 'customer', data: { outcome: d.depositOutcome, hoursBefore: Math.round(d.hoursBefore) } });
  return { booking: updated, depositOutcome: d.depositOutcome };
}

/** Customer went back and changed details: free the unpaid hold right away. */
export async function releaseHold(token: string): Promise<void> {
  const db = repo();
  const b = await loadByToken(token);
  if (b.status !== 'pending_deposit') throw new BookingError('not_changeable', 'Only unpaid reservations can be released.', 409);
  if (b.payment_intent_id) await cancelIntent(b.payment_intent_id);
  await db.bookings.update(b.id, { status: transition('pending_deposit', 'cancel'), deposit_status: 'none', cancelled_at: new Date().toISOString(), cancel_reason: 'released_by_customer' });
}

