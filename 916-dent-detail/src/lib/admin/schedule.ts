// Owner scheduling: manual booking (same availability + overlap guarantees as the public flow), staff reschedule /
// cancel / no-show with the deposit policy, admin time blocks, blackout dates, weather flags, day/week calendar data.
import { SMS_CONSENT_TEXT, bookingConfig, depositPolicy, serviceById } from '@/config/booking';
import { depositAmount } from '@/config/pricing';
import { checkSlot } from '@/lib/availability/engine';
import { addDays, utcToLocal, weekdayOf } from '@/lib/availability/tz';
import { SlotTakenError, repo, type BookingRow, type LeadSource, type Tech } from '@/lib/db';
import { syncBookingEvent } from '@/lib/booking/gcal';
import { loadAvailabilityInput } from '@/lib/booking/loader';
import { evaluateCancel, type DepositOutcome } from '@/lib/booking/policy';
import { transition, type BookingStatus } from '@/lib/booking/state';
import { assessZip } from '@/lib/geo';
import { cancelReminders, enqueuePlanned, scheduleForBooking } from '@/lib/notify';
import { dispatchDue } from '@/lib/notify/dispatch';
import { computeDuration, computePrice, validateSelection } from '@/lib/pricing';
import { refundIntent } from '@/lib/stripe';
import { HttpError } from './api';
import { logEvent } from './events';
import { advanceLead } from './pipeline';
import { primeSettings } from './settings';
import { ensureJobForBooking } from './jobs';

const MIN = 60_000;

export type ManualBookingInput = {
  customerId: string; vehicleId?: string | null; leadId?: string | null; quoteId?: string | null;
  services: string[]; addons?: string[]; sizeClass: string; startsAt: string; techId?: string | null;
  zip: string; addressLine: string; notes?: string | null; source?: LeadSource;
  /** collected = the deposit was taken offline (cash/Zelle) and is recorded as paid. */
  deposit: 'none' | 'collected'; depositMethod?: string;
  notifyCustomer: boolean;
  /** Ignore hours/buffers/weather/lead-time. NEVER ignores an overlapping live booking. */
  override?: boolean; durationMin?: number | null; idempotencyKey: string;
};

