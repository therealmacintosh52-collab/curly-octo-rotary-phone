import { fail, guard, limited, ok, requireContentLength } from '@/lib/api/http';
import { savePhoto } from '@/lib/booking/photos';
import { bookingConfig } from '@/config/booking';

export const dynamic = 'force-dynamic';

/** One image per request (multipart field "file"). Content is verified by magic bytes, never by the filename/type. */
export async function POST(req: Request) {
  return guard('photos', async () => {
    const rl = await limited(req, 'photos', 40, 600);
    if (rl) return rl;
    const sized = requireContentLength(req, bookingConfig.photos.maxBytes + 50_000);
    if (sized) return sized;
    let form: FormData;
    try { form = await req.formData(); } catch { return fail(400, 'bad_form', 'Upload a photo.'); }
    const file = form.get('file');
    if (!(file instanceof File)) return fail(400, 'no_file', 'Upload a photo.');
    const r = await savePhoto(Buffer.from(await file.arrayBuffer()));
    if ('error' in r) return r.error === 'too_large' ? fail(413, 'too_large', 'That photo is too large.') : fail(415, 'not_image', 'Only JPEG, PNG or WebP photos are accepted.');
    return ok({ path: r.path, bytes: r.bytes }, { status: 201 });
  });
}
