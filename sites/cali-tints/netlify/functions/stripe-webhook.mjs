/**
 * Stripe webhook: /.netlify/functions/stripe-webhook
 * On checkout.session.completed, record the payment on the lead and mark the
 * deposit paid. Signature verified with STRIPE_WEBHOOK_SECRET (Stripe
 * dashboard → Developers → Webhooks → endpoint secret), v1 scheme, 5-minute
 * tolerance. Returns 200 for everything verified so Stripe does not retry.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getLead, saveLead } from '../lib/store.mjs';

function verify(raw, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return expected.length === v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const raw = await req.text();
  if (!verify(raw, req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) {
    return new Response('bad signature', { status: 400 });
  }
  let event;
  try { event = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data?.object ?? {};
    const leadId = s.metadata?.lead_id, kind = s.metadata?.kind || 'deposit';
    if (s.payment_status === 'paid' && leadId) {
      const lead = await getLead(leadId);
      if (lead && !lead.payments.some((p) => p.ref === s.id)) {
        lead.payments.push({ kind, amount_cents: s.amount_total ?? 0, when: new Date().toISOString(), ref: s.id });
        if (kind === 'deposit') lead.deposit = { status: 'paid', amount_cents: s.amount_total ?? 0, session: s.id };
        if (lead.status === 'new') lead.status = 'confirmed';
        if (!lead.email && s.customer_details?.email) lead.email = s.customer_details.email;
        if (!lead.phone && s.customer_details?.phone) lead.phone = s.customer_details.phone;
        lead.updated = new Date().toISOString();
        await saveLead(lead);
      }
    }
  }
  return new Response('ok', { status: 200 });
};
