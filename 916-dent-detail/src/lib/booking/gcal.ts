// Optional Google Calendar sync (write-only: creates/updates/deletes one event per booking on the assigned
// tech's calendar). Needs a service account that has been shared on each calendar. No keys = silent no-op.
import { createSign } from 'node:crypto';
import { log } from '@/lib/api/log';
import { serviceById } from '@/config/booking';
import type { BookingRow, Tech } from '@/lib/db';

export const isCalendarLive = (): boolean => Boolean(process.env.GOOGLE_CALENDAR_CLIENT_EMAIL && process.env.GOOGLE_CALENDAR_PRIVATE_KEY);

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/calendar.events', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3300 };
  const unsigned = `${b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64u(JSON.stringify(claim))}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(process.env.GOOGLE_CALENDAR_PRIVATE_KEY!.replace(/\\n/g, '\n'));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64u(sig)}` }),
  });
  if (!res.ok) throw new Error(`gcal token ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

function calendarIdFor(tech: Tech | null): string | null {
  if (tech?.calendar_id) return tech.calendar_id;
  const pairs = (process.env.GOOGLE_CALENDAR_IDS ?? '').split(',').map((p) => p.trim().split('='));
  const key = tech?.name.toLowerCase().split(' ')[0];
  return pairs.find(([k]) => k === key)?.[1] ?? null;
}

/** Returns the event id (stored on the booking) or null when sync is off / not configured for this tech. */
export async function syncBookingEvent(action: 'upsert' | 'delete', booking: BookingRow, tech: Tech | null): Promise<string | null> {
  if (!isCalendarLive()) return null;
  const calId = calendarIdFor(tech);
  if (!calId) return null;
  try {
    const token = await accessToken();
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    if (action === 'delete') {
      if (booking.gcal_event_id) await fetch(`${base}/${booking.gcal_event_id}`, { method: 'DELETE', headers });
      return null;
    }
    const body = JSON.stringify({
      summary: `${booking.services.map((s) => serviceById(s)?.plain ?? s).join(' + ')} (${booking.zip ?? ''})`,
      location: [booking.address_line, booking.city, booking.zip].filter(Boolean).join(', '),
      description: `916 booking ${booking.id}`,
      start: { dateTime: booking.starts_at }, end: { dateTime: booking.ends_at },
    });
    const res = booking.gcal_event_id ? await fetch(`${base}/${booking.gcal_event_id}`, { method: 'PUT', headers, body }) : await fetch(base, { method: 'POST', headers, body });
    if (!res.ok) throw new Error(`gcal ${res.status}`);
    return ((await res.json()) as { id: string }).id;
  } catch (e) {
    log('warn', 'gcal.failed', { error: (e as Error).message });
    return booking.gcal_event_id ?? null;
  }
}
