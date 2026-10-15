// Cookie plumbing for the dealer session (server only: uses next/headers). Resolves to the live dealer record each request,
// so an owner pausing an account takes effect immediately.
import { cookies } from 'next/headers';
import { repo } from '@/lib/db';
import type { Dealer, DealerUser } from '@/lib/db/types';
import { SESSION_COOKIE, SESSION_TTL_SEC, signSession, verifySession } from './session-token';

export type DealerContext = { dealer: Dealer; user: DealerUser; profileId: string };

export async function setSessionCookie(profileId: string, dealerId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, signSession({ profileId, dealerId }), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_TTL_SEC,
  });
}
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}

export async function contextFromToken(token: string | undefined | null): Promise<DealerContext | null> {
  const claims = verifySession(token);
  if (!claims) return null;
  const db = repo();
  const user = await db.dealer_users.first({ where: { dealer_id: claims.dealerId, profile_id: claims.profileId } });
  const dealer = user ? await db.dealers.get(claims.dealerId) : null;
  if (!user || !dealer || dealer.status === 'rejected') return null;
  return { dealer, user, profileId: claims.profileId };
}

/** Current dealer (any status except rejected) or null. Server components and route handlers. */
export async function getDealerContext(): Promise<DealerContext | null> {
  return contextFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}
