// Shared plumbing for /api/admin routes: session + role gate, same-origin (CSRF) check, rate limit, error mapping.
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { fail, guard, limited, parseJson } from '@/lib/api/http';
import type { Session } from '@/lib/auth/session';
import { getSession } from '@/lib/auth/server';
import { ANY_ROLE, roleMayOpen, type AdminRole } from '@/lib/auth/roles';

/** Mutating requests must come from our own origin. SameSite=Lax already blocks most CSRF; this closes the rest. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return req.method === 'GET' || req.method === 'HEAD'; // browsers always send Origin on cross-site POST
  try {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    return new URL(origin).host === host;
  } catch { return false; }
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = 'BookingError'; /* reuses guard()'s mapping */ }
}
export const badRequest = (msg: string, code = 'invalid_input') => new HttpError(400, code, msg);
export const notFound = (what = 'Record') => new HttpError(404, 'not_found', `${what} not found.`);
export const forbidden = (msg = 'You do not have access to that.') => new HttpError(403, 'forbidden', msg);
export const conflict = (msg: string, code = 'conflict') => new HttpError(409, code, msg);

type Ctx<B> = { req: Request; session: Session; body: B };

/** Authenticated JSON route. `schema` validates the body for non-GET methods. */
export async function adminRoute<B = undefined>(
  name: string, req: Request, roles: AdminRole[] = ANY_ROLE, schema: ZodType<B> | null, fn: (c: Ctx<B>) => Promise<NextResponse>,
): Promise<NextResponse> {
  return guard(name, async () => {
    if (!sameOrigin(req)) return fail(403, 'bad_origin', 'Cross-site request refused.');
    const session = await getSession();
    if (!session) return fail(401, 'unauthenticated', 'Please sign in.');
    if (!roles.includes(session.role) || !roleMayOpen(session.role, new URL(req.url).pathname)) return fail(403, 'forbidden', 'You do not have access to that.');
    const rl = await limited(req, `admin:${session.sub}`, 240, 60);
    if (rl) return rl;
    let body = undefined as B;
    if (schema) {
      const p = await parseJson(req, schema, 256_000);
      if (!p.ok) return p.res;
      body = p.data;
    }
    return fn({ req, session, body });
  });
}
