// 916 Concierge web chat. POST JSON { message, conversationId?, sessionToken?, attachments?, attribution? }.
// Streams Server-Sent Events: `status` (tool progress), `delta` (reply text chunks), `done` (final metadata + UI cards).
// The reply is streamed AFTER the output filter has approved the whole message (a filter cannot judge half a sentence),
// so chunks are paced slices of an already-safe reply, not raw model tokens. Send `Accept: application/json` for one JSON body.
import { z } from 'zod';
import { fail, limited, ok, clientIp } from '@/lib/api/http';
import { guardAny } from '@/lib/concierge/route';
import { PHOTO_PATH_RE } from '@/lib/booking/photos';
import { handleMessage, INITIAL_SUGGESTIONS } from '@/lib/concierge/agent';
import { conciergeConfig } from '@/lib/concierge/config';
import { hashKey } from '@/lib/concierge/guardrails';
import { findOrCreateConversation, verifySession } from '@/lib/concierge/state';
import type { TurnResult } from '@/lib/concierge/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const attr = z.object({
  utm_source: z.string().max(200).optional(), utm_medium: z.string().max(200).optional(), utm_campaign: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(), utm_content: z.string().max(200).optional(), gclid: z.string().max(200).optional(),
  fbclid: z.string().max(200).optional(), ref: z.string().max(200).optional(), referrer: z.string().max(200).optional(), landing_page: z.string().max(200).optional(),
}).partial();

const bodySchema = z.object({
  message: z.string().max(4000),
  conversationId: z.string().uuid().optional(),
  sessionToken: z.string().max(600).optional(),
  attachments: z.array(z.object({ path: z.string().regex(PHOTO_PATH_RE), caption: z.string().max(200).optional() })).max(4).optional(),
  attribution: z.object({ first: attr.optional(), last: attr.optional() }).optional(),
});

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const publicResult = (r: TurnResult) => ({
  conversationId: r.conversationId, sessionToken: r.sessionToken, reply: r.reply, ui: r.ui, suggestions: r.suggestions, escalated: r.escalated, status: r.status, mock: r.mock,
});
const chunks = (text: string): string[] => text.match(/\S+\s*/g)?.reduce<string[]>((acc, w) => { const l = acc[acc.length - 1]; if (l !== undefined && l.length < 24) acc[acc.length - 1] = l + w; else acc.push(w); return acc; }, []) ?? [];

export async function POST(req: Request) {
  return guardAny('chat', async () => {
    const ip = clientIp(req);
    let json: unknown;
    try { json = await req.json(); } catch { return fail(400, 'bad_json', 'Invalid JSON.'); }
    const p = bodySchema.safeParse(json);
    if (!p.success) return fail(400, 'invalid_input', 'Invalid message.');
    const b = p.data;

    // Existing conversation: the signed session token must match. A guessed or leaked id alone grants nothing.
    if (b.conversationId && verifySession(b.sessionToken) !== b.conversationId) return fail(401, 'session_invalid', 'Your chat session expired. Please start a new one.');
    if (!b.conversationId) { const rl = await limited(req, 'chat-new', 12, 3600); if (rl) return rl; }

    const identity = { channel: 'web' as const, externalId: b.conversationId ? 'existing' : hashKey(`web:${crypto.randomUUID()}`), phone: null, phoneVerified: false, ip };
    if (b.conversationId) { const rec = await findOrCreateConversation(identity, b.conversationId); if (rec.conv.id !== b.conversationId) return fail(404, 'not_found', 'Chat not found.'); }

    const wantsJson = (req.headers.get('accept') ?? '').includes('application/json') && !(req.headers.get('accept') ?? '').includes('text/event-stream');
    const input = { identity, text: b.message, attachments: b.attachments, conversationId: b.conversationId, attribution: b.attribution };

    if (wantsJson) {
      const r = await handleMessage(input);
      return ok(publicResult(r));
    }

    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (e: string, d: unknown) => controller.enqueue(enc.encode(sse(e, d)));
        try {
          const r = await handleMessage(input, { onEvent: (e) => { if (e.type === 'status') send('status', { tool: e.tool }); } });
          if (r.reply) for (const c of chunks(r.reply)) { send('delta', { text: c }); await new Promise((res) => setTimeout(res, r.mock ? 8 : 18)); }
          send('done', publicResult(r));
        } catch {
          send('error', { message: 'Something went wrong. Please try again or text us.' });
        } finally { controller.close(); }
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
  });
}

/** Static data for the widget's first paint (no model call, no cost). */
export async function GET() {
  return ok({ suggestions: INITIAL_SUGGESTIONS, maxChars: conciergeConfig.maxMessageChars });
}
