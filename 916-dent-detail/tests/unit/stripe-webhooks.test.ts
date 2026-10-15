// The two Stripe invoice webhooks must each ignore the other's invoices. Uses the real Stripe signature verification
// (generateTestHeaderString) with dummy keys; no network.
import Stripe from 'stripe';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { mockRepo } from '@/lib/db/mock';
import { repo } from '@/lib/db';
import { POST as adminPost } from '@/app/api/admin/stripe/webhook/route';
import { POST as dealerPost } from '@/app/api/dealers/stripe-webhook/route';

const ADMIN_SECRET = 'whsec_admin_test'; const DEALER_SECRET = 'whsec_dealer_test';
const stripe = new Stripe('sk_test_dummy');
const post = (handler: (r: Request) => Promise<Response>, secret: string, event: Record<string, unknown>, sig?: string) => {
  const payload = JSON.stringify(event);
  const header = sig ?? stripe.webhooks.generateTestHeaderString({ payload, secret });
  return handler(new Request('http://x/hook', { method: 'POST', body: payload, headers: { 'stripe-signature': header } }));
};
const ev = (id: string, type: string, object: Record<string, unknown>) => ({ id, object: 'event', api_version: '2025-01-01', created: 1, type, data: { object }, livemode: false, pending_webhooks: 1, request: null });

let dealerInvoiceId = ''; let membershipId = '';
const saved: Record<string, string | undefined> = {};
beforeEach(async () => {
  for (const k of ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET_ADMIN', 'STRIPE_DEALER_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET']) saved[k] = process.env[k];
  Object.assign(process.env, { STRIPE_SECRET_KEY: 'sk_test_dummy', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_dummy', STRIPE_WEBHOOK_SECRET_ADMIN: ADMIN_SECRET, STRIPE_DEALER_WEBHOOK_SECRET: DEALER_SECRET });
  delete process.env.STRIPE_WEBHOOK_SECRET;
  await mockRepo().reset?.();
  const db = repo();
  const dealer = await db.dealers.insert({ name: 'Acme Motors', status: 'active' } as never);
  const inv = await db.invoices.insert({ dealer_id: dealer.id, status: 'sent', line_items: [], subtotal: 500, deposit_applied: 0, total: 500, stripe_invoice_id: 'in_dealer1', mock: false } as never);
  dealerInvoiceId = inv.id;
  const cust = await db.customers.insert({ name: 'Mem Ber', phone: '+19165550150', sms_opt_in: false });
  const m = await db.memberships.insert({ customer_id: cust.id, tier: 'maintain', status: 'past_due', stripe_subscription_id: 'sub_1', started_at: new Date().toISOString(), visits_per_period: 1 });
  membershipId = m.id;
});
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

describe('/api/admin/stripe/webhook', () => {
  it('ignores a dealer invoice.paid (does not touch memberships or the dealer invoice)', async () => {
    const res = await post(adminPost, ADMIN_SECRET, ev('evt_1', 'invoice.paid', { id: 'in_dealer1', subscription: null }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ignored: 'dealer_invoice' });
    expect((await repo().invoices.get(dealerInvoiceId))!.status).toBe('sent');
    expect((await repo().memberships.get(membershipId))!.status).toBe('past_due');
  });
  it('still handles a membership invoice.paid', async () => {
    const res = await post(adminPost, ADMIN_SECRET, ev('evt_2', 'invoice.paid', { id: 'in_sub1', subscription: 'sub_1' }));
    expect(await res.json()).toMatchObject({ received: true, handled: true });
    expect((await repo().memberships.get(membershipId))!.status).toBe('active');
  });
  it('rejects a bad signature and a signature made with the dealer secret', async () => {
    expect((await post(adminPost, ADMIN_SECRET, ev('evt_3', 'invoice.paid', { id: 'in_sub1', subscription: 'sub_1' }), 't=1,v1=deadbeef')).status).toBe(400);
    expect((await post(adminPost, DEALER_SECRET, ev('evt_4', 'invoice.paid', { id: 'in_sub1', subscription: 'sub_1' }))).status).toBe(400);
  });
  it('dedupes per endpoint: the same event id delivered twice is processed once', async () => {
    const e = ev('evt_5', 'invoice.payment_failed', { id: 'in_sub2', subscription: 'sub_1' });
    expect(await (await post(adminPost, ADMIN_SECRET, e)).json()).toMatchObject({ handled: true });
    expect(await (await post(adminPost, ADMIN_SECRET, e)).json()).toMatchObject({ duplicate: true });
  });
});

describe('/api/dealers/stripe-webhook', () => {
  it('marks a dealer invoice paid', async () => {
    const res = await post(dealerPost, DEALER_SECRET, ev('evt_10', 'invoice.paid', { id: 'in_dealer1' }));
    expect(await res.json()).toMatchObject({ received: true, result: 'paid' });
    expect((await repo().invoices.get(dealerInvoiceId))!.status).toBe('paid');
  });
  it('ignores a membership subscription invoice.paid and unrelated events', async () => {
    const r1 = await post(dealerPost, DEALER_SECRET, ev('evt_11', 'invoice.paid', { id: 'in_sub1', subscription: 'sub_1' }));
    expect(await r1.json()).toMatchObject({ ignored: 'not_dealer_invoice' });
    expect((await repo().memberships.get(membershipId))!.status).toBe('past_due');
    const r2 = await post(dealerPost, DEALER_SECRET, ev('evt_12', 'customer.subscription.updated', { id: 'sub_1', status: 'active' }));
    expect(await r2.json()).toMatchObject({ ignored: 'not_dealer_invoice' });
    expect((await repo().invoices.get(dealerInvoiceId))!.status).toBe('sent');
  });
  it('rejects a bad signature', async () => {
    expect((await post(dealerPost, DEALER_SECRET, ev('evt_13', 'invoice.paid', { id: 'in_dealer1' }), 't=1,v1=00')).status).toBe(400);
    expect((await repo().invoices.get(dealerInvoiceId))!.status).toBe('sent');
  });
});
