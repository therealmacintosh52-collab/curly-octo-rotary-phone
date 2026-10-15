import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from '@/lib/db';
import { VISITS_PER_PERIOD, balanceOf, cancelMembership, grantAmount, grantForPeriod, handleSubscriptionEvent, plans, startMembership, useVisit, periodKey } from '@/lib/memberships';
import { memberships as cfg } from '@/config/pricing';
import { createMembershipCheckout, MembershipConfigError } from '@/lib/stripe/subscriptions';

beforeEach(async () => { await repo().reset!(); });

describe('plans', () => {
  it('come from config/pricing.ts (same ids, names, prices)', () => {
    expect(plans().map((p) => [p.id, p.name, p.priceMonthly])).toEqual(cfg.map((p) => [p.id, p.name, p.priceMonthly]));
    expect(VISITS_PER_PERIOD.showroom).toBe(2);
  });
  it('grantAmount caps the balance at the rollover limit', () => {
    expect(grantAmount(0, 1)).toBe(1);
    expect(grantAmount(1, 1)).toBe(1);
    expect(grantAmount(2, 1)).toBe(0);
    expect(grantAmount(3, 2)).toBe(1);
  });
});

describe('mock membership lifecycle', () => {
  it('starts (DEMO), grants once per period, uses visits, cannot go below zero, cancels', async () => {
    const c = await repo().customers.insert({ name: 'Mem Ber', phone: '+19165550177', sms_opt_in: false });
    const r = await startMembership(c, 'maintain', 'http://localhost:3000', 'owner:t');
    expect(r.mode).toBe('mock');
    const m = r.membership!;
    expect(m.stripe_subscription_id).toMatch(/^sub_mock_/);
    expect(await balanceOf(m.id)).toBe(1);
    expect(await grantForPeriod(m, periodKey())).toBe(0); // same period: no second grant
    expect(await balanceOf(m.id)).toBe(1);
    await expect(startMembership(c, 'protect', 'x', 'o')).rejects.toThrow(/already/);
    expect(await useVisit(m.id, 'booking-1', 'o')).toBe(0);
    expect(await useVisit(m.id, 'booking-1', 'o').catch(() => -1)).toBe(0); // same booking: no double spend (returns balance 0 via dup check?)
    await expect(useVisit(m.id, 'booking-2', 'o')).rejects.toThrow(/No visit credits/);
    await grantForPeriod(m, '2099-01');
    expect(await balanceOf(m.id)).toBe(1);
    expect((await cancelMembership(m.id, 'o')).status).toBe('cancelled');
  });
});

describe('stripe', () => {
  it('live checkout is refused while the plan price is an [OWNER] placeholder', async () => {
    const prev = { sk: process.env.STRIPE_SECRET_KEY, pk: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY };
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'; process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_x';
    try {
      if (cfg[0]!.priceMonthly === null) await expect(createMembershipCheckout({ customerId: 'c', tier: 'maintain', origin: 'http://x' })).rejects.toBeInstanceOf(MembershipConfigError);
      await expect(createMembershipCheckout({ customerId: 'c', tier: 'bogus', origin: 'http://x' })).rejects.toBeInstanceOf(MembershipConfigError);
    } finally {
      if (prev.sk === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = prev.sk;
      if (prev.pk === undefined) delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = prev.pk;
    }
  });
  it('webhook mapping: checkout.completed creates + grants (idempotent), invoice.paid renews, payment_failed -> past_due, deleted -> cancelled', async () => {
    const c = await repo().customers.insert({ name: 'Mem Ber', sms_opt_in: false });
    const ev = (type: string, object: Record<string, unknown>) => ({ type, data: { object } });
    const done = ev('checkout.session.completed', { mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', metadata: { customer_id: c.id, tier: 'protect' } });
    expect(await handleSubscriptionEvent(done)).toBe('handled');
    expect(await handleSubscriptionEvent(done)).toBe('handled');
    const ms = await repo().memberships.list();
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ tier: 'protect', status: 'active', stripe_customer_id: 'cus_1' });
    expect((await repo().customers.get(c.id))!.stripe_customer_id).toBe('cus_1');
    expect(await balanceOf(ms[0]!.id)).toBe(1);
    expect(await handleSubscriptionEvent(ev('invoice.payment_failed', { subscription: 'sub_1' }))).toBe('handled');
    expect((await repo().memberships.get(ms[0]!.id))!.status).toBe('past_due');
    expect(await handleSubscriptionEvent(ev('invoice.paid', { parent: { subscription_details: { subscription: 'sub_1' } }, lines: { data: [{ period: { end: 2_000_000_000 } }] } }))).toBe('handled');
    const renewed = (await repo().memberships.get(ms[0]!.id))!;
    expect(renewed.status).toBe('active');
    expect(renewed.renews_at).toBe(new Date(2_000_000_000_000).toISOString());
    expect(await handleSubscriptionEvent(ev('customer.subscription.deleted', { id: 'sub_1' }))).toBe('handled');
    expect((await repo().memberships.get(ms[0]!.id))!.status).toBe('cancelled');
    expect(await handleSubscriptionEvent(ev('invoice.paid', { subscription: 'sub_unknown' }))).toBe('ignored');
    expect(await handleSubscriptionEvent(ev('something.else', {}))).toBe('ignored');
  });
});
