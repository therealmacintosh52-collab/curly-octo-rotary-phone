// Memberships: plans come from config/pricing.ts (names, monthly price, what is included). Visit credits per billing
// period are tracked in the membership_visits ledger (grant / use / adjust). Stripe subscription events keep status in sync.
import { memberships as planConfig, type MembershipTier } from '@/config/pricing';
import { repo, type Customer, type Membership } from '@/lib/db';
import { logEvent } from '@/lib/admin/events';
import { createMembershipCheckout, planById } from '@/lib/stripe/subscriptions';

/** [OWNER] visits included per billing period by tier. Derived from the proposed tier copy (monthly, monthly, twice-monthly). */
export const VISITS_PER_PERIOD: Record<MembershipTier['id'], number> = { maintain: 1, protect: 1, showroom: 2 };
/** [OWNER] unused visits roll over up to this many periods' worth, then stop accumulating. */
export const ROLLOVER_PERIODS = 2;

export const plans = () => planConfig.map((p) => ({ ...p, visitsPerPeriod: VISITS_PER_PERIOD[p.id] }));

/** Pure: how many visits a grant adds given the current balance (never above the cap). */
export function grantAmount(balance: number, perPeriod: number, rolloverPeriods = ROLLOVER_PERIODS): number {
  const cap = perPeriod * rolloverPeriods;
  return Math.max(0, Math.min(perPeriod, cap - balance));
}

export async function balanceOf(membershipId: string): Promise<number> {
  const rows = await repo().membership_visits.list({ where: { membership_id: membershipId } });
  return Math.round(rows.reduce((s, r) => s + r.visits, 0) * 100) / 100;
}

export const periodKey = (d = new Date()): string => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

/** Idempotent per (membership, period): a replayed webhook or double click grants once. */
export async function grantForPeriod(m: Membership, key = periodKey(), actor = 'system'): Promise<number> {
  const db = repo();
  const note = `period:${key}`;
  const dup = (await db.membership_visits.list({ where: { membership_id: m.id, kind: 'grant' } })).some((r) => r.note === note);
  if (dup) return 0;
  const per = m.visits_per_period ?? VISITS_PER_PERIOD[m.tier];
  const n = grantAmount(await balanceOf(m.id), per);
  // Record even a zero grant so the period is marked as processed.
  await db.membership_visits.insert({ membership_id: m.id, kind: 'grant', visits: n, note });
  await logEvent('membership.visits_granted', 'membership', m.id, actor, { visits: n, period: key });
  return n;
}

export async function consumeVisit(membershipId: string, bookingId: string | null, actor: string): Promise<number> {
  const bal = await balanceOf(membershipId);
  if (bookingId) {
    const dup = (await repo().membership_visits.list({ where: { membership_id: membershipId, kind: 'use' } })).find((r) => r.booking_id === bookingId);
    if (dup) return bal; // replay: this booking already used a visit
  }
  if (bal < 1) throw new Error('No visit credits left on this membership.');
  await repo().membership_visits.insert({ membership_id: membershipId, kind: 'use', visits: -1, booking_id: bookingId, note: 'visit used' });
  await logEvent('membership.visit_used', 'membership', membershipId, actor, { booking: bookingId });
  return bal - 1;
}

export async function adjustVisits(membershipId: string, visits: number, note: string, actor: string): Promise<void> {
  await repo().membership_visits.insert({ membership_id: membershipId, kind: 'adjust', visits, note: note.slice(0, 120) || 'manual adjustment' });
  await logEvent('membership.visits_adjusted', 'membership', membershipId, actor, { visits });
}

export type StartResult = { mode: 'mock' | 'live'; membership: Membership | null; checkoutUrl: string | null };

/** Start a membership for a customer. Mock: activate a DEMO subscription now. Live: return a Stripe Checkout URL for the customer. */
export async function startMembership(customer: Customer, tier: string, origin: string, actor: string): Promise<StartResult> {
  const plan = planById(tier);
  if (!plan) throw new Error('Unknown plan.');
  const open = (await repo().memberships.list({ where: { customer_id: customer.id } })).find((m) => m.status === 'active' || m.status === 'past_due');
  if (open) throw new Error('This customer already has an active membership. Cancel or change it first.');
  const r = await createMembershipCheckout({ customerId: customer.id, tier, email: customer.email, origin });
  if (r.mode === 'live') return { mode: 'live', membership: null, checkoutUrl: r.url };
  const now = new Date();
  const renews = new Date(now); renews.setUTCMonth(renews.getUTCMonth() + 1);
  const m = await repo().memberships.insert({
    customer_id: customer.id, tier: plan.id, status: 'active', stripe_subscription_id: r.subscriptionId, started_at: now.toISOString(), renews_at: renews.toISOString(),
    visits_per_period: VISITS_PER_PERIOD[plan.id],
  });
  await grantForPeriod(m, periodKey(now), actor);
  await logEvent('membership.started', 'membership', m.id, actor, { tier: plan.id, mock: true });
  return { mode: 'mock', membership: m, checkoutUrl: null };
}

