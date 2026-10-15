import { fail, guard, ok } from '@/lib/api/http';
import { sameOrigin } from '@/lib/dealers/guard';
import { clearSessionCookie } from '@/lib/dealers/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return guard('dealers.signout', async () => {
    if (!sameOrigin(req)) return fail(403, 'bad_origin', 'Cross-site request blocked.');
    await clearSessionCookie();
    return ok({ signedOut: true });
  });
}
