// Server-side Meta Conversions API for booking_completed. Reuses the browser event_id (Meta dedupes the pair) and is
// gated on the visitor's marketing consent. Sent at most once per booking. Mock mode (no keys) just logs hashed data.
import { sendCapiEvent } from '@/lib/analytics/capi';
import { repo, type BookingRow } from '@/lib/db';

export async function sendBookingCapi(b: BookingRow, o: { eventId: string; marketingConsent: boolean; fbp?: string; fbc?: string; sourceUrl?: string; clientIp?: string; userAgent?: string }): Promise<{ sent: boolean; reason?: string }> {
  if (b.status === 'pending_deposit' || b.status === 'expired' || b.status === 'cancelled') return { sent: false, reason: 'not_confirmed' };
  if (!o.marketingConsent) return { sent: false, reason: 'no_consent' };
  const db = repo();
  const prior = await db.events.first({ where: { type: 'capi.booking_completed', entity_type: 'booking', entity_id: b.id } });
  if (prior) return { sent: false, reason: 'already_sent' };
  const c = b.customer_id ? await db.customers.get(b.customer_id) : null;
  const [first, ...rest] = (c?.name ?? '').split(' ');
  const r = await sendCapiEvent({
    event: 'booking_completed', eventId: o.eventId, marketingConsent: true, sourceUrl: o.sourceUrl,
    user: { email: c?.email ?? undefined, phone: c?.phone ?? undefined, firstName: first, lastName: rest.join(' ') || undefined, zip: b.zip ?? undefined, externalId: b.customer_id ?? undefined, clientIp: o.clientIp, userAgent: o.userAgent, fbp: o.fbp, fbc: o.fbc },
    value: b.deposit_amount, currency: 'USD',
  });
  await db.events.insert({ type: 'capi.booking_completed', entity_type: 'booking', entity_id: b.id, actor: 'system', data: { ok: r.ok } });
  return { sent: r.ok };
}
