import { guard, limited, ok, parseJson, fail } from '@/lib/api/http';
import { createBooking } from '@/lib/booking/service';
import { createBookingSchema } from '@/lib/booking/schema';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return guard('booking.create', async () => {
    const rl = await limited(req, 'booking', 10, 3600);
    if (rl) return rl;
    const key = req.headers.get('idempotency-key') ?? '';
    if (!key) return fail(400, 'bad_idempotency_key', 'Idempotency-Key header is required.');
    const p = await parseJson(req, createBookingSchema);
    if (!p.ok) return p.res;
    const r = await createBooking(p.data, key);
    return ok({
      bookingId: r.booking.id, token: r.token, status: r.booking.status, replay: r.replay,
      holdExpiresAt: r.booking.hold_expires_at ?? null, startsAt: r.booking.starts_at, endsAt: r.booking.ends_at, payment: r.payment,
    }, { status: r.replay ? 200 : 201 });
  });
}
