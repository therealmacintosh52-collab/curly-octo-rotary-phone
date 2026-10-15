// Dealer session = HMAC-signed, expiring cookie value {profile, dealer, exp}. Pure + testable; cookies live in session.ts.
// Both auth modes (DEMO and Supabase) end in this same cookie, so the rest of the portal never cares which one ran.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'dd_dealer';
export const SESSION_TTL_SEC = 60 * 60 * 12;
const DEV_SECRET = 'dev-only-dealer-session-secret-change-me';

function secret(): string {
  const s = process.env.DEALER_SESSION_SECRET || process.env.BOOKING_TOKEN_SECRET;
  if (s) return s;
  // No secret and real data = refuse. Mock mode holds demo data only, so a fixed dev secret is acceptable there.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('DEALER_SESSION_SECRET (or BOOKING_TOKEN_SECRET) must be set when Supabase is configured');
  return DEV_SECRET;
}
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export type SessionClaims = { profileId: string; dealerId: string; exp: number };

export function signSession(c: { profileId: string; dealerId: string }, now = Date.now(), ttlSec = SESSION_TTL_SEC): string {
  const payload = Buffer.from(JSON.stringify({ p: c.profileId, d: c.dealerId, e: Math.floor(now / 1000) + ttlSec })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string | undefined | null, now = Date.now()): SessionClaims | null {
  const [payload, sig, extra] = String(token ?? '').split('.');
  if (!payload || !sig || extra !== undefined) return null;
  const a = Buffer.from(sig); const e = Buffer.from(sign(payload));
  if (a.length !== e.length || !timingSafeEqual(a, e)) return null;
  try {
    const j = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { p?: unknown; d?: unknown; e?: unknown };
    if (typeof j.p !== 'string' || typeof j.d !== 'string' || typeof j.e !== 'number' || j.e * 1000 <= now) return null;
    return { profileId: j.p, dealerId: j.d, exp: j.e * 1000 };
  } catch { return null; }
}
