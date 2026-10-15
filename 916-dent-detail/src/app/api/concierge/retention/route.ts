// Daily transcript retention job (vercel.json). Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`.
import { timingSafeEqual } from 'node:crypto';
import { fail, guard, ok } from '@/lib/api/http';
import { purgeOldTranscripts } from '@/lib/concierge/retention';

export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean | 'unconfigured' {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'production' ? 'unconfigured' : true;
  const a = Buffer.from(req.headers.get('authorization') ?? ''); const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function run(req: Request) {
  return guard('concierge.retention', async () => {
    const a = authorized(req);
    if (a === 'unconfigured') return fail(503, 'cron_unconfigured', 'CRON_SECRET is not set.');
    if (!a) return fail(401, 'unauthorized', 'Unauthorized.');
    return ok(await purgeOldTranscripts());
  });
}
export const GET = run;
export const POST = run;
