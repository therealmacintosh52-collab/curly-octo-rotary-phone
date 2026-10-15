import { clientIp, fail, guard, limited, ok, parseJson } from '@/lib/api/http';
import { tokenActionSchema } from '@/lib/booking/schema';
import { BookingError, cancelBooking, confirmDeposit, loadByToken, releaseHold, rescheduleBooking, verifyAndConfirm, viewFor } from '@/lib/booking/service';
import { confirmMockPayment, isStripeLive } from '@/lib/stripe';
import { sendBookingCapi } from '@/lib/booking/capi';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return guard('booking.get', async () => {
    const rl = await limited(req, 'booking-get', 60, 600);
    if (rl) return rl;
    const { token } = await ctx.params;
    return ok(await viewFor(await loadByToken(token)));
  });
}

export async function POST(req: Request, ctx: Ctx) {
  return guard('booking.action', async () => {
    const rl = await limited(req, 'booking-act', 30, 600);
    if (rl) return rl;
    const { token } = await ctx.params;
    const p = await parseJson(req, tokenActionSchema);
    if (!p.ok) return p.res;
    const a = p.data;
    switch (a.action) {
      case 'reschedule': {
        const b = await rescheduleBooking(token, a.startsAt, a.techId ?? null);
        return ok(await viewFor(b));
      }
      case 'cancel': {
        const r = await cancelBooking(token, a.reason);
        return ok({ ...(await viewFor(r.booking)), depositOutcome: r.depositOutcome });
      }
      case 'confirm-payment': {
        const b = await loadByToken(token);
        return ok(await viewFor(await verifyAndConfirm(b.id)));
      }
      case 'mock-pay': {
        if (isStripeLive()) return fail(403, 'not_available', 'Demo payments are disabled when Stripe is live.');
        const b = await loadByToken(token);
        if (!b.payment_intent_id || !confirmMockPayment(b.payment_intent_id)) throw new BookingError('not_available', 'No demo payment to confirm.', 409);
        return ok(await viewFor(await confirmDeposit(b.id)));
      }
      case 'capi': {
        const b = await loadByToken(token);
        return ok(await sendBookingCapi(b, { eventId: a.eventId, marketingConsent: a.marketingConsent, fbp: a.fbp, fbc: a.fbc, sourceUrl: a.sourceUrl, clientIp: clientIp(req), userAgent: req.headers.get('user-agent') ?? undefined }));
      }
      case 'release': {
        await releaseHold(token);
        return ok({ released: true });
      }
    }
  });
}

