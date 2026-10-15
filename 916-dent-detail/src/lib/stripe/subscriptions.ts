// Phase 3: membership billing. Live: Stripe Checkout (mode subscription, inline monthly price) + Billing Portal.
// Mock: no Stripe at all; the admin UI activates a DEMO membership with a `sub_mock_*` id. The monthly price comes
// ONLY from config/pricing.ts (memberships[].priceMonthly); while it is null (an [OWNER] placeholder) live checkout is
// refused so nothing can be sold at a made-up price.
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { memberships, type MembershipTier } from '@/config/pricing';
import { isStripeLive } from './index';

const G = globalThis as unknown as { __stripeP3s?: Stripe };
const client = (): Stripe => (G.__stripeP3s ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { maxNetworkRetries: 2 }));

export class MembershipConfigError extends Error { constructor(m: string) { super(m); this.name = 'MembershipConfigError'; } }

export const planById = (id: string): MembershipTier | undefined => memberships.find((m) => m.id === id);

export type CheckoutResult = { mode: 'mock' | 'live'; url: string | null; subscriptionId: string | null; stripeCustomerId: string | null };

export async function createMembershipCheckout(o: { customerId: string; tier: string; email?: string | null; stripeCustomerId?: string | null; origin: string }): Promise<CheckoutResult> {
  const plan = planById(o.tier);
  if (!plan) throw new MembershipConfigError('Unknown membership plan.');
  if (!isStripeLive()) return { mode: 'mock', url: null, subscriptionId: `sub_mock_${randomUUID().replace(/-/g, '').slice(0, 14)}`, stripeCustomerId: null };
  if (plan.priceMonthly === null) throw new MembershipConfigError(`Set the ${plan.name} monthly price in src/config/pricing.ts before selling it.`);
  const s = await client().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(plan.priceMonthly * 100), recurring: { interval: 'month' }, product_data: { name: `916 Dent & Detail ${plan.name} membership` } } }],
    ...(o.stripeCustomerId ? { customer: o.stripeCustomerId } : { customer_email: o.email ?? undefined }),
    client_reference_id: o.customerId,
    metadata: { customer_id: o.customerId, tier: plan.id },
    subscription_data: { metadata: { customer_id: o.customerId, tier: plan.id } },
    success_url: `${o.origin}/admin/memberships?started=1`,
    cancel_url: `${o.origin}/admin/memberships`,
  });
  return { mode: 'live', url: s.url, subscriptionId: null, stripeCustomerId: null };
}

export async function createBillingPortal(stripeCustomerId: string, returnUrl: string): Promise<string | null> {
  if (!isStripeLive() || stripeCustomerId.startsWith('cus_mock')) return null;
  const s = await client().billingPortal.sessions.create({ customer: stripeCustomerId, return_url: returnUrl });
  return s.url;
}

export async function cancelSubscription(subscriptionId: string): Promise<{ mock: boolean }> {
  if (subscriptionId.startsWith('sub_mock_') || !isStripeLive()) return { mock: true };
  await client().subscriptions.cancel(subscriptionId);
  return { mock: false };
}

export function verifySubscriptionEvent(raw: string, signature: string | null): Stripe.Event | null {
  if (!isStripeLive()) return null;
  const secret = process.env.STRIPE_WEBHOOK_SECRET_ADMIN || process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) throw new Error('missing webhook secret or signature');
  return client().webhooks.constructEvent(raw, signature, secret);
}