export async function createManualBooking(i: ManualBookingInput, actor: string, now = Date.now()): Promise<{ booking: BookingRow; replay: boolean }> {
  const db = repo();
  const prior = await db.bookings.first({ where: { idempotency_key: i.idempotencyKey } });
  if (prior) return { booking: prior, replay: true };
  await primeSettings();
  const sel = validateSelection(i.services, i.sizeClass, i.addons ?? []);
  if (!sel.ok) throw new HttpError(400, 'invalid_selection', sel.error);
  const customer = await db.customers.get(i.customerId);
  if (!customer) throw new HttpError(404, 'not_found', 'Customer not found.');
  const area = assessZip(i.zip);
  if (area.status === 'invalid') throw new HttpError(400, 'invalid_zip', 'Enter a 5-digit ZIP.');
  if (area.status !== 'in_area' && !i.override) throw new HttpError(422, 'out_of_area', `${area.message} Tick "Override rules" to book it anyway.`);

  const quote = i.quoteId ? await db.quotes.get(i.quoteId) : null;
  const dentQuote = quote && quote.low != null && quote.high != null ? { low: quote.low, high: quote.high } : null;
  const panels = quote && Array.isArray(quote.panels) && quote.panels.length ? quote.panels.length : null;
  const travelFee = area.status === 'in_area' ? area.travelFee ?? 0 : 0;
  const price = computePrice({ services: sel.services, sizeClass: sel.sizeClass, addons: sel.addons, dentQuote, travelFee });
  if (!price.ok) throw new HttpError(400, 'pricing_error', price.error);
  const durationMin = i.durationMin && i.durationMin >= 15 ? Math.ceil(i.durationMin / 15) * 15 : computeDuration({ services: sel.services, sizeClass: sel.sizeClass, addons: sel.addons, panels });
  const exterior = sel.services.some((s) => serviceById(s)?.exterior);
  const startMs = Date.parse(i.startsAt);
  if (!Number.isFinite(startMs)) throw new HttpError(400, 'invalid_time', 'Pick a start time.');

  let techId = i.techId ?? null;
  if (!i.override) {
    const avail = await loadAvailabilityInput(now, { durationMin, zip: i.zip, exterior, preferredTechId: techId });
    const slot = checkSlot(avail, startMs, techId);
    if (!slot.ok) throw new HttpError(409, 'slot_unavailable', 'That time is not open (hours, blocks, buffers or another job). Pick a listed time, or tick "Override rules".');
    techId = slot.techId;
  } else if (!techId) {
    const first = (await db.techs.list({ where: { active: true }, orderBy: 'name' }))[0];
    if (!first) throw new HttpError(409, 'no_tech', 'There is no active technician to assign.');
    techId = first.id;
  }

  let lead = i.leadId ? await db.leads.get(i.leadId) : null;
  if (!lead) {
    lead = await db.leads.insert({ customer_id: customer.id, name: customer.name, phone: customer.phone ?? null, email: customer.email ?? null, zip: i.zip, stage: 'booked', source: i.source ?? 'direct', source_auto: i.source ?? 'direct', source_overridden: false, area_status: area.status });
  }
  const deposit = i.deposit === 'collected';
  let booking: BookingRow;
  try {
    booking = await db.bookingsX.createChecked({
      customer_id: customer.id, vehicle_id: i.vehicleId ?? null, lead_id: lead.id, quote_id: quote?.id ?? null, tech_id: techId, status: 'confirmed',
      services: sel.services, addons: sel.addons, size_class: sel.sizeClass, starts_at: new Date(startMs).toISOString(), ends_at: new Date(startMs + durationMin * MIN).toISOString(),
      duration_min: durationMin, hold_expires_at: null, zip: i.zip, address_line: i.addressLine, city: area.status === 'in_area' ? area.city ?? null : null, area_status: area.status,
      travel_fee: travelFee, price_low: price.totalLow, price_high: price.totalHigh, needs_review: price.status === 'needs_photos',
      deposit_amount: deposit ? depositAmount : 0, deposit_status: deposit ? 'paid' : 'none', idempotency_key: i.idempotencyKey, reschedule_count: 0, customer_notes: i.notes?.slice(0, 500) ?? null,
    });
  } catch (e) {
    if (e instanceof SlotTakenError) throw new HttpError(409, 'slot_unavailable', 'That technician already has a job at that time. Pick another time or technician.');
    throw e;
  }
  if (deposit) await db.payments.insert({ booking_id: booking.id, customer_id: customer.id, kind: 'deposit', amount: depositAmount, status: 'succeeded', method: i.depositMethod || 'cash', mock: false, recorded_by: null, reference: 'collected offline' });
  await ensureJobForBooking(booking.id);
  await advanceLead(lead.id, 'booked', actor);
  const tech = techId ? await db.techs.get(techId) : null;
  const ev = await syncBookingEvent('upsert', booking, tech);
  if (ev) booking = await db.bookings.update(booking.id, { gcal_event_id: ev });
  if (i.notifyCustomer) { await scheduleForBooking(booking.id, { now }); await dispatchDue(now, 10); }
  await logEvent('booking.created', 'booking', booking.id, actor, { manual: true, override: Boolean(i.override), deposit: i.deposit, notify: i.notifyCustomer, services: sel.services });
  void SMS_CONSENT_TEXT; void bookingConfig;
  return { booking, replay: false };
}

export async function adminReschedule(bookingId: string, o: { startsAt: string; techId?: string | null; override?: boolean; notifyCustomer: boolean }, actor: string, now = Date.now()): Promise<BookingRow> {
  const db = repo();
  const b = await db.bookings.get(bookingId);
  if (!b) throw new HttpError(404, 'not_found', 'Booking not found.');
  if (b.status !== 'confirmed' && b.status !== 'pending_deposit') throw new HttpError(409, 'not_changeable', 'Only upcoming bookings can be moved.');
  await primeSettings();
  const startMs = Date.parse(o.startsAt);
  if (!Number.isFinite(startMs)) throw new HttpError(400, 'invalid_time', 'Pick a start time.');
  const exterior = b.services.some((s) => serviceById(s)?.exterior);
  let techId = o.techId ?? b.tech_id ?? null;
  if (!o.override) {
    const avail = await loadAvailabilityInput(now, { durationMin: b.duration_min, zip: b.zip, exterior, excludeBookingId: b.id, preferredTechId: techId });
    const slot = checkSlot(avail, startMs, o.techId ?? null);
    if (!slot.ok) throw new HttpError(409, 'slot_unavailable', 'That time is not open. Pick a listed time, or tick "Override rules".');
    techId = slot.techId;
  }
  if (!techId) throw new HttpError(409, 'no_tech', 'Choose a technician.');
  let moved: BookingRow;
  try { moved = await db.bookingsX.moveChecked(b.id, { starts_at: new Date(startMs).toISOString(), ends_at: new Date(startMs + b.duration_min * MIN).toISOString(), tech_id: techId }); }
  catch (e) { if (e instanceof SlotTakenError) throw new HttpError(409, 'slot_unavailable', 'That technician already has a job then.'); throw e; }
  // Staff-initiated moves never count against the customer's reschedule limit; the deposit travels with the booking.
  await cancelReminders(b.id);
  if (o.notifyCustomer) { await scheduleForBooking(b.id, { now, rescheduled: true }); await dispatchDue(now, 10); }
  const tech = await db.techs.get(techId);
  const ev = await syncBookingEvent('upsert', moved, tech);
  if (ev && ev !== moved.gcal_event_id) moved = await db.bookings.update(b.id, { gcal_event_id: ev });
  await logEvent('booking.rescheduled', 'booking', b.id, actor, { by: 'staff', override: Boolean(o.override), notify: o.notifyCustomer });
  return moved;
}

