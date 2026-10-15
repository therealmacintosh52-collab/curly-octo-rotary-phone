// Owner authorization for the dealer screens, delegating to Phase 3's session (src/lib/auth/server.ts). Phase 3 exposes
// requireStaff() (owner + admin roles) rather than a function literally called requireOwner(), so this 5-line adapter gives
// the dealer code the `requireOwner()` name from the brief. When Phase 3 adds its own requireOwner(), re-export it here.
// Do NOT import this file from code that unit tests load: it pulls in 'server-only'.
import { getSession, requireStaff } from '@/lib/auth/server';

/** Page / server-action guard: redirects to /admin/login when not signed in, to the role home when not staff. */
export async function requireOwner(): Promise<{ id: string; name: string }> {
  const s = await requireStaff();
  return { id: s.sub, name: s.name };
}

/** Route-handler guard: true when the caller holds an owner/admin session (never redirects). */
export async function ownerAllowed(): Promise<boolean> {
  const s = await getSession();
  return Boolean(s && (s.role === 'owner' || s.role === 'admin'));
}
