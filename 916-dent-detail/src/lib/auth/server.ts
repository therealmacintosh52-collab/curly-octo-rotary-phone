// Server-side session access for pages, layouts, server actions and route handlers.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isSupabaseLive, repo } from '@/lib/db';
import { ANY_ROLE, STAFF, homeFor, isAdminRole, isStaff, type AdminRole } from './roles';
import { SESSION_COOKIE, sessionDays, signSession, verifySession, type Session } from './session';

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
/**
 * THE owner guard (single definition): page / server-action guard for owner-level screens (roles owner + admin).
 * Redirects to /admin/login when signed out and to the role's home when not an owner (a tech). `requireStaff` is the same
 * function under its Phase 3 name, kept so existing call sites read the same.
 */
export const requireOwner = (): Promise<Session> => requireSession(STAFF);
export const requireStaff = requireOwner;

/** Route-handler variant: true when the caller holds an owner/admin session. Never redirects. */
export async function ownerAllowed(): Promise<boolean> {
  const s = await getSession();
  return Boolean(s && isStaff(s.role));
}

export async function startSession(u: { sub: string; role: AdminRole; name: string; techId: string | null; mode: 'demo' | 'live' }): Promise<void> {
  const token = await signSession(u);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: sessionDays(u.role) * 86400,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}
