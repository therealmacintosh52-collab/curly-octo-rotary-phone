// Handlers behind /api/admin/auth/*. Kept in lib so route files stay one-liners and the logic is testable.
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { fail, guard, limited, ok, parseJson } from '@/lib/api/http';
import { log } from '@/lib/api/log';
import { authMode, demoLoginEnabled, demoUsers, liveAuthConfigured } from '@/lib/auth/config';
import { homeFor, safeNext } from '@/lib/auth/roles';
import { endSession, startSession } from '@/lib/auth/server';
import { passwordSignIn, resolveProfile, sendMagicLink, userFromAccessToken, type AuthedUser } from '@/lib/auth/supabase-auth';
import { sameOrigin } from './api';

const pre = async (req: Request, name: string, limit = 10): Promise<NextResponse | null> => {
  if (!sameOrigin(req)) return fail(403, 'bad_origin', 'Cross-site request refused.');
  return limited(req, `auth:${name}`, limit, 600);
};

async function finishLive(user: AuthedUser | null, next?: string | null): Promise<NextResponse> {
  const p = user ? await resolveProfile(user) : null;
  if (!p) { log('warn', 'admin.login.denied', { live: true }); return fail(401, 'invalid_login', 'Those details did not work, or this account has no admin access.'); }
  await startSession({ sub: p.id, role: p.role, name: p.name, techId: p.techId, mode: 'live' });
  return ok({ ok: true, redirect: safeNext(next, p.role) });
}

export const demoLogin = (req: Request) => guard('admin.auth.demo', async () => {
  const rl = await pre(req, 'demo'); if (rl) return rl;
  if (!demoLoginEnabled()) return fail(403, 'demo_disabled', 'Demo login is disabled.');
  const p = await parseJson(req, z.object({ userId: z.string().max(64), next: z.string().max(200).optional() }));
  if (!p.ok) return p.res;
  const u = demoUsers.find((d) => d.id === p.data.userId);
  if (!u) return fail(400, 'unknown_user', 'Unknown demo user.');
  await startSession({ sub: u.id, role: u.role, name: u.name, techId: u.techId, mode: 'demo' });
  return ok({ ok: true, redirect: safeNext(p.data.next, u.role) });
});

export const passwordLogin = (req: Request) => guard('admin.auth.login', async () => {
  const rl = await pre(req, 'login'); if (rl) return rl;
  if (!liveAuthConfigured()) return fail(400, 'not_configured', 'Sign-in is not configured.');
  const p = await parseJson(req, z.object({ email: z.email().max(120), password: z.string().min(1).max(200), next: z.string().max(200).optional() }));
  if (!p.ok) return p.res;
  return finishLive(await passwordSignIn(p.data.email, p.data.password), p.data.next);
});

export const magicLink = (req: Request) => guard('admin.auth.magic', async () => {
  const rl = await pre(req, 'magic', 5); if (rl) return rl;
  if (!liveAuthConfigured()) return fail(400, 'not_configured', 'Sign-in is not configured.');
  const p = await parseJson(req, z.object({ email: z.email().max(120) }));
  if (!p.ok) return p.res;
  const origin = new URL(req.url).origin;
  await sendMagicLink(p.data.email, `${origin}/admin/auth/callback`);
  return ok({ ok: true }); // same answer whether or not the address exists
});

export const sessionFromToken = (req: Request) => guard('admin.auth.session', async () => {
  const rl = await pre(req, 'session'); if (rl) return rl;
  if (!liveAuthConfigured()) return fail(400, 'not_configured', 'Sign-in is not configured.');
  const p = await parseJson(req, z.object({ accessToken: z.string().min(20).max(4000) }));
  if (!p.ok) return p.res;
  return finishLive(await userFromAccessToken(p.data.accessToken), null);
});

export const logout = (req: Request) => guard('admin.auth.logout', async () => {
  if (!sameOrigin(req)) return fail(403, 'bad_origin', 'Cross-site request refused.');
  await endSession();
  return ok({ ok: true, redirect: '/admin/login' });
});

export { authMode, homeFor };
