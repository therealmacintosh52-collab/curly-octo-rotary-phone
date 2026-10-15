import { fail, guard, ok } from '@/lib/api/http';
import { applyStripeInvoiceEvent } from '@/lib/dealers/statements';
import { verifyDealerWebhook } from '@/lib/dealers/stripe-invoicing';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

/**
 * Dealer invoice events from Stripe (invoice.paid, invoice.voided). Add this URL as a SECOND webhook endpoint in Stripe; its signing
 * secret goes in STRIPE_DEALER_WEBHOOK_SECRET (falls back to STRIPE_WEBHOOK_SECRET). Mock mode ignores calls.
 */
export async function POST(req: Request) {
  return guard('dealers.stripe.webhook', async () => {
    const raw = await req.text();
    let event: Stripe.Event | null;
    try { event = verifyDealerWebhook(raw, req.headers.get('stripe-signature')); }
    catch { return fail(400, 'bad_signature', 'Invalid signature.'); }
    if (!event) return ok({ ignored: 'mock mode' });
    const obj = event.data.object as { id?: string };
    const result = await applyStripeInvoiceEvent(event.type, obj.id);
    return ok({ received: true, result });
  });
}
