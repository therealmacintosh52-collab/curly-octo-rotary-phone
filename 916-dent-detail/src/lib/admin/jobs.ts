// Job lifecycle for the tech view (and owners doing the same work): ensure job, on my way, start, edit lines,
// take payment, finish -> invoice + review request. Every transition goes through the Phase 2 state machine and every
// mutating call is idempotent (safe to replay from the offline outbox).
import { serviceById } from '@/config/booking';
import { addonPrices } from '@/config/pricing';
import { site } from '@/config/site';
import { transition, InvalidTransitionError, type BookingStatus } from '@/lib/booking/state';
import { signBookingToken } from '@/lib/booking/tokens';
import { repo, type BookingRow, type Customer, type Invoice, type Job, type JobPhoto, type Note, type Payment, type Vehicle } from '@/lib/db';
import { baseUrl } from '@/lib/notify/dispatch';
import { scheduleAfterCompletion, sendOnTheWay } from '@/lib/notify';
import { commitCredits, isReferralLine, previewCredits } from '@/lib/referrals';
import { createPayLink, sessionPaid } from '@/lib/stripe/payments';
import { HttpError } from './api';
import { logEvent } from './events';
import { round2 } from './format';
import { addonCatalog, computeInvoice, depositPaidOf, parseLines, seedLines, subtotalOf, type InvoiceMath, type LineItem } from './invoice';
import { loadInvoiceBundle, recordPayment, refreshInvoice, type InvoiceBundle, type RecordPaymentInput } from './payments';
import { advanceLead } from './pipeline';

const asHttp = (e: unknown): never => {
  if (e instanceof InvalidTransitionError) throw new HttpError(409, 'bad_state', e.message);
  throw e;
};

export async function ensureJobForBooking(bookingId: string): Promise<Job> {
  const db = repo();
  const b = await db.bookings.get(bookingId);
  if (!b) throw new HttpError(404, 'not_found', 'Booking not found.');
  let job = await db.jobs.first({ where: { booking_id: bookingId } });
  if (!job) {
    job = await db.jobs.insert({ booking_id: b.id, customer_id: b.customer_id ?? null, vehicle_id: b.vehicle_id ?? null, tech_id: b.tech_id ?? null, stage: 'booked', line_items: seedLines(b) });
  } else if (!job.finished_at && parseLines(job.line_items).length === 0) {
    const seeded = seedLines(b);
    if (seeded.length) job = await db.jobs.update(job.id, { line_items: seeded });
  }
  if (job.tech_id !== (b.tech_id ?? null)) job = await db.jobs.update(job.id, { tech_id: b.tech_id ?? null });
  return job;
}

export type JobBundle = {
  job: Job; booking: BookingRow; customer: Customer | null; vehicle: Vehicle | null; photos: JobPhoto[]; notes: Note[];
  lines: LineItem[]; invoice: Invoice | null; payments: Payment[]; math: InvoiceMath; referralPreview: LineItem[];
};

export async function loadJobBundle(jobId: string): Promise<JobBundle | null> {
  const db = repo();
  let job = await db.jobs.get(jobId);
  if (!job || !job.booking_id) return null;
  const booking = await db.bookings.get(job.booking_id);
  if (!booking) return null;
  job = await ensureJobForBooking(booking.id);
  const [customer, vehicle, photos, notes, invoice] = await Promise.all([
    booking.customer_id ? db.customers.get(booking.customer_id) : null,
    booking.vehicle_id ? db.vehicles.get(booking.vehicle_id) : null,
    db.job_photos.list({ where: { job_id: job.id }, orderBy: 'created_at' }),
    db.notes.list({ where: { entity_type: 'job', entity_id: job.id }, orderBy: 'created_at', desc: true }),
    db.invoices.first({ where: { job_id: job.id } }),
  ]);
  const payments = invoice ? await db.payments.list({ where: { invoice_id: invoice.id }, orderBy: 'created_at' }) : [];
  const base = parseLines(job.line_items).filter((l) => !isReferralLine(l));
  let lines: LineItem[];
  let referralPreview: LineItem[] = [];
  if (invoice) lines = parseLines(invoice.line_items);
  else {
    referralPreview = customer ? (await previewCredits(customer.id, subtotalOf(base))).lines : [];
    lines = [...base, ...referralPreview];
  }
  const math = computeInvoice(lines, invoice ? invoice.deposit_applied : depositPaidOf(booking), payments);
  return { job, booking, customer, vehicle, photos, notes, lines, invoice, payments, math, referralPreview };
}

