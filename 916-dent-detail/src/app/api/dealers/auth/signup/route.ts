import { fail, guard, limited, ok, parseJson } from '@/lib/api/http';
import { AccountError, signUpDealer } from '@/lib/dealers/accounts';
import { AuthError, authMode } from '@/lib/dealers/auth';
import { sameOrigin } from '@/lib/dealers/guard';
import { signupSchema } from '@/lib/dealers/schema';
import { setSessionCookie } from '@/lib/dealers/session';
import { normalizePhone } from '@/lib/sms';

export const dynamic = 'force-dynamic';

/** Create a PENDING dealer account (+ login) and sign the person in so they can see the waiting-for-approval page. */
export async function POST(req: Request) {
  return guard('dealers.signup', async () => {
    if (!sameOrigin(req)) return fail(403, 'bad_origin', 'Cross-site request blocked.');
    const rl = await limited(req, 'dealer-signup', 5, 3600);
    if (rl) return rl;
    const p = await parseJson(req, signupSchema);
    if (!p.ok) return p.res;
    const d = p.data;
    if (authMode() === 'supabase' && (d.password?.length ?? 0) < 10) return fail(400, 'weak_password', 'Use a password of at least 10 characters.');
    const phone = d.phone ? normalizePhone(d.phone) : null;
    if (d.phone && !phone) return fail(400, 'invalid_phone', 'Enter a valid US phone number.');
    try {
      const { dealer, profileId } = await signUpDealer({ ...d, phone });
      await setSessionCookie(profileId, dealer.id);
      return ok({ dealerId: dealer.id, status: dealer.status }, { status: 201 });
    } catch (e) {
      if (e instanceof AccountError || e instanceof AuthError) return fail(e instanceof AuthError ? (e.code === 'weak_password' ? 400 : e.code === 'unavailable' ? 503 : 409) : 409, e.code, e.message);
      throw e;
    }
  });
}
