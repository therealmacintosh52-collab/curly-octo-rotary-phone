// Signed session cookie (HMAC-SHA256 via Web Crypto so the same code runs in the proxy and in Node).
// Format: base64url(JSON payload) + "." + base64url(signature). The payload carries the role claim; live mode
// re-checks the role against the profiles table on every server request (see server.ts), so revoking a role in the
// database takes effect immediately even though the cookie lives for days.
import { isAdminRole, type AdminRole } from './roles';

export const SESSION_COOKIE = 'd916_admin';
export const SESSION_DAYS = 7;

export type Session = {
  v: 1;
  sub: string;            // profiles.id (live) or demo profile id
  role: AdminRole;
  name: string;
  techId: string | null;
  mode: 'demo' | 'live';
  exp: number;            // epoch seconds
};

const enc = new TextEncoder();

export function sessionSecret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.BOOKING_TOKEN_SECRET;
  if (s && s.length >= 16) return s;
  // Zero-key demo: a fixed dev secret, allowed only when the demo login is itself allowed.
  if (process.env.NODE_ENV !== 'production' || process.env.ADMIN_DEMO_LOGIN === '1') return process.env.NEXT_PUBLIC_SUPABASE_URL ? null : 'dev-only-admin-session-secret-not-for-production';
  return null;
}

const b64u = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (s: string): Uint8Array => {
  const p = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(p);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export async function signSession(s: Omit<Session, 'v' | 'exp'> & { exp?: number }, now = Date.now()): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error('ADMIN_SESSION_SECRET (16+ chars) is required');
  const payload: Session = { ...s, v: 1, exp: s.exp ?? Math.floor(now / 1000) + SESSION_DAYS * 86400 };
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(`admin-session:${body}`));
  return `${body}.${b64u(sig)}`;
}

export async function verifySession(token: string | undefined | null, now = Date.now()): Promise<Session | null> {
  if (!token) return null;
  const secret = sessionSecret();
  if (!secret) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || token.split('.').length !== 2) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), unb64u(sig) as BufferSource, enc.encode(`admin-session:${body}`));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64u(body))) as Partial<Session>;
    if (p.v !== 1 || !isAdminRole(p.role) || typeof p.sub !== 'string' || typeof p.exp !== 'number' || p.exp * 1000 <= now) return null;
    if (p.mode !== 'demo' && p.mode !== 'live') return null;
    return { v: 1, sub: p.sub, role: p.role, name: String(p.name ?? ''), techId: p.techId ?? null, mode: p.mode, exp: p.exp };
  } catch { return null; }
}
