// Route protection for /admin and /api/admin (Next 16 "proxy", formerly middleware).
// 1) every response under these paths is noindex (header), 2) no valid session -> login (pages) or 401 (API),
// 3) technicians are confined to the tech-view allowlist. Handlers and pages still re-check roles themselves
// (defence in depth); this layer only verifies the cookie signature and expiry.
import { NextResponse, type NextRequest } from 'next/server';
import { isPublicAdminPath, roleMayOpen } from '@/lib/auth/roles';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';

const NOINDEX = 'noindex, nofollow, noarchive, nosnippet';

function withHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Robots-Tag', NOINDEX);
  res.headers.set('Cache-Control', 'private, no-store');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');
  if (isPublicAdminPath(pathname)) {
    // The service worker script and manifest must stay cacheable by the browser's own update rules.
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', NOINDEX);
    return res;
  }
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (isApi) return withHeaders(NextResponse.json({ error: { code: 'unauthenticated', message: 'Please sign in.' } }, { status: 401 }));
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return withHeaders(NextResponse.redirect(url));
  }
  if (!roleMayOpen(session.role, pathname)) {
    if (isApi) return withHeaders(NextResponse.json({ error: { code: 'forbidden', message: 'You do not have access to that.' } }, { status: 403 }));
    const url = req.nextUrl.clone();
    url.pathname = '/admin/today';
    url.search = '';
    return withHeaders(NextResponse.redirect(url));
  }
  return withHeaders(NextResponse.next());
}

export const config = { matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'] };
