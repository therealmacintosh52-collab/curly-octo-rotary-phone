// Meta Conversions API (server only). Import this from route handlers / server actions, never from client code.
//
//   await sendCapiEvent({
//     event: 'booking_completed',          // our event name; mapped to Meta's with the SAME table the browser uses
//     eventId,                             // the id track() returned in the browser => Meta deduplicates the pair
//     marketingConsent,                    // REQUIRED: pass the visitor's marketing consent; false => nothing is sent
//     sourceUrl, user: { email, phone, firstName, lastName, zip, clientIp, userAgent, fbp, fbc }, value, currency,
//   });
//
// Env-gated: needs NEXT_PUBLIC_META_PIXEL_ID + META_CAPI_ACCESS_TOKEN. Without them it logs the payload (PII already
// hashed) and returns { mocked: true }, so the app runs with zero keys. META_TEST_EVENT_CODE routes events to
// Events Manager > Test events. All identifiers except fbp/fbc/IP/user-agent are SHA-256 hashed per Meta's spec.
import { createHash } from 'node:crypto';
import { metaEventName, type AnalyticsEvent } from './events';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Meta normalisation rules: trim + lowercase; phone = digits with country code; zip = first 5 digits; names letters only. */
export const norm = {
  email: (v: string) => v.trim().toLowerCase(),
  phone: (v: string) => {
    const d = v.replace(/\D/g, '');
    return d.length === 10 ? `1${d}` : d; // US default
  },
  name: (v: string) => v.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''),
  zip: (v: string) => v.replace(/\D/g, '').slice(0, 5),
};
export const hashed = {
  email: (v: string) => sha256(norm.email(v)),
  phone: (v: string) => sha256(norm.phone(v)),
  name: (v: string) => sha256(norm.name(v)),
  zip: (v: string) => sha256(norm.zip(v)),
};

export type CapiUser = {
  email?: string; phone?: string; firstName?: string; lastName?: string; zip?: string; externalId?: string;
  clientIp?: string; userAgent?: string; fbp?: string; fbc?: string;
};

export type CapiInput = {
  event: AnalyticsEvent;
  eventId: string;
  marketingConsent: boolean;
  sourceUrl?: string;
  user: CapiUser;
  value?: number;
  currency?: string;
  custom?: Record<string, string | number | boolean>;
  eventTime?: number; // unix seconds
};

export type CapiResult =
  | { ok: true; mocked: true; payload: unknown }
  | { ok: true; mocked: false; eventsReceived?: number }
  | { ok: false; skipped: 'no-consent' | 'unmapped-event' }
  | { ok: false; error: string; status?: number };

export function buildUserData(u: CapiUser) {
  const one = (v: string | undefined, f: (x: string) => string) => (v && v.trim() ? [f(v)] : undefined);
  const out: Record<string, unknown> = {
    em: one(u.email, hashed.email),
    ph: one(u.phone, hashed.phone),
    fn: one(u.firstName, hashed.name),
    ln: one(u.lastName, hashed.name),
    zp: one(u.zip, hashed.zip),
    external_id: one(u.externalId, (x) => sha256(x.trim())),
    client_ip_address: u.clientIp, // not hashed
    client_user_agent: u.userAgent, // not hashed
    fbp: u.fbp, // not hashed
    fbc: u.fbc, // not hashed
    country: [sha256('us')],
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

export async function sendCapiEvent(input: CapiInput): Promise<CapiResult> {
  if (!input.marketingConsent) return { ok: false, skipped: 'no-consent' };
  const name = metaEventName[input.event];
  if (!name) return { ok: false, skipped: 'unmapped-event' };

  const payload = {
    data: [
      {
        event_name: name,
        event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: input.eventId, // must equal the browser eventID for dedupe
        action_source: 'website',
        ...(input.sourceUrl ? { event_source_url: input.sourceUrl } : {}),
        user_data: buildUserData(input.user),
        custom_data: {
          ...(input.custom ?? {}),
          ...(typeof input.value === 'number' ? { value: input.value, currency: input.currency ?? 'USD' } : {}),
        },
      },
    ],
    ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
  };

  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixel || !token) {
    if (process.env.NODE_ENV !== 'test') console.info('[capi:mock]', JSON.stringify(payload));
    return { ok: true, mocked: true, payload };
  }

  const version = process.env.META_GRAPH_VERSION || 'v21.0';
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${pixel}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `Meta CAPI ${res.status}`, status: res.status };
    const json = (await res.json().catch(() => ({}))) as { events_received?: number };
    return { ok: true, mocked: false, eventsReceived: json.events_received };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'CAPI request failed' };
  }
}
