import { NextResponse } from 'next/server';
import { fail, guard } from '@/lib/api/http';
import { requireDealer } from '@/lib/dealers/guard';
import { dealerMayReadPhoto, readStoredPhoto } from '@/lib/dealers/photos';

export const dynamic = 'force-dynamic';

/** Streams a stored photo to the dealer that owns it (own uploads, or before/after photos of its own jobs). */
export async function GET(req: Request) {
  return guard('dealers.photo', async () => {
    const a = await requireDealer(req);
    if ('res' in a) return a.res;
    const path = new URL(req.url).searchParams.get('path') ?? '';
    if (!(await dealerMayReadPhoto(a.ctx.dealer.id, path))) return fail(404, 'not_found', 'Photo not found.');
    const p = await readStoredPhoto(path);
    if (!p) return fail(404, 'not_found', 'Photo not found.');
    return new NextResponse(new Uint8Array(p.buf), { headers: { 'Content-Type': p.type, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
  });
}
