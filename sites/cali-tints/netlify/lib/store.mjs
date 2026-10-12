/**
 * Lead storage and owner auth for the built-in CRM.
 *
 * Leads live in Netlify Blobs (store "leads", one JSON document per lead plus
 * an index). The owner's dashboard (/admin/) authenticates with the
 * ADMIN_PASSWORD environment variable sent as an x-admin-key header; public
 * endpoints (creating a lead from the booking form) need no key.
 */
import { getStore } from '@netlify/blobs';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const STATUSES = ['new', 'confirmed', 'in_bay', 'done', 'lost'];

export const CORS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
  'access-control-allow-headers': 'content-type, x-admin-key',
};
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: CORS });

export function isOwner(req) {
  const secret = process.env.ADMIN_PASSWORD;
  const key = req.headers.get('x-admin-key') || '';
  if (!secret || !key) return false;
  const a = createHmac('sha256', 'k').update(secret).digest();
  const b = createHmac('sha256', 'k').update(key).digest();
  return timingSafeEqual(a, b);
}

const store = () => getStore('leads');

export function newId() {
  return `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}

export async function listLeads() {
  const s = store();
  const { blobs } = await s.list({ prefix: 'lead/' });
  const leads = await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' })));
  return leads.filter(Boolean).sort((a, b) => (b.created || '').localeCompare(a.created || ''));
}

export async function getLead(id) {
  return store().get(`lead/${id}`, { type: 'json' });
}

export async function saveLead(lead) {
  await store().setJSON(`lead/${lead.id}`, lead);
  return lead;
}

/** Up to 20 short label → value pairs from the booking questions. */
export function detailsFrom(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw).slice(0, 20)) {
      if (typeof k === 'string' && (typeof v === 'string' || typeof v === 'number')) out[k.slice(0, 40)] = String(v).slice(0, 160);
    }
  } else if (typeof raw === 'string') {
    raw.split('\n').slice(0, 20).forEach((line) => { const i = line.indexOf(':'); if (i > 0) out[line.slice(0, i).trim().slice(0, 40)] = line.slice(i + 1).trim().slice(0, 160); });
  }
  return out;
}

/** Shape a public submission into a lead document. Everything is a short string. */
export function leadFromInput(input, source) {
  const s = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  return {
    id: newId(),
    created: new Date().toISOString(),
    source,                                  // booking | quote | assistant | admin | social
    status: 'new',
    name: s(input.name, 80), phone: s(input.phone, 40), email: s(input.email, 120),
    vehicle: s(input.vehicle, 120), service: s(input.service, 80),
    date: s(input.date, 60), time: s(input.time, 20), duration: s(input.duration, 20),
    note: s(input.message || input.note, 600),
    details: detailsFrom(input.details),     // { "Which windows": "Full car", ... }
    quote_cents: 0,                          // the owner fills this in after seeing the car
    deposit: { status: 'none', amount_cents: 0 },   // none | pending | paid
    payments: [],                            // { kind: deposit|balance|full, amount_cents, when, ref }
    notes: [],                               // owner notes: { when, text }
    updated: new Date().toISOString(),
  };
}
