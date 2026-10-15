// Phone verification for the web chat (deterministic, no model). start: texts a 6-digit code (live) or uses the demo code
// (mock mode, no real data). confirm: checks it. A verified phone unlocks lookup / reschedule / cancel / booking in that chat.
import { z } from 'zod';
import { fail, guard, limited, ok, parseJson, clientIp } from '@/lib/api/http';
import { confirmVerification, startVerification } from '@/lib/concierge/verify';
import { verifySession } from '@/lib/concierge/state';

export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), conversationId: z.string().uuid(), sessionToken: z.string().max(600), phone: z.string().max(30) }),
  z.object({ action: z.literal('confirm'), conversationId: z.string().uuid(), sessionToken: z.string().max(600), code: z.string().max(10) }),
]);

export async function POST(req: Request) {
  return guard('concierge.verify', async () => {
    const rl = await limited(req, 'cc-verify', 20, 3600);
    if (rl) return rl;
    const p = await parseJson(req, schema, 2000);
    if (!p.ok) return p.res;
    const b = p.data;
    if (verifySession(b.sessionToken) !== b.conversationId) return fail(401, 'session_invalid', 'Your chat session expired. Please start a new one.');
    if (b.action === 'start') {
      const r = await startVerification({ conversationId: b.conversationId, phone: b.phone, ip: clientIp(req) });
      if (!r.ok) {
        const msg = { invalid_phone: 'Enter a valid US mobile number.', unavailable: 'Phone verification is not available right now. Text us from your own phone and we can help.', rate_limited: 'Too many tries. Please wait a while and try again.', not_found: 'Chat not found.', opted_out: 'That number has opted out of texts.', send_failed: "We couldn't send the code. Check the number and try again." }[r.error];
        return fail(r.error === 'rate_limited' ? 429 : 400, r.error, msg);
      }
      return ok({ sent: true, sentTo: r.sentTo, mock: r.mock, mockCodeHint: r.mockCodeHint });
    }
    const r = await confirmVerification({ conversationId: b.conversationId, code: b.code });
    if (!r.ok) return fail(400, r.error, { no_pending: 'Request a code first.', expired: 'That code expired. Request a new one.', bad_code: "That code doesn't match. Try again.", too_many_attempts: 'Too many wrong codes. Request a new one.', not_found: 'Chat not found.' }[r.error]);
    return ok({ verified: true, phoneLast4: r.phoneLast4 });
  });
}
