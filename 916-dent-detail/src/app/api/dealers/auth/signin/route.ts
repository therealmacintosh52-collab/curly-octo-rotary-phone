import { fail, guard, limited, ok, parseJson, rateLimit } from '@/lib/api/http';
import { verifyLogin } from '@/lib/dealers/auth';
import { sameOrigin } from '@/lib/dealers/guard';
import { signinSchema } from '@/lib/dealers/schema';
import { setSessionCookie } from '@/lib/dealers/session';
import { repo } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return guard('dealers.signin', async () => {
    if (!sameOrigin(req)) return fail(403, 'bad_origin', 'Cross-site request blocked.');
    const rl = await limited(req, 'dealer-signin', 20, 600);
    if (rl) return rl;
    const p = await parseJson(req, signinSchema);
    if (!p.ok) return p.res;
    const per = await rateLimit(`dealer-signin-email:${p.data.email.toLowerCase()}`, 8, 600);
    if (!per.ok) return fail(429, 'rate_limited', 'Too many attempts. Please wait a few minutes and try again.');
    const generic = fail(401, 'invalid', "We couldn't sign you in. Check your email and password.");
    const profileId = await verifyLogin(p.data.email, p.data.password ?? '');
    if (!profileId) return generic;
    const du = await repo().dealer_users.first({ where: { profile_id: profileId } });
    const dealer = du ? await repo().dealers.get(du.dealer_id) : null;
    if (!du || !dealer || dealer.status === 'rejected') return generic;
    await setSessionCookie(profileId, dealer.id);
    return ok({ status: dealer.status });
  });
}
