// Twilio inbound SMS/MMS webhook. Point the number's "A message comes in" webhook (HTTP POST) here.
//  * live (Twilio keys set): X-Twilio-Signature is REQUIRED; the reply is generated after we answer Twilio (empty TwiML,
//    so a slow model never hits Twilio's 15 s timeout) and delivered through the sms lib.
//  * fully offline demo (no Twilio, no Supabase): unsigned requests are accepted and the reply comes back as TwiML.
//  * Supabase live but Twilio missing: refused (503). An unsigned webhook would let anyone act as any phone number.
//  * STOP/START/HELP are handled in code before the model (and Twilio answers them itself on its numbers).
import { after } from 'next/server';
import { fail, limited } from '@/lib/api/http';
import { guardAny } from '@/lib/concierge/route';
import { log } from '@/lib/api/log';
import { processInboundSms } from '@/lib/concierge/channels';
import { authenticateWebhook, formParams, twiml, twimlMessage } from '@/lib/concierge/twilio';
import { isSmsLive } from '@/lib/sms';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  return guardAny('sms', async () => {
    const flood = await limited(req, 'sms-ip', 600, 600);
    if (flood) return flood;
    let params: Record<string, string>;
    try { params = await formParams(req); } catch { return fail(400, 'bad_form', 'Invalid body.'); }
    const auth = authenticateWebhook(req, params);
    if (auth === 'unconfigured') return fail(503, 'sms_unconfigured', 'SMS is not configured.');
    if (auth === 'bad_signature') { log('warn', 'sms.bad_signature'); return fail(403, 'bad_signature', 'Invalid signature.'); }

    const mode = process.env.SMS_REPLY_MODE ?? (isSmsLive() ? 'async' : 'twiml');
    if (mode === 'async') {
      const work = () => processInboundSms(params).then(() => undefined).catch((e) => log('error', 'sms.async_failed', { error: (e as Error).name }));
      try { after(work); } catch { await work(); } // outside a request scope (tests): just run it
      return twiml();
    }
    const r = await processInboundSms(params, { deliver: false });
    return r?.reply ? twimlMessage(r.reply) : twiml();
  });
}
