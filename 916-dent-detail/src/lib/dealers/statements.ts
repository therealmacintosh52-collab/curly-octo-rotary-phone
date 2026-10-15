// Monthly statements (aggregate completed, priced work per dealer per month) and net-terms invoices built from them.
// Idempotent: one statement per dealer per month (unique index), re-running only picks up newly eligible vehicles while the
// statement is still open. Invoices are issued by the owner, never automatically.
import { log } from '@/lib/api/log';
import { repo } from '@/lib/db';
import type { Dealer, DealerStatement, DealerVehicle, Invoice } from '@/lib/db/types';
import { asProposals } from './addons';
import { audit } from './audit';
import { aging, buildStatement, dueDate, effectiveInvoiceStatus, fromCents, monthLabel, monthPeriod, previousMonth, toCents, type Aging, type PricedVehicle, type StatementLine } from './billing';
import { notifyDealer, notifyOwner, portalUrl } from './notify';
import { createNetTermsInvoice, markStripePaidOutOfBand, voidStripeInvoice } from './stripe-invoicing';
import { describeServices, vehicleLabel } from './vehicles';

export class BillingError extends Error {
  constructor(public code: 'not_found' | 'bad_state' | 'empty', message: string) { super(message); this.name = 'BillingError'; }
}

export const asLines = (v: unknown): StatementLine[] => (Array.isArray(v) ? (v as StatementLine[]) : []);

function toPriced(v: DealerVehicle): PricedVehicle {
  return {
    vehicle_id: v.id, stock_number: v.stock_number ?? null, vin: v.vin ?? null, label: vehicleLabel(v), done_at: v.done_at ?? v.updated_at,
    description: describeServices(v.services, v.panels), price: v.price ?? null,
    addons: asProposals(v.addon_approvals).map((a) => ({ id: a.id, label: a.label, price: a.price, status: a.status })),
  };
}

export type StatementResult = { statement: DealerStatement | null; created: boolean; added: number; unpriced: number };

export async function generateStatement(dealerId: string, ym: string): Promise<StatementResult> {
  const db = repo();
  const p = monthPeriod(ym);
  const existing = await db.dealer_statements.first({ where: { dealer_id: dealerId, period_start: p.start } });
  if (existing && (existing.status !== 'open' || existing.invoice_id)) return { statement: existing, created: false, added: 0, unpriced: existing.unpriced_count ?? 0 };
  const eligible = (await db.dealer_vehicles.list({ where: { dealer_id: dealerId, status: 'done', statement_id: null } })).filter((v) => (v.done_at ?? v.updated_at) < p.endUtc);
  const { lines, unpriced } = buildStatement(eligible.map(toPriced));
  const prior = existing ? asLines(existing.line_items) : [];
  if (!lines.length && !existing) return { statement: null, created: false, added: 0, unpriced: unpriced.length };
  const all = [...prior, ...lines];
  const totalCents = all.reduce((n, l) => n + toCents(l.total), 0);
  const fields = { total: fromCents(totalCents), line_items: all, vehicle_count: all.length, unpriced_count: unpriced.length };
  const statement = existing
    ? await db.dealer_statements.update(existing.id, fields)
    : await db.dealer_statements.insert({ dealer_id: dealerId, period_start: p.start, period_end: p.end, status: 'open', ...fields });
  const ids = new Set(lines.map((l) => l.vehicle_id));
  for (const v of eligible) if (ids.has(v.id)) await db.dealer_vehicles.update(v.id, { statement_id: statement.id });
  await audit('dealer.statement.generated', 'dealer_statement', statement.id, 'system', { month: ym, lines: lines.length, unpriced: unpriced.length, total: statement.total });
  return { statement, created: !existing, added: lines.length, unpriced: unpriced.length };
}

export type MonthlyRun = { month: string; dealers: number; created: number; updated: number; unpricedVehicles: number; overdueMarked: number };

