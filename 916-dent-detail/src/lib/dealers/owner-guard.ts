// TODO(P3-merge): replace the body with `import { requireOwner } from '@/lib/auth'` once Phase 3 ships it (same call shape).
// Until then this stub FAILS CLOSED: owner screens work only in mock mode (demo data) and, in a production build, only when
// DEALERS_DEMO_OWNER=1 is set (used by the Playwright run). With Supabase keys configured it always denies.
import { isSupabaseLive } from '@/lib/db';

export class OwnerAuthError extends Error {
  constructor() { super('Owner sign-in required.'); this.name = 'OwnerAuthError'; }
}

export function ownerAllowed(): boolean {
  return !isSupabaseLive() && (process.env.NODE_ENV !== 'production' || process.env.DEALERS_DEMO_OWNER === '1');
}

/** Throws OwnerAuthError unless the caller is the owner. Returns an actor id for audit rows. */
export async function requireOwner(): Promise<{ id: string }> {
  if (!ownerAllowed()) throw new OwnerAuthError();
  return { id: 'owner-demo' };
}