export async function startJobForBooking(bookingId: string, actor: string): Promise<Job> {
  const db = repo();
  const b = await db.bookings.get(bookingId);
  if (!b) throw new HttpError(404, 'not_found', 'Booking not found.');
  const job = await ensureJobForBooking(bookingId);
  if (b.status === 'in_progress' || b.status === 'completed') return job; // idempotent replay
  try {
    const next = transition(b.status as BookingStatus, 'start');
    await db.bookings.updateIf(b.id, { status: b.status }, { status: next });
  } catch (e) { asHttp(e); }
  const now = new Date().toISOString();
  const updated = await db.jobs.update(job.id, { started_at: job.started_at ?? now, stage: 'in_progress' });
  await advanceLead(b.lead_id, 'in_progress', actor);
  await logEvent('job.started', 'job', job.id, actor, {});
  return updated;
}

export async function sendOnMyWay(bookingId: string, actor: string, etaMinutes?: number): Promise<{ etaMinutes: number; alreadySent: boolean }> {
  const db = repo();
  const b = await db.bookings.get(bookingId);
  if (!b) throw new HttpError(404, 'not_found', 'Booking not found.');
  if (b.status === 'in_progress' || b.status === 'completed') throw new HttpError(409, 'bad_state', 'This job has already started.');
  const was = b.status === 'on_the_way';
  let eta: number;
  try { eta = (await sendOnTheWay(bookingId, { etaMinutes })).etaMinutes; } catch (e) { return asHttp(e); }
  const job = await ensureJobForBooking(bookingId);
  await db.jobs.update(job.id, { on_my_way_at: job.on_my_way_at ?? new Date().toISOString(), eta_minutes: eta });
  if (!was) await logEvent('job.on_my_way', 'job', job.id, actor, { etaMinutes: eta });
  return { etaMinutes: eta, alreadySent: was };
}

// ---- line items --------------------------------------------------------------------------------------------------
export type LineOp =
  | { op: 'add_addon'; id: string; addonId: string }
  | { op: 'add_custom'; id: string; label: string; amount: number; kind?: 'service' | 'custom' | 'discount' }
  | { op: 'set_amount'; id: string; amount: number }
  | { op: 'remove'; id: string };

export async function editJobLines(jobId: string, o: LineOp, actor: string): Promise<LineItem[]> {
  const db = repo();
  const job = await db.jobs.get(jobId);
  if (!job) throw new HttpError(404, 'not_found', 'Job not found.');
  if (job.finished_at) throw new HttpError(409, 'finished', 'This job is finished. Staff can edit the invoice instead.');
  let lines = parseLines(job.line_items).filter((l) => !isReferralLine(l));
  const has = lines.some((l) => l.id === o.id);
  if (o.op === 'add_addon') {
    if (has) return lines; // replay
    const def = addonCatalog().find((a) => a.id === o.addonId);
    if (!def) throw new HttpError(400, 'unknown_addon', 'Unknown add-on.');
    lines.push({ id: o.id, label: def.label, amount: def.price, qty: 1, kind: 'addon', addonId: def.id }); // price from config only
  } else if (o.op === 'add_custom') {
    if (has) return lines;
    if (!o.label.trim() || !Number.isFinite(o.amount) || o.amount === 0 || Math.abs(o.amount) > 20_000) throw new HttpError(400, 'invalid_line', 'Enter a label and a non-zero amount.');
    lines.push({ id: o.id, label: o.label.trim().slice(0, 120), amount: round2(o.kind === 'discount' ? -Math.abs(o.amount) : o.amount), qty: 1, kind: o.kind ?? 'custom' });
  } else if (o.op === 'set_amount') {
    if (!Number.isFinite(o.amount) || Math.abs(o.amount) > 20_000) throw new HttpError(400, 'invalid_amount', 'Enter a valid amount.');
    lines = lines.map((l) => (l.id === o.id ? { ...l, amount: round2(l.kind === 'discount' || l.kind === 'credit' ? -Math.abs(o.amount) : Math.max(0, o.amount)) } : l));
  } else lines = lines.filter((l) => l.id !== o.id);
  await db.jobs.update(jobId, { line_items: lines });
  await logEvent('job.line_changed', 'job', jobId, actor, { op: o.op, subtotal: subtotalOf(lines) });
  await syncDraftInvoice(jobId).catch(() => undefined); // keep a draft invoice (if one exists) in step
  return lines;
}

