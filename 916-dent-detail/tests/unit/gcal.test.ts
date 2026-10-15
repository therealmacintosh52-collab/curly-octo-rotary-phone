// Google Calendar one-way push: env-gated, stubbed fetch only (no network, no real key).
import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isCalendarLive, syncBookingEvent } from '@/lib/booking/gcal';
import type { BookingRow, Tech } from '@/lib/db';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const ENV = ['GOOGLE_CALENDAR_CLIENT_EMAIL', 'GOOGLE_CALENDAR_PRIVATE_KEY', 'GOOGLE_CALENDAR_IDS'] as const;
const saved: Record<string, string | undefined> = {};
const booking = (over: Partial<BookingRow> = {}): BookingRow => ({
  id: 'b1', status: 'confirmed', services: ['interior'], addons: [], starts_at: '2026-10-20T16:00:00.000Z', ends_at: '2026-10-20T18:00:00.000Z', duration_min: 120,
  zip: '95624', city: 'Elk Grove', address_line: '1 Main St', travel_fee: 0, needs_review: false, deposit_amount: 50, deposit_status: 'paid', reschedule_count: 0,
  created_at: '', updated_at: '', ...over,
} as BookingRow);
const tech = (over: Partial<Tech> = {}): Tech => ({ id: 't1', name: 'Alex Rivera', active: true, created_at: '', updated_at: '', ...over } as Tech);

let calls: { url: string; init?: RequestInit }[] = [];
function stubFetch(handler?: (url: string, init?: RequestInit) => Response | undefined) {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    const custom = handler?.(u, init);
    if (custom) return custom;
    if (u.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'ya29.test', expires_in: 3600 }), { status: 200 });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ id: 'evt_123' }), { status: 200 });
  }));
}

beforeEach(() => { for (const k of ENV) saved[k] = process.env[k]; });
afterEach(() => { vi.unstubAllGlobals(); for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
const live = (ids = 'alex=alex@group.calendar.google.com') => {
  process.env.GOOGLE_CALENDAR_CLIENT_EMAIL = 'svc@proj.iam.gserviceaccount.com';
  process.env.GOOGLE_CALENDAR_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n'); // how it arrives from an .env file
  process.env.GOOGLE_CALENDAR_IDS = ids;
};

describe('gcal sync', () => {
  it('is a silent no-op without keys: no network, returns null', async () => {
    for (const k of ENV) delete process.env[k];
    stubFetch();
    expect(isCalendarLive()).toBe(false);
    expect(await syncBookingEvent('upsert', booking(), tech())).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('with keys but no calendar for this tech: nothing is sent', async () => {
    live('someoneelse=x@group.calendar.google.com');
    stubFetch();
    expect(await syncBookingEvent('upsert', booking(), tech())).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('creates an event on the tech calendar (first name -> GOOGLE_CALENDAR_IDS) with a signed JWT assertion and returns its id', async () => {
    live();
    stubFetch();
    expect(await syncBookingEvent('upsert', booking(), tech())).toBe('evt_123');
    const [tokenCall, eventCall] = calls;
    expect(tokenCall!.url).toBe('https://oauth2.googleapis.com/token');
    const form = new URLSearchParams(String(tokenCall!.init!.body));
    expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const [h, c, sig] = form.get('assertion')!.split('.');
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claim = JSON.parse(Buffer.from(c!, 'base64url').toString());
    expect(claim).toMatchObject({ iss: 'svc@proj.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/calendar.events', aud: 'https://oauth2.googleapis.com/token' });
    expect(claim.exp - claim.iat).toBeLessThanOrEqual(3600);
    expect(sig!.length).toBeGreaterThan(100);
    expect(eventCall!.url).toBe(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent('alex@group.calendar.google.com')}/events`);
    expect(eventCall!.init!.method).toBe('POST');
    expect((eventCall!.init!.headers as Record<string, string>).Authorization).toBe('Bearer ya29.test');
    const body = JSON.parse(String(eventCall!.init!.body));
    expect(body.start.dateTime).toBe('2026-10-20T16:00:00.000Z');
    expect(body.end.dateTime).toBe('2026-10-20T18:00:00.000Z');
    expect(body.summary).toContain('95624');
    expect(body.description).toBe('916 booking b1'); // no customer name, phone or email is written to the calendar
    expect(JSON.stringify(body)).not.toMatch(/@|\+1|\(916\)/);
  });

  it('updates (PUT) the existing event when the booking already has one, and the tech calendar_id column wins over the env map', async () => {
    live();
    stubFetch();
    await syncBookingEvent('upsert', booking({ gcal_event_id: 'evt_old' }), tech({ calendar_id: 'direct@group.calendar.google.com' } as Partial<Tech>));
    const ev = calls.at(-1)!;
    expect(ev.init!.method).toBe('PUT');
    expect(ev.url).toBe(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent('direct@group.calendar.google.com')}/events/evt_old`);
  });

  it('delete removes the event; delete without an event id sends nothing but the token', async () => {
    live();
    stubFetch();
    expect(await syncBookingEvent('delete', booking({ gcal_event_id: 'evt_old' }), tech())).toBeNull();
    expect(calls.at(-1)!.init!.method).toBe('DELETE');
    expect(calls.at(-1)!.url.endsWith('/events/evt_old')).toBe(true);
    calls.length = 0;
    await syncBookingEvent('delete', booking(), tech());
    expect(calls.filter((c) => c.init?.method === 'DELETE')).toHaveLength(0);
  });

  it('a Google failure never breaks the booking: it is swallowed and the previous event id is kept', async () => {
    live();
    stubFetch((u) => (u.includes('/calendar/v3/') ? new Response('nope', { status: 500 }) : undefined));
    expect(await syncBookingEvent('upsert', booking({ gcal_event_id: 'evt_keep' }), tech())).toBe('evt_keep');
    stubFetch(() => { throw new Error('network down'); });
    expect(await syncBookingEvent('upsert', booking(), tech())).toBeNull();
  });
});
