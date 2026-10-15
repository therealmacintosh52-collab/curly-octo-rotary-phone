// Stripe Invoicing for dealer net terms. Live (STRIPE_SECRET_KEY set): a finalized invoice with collection_method=send_invoice
// (Stripe does not email it until someone sends it; the owner does that from the dashboard, or we email our own link).
// Mock: a recorded `in_mock_*` invoice whose "hosted link" is a stub page inside the portal. Amounts: dollars in, cents to Stripe.
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { log } from '@/lib/api/log';
import { repo } from '@/lib/db';
import type { Dealer } from '@/lib/db/types';
import type { StatementLine } from './billing';
import { toCents } from './billing';

export const dealerStripeLive = (): boolean => Boolean(process.env.STRIPE_SECRET_KEY);

const G = globalThis as unknown as { __stripeDealers?: Stripe };
const client = (): Stripe => (G.__stripeDealers ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { maxNetworkRetries: 2 }));

export type CreatedInvoice = { stripeId: string; hostedUrl: string | null; pdfUrl: string | null; number: string | null; mock: boolean };

async function ensureCustomer(dealer: Dealer): Promise<string> {
  if (dealer.stripe_customer_id) return dealer.stripe_customer_id;
  const c = await client().customers.create({ name: dealer.name, email: dealer.ap_email || dealer.email || undefined, metadata: { dealer_id: dealer.id } }, { idempotencyKey: `dealer_customer_${dealer.id}` });
  await repo().dealers.update(dealer.id, { stripe_customer_id: c.id });
  return c.id;
}

export async function createNetTermsInvoice(o: { dealer: Dealer; statementId: string; lines: StatementLine[]; daysUntilDue: number; memo: string; mockHostedPath: (mockId: string) => string }): Promise<CreatedInvoice> {
  if (!dealerStripeLive()) {
    const id = `in_mock_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    return { stripeId: id, hostedUrl: o.mockHostedPath(id), pdfUrl: null, number: null, mock: true };
  }
  const stripe = client();
  const customer = await ensureCustomer(o.dealer);
  const key = `dealer_inv_${o.statementId}`;
  const inv = await stripe.invoices.create(
    {
      customer, collection_method: 'send_invoice', days_until_due: Math.max(1, o.daysUntilDue), auto_advance: false,
      pending_invoice_items_behavior: 'exclude', description: o.memo, metadata: { dealer_id: o.dealer.id, statement_id: o.statementId },
    },
    { idempotencyKey: key },
  );
  for (const l of o.lines) {
    const label = `${l.label}${l.stock_number ? ` (stock ${l.stock_number})` : ''}: ${l.description}`.slice(0, 480);
    await stripe.invoiceItems.create({ customer, invoice: inv.id, amount: toCents(l.base), currency: 'usd', description: label }, { idempotencyKey: `${key}_${l.vehicle_id}` });
    for (const a of l.addons) await stripe.invoiceItems.create({ customer, invoice: inv.id, amount: toCents(a.amount), currency: 'usd', description: `Add-on: ${a.label}`.slice(0, 480) }, { idempotencyKey: `${key}_${l.vehicle_id}_${a.id}` });
  }
  const fin = await stripe.invoices.finalizeInvoice(inv.id!, { auto_advance: false });
  return { stripeId: fin.id!, hostedUrl: fin.hosted_invoice_url ?? null, pdfUrl: fin.invoice_pdf ?? null, number: fin.number ?? null, mock: false };
}

/** Owner marks an invoice paid outside Stripe (check, ACH, cash). */
export async function markStripePaidOutOfBand(stripeId: string): Promise<void> {
  if (!dealerStripeLive() || stripeId.startsWith('in_mock_')) return;
  try { await client().invoices.pay(stripeId, { paid_out_of_band: true }); }
  catch (e) { log('error', 'dealer.stripe.pay_oob_failed', { error: (e as Error).name }); throw new Error('Stripe did not accept the payment record. Check the invoice in Stripe.'); }
}

export async function voidStripeInvoice(stripeId: string): Promise<void> {
  if (!dealerStripeLive() || stripeId.startsWith('in_mock_')) return;
  try { await client().invoices.voidInvoice(stripeId); }
  catch (e) { log('error', 'dealer.stripe.void_failed', { error: (e as Error).name }); throw new Error('Stripe did not void the invoice. Check it in Stripe.'); }
}

export function verifyDealerWebhook(raw: string, signature: string | null): Stripe.Event | null {
  if (!dealerStripeLive()) return null;
  const secret = process.env.STRIPE_DEALER_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) throw new Error('missing webhook secret or signature');
  return client().webhooks.constructEvent(raw, signature, secret);
}
