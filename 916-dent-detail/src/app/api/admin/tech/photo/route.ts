import { readTextCapped } from '@/lib/security/body';
import { ok, fail, guard, requireContentLength } from '@/lib/api/http';
import { HttpError, sameOrigin } from '@/lib/admin/api';
import { jobForSession } from '@/lib/admin/access';
import { actorOf } from '@/lib/admin/events';
import { addJobPhoto, setPhotoConsent } from '@/lib/admin/photos';
import { bookingConfig } from '@/config/booking';
import { getSession } from '@/lib/auth/server';
import { repo } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** multipart: jobId, kind (before|after|other), file, [consent=1], [caption], [id] (client uuid for idempotent retries). */
export async function POST(req: Request) {
  return guard('admin.photo', async () => {
    if (!sameOrigin(req)) return fail(403, 'bad_origin', 'Cross-site request refused.');
    const s = await getSession();
    if (!s) return fail(401, 'unauthenticated', 'Please sign in.');
    const sized = requireContentLength(req, bookingConfig.photos.maxBytes + 200_000);
    if (sized) return sized;
    const fd = await req.formData().catch(() => null);
    if (!fd) return fail(400, 'bad_form', 'Bad upload.');
    const jobId = String(fd.get('jobId') ?? '');
    const kind = String(fd.get('kind') ?? 'other');
    const file = fd.get('file');
    if (!['before', 'after', 'other'].includes(kind) || !(file instanceof File)) return fail(400, 'invalid_input', 'Choose a photo.');
    const job = await jobForSession(s, jobId);
    const id = String(fd.get('id') ?? '');
    const row = await addJobPhoto(job, kind as 'before' | 'after' | 'other', Buffer.from(await file.arrayBuffer()), {
      marketingConsent: fd.get('consent') === '1', caption: String(fd.get('caption') ?? '') || undefined, actor: actorOf(s), id: /^[0-9a-f-]{36}$/.test(id) ? id : undefined,
    });
    if ('error' in row) return fail(row.error === 'too_large' ? 413 : 400, row.error, row.error === 'not_image' ? 'That is not a photo we can use. Try a JPEG or PNG.' : row.error === 'too_large' ? 'Photo too large.' : 'Could not store the photo.');
    return ok({ photo: { id: row.id, kind: row.kind, path: row.storage_path, consent: row.marketing_consent } }, { status: 201 });
  });
}

/** PATCH-like consent toggle: JSON {photoId, consent}. */
export async function PUT(req: Request) {
  return guard('admin.photo.consent', async () => {
    if (!sameOrigin(req)) return fail(403, 'bad_origin', 'Cross-site request refused.');
    const s = await getSession();
    if (!s) return fail(401, 'unauthenticated', 'Please sign in.');
    const body = await readTextCapped(req, 2_000);
    const b = (body === null ? null : (() => { try { return JSON.parse(body); } catch { return null; } })()) as { photoId?: string; consent?: boolean } | null;
    if (!b?.photoId || typeof b.consent !== 'boolean') return fail(400, 'invalid_input', 'Bad request.');
    const photo = await repo().job_photos.get(b.photoId);
    if (!photo?.job_id) throw new HttpError(404, 'not_found', 'Photo not found.');
    await jobForSession(s, photo.job_id);
    const row = await setPhotoConsent(photo.id, b.consent, actorOf(s));
    return ok({ photo: { id: row.id, consent: row.marketing_consent } });
  });
}
