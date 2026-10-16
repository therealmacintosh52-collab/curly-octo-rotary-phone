import { readTextCapped } from '@/lib/security/body';
import { fail, guard, ok } from '@/lib/api/http';
import { log } from '@/lib/api/log';
import { confirmDeposit } from '@/lib/booking/service';
import { repo } from '@/lib/db';
import { isStripeLive, verifyWebhook } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return guard('stripe.webhook', async () => {
    // Mock mode: nothing to verify and nothing to trust. Acknowledge so a misconfigured sender stops retrying.
    if (!isStripeLive()) return ok({ received: true, mock: true });
    const raw = await readTextCapped(req, 1_000_000);
    if (raw === null) return fail(413, 'too_large', 'Request too large.');
    let event;
    try { event = verifyWebhook(raw, req.headers.get('stripe-signature')); }
    catch { return fail(400, 'bad_signature', 'Invalid signature.'); }
    if (!event) return fail(400, 'bad_signature', 'Invalid signature.');

    const db = repo();
    if (await db.stripe_events.get(event.id)) return ok({ received: true, duplicate: true });
    await db.stripe_events.insert({ id: event.id, type: event.type });

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as { id: string; metadata?: Record<string, string> };
      const bookingId = pi.metadata?.booking_id ?? (await db.bookings.first({ where: { payment_intent_id: pi.id } }))?.id;
      if (bookingId) {
        try { await confirmDeposit(bookingId); }
        catch (e) { log('warn', 'stripe.webhook.confirm_failed', { booking: bookingId, error: (e as Error).name }); }
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      log('info', 'stripe.payment_failed', { event: event.id });
    }
    return ok({ received: true });
  });
}
