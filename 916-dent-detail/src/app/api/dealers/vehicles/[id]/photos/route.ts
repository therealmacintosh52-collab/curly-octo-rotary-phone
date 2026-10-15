import { bookingConfig } from '@/config/booking';
import { fail, guard, limited, ok, requireContentLength } from '@/lib/api/http';
import { requireDealer } from '@/lib/dealers/guard';
import { saveDealerPhoto } from '@/lib/dealers/photos';
import { attachPhoto, VehicleError } from '@/lib/dealers/vehicles';

export const dynamic = 'force-dynamic';

/** One image per request (multipart "file"), appended to the vehicle. The client uploads a batch with a few in parallel. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guard('dealers.photos', async () => {
    const a = await requireDealer(req, { active: true, mutating: true });
    if ('res' in a) return a.res;
    const rl = await limited(req, 'dealer-photos', 200, 600);
    if (rl) return rl;
    const { id } = await ctx.params;
    const sized = requireContentLength(req, bookingConfig.photos.maxBytes + 50_000);
    if (sized) return sized;
    let form: FormData;
    try { form = await req.formData(); } catch { return fail(400, 'bad_form', 'Upload a photo.'); }
    const file = form.get('file');
    if (!(file instanceof File)) return fail(400, 'no_file', 'Upload a photo.');
    const saved = await saveDealerPhoto(a.ctx.dealer.id, Buffer.from(await file.arrayBuffer()));
    if ('error' in saved) return saved.error === 'too_large' ? fail(413, 'too_large', 'That photo is too large.') : fail(415, 'not_image', 'Only JPEG, PNG or WebP photos are accepted.');
    try {
      const v = await attachPhoto(a.ctx.dealer.id, id, saved.path);
      return ok({ path: saved.path, count: v.photo_paths.length }, { status: 201 });
    } catch (e) {
      if (e instanceof VehicleError) return fail(e.code === 'not_found' ? 404 : e.code === 'limit' ? 409 : 400, e.code, e.message);
      throw e;
    }
  });
}
