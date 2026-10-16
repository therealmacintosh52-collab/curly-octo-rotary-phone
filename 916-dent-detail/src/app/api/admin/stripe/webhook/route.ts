import { readTextCapped } from '@/lib/security/body';
import { fail, guard, ok } from '@/lib/api/http';
import { log } from '@/lib/api/log';
import { recordPayment } from '@/lib/admin/payments';
import { repo } from '@/lib/db';
import { handleSubscriptionEvent } from '@/lib/memberships';
import { isStripeLive } from '@/lib/stripe';
import { invoiceOwner } from '@/lib/stripe/ownership';
import { verifyAdminWebhook } from '@/lib/stripe/payments';

export const dynamic = 'force-dynamic';

/**
 * Phase 3 Stripe webhook (separate endpoint from Phase 2's deposit webhook; own secret STRIPE_WEBHOOK_SECRET_ADMIN, falls
 * back to STRIPE_WEBHOOK_SECRET). Events: checkout.session.completed (pay links + membership signups),
 * customer.subscription.updated|deleted, invoice.paid, invoice.payment_failed. Idempotent via stripe_events.
 */
export async function POST(req: Request) {
  return guard('admin.stripe.webhook', async () => {
    if (!isStripeLive()) return ok({ received: true, mock: true });
    const raw = await readTextCapped(req, 1_000_000);
    if (raw === null) return fail(413, 'too_large', 'Request too large.');
    let ev;
    try { ev = verifyAdminWebhook(raw, req.headers.get('stripe-signature')); } catch { return fail(400, 'bad_signature', 'Invalid signature.'); }
    if (!ev) return fail(400, 'bad_signature', 'Invalid signature.');
    const db = repo();
    // dedupe per endpoint: Stripe sends the SAME event id to every endpoint subscribed to it, so a bare ev.id would let one endpoint starve another
    const dedupeId = `admin:${ev.id}`;
    if (await db.stripe_events.get(dedupeId)) return ok({ received: true, duplicate: true });
    await db.stripe_events.insert({ id: dedupeId, type: ev.type });

    const obj = ev.data.object as unknown as Record<string, unknown>;
    // dealer net-terms invoices belong to /api/dealers/stripe-webhook; never handle their invoice.* events here
    if (ev.type.startsWith('invoice.') && (await invoiceOwner(obj)) === 'dealer') return ok({ received: true, ignored: 'dealer_invoice' });
    if (ev.type === 'checkout.session.completed' && obj.mode === 'payment') {
      const invoiceId = (obj.metadata as Record<string, string> | undefined)?.invoice_id;
      const pi = typeof obj.payment_intent === 'string' ? obj.payment_intent : null;
      if (invoiceId && obj.payment_status === 'paid') {
        try { await recordPayment({ invoiceId, amount: Number(obj.amount_total ?? 0) / 100, method: 'stripe_link', actor: 'stripe', stripePaymentIntentId: pi }); }
        catch (e) { log('warn', 'admin.webhook.pay_failed', { invoice: invoiceId, error: (e as Error).name }); }
      }
      return ok({ received: true });
    }
    const r = await handleSubscriptionEvent({ type: ev.type, data: { object: obj } });
    return ok({ received: true, handled: r === 'handled' });
  });
}
