// Signed, expiring links for /booking/[token]. HMAC-SHA256, constant-time compare. Server-only.
import { createHmac, timingSafeEqual } from 'node:crypto';

const DEV_SECRET = 'dev-only-booking-token-secret-change-me';

function secret(): string {
  const s = process.env.BOOKING_TOKEN_SECRET;
  if (s) return s;
  // Mock mode (no database keys) holds only demo data, so a fixed dev secret is acceptable. Real data requires a real secret.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('BOOKING_TOKEN_SECRET must be set when Supabase is configured');
  return DEV_SECRET;
}
const b64 = (s: string) => Buffer.from(s).toString('base64url');
// domain-separated: a signature made for one kind of token can never validate as another (admin/dealer/chat tokens use their own prefix)
const sign = (payload: string) => createHmac('sha256', secret()).update(`booking-token:${payload}`).digest('base64url');

export function signBookingToken(bookingId: string, expiresAtMs: number): string {
  const payload = b64(JSON.stringify({ b: bookingId, e: Math.floor(expiresAtMs / 1000) }));
  return `${payload}.${sign(payload)}`;
}

export type TokenResult = { ok: true; bookingId: string; expiresAt: number } | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export function verifyBookingToken(token: string, now = Date.now()): TokenResult {
  const [payload, sig, extra] = String(token ?? '').split('.');
  if (!payload || !sig || extra !== undefined) return { ok: false, reason: 'malformed' };
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const e = Buffer.from(expected);
  if (a.length !== e.length || !timingSafeEqual(a, e)) return { ok: false, reason: 'bad_signature' };
  try {
    const { b, e: exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { b: string; e: number };
    if (typeof b !== 'string' || typeof exp !== 'number') return { ok: false, reason: 'malformed' };
    if (exp * 1000 <= now) return { ok: false, reason: 'expired' };
    return { ok: true, bookingId: b, expiresAt: exp * 1000 };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}
