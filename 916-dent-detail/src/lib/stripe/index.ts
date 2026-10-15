// Stripe deposits. Live when STRIPE_SECRET_KEY + NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY are set; otherwise a fake
// payment intent and a "DEMO" confirm button in the UI. Amounts are whole dollars in app code, cents at Stripe.
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { log } from '@/lib/api/log';

export const isStripeLive = (): boolean => Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const G = globalThis as unknown as { __stripe?: Stripe };
function client(): Stripe {
  return (G.__stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { maxNetworkRetries: 2 }));
}

export type DepositIntent = { id: string; clientSecret: string; amount: number; mock: boolean };

export async function createDepositIntent(opts: { amount: number; bookingId: string; email?: string | null; idempotencyKey: string }): Promise<DepositIntent> {
  if (!isStripeLive()) {
    const id = `pi_mock_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    return { id, clientSecret: `${id}_secret_mock`, amount: opts.amount, mock: true };
  }
  const pi = await client().paymentIntents.create(
    {
      amount: Math.round(opts.amount * 100), currency: 'usd', automatic_payment_methods: { enabled: true },
      receipt_email: opts.email ?? undefined, description: 'Appointment deposit', metadata: { booking_id: opts.bookingId },
    },
    { idempotencyKey: `deposit_${opts.idempotencyKey}` },
  );
  return { id: pi.id, clientSecret: pi.client_secret!, amount: opts.amount, mock: false };
}

/** Server-side truth about a payment. Mock intents are "succeeded" only after confirmMockPayment. */
const mockPaid = (G as unknown as { __mockPaid?: Set<string> });
export function confirmMockPayment(intentId: string): boolean {
  if (isStripeLive() || !intentId.startsWith('pi_mock_')) return false;
  (mockPaid.__mockPaid ??= new Set()).add(intentId);
  return true;
}

export async function intentStatus(intentId: string): Promise<'succeeded' | 'pending' | 'failed'> {
  if (intentId.startsWith('pi_mock_')) return mockPaid.__mockPaid?.has(intentId) ? 'succeeded' : 'pending';
  if (!isStripeLive()) return 'pending';
  const pi = await client().paymentIntents.retrieve(intentId);
  return pi.status === 'succeeded' ? 'succeeded' : pi.status === 'canceled' ? 'failed' : 'pending';
}

export async function refundIntent(intentId: string): Promise<{ ok: boolean; mock: boolean }> {
  if (intentId.startsWith('pi_mock_') || !isStripeLive()) { log('info', 'stripe.refund.mock', { intent: intentId }); return { ok: true, mock: true }; }
  try { await client().refunds.create({ payment_intent: intentId }, { idempotencyKey: `refund_${intentId}` }); return { ok: true, mock: false }; }
  catch (e) { log('error', 'stripe.refund.failed', { error: (e as Error).name }); return { ok: false, mock: false }; }
}

export async function cancelIntent(intentId: string): Promise<void> {
  if (intentId.startsWith('pi_mock_') || !isStripeLive()) return;
  try { await client().paymentIntents.cancel(intentId); } catch { /* already finalised */ }
}

/** Verify a webhook. Live: signature required. Mock mode: returns null (the route ignores webhooks). */
export function verifyWebhook(rawBody: string, signature: string | null): Stripe.Event | null {
  if (!isStripeLive()) return null;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) throw new Error('missing webhook secret or signature');
  return client().webhooks.constructEvent(rawBody, signature, secret);
}