/** Cron entry: statements for the previous calendar month for every active dealer, then the overdue sweep. */
export async function runMonthlyStatements(opts: { month?: string; now?: Date } = {}): Promise<MonthlyRun> {
  const now = opts.now ?? new Date();
  const month = opts.month ?? previousMonth(now);
  const dealers = await repo().dealers.list({ where: { status: 'active' } });
  const run: MonthlyRun = { month, dealers: dealers.length, created: 0, updated: 0, unpricedVehicles: 0, overdueMarked: 0 };
  for (const d of dealers) {
    try {
      const r = await generateStatement(d.id, month);
      if (r.created) run.created++; else if (r.added) run.updated++;
      run.unpricedVehicles += r.unpriced;
    } catch (e) { log('error', 'dealer.statement.failed', { dealer: d.id, detail: (e as Error).message.slice(0, 100) }); }
  }
  run.overdueMarked = await markOverdue(now.getTime());
  if (run.created || run.unpricedVehicles) await notifyOwner(`Dealer statements for ${monthLabel(month)}`, `${run.created} statement(s) created. ${run.unpricedVehicles} finished vehicle(s) have no price and were left off: ${portalUrl('/admin/dealers')}`);
  return run;
}

export async function markOverdue(now = Date.now()): Promise<number> {
  const db = repo();
  let n = 0;
  for (const inv of await db.invoices.list({ where: { status: 'sent' } })) {
    if (inv.dealer_id && inv.due_at && Date.parse(inv.due_at) < now) {
      await db.invoices.update(inv.id, { status: 'overdue' });
      if (inv.statement_id) await db.dealer_statements.update(inv.statement_id, { status: 'overdue' }).catch(() => undefined);
      n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------- invoices
export const invoiceTerms = (d: Pick<Dealer, 'net_terms_approved' | 'net_terms_days'>): { days: number; label: string } =>
  d.net_terms_approved ? { days: d.net_terms_days, label: `Net ${d.net_terms_days}` } : { days: 1, label: 'Due on receipt' };

export async function issueInvoice(statementId: string, now = Date.now()): Promise<Invoice> {
  const db = repo();
  const st = await db.dealer_statements.get(statementId);
  if (!st) throw new BillingError('not_found', 'Statement not found.');
  if (st.status !== 'open' || st.invoice_id) throw new BillingError('bad_state', 'This statement already has an invoice.');
  if (st.total <= 0) throw new BillingError('empty', 'Nothing to invoice on this statement.');
  const dealer = await db.dealers.get(st.dealer_id);
  if (!dealer) throw new BillingError('not_found', 'Dealer not found.');
  const terms = invoiceTerms(dealer);
  const lines = asLines(st.line_items);
  const ym = st.period_start.slice(0, 7);
  const memo = `Statement for ${monthLabel(ym)}`;
  const created = await createNetTermsInvoice({ dealer, statementId: st.id, lines, daysUntilDue: terms.days, memo, mockHostedPath: (id) => `/dealers/dashboard/billing/invoices/${id}` });
  const number = created.number ?? `INV-${ym.replace('-', '')}-${st.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  const inv = await db.invoices.insert({
    number, dealer_id: dealer.id, status: 'sent', line_items: lines, subtotal: st.total, deposit_applied: 0, total: st.total,
    stripe_invoice_id: created.stripeId, due_at: dueDate(now, terms.days), statement_id: st.id, hosted_invoice_url: created.hostedUrl, invoice_pdf_url: created.pdfUrl,
    mock: created.mock, net_days: terms.days, memo,
  });
  await db.dealer_statements.update(st.id, { status: 'sent', invoice_id: inv.id, stripe_invoice_id: created.stripeId });
  for (const l of lines) await db.dealer_vehicles.update(l.vehicle_id, { status: 'invoiced', invoice_id: inv.id }).catch(() => undefined);
  await audit('dealer.invoice.issued', 'dealer_invoice', inv.id, 'owner', { statement: st.id, total: inv.total, net_days: terms.days, mock: created.mock });
  await notifyDealer(dealer, `Invoice ${number} for ${monthLabel(ym)}`, `Your statement for ${monthLabel(ym)} is ready: ${lines.length} vehicle${lines.length === 1 ? '' : 's'}, total $${inv.total.toFixed(2)}. Terms: ${terms.label}. View it and download the statement PDF: ${portalUrl('/dealers/dashboard/billing')}`, { toAp: true });
  return inv;
}

async function mustInvoice(id: string): Promise<Invoice> {
  const inv = await repo().invoices.get(id);
  if (!inv || !inv.dealer_id) throw new BillingError('not_found', 'Invoice not found.');
  return inv;
}

export async function markInvoicePaid(id: string, o: { method?: string; reference?: string; viaStripeEvent?: boolean; now?: number } = {}): Promise<Invoice> {
  const db = repo();
  const inv = await mustInvoice(id);
  if (inv.status === 'paid') return inv;
  if (inv.status === 'void') throw new BillingError('bad_state', 'A void invoice cannot be paid.');
  if (!o.viaStripeEvent && inv.stripe_invoice_id) await markStripePaidOutOfBand(inv.stripe_invoice_id);
  const now = new Date(o.now ?? Date.now()).toISOString();
  const next = await db.invoices.update(id, { status: 'paid', paid_at: now });
  if (inv.statement_id) await db.dealer_statements.update(inv.statement_id, { status: 'paid' }).catch(() => undefined);
  await db.payments.insert({ invoice_id: id, kind: 'dealer', amount: inv.total, status: 'succeeded', method: o.method ?? (o.viaStripeEvent ? 'stripe' : 'manual'), mock: Boolean(inv.mock), ...(o.reference ? { reference: o.reference } : {}) });
  await audit('dealer.invoice.paid', 'dealer_invoice', id, o.viaStripeEvent ? 'system' : 'owner', { total: inv.total, method: o.method ?? null });
  return next;
}

/** Void an invoice. Its statement reopens so it can be corrected and issued again. */
export async function voidInvoice(id: string, o: { viaStripeEvent?: boolean } = {}): Promise<Invoice> {
  const db = repo();
  const inv = await mustInvoice(id);
  if (inv.status === 'void') return inv;
  if (inv.status === 'paid') throw new BillingError('bad_state', 'A paid invoice cannot be voided.');
  if (!o.viaStripeEvent && inv.stripe_invoice_id) await voidStripeInvoice(inv.stripe_invoice_id);
  const next = await db.invoices.update(id, { status: 'void' });
  if (inv.statement_id) {
    await db.dealer_statements.update(inv.statement_id, { status: 'open', invoice_id: null, stripe_invoice_id: null }).catch(() => undefined);
    for (const v of await db.dealer_vehicles.list({ where: { invoice_id: id } })) await db.dealer_vehicles.update(v.id, { status: 'done', invoice_id: null });
  }
  await audit('dealer.invoice.void', 'dealer_invoice', id, o.viaStripeEvent ? 'system' : 'owner', {});
  return next;
}

/** Stripe webhook entry: keep our records in step with what happens in Stripe. Unknown invoices are ignored. */
export async function applyStripeInvoiceEvent(type: string, stripeInvoiceId: string | undefined): Promise<'paid' | 'void' | 'ignored'> {
  if (!stripeInvoiceId) return 'ignored';
  const inv = await repo().invoices.first({ where: { stripe_invoice_id: stripeInvoiceId } });
  if (!inv || !inv.dealer_id) return 'ignored';
  if (type === 'invoice.paid') { await markInvoicePaid(inv.id, { viaStripeEvent: true, method: 'stripe' }); return 'paid'; }
  if (type === 'invoice.voided') { await voidInvoice(inv.id, { viaStripeEvent: true }); return 'void'; }
  return 'ignored';
}

export type Ledger = { invoices: (Invoice & { effectiveStatus: string })[]; statements: DealerStatement[]; aging: Aging; balance: number };

export async function dealerLedger(dealerId: string, now = Date.now()): Promise<Ledger> {
  const db = repo();
  const invoices = (await db.invoices.list({ where: { dealer_id: dealerId }, orderBy: 'created_at', desc: true })).map((i) => ({ ...i, effectiveStatus: effectiveInvoiceStatus(i.status, i.due_at, now) }));
  const statements = await db.dealer_statements.list({ where: { dealer_id: dealerId }, orderBy: 'period_start', desc: true });
  const a = aging(invoices.map((i) => ({ total: i.total, due_at: i.due_at, status: i.effectiveStatus === 'overdue' ? 'overdue' : i.status })), now);
  return { invoices, statements, aging: a, balance: a.total };
}
