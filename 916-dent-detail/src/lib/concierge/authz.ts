// Authorization for booking data. The model never decides who may see or change a booking: this module does, from
// facts the CHANNEL established (Twilio From number, verified web phone) or a signed manage-link token.
//
//   lookup / reschedule / cancel / deposit link  ==>  (a) booking belongs to the verified phone of this conversation, or
//                                                    (b) caller presents a valid signed token for that exact booking.
// Failures are deliberately uniform ("not found" and "not yours" look the same) so nothing can be enumerated.
import { verifyBookingToken } from '@/lib/booking/tokens';
import { repo, type BookingRow } from '@/lib/db';
import type { ConvState } from './state';
import type { ChannelIdentity } from './types';

export const verifiedPhoneOf = (identity: ChannelIdentity, state: ConvState): string | null =>
  identity.phoneVerified && identity.phone ? identity.phone : state.verifiedPhone ?? null;

export type BookingAccess = { ok: true; booking: BookingRow; via: 'phone' | 'token' } | { ok: false; reason: 'verification_required' | 'not_accessible' };

export async function authorizeBooking(p: { identity: ChannelIdentity; state: ConvState; bookingId?: string | null; token?: string | null; now?: number }): Promise<BookingAccess> {
  const db = repo();
  if (p.token) {
    const v = verifyBookingToken(p.token, p.now ?? Date.now());
    if (!v.ok || (p.bookingId && p.bookingId !== v.bookingId)) return { ok: false, reason: 'not_accessible' };
    const b = await db.bookings.get(v.bookingId);
    return b ? { ok: true, booking: b, via: 'token' } : { ok: false, reason: 'not_accessible' };
  }
  const phone = verifiedPhoneOf(p.identity, p.state);
  if (!phone) return { ok: false, reason: 'verification_required' };
  if (!p.bookingId) return { ok: false, reason: 'not_accessible' };
  const b = await db.bookings.get(p.bookingId).catch(() => null);
  if (!b?.customer_id) return { ok: false, reason: 'not_accessible' };
  const c = await db.customers.get(b.customer_id);
  return c?.phone && c.phone === phone ? { ok: true, booking: b, via: 'phone' } : { ok: false, reason: 'not_accessible' };
}

/** Bookings that belong to a VERIFIED phone. Callers must pass verifiedPhoneOf(...), never a number from customer text. */
export async function bookingsForVerifiedPhone(phone: string, limit = 6): Promise<BookingRow[]> {
  const db = repo();
  const customers = await db.customers.list({ where: { phone } });
  const out: BookingRow[] = [];
  for (const c of customers) out.push(...(await db.bookings.list({ where: { customer_id: c.id }, orderBy: 'starts_at', desc: true, limit })));
  return out.filter((b) => b.status !== 'expired').sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at)).slice(0, limit);
}