export async function cancelMembership(id: string, actor: string): Promise<Membership> {
  const m = await repo().memberships.get(id);
  if (!m) throw new Error('Membership not found.');
  if (m.stripe_subscription_id) { const { cancelSubscription } = await import('@/lib/stripe/subscriptions'); await cancelSubscription(m.stripe_subscription_id); }
  const u = await repo().memberships.update(id, { status: 'cancelled', cancelled_at: new Date().toISOString() });
  await logEvent('membership.cancelled', 'membership', id, actor, {});
  return u;
}

// ---- Stripe webhook mapping (called from /api/admin/stripe/webhook) -----------------------------------------------
type StripeLike = { type: string; data: { object: Record<string, unknown> } };
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const subIdOfInvoice = (inv: Record<string, unknown>): string | null => {
  const direct = str(inv.subscription);
  if (direct) return direct;
  const parent = inv.parent as { subscription_details?: { subscription?: unknown } } | undefined;
  return str(parent?.subscription_details?.subscription);
};
const STATUS_MAP: Record<string, Membership['status']> = { active: 'active', trialing: 'active', past_due: 'past_due', unpaid: 'past_due', paused: 'paused', canceled: 'cancelled', incomplete_expired: 'cancelled' };

export async function handleSubscriptionEvent(ev: StripeLike): Promise<'handled' | 'ignored'> {
  const db = repo();
  const o = ev.data.object;
  if (ev.type === 'checkout.session.completed' && o.mode === 'subscription') {
    const meta = (o.metadata ?? {}) as Record<string, string>;
    const subId = str(o.subscription);
    const tier = planById(meta.tier ?? '')?.id;
    const customerId = meta.customer_id;
    if (!subId || !tier || !customerId) return 'ignored';
    if (await db.memberships.first({ where: { stripe_subscription_id: subId } })) return 'handled';
    const renews = new Date(); renews.setUTCMonth(renews.getUTCMonth() + 1);
    const m = await db.memberships.insert({ customer_id: customerId, tier, status: 'active', stripe_subscription_id: subId, stripe_customer_id: str(o.customer), started_at: new Date().toISOString(), renews_at: renews.toISOString(), visits_per_period: VISITS_PER_PERIOD[tier] });
    const sc = str(o.customer);
    if (sc) await db.customers.update(customerId, { stripe_customer_id: sc }).catch(() => undefined);
    await grantForPeriod(m, periodKey(), 'stripe');
    await logEvent('membership.started', 'membership', m.id, 'stripe', { tier });
    return 'handled';
  }
  if (ev.type === 'invoice.paid') {
    const subId = subIdOfInvoice(o);
    const m = subId ? await db.memberships.first({ where: { stripe_subscription_id: subId } }) : null;
    if (!m) return 'ignored';
    const periodEnd = typeof (o.lines as { data?: { period?: { end?: number } }[] } | undefined)?.data?.[0]?.period?.end === 'number' ? new Date(((o.lines as { data: { period: { end: number } }[] }).data[0]!.period.end) * 1000) : null;
    const fresh = await db.memberships.update(m.id, { status: 'active', ...(periodEnd ? { renews_at: periodEnd.toISOString() } : {}) });
    await grantForPeriod(fresh, periodKey(), 'stripe');
    return 'handled';
  }
  if (ev.type === 'invoice.payment_failed') {
    const subId = subIdOfInvoice(o);
    const m = subId ? await db.memberships.first({ where: { stripe_subscription_id: subId } }) : null;
    if (!m) return 'ignored';
    await db.memberships.update(m.id, { status: 'past_due' });
    return 'handled';
  }
  if (ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.deleted') {
    const subId = str(o.id);
    const m = subId ? await db.memberships.first({ where: { stripe_subscription_id: subId } }) : null;
    if (!m) return 'ignored';
    const status = ev.type.endsWith('deleted') ? 'cancelled' : STATUS_MAP[String(o.status)] ?? m.status;
    await db.memberships.update(m.id, { status, ...(status === 'cancelled' && !m.cancelled_at ? { cancelled_at: new Date().toISOString() } : {}) });
    return 'handled';
  }
  return 'ignored';
}
