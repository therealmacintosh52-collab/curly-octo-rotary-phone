// Server-side session access for pages, layouts, server actions and route handlers.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isSupabaseLive, repo } from '@/lib/db';
import { ANY_ROLE, STAFF, homeFor, isAdminRole, type AdminRole } from './roles';
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession, type Session } from './session';

/** Verified session or null. Live mode re-reads the profile so a revoked/changed role applies immediately. */
export const getSession = cache(async (): Promise<Session | null> => {
  const c = await cookies();
  const s = await verifySession(c.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  if (s.mode === 'live') {
    if (!isSupabaseLive()) return null;
    const p = await repo().profiles.get(s.sub).catch(() => null);
    if (!p || !isAdminRole(p.role)) return null;
    return { ...s, role: p.role, techId: p.tech_id ?? null, name: p.full_name || s.name };
  }
  if (isSupabaseLive()) return null; // a demo cookie must never work against a real database
  return s;
});

export async function requireSession(roles: AdminRole[] = ANY_ROLE): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/admin/login');
  if (!roles.includes(s.role)) redirect(homeFor(s.role));
  return s;
}
export const requireStaff = () => requireSession(STAFF);

export async function startSession(u: { sub: string; role: AdminRole; name: string; techId: string | null; mode: 'demo' | 'live' }): Promise<void> {
  const token = await signSession(u);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}
