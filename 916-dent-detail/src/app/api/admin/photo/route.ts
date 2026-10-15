import { NextResponse } from 'next/server';
import { fail } from '@/lib/api/http';
import { sameOrigin } from '@/lib/admin/api';
import { mayViewImage } from '@/lib/admin/access';
import { ADMIN_PATH_RE, readImage } from '@/lib/admin/photos';
import { getSession } from '@/lib/auth/server';
import { isImageBytes } from '@/lib/quote';

export const dynamic = 'force-dynamic';

/** Authorised image proxy. Storage stays private; live mode redirects to a 5-minute signed URL after the check. */
export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail(403, 'bad_origin', 'Refused.');
  const s = await getSession();
  if (!s) return fail(401, 'unauthenticated', 'Please sign in.');
  const path = new URL(req.url).searchParams.get('path') ?? '';
  if (!ADMIN_PATH_RE.test(path)) return fail(400, 'bad_path', 'Bad path.');
  if (!(await mayViewImage(s, path))) return fail(404, 'not_found', 'Not found.');
  const img = await readImage(path);
  if (!img) return fail(404, 'not_found', 'Not found.');
  if ('redirect' in img) return NextResponse.redirect(img.redirect, { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
  const type = isImageBytes(img.buf) ?? 'application/octet-stream';
  return new NextResponse(new Uint8Array(img.buf), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
}