export type CancelChoice = 'policy' | 'refund' | 'credit' | 'keep';

/** What the deposit policy says for a customer-initiated cancel right now (shown in the UI before the owner decides). */
export function policyPreview(b: Pick<BookingRow, 'status' | 'starts_at' | 'deposit_status' | 'reschedule_count'>, now = Date.now()): { outcome: DepositOutcome; hoursBefore: number; allowed: boolean } {
  const d = evaluateCancel({ status: b.status as BookingStatus, startsAt: Date.parse(b.starts_at), depositPaid: b.deposit_status === 'paid', rescheduleCount: b.reschedule_count }, now);
  return d.allowed ? { outcome: d.depositOutcome, hoursBefore: d.hoursBefore, allowed: true } : { outcome: 'none', hoursBefore: d.hoursBefore, allowed: false };
}

export const OUTCOME_LABEL: Record<DepositOutcome, string> = { refund: 'Refund the deposit', credit: `Keep as ${depositPolicy.creditValidDays}-day credit`, forfeit: 'Keep the deposit', none: 'No deposit involved' };

export async function adminCancel(bookingId: string, o: { reason: string; initiatedBy: 'customer' | 'us'; choice: CancelChoice; noShow?: boolean; notifyCustomer: boolean }, actor: string, now = Date.now()): Promise<{ booking: BookingRow; outcome: DepositOutcome }> {
  const db = repo();
  const b = await db.bookings.get(bookingId);
  if (!b) throw new HttpError(404, 'not_found', 'Booking not found.');
  if (!['pending_deposit', 'confirmed', 'on_the_way'].includes(b.status)) throw new HttpError(409, 'not_changeable', 'This booking can no longer be cancelled.');
  const next = transition(b.status as BookingStatus, o.noShow ? 'no_show' : 'cancel');
  const policy = policyPreview(b, now);
  let outcome: DepositOutcome = 'none';
  let depositStatus = b.deposit_status;
  if (b.deposit_status === 'paid') {
    outcome = o.choice === 'refund' ? 'refund' : o.choice === 'credit' ? 'credit' : o.choice === 'keep' ? 'forfeit'
      : o.noShow ? 'forfeit' : o.initiatedBy === 'us' ? 'refund' : policy.outcome === 'none' ? 'refund' : policy.outcome;
    if (outcome === 'refund') {
      if (b.payment_intent_id) { const r = await refundIntent(b.payment_intent_id); if (!r.ok) throw new HttpError(502, 'refund_failed', 'Stripe could not refund the deposit. Nothing was cancelled; try again or refund in Stripe.'); }
      await db.payments.insert({ booking_id: b.id, customer_id: b.customer_id ?? null, kind: 'refund', amount: b.deposit_amount, status: 'succeeded', method: b.payment_intent_id ? 'card' : 'other', mock: !b.payment_intent_id || b.payment_intent_id.startsWith('pi_mock_'), reference: 'deposit refund' });
      depositStatus = 'refunded';
    } else depositStatus = outcome === 'credit' ? 'credited' : 'forfeited';
  }
  const won = await db.bookings.updateIf(b.id, { status: b.status }, { status: next, deposit_status: depositStatus, cancelled_at: new Date(now).toISOString(), cancel_reason: o.reason.slice(0, 200) });
  if (!won) throw new HttpError(409, 'stale', 'This booking just changed. Reload and try again.');
  await db.queue.cancelPending(b.id);
  const tech = b.tech_id ? await db.techs.get(b.tech_id) : null;
  await syncBookingEvent('delete', b, tech);
  await advanceLead(b.lead_id, 'lost', actor);
  if (o.notifyCustomer && b.deposit_status === 'paid' && !o.noShow) {
    await enqueuePlanned(b.id, [{ kind: 'cancellation', runAt: now, dedupeKey: `${b.id}:cancellation` }], { depositOutcome: outcome });
    await dispatchDue(now, 10);
  }
  await logEvent(o.noShow ? 'booking.no_show' : 'booking.cancelled', 'booking', b.id, actor, { by: o.initiatedBy, outcome, hoursBefore: Math.round(policy.hoursBefore) });
  return { booking: won, outcome };
}

