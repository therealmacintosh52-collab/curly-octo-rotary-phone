/**
 * CRM API: /.netlify/functions/leads
 *   POST   (public)  create a lead from the booking or quote form or the assistant
 *   GET    (owner)   list leads            ?summary=1 adds today/week counts
 *   PATCH  (owner)   update one lead: { id, status?, quote_cents?, note?, name?, phone?, vehicle?, service?, date?, time? }
 *   GET    (anyone)  ?ping=1 → { ok, crm: true|false } so the site knows the CRM is live
 * Owner calls carry x-admin-key = ADMIN_PASSWORD.
 */
import { CORS, json, isOwner, listLeads, getLead, saveLead, leadFromInput, detailsFrom, STATUSES } from '../lib/store.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  const url = new URL(req.url);
  const crm = Boolean(process.env.ADMIN_PASSWORD);

  if (req.method === 'GET') {
    if (url.searchParams.get('ping')) return json({ ok: true, crm, stripe: Boolean(process.env.STRIPE_SECRET_KEY) });
    if (!isOwner(req)) return json({ error: 'unauthorized' }, 401);
    const leads = await listLeads();
    const out = { leads };
    if (url.searchParams.get('summary')) {
      const today = new Date().toISOString().slice(0, 10);
      const week = new Date(Date.now() - 7 * 86400000).toISOString();
      out.summary = {
        total: leads.length,
        new: leads.filter((l) => l.status === 'new').length,
        today: leads.filter((l) => l.created.startsWith(today)).length,
        week: leads.filter((l) => l.created >= week).length,
        deposits_cents: leads.reduce((n, l) => n + l.payments.reduce((m, p) => m + (p.amount_cents || 0), 0), 0),
      };
    }
    return json(out);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  if (req.method === 'POST') {
    if (!crm) return json({ error: 'crm not configured', crm: false }, 503);
    const source = ['booking', 'quote', 'assistant', 'admin', 'social'].includes(body.source) ? body.source : 'quote';
    if (source === 'admin' && !isOwner(req)) return json({ error: 'unauthorized' }, 401);
    if (typeof body._gotcha === 'string' && body._gotcha) return json({ ok: true });   // honeypot
    const lead = leadFromInput(body, source);
    if (!lead.phone && !lead.name) return json({ error: 'name or phone required' }, 400);
    await saveLead(lead);
    return json({ ok: true, id: lead.id });
  }

  if (req.method === 'PATCH') {
    if (!isOwner(req)) return json({ error: 'unauthorized' }, 401);
    const lead = await getLead(String(body.id || ''));
    if (!lead) return json({ error: 'not found' }, 404);
    if (body.status && STATUSES.includes(body.status)) lead.status = body.status;
    if (Number.isFinite(body.quote_cents)) lead.quote_cents = Math.max(0, Math.round(body.quote_cents));
    for (const k of ['name', 'phone', 'email', 'vehicle', 'service', 'date', 'time']) {
      if (typeof body[k] === 'string') lead[k] = body[k].trim().slice(0, 120);
    }
    if (body.details) lead.details = { ...(lead.details || {}), ...detailsFrom(body.details) };
    if (typeof body.note === 'string' && body.note.trim()) lead.notes.push({ when: new Date().toISOString(), text: body.note.trim().slice(0, 600) });
    if (body.payment && Number.isFinite(body.payment.amount_cents)) {
      // Cash or card taken at the counter, recorded by hand.
      lead.payments.push({ kind: body.payment.kind || 'balance', amount_cents: Math.round(body.payment.amount_cents), when: new Date().toISOString(), ref: 'manual' });
    }
    lead.updated = new Date().toISOString();
    await saveLead(lead);
    return json({ ok: true, lead });
  }
  return json({ error: 'method' }, 405);
};
