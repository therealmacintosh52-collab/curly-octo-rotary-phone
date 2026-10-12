/**
 * Payments: /.netlify/functions/checkout  (Stripe Checkout, hosted page)
 *
 *   GET                       → { enabled, deposit_cents, currency }
 *   POST { lead_id, kind }    kind = "deposit" (the fixed deposit for that
 *                             service) | "full" (the quoted amount on the lead,
 *                             or the amount the customer says they were
 *                             quoted, if the shop has not entered one yet)
 *                             → { url } to redirect the customer to
 *   POST { lead_id, kind:"balance" }   (owner, x-admin-key) → { url } a link the
 *                             shop texts the customer for the remaining balance
 *
 * Talks to Stripe's REST API directly (no SDK). Needs STRIPE_SECRET_KEY; the
 * webhook (stripe-webhook.mjs) marks the lead paid when Stripe confirms.
 * Deposit amounts come from src/data/site.json → payments.
 */
import { createRequire } from 'node:module';
import { CORS, json, isOwner, getLead, saveLead } from '../lib/store.mjs';
const require = createRequire(import.meta.url);
const data = require('../../src/data/site.json');
const P = data.payments;
const BASE = data.site.base_url.replace(/\/$/, '');

const enabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

function depositFor(serviceName) {
  const s = data.services.find((x) => x.nav === serviceName || x.slug === serviceName);
  return s?.deposit_cents ?? P.deposit_cents;
}

async function stripe(path, form) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(process.env.STRIPE_SECRET_KEY + ':').toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out?.error?.message || `stripe ${res.status}`);
  return out;
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (req.method === 'GET') return json({ enabled: enabled(), deposit_cents: P.deposit_cents, currency: P.currency, full_optional: P.full_payment_optional });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!enabled()) return json({ error: 'payments not configured', enabled: false }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const lead = await getLead(String(body.lead_id || ''));
  if (!lead) return json({ error: 'lead not found' }, 404);
  const kind = ['deposit', 'full', 'balance'].includes(body.kind) ? body.kind : 'deposit';
  if (kind === 'balance' && !isOwner(req)) return json({ error: 'unauthorized' }, 401);

  let amount, label;
  if (kind === 'deposit') {
    amount = depositFor(lead.service); label = `Deposit — ${lead.service || 'booking'} at ${data.site.name}`;
  } else if (kind === 'full') {
    amount = lead.quote_cents || Math.round(Number(body.amount_cents) || 0);
    label = `Full payment — ${lead.service || 'booking'} at ${data.site.name}`;
    if (amount < 1000) return json({ error: 'A quoted amount is needed for full payment' }, 400);
  } else {
    const paid = lead.payments.reduce((n, p) => n + (p.amount_cents || 0), 0);
    amount = Math.max(0, (lead.quote_cents || 0) - paid);
    label = `Balance — ${lead.service || 'job'} at ${data.site.name}`;
    if (amount < 100) return json({ error: 'No balance due: enter the quote first' }, 400);
  }

  const session = await stripe('checkout/sessions', {
    mode: 'payment',
    'line_items[0][price_data][currency]': P.currency,
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': label,
    'line_items[0][price_data][product_data][description]': [lead.vehicle, lead.date && `${lead.date} ${lead.time}`].filter(Boolean).join(' · ').slice(0, 200) || 'Cali Tints',
    'line_items[0][quantity]': '1',
    success_url: `${BASE}/thank-you/?paid=${kind}&lead=${lead.id}`,
    cancel_url: `${BASE}/book/?cancelled=1`,
    'metadata[lead_id]': lead.id,
    'metadata[kind]': kind,
    ...(lead.phone ? {} : {}),
    ...(P.collect_phone ? { 'phone_number_collection[enabled]': 'true' } : {}),
  });

  lead.deposit = kind === 'deposit' ? { status: 'pending', amount_cents: amount, session: session.id } : lead.deposit;
  lead.updated = new Date().toISOString();
  await saveLead(lead);
  return json({ url: session.url, amount_cents: amount });
};
