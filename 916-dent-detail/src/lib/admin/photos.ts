// Admin/tech photo + signature storage. Live: private Supabase Storage bucket (reads via short-lived signed URL
// minted after an authorization check). Mock: in-memory map shared with Phase 2's quote photos.
import { randomUUID } from 'node:crypto';
import { bookingConfig } from '@/config/booking';
import { photosBucket, supabaseAdmin } from '@/lib/db/admin-client';
import { repo, type Job, type JobPhoto } from '@/lib/db';
import { isImageBytes } from '@/lib/quote';
import { logEvent } from './events';

const G = globalThis as unknown as { __mockPhotos?: Map<string, { buf: Buffer; type: string }> };
const mem = () => (G.__mockPhotos ??= new Map());
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** jobs/<jobId>/<uuid>.<ext>, signatures/<jobId>/<uuid>.png, or Phase 2's quotes/<uuid>.<ext>. */
export const ADMIN_PATH_RE = /^(?:(jobs|signatures)\/[0-9a-f-]{36}\/[0-9a-f-]{36}|quotes\/[0-9a-f-]{36})\.(jpg|png|webp)$/;

export type SaveFail = { error: 'not_image' | 'too_large' | 'storage_failed' };

async function put(path: string, buf: Buffer, type: string): Promise<boolean> {
  const sb = supabaseAdmin();
  if (sb) {
    const { error } = await sb.storage.from(photosBucket()).upload(path, buf, { contentType: type, upsert: false });
    return !error;
  }
  mem().set(path, { buf, type });
  return true;
}

export async function saveJobImage(prefix: 'jobs' | 'signatures', jobId: string, buf: Buffer): Promise<{ path: string } | SaveFail> {
  if (buf.length > bookingConfig.photos.maxBytes) return { error: 'too_large' };
  const type = isImageBytes(buf);
  if (!type) return { error: 'not_image' };
  const path = `${prefix}/${jobId}/${randomUUID()}.${EXT[type]}`;
  return (await put(path, buf, type)) ? { path } : { error: 'storage_failed' };
}

export async function readImage(path: string): Promise<{ buf: Buffer; type: string } | { redirect: string } | null> {
  if (!ADMIN_PATH_RE.test(path)) return null;
  const sb = supabaseAdmin();
  if (sb) {
    const { data, error } = await sb.storage.from(photosBucket()).createSignedUrl(path, 300);
    return error || !data ? null : { redirect: data.signedUrl };
  }
  return mem().get(path) ?? null;
}

export async function addJobPhoto(job: Job, kind: JobPhoto['kind'], buf: Buffer, opts: { caption?: string; marketingConsent?: boolean; actor: string; id?: string }): Promise<JobPhoto | SaveFail> {
  if (opts.id) { const ex = await repo().job_photos.get(opts.id); if (ex) return ex; }
  const saved = await saveJobImage('jobs', job.id, buf);
  if ('error' in saved) return saved;
  const consent = Boolean(opts.marketingConsent);
  const row = await repo().job_photos.insert({
    ...(opts.id ? { id: opts.id } : {}), job_id: job.id, booking_id: job.booking_id ?? null, kind, storage_path: saved.path,
    marketing_consent: consent, consent_at: consent ? new Date().toISOString() : null, caption: opts.caption?.slice(0, 200) ?? null,
  });
  await logEvent('job.photo_added', 'job', job.id, opts.actor, { kind, consent });
  return row;
}

export async function setPhotoConsent(photoId: string, consent: boolean, actor: string): Promise<JobPhoto> {
  const row = await repo().job_photos.update(photoId, { marketing_consent: consent, consent_at: consent ? new Date().toISOString() : null });
  await logEvent('job.photo_consent', 'job', row.job_id ?? photoId, actor, { photo: photoId, consent });
  return row;
}

export async function saveSignature(job: Job, buf: Buffer, actor: string): Promise<string | SaveFail> {
  const saved = await saveJobImage('signatures', job.id, buf);
  if ('error' in saved) return saved;
  await repo().jobs.update(job.id, { signature_path: saved.path });
  await logEvent('job.signature_saved', 'job', job.id, actor, {});
  return saved.path;
}
