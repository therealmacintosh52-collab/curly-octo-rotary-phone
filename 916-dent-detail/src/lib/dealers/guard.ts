// Request guards for the dealer API: same-origin check for state-changing calls (cookie auth + SameSite=Lax already blocks
// cross-site POSTs; this also rejects a mismatched Origin header), and active-dealer gating.
import { fail } from '@/lib/api/http';
import type { NextResponse } from 'next/server';
import { getDealerContext, type DealerContext } from './session';

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser clients and same-origin GET-style fetches omit it; cookies are SameSite=Lax regardless
  try {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    return new URL(origin).host === host;
  } catch { return false; }
}

export async function requireDealer(req: Request, opts: { active?: boolean; mutating?: boolean } = {}): Promise<{ ctx: DealerContext } | { res: NextResponse }> {
  if (opts.mutating && !sameOrigin(req)) return { res: fail(403, 'bad_origin', 'Cross-site request blocked.') };
  const ctx = await getDealerContext();
  if (!ctx) return { res: fail(401, 'unauthorized', 'Please sign in.') };
  if (opts.active && ctx.dealer.status !== 'active') {
    return { res: fail(403, 'not_active', ctx.dealer.status === 'pending' ? 'Your account is waiting for approval.' : 'Your account is not active. Contact us.') };
  }
  return { ctx };
}
