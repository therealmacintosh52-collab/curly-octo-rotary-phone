// Optional Twilio Voice entry point: forward the call to the owners' phones, then report the result to /api/voice/missed.
// Wire the number's "A call comes in" webhook (HTTP POST) here. Skip this route if the business line already forwards
// calls elsewhere and you use a call status callback pointed at /api/voice/missed instead (see README).
import { fail } from '@/lib/api/http';
import { guardAny } from '@/lib/concierge/route';
import { ownerAlertPhones } from '@/lib/concierge/config';
import { authenticateWebhook, escapeXml, formParams, twiml } from '@/lib/concierge/twilio';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return guardAny('voice.incoming', async () => {
    let params: Record<string, string>;
    try { params = await formParams(req); } catch { return fail(400, 'bad_form', 'Invalid body.'); }
    const auth = authenticateWebhook(req, params);
    if (auth === 'unconfigured') return fail(503, 'voice_unconfigured', 'Voice is not configured.');
    if (auth === 'bad_signature') return fail(403, 'bad_signature', 'Invalid signature.');
    const targets = ownerAlertPhones();
    if (!targets.length) return twiml('<Say>Thanks for calling. Please text us and we will help you right away.</Say><Hangup/>');
    const action = `${(process.env.TWILIO_WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')}/api/voice/missed`;
    const numbers = targets.map((n) => `<Number>${escapeXml(n)}</Number>`).join('');
    return twiml(`<Dial timeout="20" answerOnBridge="true" action="${escapeXml(action)}" method="POST">${numbers}</Dial>`);
  });
}
