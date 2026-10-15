import { z } from 'zod';
import { fail, guard, limited, ok, parseJson } from '@/lib/api/http';
import { REASON_TEXT, validateReferralCode } from '@/lib/referrals';

export const dynamic = 'force-dynamic';

const schema = z.object({ code: z.string().trim().min(1).max(20), phone: z.string().max(30).optional(), email: z.string().max(120).optional() });

/**
 * Public. "Is this code usable by this person?" No side effects, and the answer never names the referrer.
 * Booking UI hook (Phase 2, one line): after the customer types a code, `fetch('/api/referral/validate', { method: 'POST', body: JSON.stringify({ code, phone, email }) })`
 * and show `message`. The credit itself is applied on the invoice (see /api/referral/apply and README).
 */
export async function POST(req: Request) {
  return guard('referral.validate', async () => {
    const rl = await limited(req, 'ref-validate', 20, 60);
    if (rl) return rl;
    const p = await parseJson(req, schema);
    if (!p.ok) return p.res;
    const v = await validateReferralCode(p.data.code, { phone: p.data.phone, email: p.data.email });
    if (!v.valid) return ok({ valid: false, reason: v.reason, message: REASON_TEXT[v.reason] });
    return ok({ valid: true, creditAmount: v.creditAmount, message: `Code accepted. $${v.creditAmount} off your first visit.` });
  });
}

export const GET = () => fail(405, 'method_not_allowed', 'Use POST.');
