/**
 * Website assistant endpoint: POST /.netlify/functions/chat
 *   body  { messages: [{role, content}], text: "new message" }
 *   reply { reply, actions: [{label, href}] }
 * GET returns { ok: true, llm: true|false } so the widget knows whether Claude
 * is wired up; without ANTHROPIC_API_KEY the widget keeps its built-in
 * guided flow and this endpoint only reports that.
 */
import { LLM_ENABLED, runTurn } from '../lib/engine.mjs';

const CORS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: CORS });

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (req.method === 'GET') return json({ ok: true, llm: LLM_ENABLED });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!LLM_ENABLED) return json({ error: 'assistant not configured', llm: false }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const text = String(body?.text ?? '').trim().slice(0, 1500);
  if (!text) return json({ error: 'empty' }, 400);
  const history = Array.isArray(body?.messages)
    ? body.messages
        .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
        .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }))
    : [];
  try {
    const out = await runTurn(history, text, { channel: 'website' });
    return json(out);
  } catch (e) {
    console.error('chat error', e?.status, e?.message);
    return json({ error: 'upstream', reply: 'Something went wrong on my side. Call the shop or use the booking page and a person will sort it.' }, 502);
  }
};
