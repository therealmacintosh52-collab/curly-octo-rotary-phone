// Twilio Voice: the <Dial action="..."> callback (and/or call status callback). If nobody answered, text the caller back
// within 60 seconds and start the bot conversation. Deduped per number, quiet-hours aware, opt-out aware.
import { fail, limited } from '@/lib/api/http';
import { guardAny } from '@/lib/concierge/route';
import { log } from '@/lib/api/log';
import { handleMissedCall, wasMissed } from '@/lib/concierge/missedcall';
import { authenticateWebhook, formParams, twiml, escapeXml } from '@/lib/concierge/twilio';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  return guardAny('voice.missed', async () => {
    const flood = await limited(req, 'voice-ip', 300, 600);
    if (flood) return flood;
    let params: Record<string, string>;
    try { params = await formParams(req); } catch { return fail(400, 'bad_form', 'Invalid body.'); }
    const auth = authenticateWebhook(req, params);
    if (auth === 'unconfigured') return fail(503, 'voice_unconfigured', 'Voice is not configured.');
    if (auth === 'bad_signature') { log('warn', 'voice.bad_signature'); return fail(403, 'bad_signature', 'Invalid signature.'); }
    if (!wasMissed(params)) return twiml(); // answered or completed: nothing to do
    const received = Date.now();
    const out = await handleMissedCall({ from: params.From ?? params.Caller ?? '', callSid: params.CallSid, receivedAtMs: received });
    log('info', 'voice.missed', { action: out.action });
    const say = out.action === 'sent' || out.action === 'deferred' ? '<Say>Sorry we missed you. We are sending you a text so we can help right away. Goodbye.</Say>' : '';
    return twiml(`${say}<Hangup/>`.replace(/<Say>(.*?)<\/Say>/, (_m, t: string) => `<Say>${escapeXml(t)}</Say>`));
  });
}
