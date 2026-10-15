// Phase 3: collecting the balance in person. Live: Stripe Checkout Session used as a one-off pay link (works from a
// text/QR on the customer's phone; the URL is valid 24 h) and Terminal helpers (connection token + card_present
// intent). Mock: a clearly fake link; the admin UI offers "DEMO: mark as paid". Whole dollars in, cents at Stripe.
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { log } from '@/lib/api/log';
import { isStripeLive } from './index';

const G = globalThis as unknown as { __stripeP3?: Stripe };
const client = (): Stripe => (G.__stripeP3 ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { maxNetworkRetries: 2 }));

export type PayLink = { id: string; url: string; mock: boolean };

export async function createPayLink(o: { amount: number; description: string; invoiceId: string; bookingId?: string | null; email?: string | null; origin: string }): Promise<PayLink> {
  if (!(o.amount > 0)) throw new Error('amount must be positive');
  if (!isStripeLive()) {
    const id = `cs_mock_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    return { id, url: `${o.origin}/admin/demo-pay/${id}`, mock: true };
  }
  const s = await client().checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(o.amount * 100), product_data: { name: o.description.slice(0, 120) } } }],
      client_reference_id: o.invoiceId,
      customer_email: o.email ?? undefined,
      metadata: { invoice_id: o.invoiceId, booking_id: o.bookingId ?? '' },
      payment_intent_data: { metadata: { invoice_id: o.invoiceId, booking_id: o.bookingId ?? '' }, description: o.description.slice(0, 120) },
      success_url: `${o.origin}/admin/pay-done?invoice=${o.invoiceId}`,
      cancel_url: `${o.origin}/admin/pay-done?invoice=${o.invoiceId}&cancelled=1`,
    },
    { idempotencyKey: `paylink_${o.invoiceId}_${Math.round(o.amount * 100)}` },
  );
  if (!s.url) throw new Error('Stripe returned no checkout url');
  return { id: s.id, url: s.url, mock: false };
}

/** Stripe Terminal: the reader SDK in the browser asks this endpoint for a connection token. */
export async function terminalConnectionToken(): Promise<{ secret: string } | null> {
  if (!isStripeLive()) return null;
  const t = await client().terminal.connectionTokens.create({});
  return { secret: t.secret };
}

export async function createTerminalIntent(o: { amount: number; invoiceId: string; bookingId?: string | null }): Promise<{ id: string; clientSecret: string } | null> {
  if (!isStripeLive()) return null;
  const pi = await client().paymentIntents.create(
    { amount: Math.round(o.amount * 100), currency: 'usd', allowed_payment_method_types: ['card_present'], capture_method: 'automatic', metadata: { invoice_id: o.invoiceId, booking_id: o.bookingId ?? '' } },
    { idempotencyKey: `term_${o.invoiceId}_${Math.round(o.amount * 100)}` },
  );
  log('info', 'stripe.terminal_intent', { invoice: o.invoiceId });
  return { id: pi.id, clientSecret: pi.client_secret! };
}

/** Server-side truth for a Checkout Session or PaymentIntent that should have paid an invoice. */
export async function sessionPaid(sessionId: string): Promise<{ paid: boolean; paymentIntentId: string | null; amount: number }> {
  if (sessionId.startsWith('cs_mock_') || !isStripeLive()) return { paid: false, paymentIntentId: null, amount: 0 };
  const s = await client().checkout.sessions.retrieve(sessionId);
  return { paid: s.payment_status === 'paid', paymentIntentId: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id ?? null, amount: (s.amount_total ?? 0) / 100 };
}

export const isTerminalConfigured = (): boolean => isStripeLive() && Boolean(process.env.STRIPE_TERMINAL_LOCATION_ID);

/** Verify an admin-webhook signature (separate endpoint and secret from Phase 2's deposit webhook). */
export function verifyAdminWebhook(raw: string, signature: string | null): Stripe.Event | null {
  if (!isStripeLive()) return null;
  const secret = process.env.STRIPE_WEBHOOK_SECRET_ADMIN || process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) throw new Error('missing webhook secret or signature');
  return client().webhooks.constructEvent(raw, signature, secret);
}