/** Create or refresh the draft invoice from the job's lines + referral credits. Never touches a finished/paid invoice. */
export async function syncDraftInvoice(jobId: string, opts: { create?: boolean } = {}): Promise<InvoiceBundle | null> {
  const db = repo();
  const job = await db.jobs.get(jobId);
  if (!job || !job.booking_id) return null;
  const booking = (await db.bookings.get(job.booking_id))!;
  const existing = await db.invoices.first({ where: { job_id: jobId } });
  if (!existing && !opts.create) return null;
  if (existing && existing.status !== 'draft') return loadInvoiceBundle(existing.id);
  const base = parseLines(job.line_items).filter((l) => !isReferralLine(l));
  const credits = booking.customer_id ? await previewCredits(booking.customer_id, subtotalOf(base)) : { lines: [] as LineItem[] };
  const lines = [...base, ...credits.lines];
  const m = computeInvoice(lines, depositPaidOf(booking));
  if (existing) {
    await db.invoices.update(existing.id, { line_items: lines, subtotal: m.subtotal, deposit_applied: m.depositApplied, total: m.total });
    return refreshInvoice(existing.id);
  }
  const number = await db.admin.nextInvoiceNumber();
  const inv = await db.invoices.insert({
    number, job_id: jobId, booking_id: booking.id, customer_id: booking.customer_id ?? null, status: 'draft', line_items: lines,
    subtotal: m.subtotal, deposit_applied: m.depositApplied, total: m.total,
  });
  return refreshInvoice(inv.id);
}

// ---- payment -----------------------------------------------------------------------------------------------------
export async function takePayment(jobId: string, p: Pick<RecordPaymentInput, 'amount' | 'method' | 'reference' | 'actor' | 'recordedBy' | 'opId'>): Promise<InvoiceBundle> {
  const bundle = await syncDraftInvoice(jobId, { create: true });
  if (!bundle) throw new HttpError(404, 'not_found', 'Job not found.');
  if (bundle.math.subtotal <= 0) throw new HttpError(409, 'no_price', 'Add the price to the job before taking payment.');
  const r = await recordPayment({ ...p, invoiceId: bundle.invoice.id });
  return r.bundle;
}

export async function makePayLink(jobId: string, origin: string, actor: string): Promise<{ url: string; mock: boolean; amount: number }> {
  const bundle = await syncDraftInvoice(jobId, { create: true });
  if (!bundle) throw new HttpError(404, 'not_found', 'Job not found.');
  const amount = bundle.math.balance;
  if (!(amount > 0)) throw new HttpError(409, 'nothing_due', 'Nothing is due on this job.');
  const link = await createPayLink({ amount, description: `916 Dent & Detail ${bundle.invoice.number ?? 'invoice'}`, invoiceId: bundle.invoice.id, bookingId: bundle.invoice.booking_id, email: bundle.customer?.email, origin });
  await repo().jobs.update(jobId, { payment_link_url: link.url, payment_link_id: link.id });
  await logEvent('job.pay_link_created', 'job', jobId, actor, { amount, mock: link.mock });
  return { url: link.url, mock: link.mock, amount };
}

/** Live: ask Stripe whether the pay-link session was paid, then record it. Mock: only the explicit demo button pays. */
export async function checkPayLink(jobId: string, actor: string): Promise<{ paid: boolean }> {
  const job = await repo().jobs.get(jobId);
  if (!job?.payment_link_id) return { paid: false };
  const s = await sessionPaid(job.payment_link_id);
  if (!s.paid) return { paid: false };
  const bundle = await syncDraftInvoice(jobId, { create: true });
  if (bundle && bundle.math.balance > 0) await recordPayment({ invoiceId: bundle.invoice.id, amount: Math.min(s.amount, bundle.math.balance), method: 'stripe_link', actor, stripePaymentIntentId: s.paymentIntentId });
  return { paid: true };
}

