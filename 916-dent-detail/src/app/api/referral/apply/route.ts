import { z } from 'zod';
import { guard, limited, ok, parseJson } from '@/lib/api/http';
import { loadByToken } from '@/lib/booking/service';
import { logEvent } from '@/lib/admin/events';
import { repo } from '@/lib/db';
import { REASON_TEXT, applyReferralToCustomer } from '@/lib/referrals';

export const dynamic = 'force-dynamic';

const schema = z.object({ code: z.string().trim().min(1).max(20), token: z.string().min(20).max(400) });

/**
 * Public, authorised by the signed booking token (/booking/[token]). Attaches a referral code to the booking's customer
 * ("first code wins"), marks the lead as referral-sourced, and returns the credit that will appear on the invoice.
 * One-line hook for the booking confirmation step: `fetch('/api/referral/apply', { method: 'POST', body: JSON.stringify({ code, token }) })`.
 * (/book?ref=CODE already reaches the CRM through attribution.ref; this endpoint is for a typed code.)
 */
export async function POST(req: Request) {
  return guard('referral.apply', async () => {
    const rl = await limited(req, 'ref-apply', 10, 60);
    if (rl) return rl;
    const p = await parseJson(req, schema);
    if (!p.ok) return p.res;
    const booking = await loadByToken(p.data.token); // throws BookingError (404/410) for a bad or expired link
    if (!booking.customer_id) return ok({ valid: false, message: 'No customer on this booking.' });
    const v = await applyReferralToCustomer(booking.customer_id, p.data.code);
    if (!v.valid) return ok({ valid: false, reason: v.reason, message: REASON_TEXT[v.reason] });
    if (booking.lead_id) {
      const lead = await repo().leads.get(booking.lead_id);
      if (lead && ['direct', 'organic', 'other'].includes(lead.source) && !lead.source_overridden) {
        await repo().leads.update(lead.id, { source: 'referral', source_auto: lead.source_auto ?? lead.source });
        await logEvent('lead.source_overridden', 'lead', lead.id, 'system', { from: lead.source, to: 'referral', via: 'referral_apply' });
      }
    }
    return ok({ valid: true, creditAmount: v.creditAmount, message: `Code accepted. $${v.creditAmount} comes off your invoice after your first visit.` });
  });
}
