import { timingSafeEqual } from 'node:crypto';
import { fail, guard, ok } from '@/lib/api/http';
import { runMonthlyStatements } from '@/lib/dealers/statements';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request): boolean | 'unconfigured' {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'production' ? 'unconfigured' : true; // open only in local dev
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Monthly: builds last month's statement for every active dealer (idempotent), then marks overdue invoices.
 * Optional ?month=YYYY-MM re-runs a specific month. Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`.
 */
async function run(req: Request) {
  return guard('cron.statements', async () => {
    const auth = authorized(req);
    if (auth === 'unconfigured') return fail(503, 'cron_unconfigured', 'CRON_SECRET is not set.');
    if (!auth) return fail(401, 'unauthorized', 'Unauthorized.');
    const month = new URL(req.url).searchParams.get('month') ?? undefined;
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail(400, 'bad_month', 'month must be YYYY-MM.');
    return ok(await runMonthlyStatements({ month }));
  });
}
export const GET = run;
export const POST = run;
