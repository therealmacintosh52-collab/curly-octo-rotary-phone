import { timingSafeEqual } from 'node:crypto';
import { fail, guard, ok } from '@/lib/api/http';
import { dispatchDue } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request): boolean | 'unconfigured' {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'production' ? 'unconfigured' : true; // open only in local dev
  const given = req.headers.get('authorization') ?? '';
  const want = `Bearer ${secret}`;
  const a = Buffer.from(given); const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request) {
  return guard('cron.dispatch', async () => {
    const ok_ = authorized(req);
    if (ok_ === 'unconfigured') return fail(503, 'cron_unconfigured', 'CRON_SECRET is not set.');
    if (!ok_) return fail(401, 'unauthorized', 'Unauthorized.');
    return ok(await dispatchDue());
  });
}
// Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`.
export const GET = run;
export const POST = run;