// ---- blocks, blackouts, weather -----------------------------------------------------------------------------------
export async function addBlock(i: { techId?: string | null; startsAt: string; endsAt: string; reason?: string | null }, actor: string) {
  const s = Date.parse(i.startsAt), e = Date.parse(i.endsAt);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) throw new HttpError(400, 'bad_range', 'The block must end after it starts.');
  const row = await repo().admin_blocks.insert({ tech_id: i.techId ?? null, starts_at: new Date(s).toISOString(), ends_at: new Date(e).toISOString(), reason: i.reason?.slice(0, 120) ?? null });
  await logEvent('block.added', 'admin_block', row.id, actor, {});
  return row;
}
export async function addBlackout(i: { date: string; techId?: string | null; reason?: string | null }, actor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date)) throw new HttpError(400, 'bad_date', 'Pick a date.');
  const row = await repo().blackout_dates.insert({ date: i.date, tech_id: i.techId ?? null, reason: i.reason?.slice(0, 120) ?? null });
  await logEvent('blackout.added', 'blackout', row.id, actor, { date: i.date });
  return row;
}
/** Toggle the exterior-work weather flag for a local date. Returns the new state. */
export async function toggleWeather(date: string, reason: string | null, actor: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'bad_date', 'Pick a date.');
  const db = repo();
  const ex = await db.weather_flags.first({ where: { date } });
  if (ex) { await db.weather_flags.remove(ex.id); await logEvent('weather.cleared', 'weather', date, actor, {}); return false; }
  await db.weather_flags.insert({ date, reason: reason?.slice(0, 60) || 'weather' });
  await logEvent('weather.flagged', 'weather', date, actor, { reason });
  return true;
}

/** Bookings that fall on a weather-flagged day and include exterior work (so the owner can reschedule them). */
export async function bookingsAffectedByWeather(): Promise<BookingRow[]> {
  const db = repo();
  const flags = await db.weather_flags.list();
  if (!flags.length) return [];
  const dates = new Set(flags.map((f) => f.date));
  const live = await db.bookings.list({ ranges: [{ col: 'ends_at', gt: new Date().toISOString() }], orderBy: 'starts_at' });
  return live.filter((b) => ['confirmed', 'pending_deposit'].includes(b.status) && dates.has(utcToLocal(Date.parse(b.starts_at)).date) && b.services.some((s) => serviceById(s)?.exterior));
}

// ---- calendar data ------------------------------------------------------------------------------------------------
export type CalendarDay = { date: string; weekday: number; bookings: BookingRow[]; weather: string | null; blackout: { techId: string | null; reason: string | null }[]; blocks: { id: string; techId: string | null; startsAt: string; endsAt: string; reason: string | null }[] };

export async function loadCalendar(fromDate: string, days: number): Promise<{ days: CalendarDay[]; techs: Tech[] }> {
  const db = repo();
  const dates = Array.from({ length: days }, (_, k) => addDays(fromDate, k));
  const lo = new Date(Date.parse(`${addDays(fromDate, -1)}T00:00:00Z`)).toISOString();
  const hi = new Date(Date.parse(`${addDays(fromDate, days + 1)}T00:00:00Z`)).toISOString();
  const [techs, bookings, blackouts, blocks, weather] = await Promise.all([
    db.techs.list({ where: { active: true }, orderBy: 'name' }),
    db.bookings.list({ ranges: [{ col: 'starts_at', gte: lo, lt: hi }], orderBy: 'starts_at' }),
    db.blackout_dates.list(), db.admin_blocks.list({ ranges: [{ col: 'ends_at', gt: lo }] }), db.weather_flags.list(),
  ]);
  const wf = new Map(weather.map((w) => [w.date, w.reason ?? 'weather']));
  return {
    techs,
    days: dates.map((date) => ({
      date, weekday: weekdayOf(date),
      bookings: bookings.filter((b) => utcToLocal(Date.parse(b.starts_at)).date === date && !['expired'].includes(b.status)),
      weather: wf.get(date) ?? null,
      blackout: blackouts.filter((x) => x.date === date).map((x) => ({ techId: x.tech_id ?? null, reason: x.reason ?? null })),
      blocks: blocks.filter((x) => utcToLocal(Date.parse(x.starts_at)).date === date).map((x) => ({ id: x.id, techId: x.tech_id ?? null, startsAt: x.starts_at, endsAt: x.ends_at, reason: x.reason ?? null })),
    })),
  };
}
