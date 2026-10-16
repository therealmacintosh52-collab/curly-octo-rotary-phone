// Receives CSP violation reports (legacy `report-uri` and the Reporting API). Logs a sanitized one-liner per report (no query strings, no
// document content, no IPs), rate limited per client, body capped. Nothing is stored. Always 204 so a browser never retries.
import { NextResponse } from 'next/server';
import { limited } from '@/lib/api/http';
import { log } from '@/lib/api/log';
import { readTextCapped } from '@/lib/security/body';
import { sanitizeReport } from '@/lib/security/csp-report';

export const dynamic = 'force-dynamic';

const MAX = 8_192;

export async function POST(req: Request) {
  const rl = await limited(req, 'csp-report', 30, 60);
  if (rl) return rl;
  const t = await readTextCapped(req, MAX);
  if (t === null) return new NextResponse(null, { status: 413 });
  let raw: unknown = null;
  try { raw = JSON.parse(t); } catch { return new NextResponse(null, { status: 400 }); }
  for (const r of sanitizeReport(raw)) log('warn', 'csp.violation', r);
  return new NextResponse(null, { status: 204 });
}
