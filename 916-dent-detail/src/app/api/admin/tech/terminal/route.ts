import { z } from 'zod';
import { adminRoute, HttpError } from '@/lib/admin/api';
import { jobForSession } from '@/lib/admin/access';
import { syncDraftInvoice } from '@/lib/admin/jobs';
import { ok } from '@/lib/api/http';
import { ANY_ROLE } from '@/lib/auth/roles';
import { createTerminalIntent, isTerminalConfigured, terminalConnectionToken } from '@/lib/stripe/payments';

export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('action', [z.object({ action: z.literal('token') }), z.object({ action: z.literal('intent'), jobId: z.string().uuid() })]);

/**
 * Stripe Terminal server half: connection token + card_present PaymentIntent for the balance due. Live mode only and
 * only when STRIPE_TERMINAL_LOCATION_ID is set. The reader UI itself is NOT built or verified (needs hardware).
 */
export async function POST(req: Request) {
  return adminRoute('admin.terminal', req, ANY_ROLE, schema, async ({ session, body }) => {
    if (!isTerminalConfigured()) throw new HttpError(409, 'terminal_off', 'Card reader payments are not set up. Use a pay link or record the payment.');
    if (body.action === 'token') return ok(await terminalConnectionToken());
    const job = await jobForSession(session, body.jobId);
    const bundle = await syncDraftInvoice(job.id, { create: true });
    if (!bundle || !(bundle.math.balance > 0)) throw new HttpError(409, 'nothing_due', 'Nothing is due on this job.');
    return ok(await createTerminalIntent({ amount: bundle.math.balance, invoiceId: bundle.invoice.id, bookingId: bundle.invoice.booking_id }));
  });
}
