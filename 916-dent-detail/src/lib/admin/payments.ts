// Invoice payments: record manual payments (cash / Zelle / card on phone / check), pay links, and recompute invoice state.
import { repo, type BookingRow, type Customer, type Invoice, type Job, type Payment } from '@/lib/db';
import { round2 } from './format';
import { logEvent } from './events';
import { computeInvoice, depositPaidOf, parseLines, type InvoiceMath, type LineItem } from './invoice';
import { HttpError } from './api';

export const MANUAL_METHODS = ['cash', 'zelle', 'card_phone', 'check', 'other'] as const;
export type ManualMethod = (typeof MANUAL_METHODS)[number];
export const METHOD_LABEL: Record<string, string> = { cash: 'Cash', zelle: 'Zelle', card_phone: 'Card on phone', check: 'Check', other: 'Other', card: 'Card', stripe_link: 'Pay link', terminal: 'Card reader' };

export type InvoiceBundle = {
  invoice: Invoice; lines: LineItem[]; payments: Payment[]; math: InvoiceMath;
  job: Job | null; booking: BookingRow | null; customer: Customer | null;
};

export async function loadInvoiceBundle(invoiceId: string): Promise<InvoiceBundle | null> {
  const db = repo();
  const invoice = await db.invoices.get(invoiceId);
  if (!invoice) return null;
  const [job, booking, customer, payments] = await Promise.all([
    invoice.job_id ? db.jobs.get(invoice.job_id) : null,
    invoice.booking_id ? db.bookings.get(invoice.booking_id) : null,
    invoice.customer_id ? db.customers.get(invoice.customer_id) : null,
    db.payments.list({ where: { invoice_id: invoiceId }, orderBy: 'created_at' }),
  ]);
  const lines = parseLines(invoice.line_items);
  // The stored deposit_applied is authoritative once an invoice exists (the booking deposit may later be refunded).
  const math = computeInvoice(lines, invoice.deposit_applied, payments);
  return { invoice, lines, payments, math, job, booking, customer };
}

/** Recompute stored totals and status from lines + payments. Idempotent. */
export async function refreshInvoice(invoiceId: string): Promise<InvoiceBundle> {
  const b = await loadInvoiceBundle(invoiceId);
  if (!b) throw new HttpError(404, 'not_found', 'Invoice not found.');
  const depositApplied = b.invoice.deposit_applied;
  const m = computeInvoice(b.lines, depositApplied, b.payments);
  let status = b.invoice.status;
  if (status !== 'void') {
    if (m.subtotal > 0 && m.balance <= 0) status = 'paid';
    else if (status === 'paid') status = b.job?.finished_at ? 'sent' : 'draft';
  }
  const patch: Partial<Invoice> = { subtotal: m.subtotal, total: m.total, status, paid_at: status === 'paid' ? b.invoice.paid_at ?? new Date().toISOString() : null };
  const invoice = await repo().invoices.update(invoiceId, patch);
  if (b.job && m.subtotal !== (b.job.final_price ?? null)) await repo().jobs.update(b.job.id, { final_price: m.subtotal });
  return { ...b, invoice, math: m };
}

export async function updateInvoiceLines(invoiceId: string, lines: LineItem[], actor: string): Promise<InvoiceBundle> {
  const b = await loadInvoiceBundle(invoiceId);
  if (!b) throw new HttpError(404, 'not_found', 'Invoice not found.');
  if (b.invoice.status === 'void') throw new HttpError(409, 'void', 'This invoice is void.');
  // deposit_applied follows the (possibly lower) subtotal but never exceeds what was actually paid
  const paidDeposit = b.booking ? depositPaidOf(b.booking) : b.invoice.deposit_applied;
  const m = computeInvoice(lines, paidDeposit);
  await repo().invoices.update(invoiceId, { line_items: lines, deposit_applied: m.depositApplied });
  await logEvent('invoice.lines_changed', 'invoice', invoiceId, actor, { count: lines.length, subtotal: m.subtotal });
  return refreshInvoice(invoiceId);
}

export type RecordPaymentInput = {
  invoiceId: string; amount: number; method: ManualMethod | 'stripe_link' | 'terminal' | 'card';
  reference?: string | null; actor: string; recordedBy?: string | null; opId?: string; mock?: boolean; stripePaymentIntentId?: string | null;
};

export async function recordPayment(i: RecordPaymentInput): Promise<{ bundle: InvoiceBundle; payment: Payment | null; duplicate: boolean }> {
  const db = repo();
  const b0 = await loadInvoiceBundle(i.invoiceId);
  if (!b0) throw new HttpError(404, 'not_found', 'Invoice not found.');
  if (b0.invoice.status === 'void') throw new HttpError(409, 'void', 'This invoice is void.');
  if (i.stripePaymentIntentId) {
    const ex = await db.payments.first({ where: { stripe_payment_intent_id: i.stripePaymentIntentId } });
    if (ex) return { bundle: b0, payment: ex, duplicate: true };
  }
  if (i.opId) {
    const evs = await db.events.list({ where: { type: 'payment.recorded', entity_id: i.invoiceId }, limit: 200 });
    if (evs.some((e) => e.data.opId === i.opId)) return { bundle: b0, payment: null, duplicate: true };
  }
  const amount = round2(i.amount);
  if (!(amount > 0)) throw new HttpError(400, 'invalid_amount', 'Enter an amount above zero.');
  if (amount > b0.math.balance + 0.005) throw new HttpError(409, 'overpay', `That is more than the balance due (${b0.math.balance.toFixed(2)}).`);
  const payment = await db.payments.insert({
    booking_id: b0.invoice.booking_id ?? null, invoice_id: i.invoiceId, customer_id: b0.invoice.customer_id ?? null, kind: 'balance', amount,
    status: 'succeeded', method: i.method, stripe_payment_intent_id: i.stripePaymentIntentId ?? null, mock: Boolean(i.mock), recorded_by: i.recordedBy ?? null, reference: i.reference?.slice(0, 80) ?? null,
  });
  await logEvent('payment.recorded', 'invoice', i.invoiceId, i.actor, { opId: i.opId ?? null, amount, method: i.method, mock: Boolean(i.mock) });
  const bundle = await refreshInvoice(i.invoiceId);
  return { bundle, payment, duplicate: false };
}