export async function demoPayLink(jobId: string, actor: string): Promise<InvoiceBundle> {
  const job = await repo().jobs.get(jobId);
  if (!job?.payment_link_id?.startsWith('cs_mock_')) throw new HttpError(409, 'not_demo', 'Demo payment only applies to demo pay links.');
  const bundle = await syncDraftInvoice(jobId, { create: true });
  if (!bundle || bundle.math.balance <= 0) throw new HttpError(409, 'nothing_due', 'Nothing is due on this job.');
  const r = await recordPayment({ invoiceId: bundle.invoice.id, amount: bundle.math.balance, method: 'stripe_link', actor, mock: true, opId: `demo-${job.payment_link_id}` });
  return r.bundle;
}

// ---- finish ------------------------------------------------------------------------------------------------------
export type FinishResult = { invoice: Invoice; math: InvoiceMath; replay: boolean; invoiceUrl: string };

export const invoiceLink = (bookingId: string, now = Date.now()): string => `${baseUrl()}/invoice/${signBookingToken(bookingId, now + 60 * 86_400_000)}`;

export async function finishJob(jobId: string, actor: string, o: { summary?: string; now?: number } = {}): Promise<FinishResult> {
  const db = repo();
  const now = o.now ?? Date.now();
  const job = await db.jobs.get(jobId);
  if (!job || !job.booking_id) throw new HttpError(404, 'not_found', 'Job not found.');
  const booking = (await db.bookings.get(job.booking_id))!;
  const existing = await db.invoices.first({ where: { job_id: jobId } });
  if (booking.status === 'completed' && existing) {
    return { invoice: existing, math: computeInvoice(parseLines(existing.line_items), existing.deposit_applied, await db.payments.list({ where: { invoice_id: existing.id } })), replay: true, invoiceUrl: invoiceLink(booking.id, now) };
  }
  if (!['confirmed', 'on_the_way', 'in_progress'].includes(booking.status)) throw new HttpError(409, 'bad_state', `A ${booking.status.replace('_', ' ')} booking cannot be finished.`);
  const base = parseLines(job.line_items).filter((l) => !isReferralLine(l));
  if (subtotalOf(base) <= 0) throw new HttpError(409, 'no_price', 'Add the final price before finishing (dent work has no fixed price until you set it).');

  // 1) invoice (draft -> sent/paid) with referral credits baked in
  const bundle = (await syncDraftInvoice(jobId, { create: true }))!;
  // 2) state machine: lock with a conditional update so a double tap / replay cannot finish twice
  let status = booking.status as BookingStatus;
  try {
    if (status !== 'in_progress') { const s = transition(status, 'start'); await db.bookings.updateIf(booking.id, { status }, { status: s }); status = s; }
    const done = transition(status, 'finish');
    const won = await db.bookings.updateIf(booking.id, { status }, { status: done });
    if (!won) {
      const again = await db.invoices.first({ where: { job_id: jobId } });
      if (again) return { invoice: again, math: bundle.math, replay: true, invoiceUrl: invoiceLink(booking.id, now) };
    }
  } catch (e) { asHttp(e); }
  const iso = new Date(now).toISOString();
  await db.jobs.update(jobId, { started_at: job.started_at ?? iso, finished_at: iso, stage: 'done', final_price: bundle.math.subtotal, summary: o.summary?.slice(0, 500) ?? job.summary ?? null });
  const credits = booking.customer_id ? await commitCredits({ customerId: booking.customer_id, bookingId: booking.id, invoiceLines: bundle.lines }) : { redeemed: 0, referrerCreditId: null };
  const fresh = await refreshInvoice(bundle.invoice.id);
  const final = await db.invoices.update(fresh.invoice.id, { status: fresh.math.balance <= 0 ? 'paid' : 'sent', paid_at: fresh.math.balance <= 0 ? fresh.invoice.paid_at ?? iso : null });
  await advanceLead(booking.lead_id, 'done', actor);
  const link = invoiceLink(booking.id, now);
  await scheduleAfterCompletion(booking.id, now, { invoiceUrl: link });
  await db.jobs.update(jobId, { review_requested_at: new Date(now + 2 * 3_600_000).toISOString() }).catch(() => undefined);
  await logEvent('job.finished', 'job', jobId, actor, { subtotal: fresh.math.subtotal, balance: fresh.math.balance, creditsRedeemed: credits.redeemed, referrerCredit: Boolean(credits.referrerCreditId), reviewLink: Boolean(site.googleReviewUrl) });
  return { invoice: final, math: fresh.math, replay: false, invoiceUrl: link };
}

export const serviceNames = (ids: string[]): string => ids.map((s) => serviceById(s)?.plain ?? s).join(' + ');
export { addonPrices };
