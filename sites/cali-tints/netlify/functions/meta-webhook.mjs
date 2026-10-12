/**
 * Instagram DM + Facebook Messenger bot: /.netlify/functions/meta-webhook
 *
 * Meta calls GET once to verify the webhook (echo hub.challenge when the
 * verify token matches), then POSTs every message. Each text message runs
 * through the same assistant engine as the website, with the last few turns
 * per sender kept in Netlify Blobs so the conversation has memory, and the
 * reply is sent back through the Graph API.
 *
 * Environment (set in the Netlify UI):
 *   ANTHROPIC_API_KEY     Claude
 *   META_VERIFY_TOKEN     any string you also paste into the Meta app webhook form
 *   META_APP_SECRET       from the Meta app, to verify X-Hub-Signature-256
 *   META_PAGE_TOKEN       Page access token with pages_messaging and
 *                         instagram_manage_messages
 * Setup steps are in README.md → "Bots and booking: what the owner connects".
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { LLM_ENABLED, runTurn } from '../lib/engine.mjs';
import { S, BASE_URL, openState } from '../lib/knowledge.mjs';

const GRAPH = 'https://graph.facebook.com/v21.0';

export default async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token && token === process.env.META_VERIFY_TOKEN) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('method', { status: 405 });

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'))) {
    return new Response('bad signature', { status: 401 });
  }
  let body;
  try { body = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

  // Meta expects a fast 200; do the work, but never fail the acknowledgement.
  try {
    const events = [];
    for (const entry of body?.entry ?? []) {
      for (const ev of entry?.messaging ?? []) events.push(ev);        // Messenger + Instagram
    }
    await Promise.all(events.map(handleEvent));
  } catch (e) {
    console.error('meta-webhook', e?.message);
  }
  return new Response('EVENT_RECEIVED', { status: 200 });
};

function verifySignature(raw, header) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return process.env.NETLIFY_DEV === 'true';       // allow local testing only
  if (!header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const got = header.slice(7);
  return expected.length === got.length && timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

async function handleEvent(ev) {
  const sender = ev?.sender?.id;
  const text = ev?.message?.text;
  if (!sender || !text || ev.message?.is_echo) return;
  const store = getStore('assistant-conversations');
  const key = `sender/${sender}`;
  const history = (await store.get(key, { type: 'json' })) ?? [];

  let out;
  if (LLM_ENABLED) {
    try { out = await runTurn(history, text, { channel: 'Instagram/Messenger DM' }); }
    catch (e) { console.error('turn failed', e?.message); }
  }
  if (!out) {
    const st = openState();
    out = {
      reply: `Thanks for the message. ${st.open ? `We're open now, call ${S.phone_display} and a person will help.` : `We're closed right now (${S.hours_human}).`} Book online any time: ${BASE_URL}/book/`,
      actions: [],
    };
  }
  const linkLines = out.actions.filter((a) => a.href.startsWith('http')).map((a) => `${a.label}: ${a.href}`);
  const reply = [out.reply, ...linkLines].join('\n');

  await sendText(sender, reply);
  const next = [...history, { role: 'user', content: text }, { role: 'assistant', content: out.reply }].slice(-20);
  await store.setJSON(key, next);
}

async function sendText(recipientId, text) {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) { console.error('META_PAGE_TOKEN missing; reply not sent'); return; }
  const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, messaging_type: 'RESPONSE', message: { text: text.slice(0, 1900) } }),
  });
  if (!res.ok) console.error('graph send failed', res.status, await res.text());
}
