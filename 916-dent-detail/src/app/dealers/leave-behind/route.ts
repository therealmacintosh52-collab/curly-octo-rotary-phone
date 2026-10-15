import { NextResponse } from 'next/server';

/** The printable one-pager lives at /dealers/leave-behind.pdf (built by `npm run leave-behind`); this is the friendly URL. */
export function GET(req: Request) {
  return NextResponse.redirect(new URL('/dealers/leave-behind.pdf', req.url), 307);
}
