// Dealer photo storage + access control. Live: the private Supabase Storage bucket (same bucket as booking photos, path
// prefix dealers/<dealerId>/). Mock: in-memory. A dealer may read only (a) paths under its own prefix and (b) before/after
// job photos of its own vehicles' jobs. Bytes are verified by magic number, never by filename or declared type.
import { randomUUID } from 'node:crypto';
import { bookingConfig } from '@/config/booking';
import { repo } from '@/lib/db';
import { photosBucket, supabaseAdmin } from '@/lib/db/admin-client';
import { isImageBytes } from '@/lib/quote';

export const DEALER_PHOTO_MAX_PER_VEHICLE = 12;
export const DEALER_PHOTO_RE = /^dealers\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const G = globalThis as unknown as { __dealerPhotos?: Map<string, { buf: Buffer; type: string }>; __mockPhotos?: Map<string, { buf: Buffer; type: string }> };
const mem = () => (G.__dealerPhotos ??= new Map());

export async function saveDealerPhoto(dealerId: string, buf: Buffer): Promise<{ path: string; bytes: number } | { error: 'not_image' | 'too_large' }> {
  if (buf.length > bookingConfig.photos.maxBytes) return { error: 'too_large' };
  const type = isImageBytes(buf);
  if (!type) return { error: 'not_image' };
  const path = `dealers/${dealerId}/${randomUUID()}.${EXT[type]}`;
  const sb = supabaseAdmin();
  if (sb) {
    const { error } = await sb.storage.from(photosBucket()).upload(path, buf, { contentType: type, upsert: false });
    if (error) throw new Error('storage upload failed');
  } else mem().set(path, { buf, type });
  return { path, bytes: buf.length };
}

export async function readStoredPhoto(path: string): Promise<{ buf: Buffer; type: string } | null> {
  if (!path || path.includes('..') || path.length > 300) return null;
  const sb = supabaseAdmin();
  if (sb) {
    const { data } = await sb.storage.from(photosBucket()).download(path);
    if (!data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    const type = isImageBytes(buf);
    return type ? { buf, type } : null;
  }
  return mem().get(path) ?? G.__mockPhotos?.get(path) ?? null;
}

/** May this dealer see this stored photo? */
export async function dealerMayReadPhoto(dealerId: string, path: string): Promise<boolean> {
  if (DEALER_PHOTO_RE.test(path)) return path.startsWith(`dealers/${dealerId}/`);
  const photo = await repo().job_photos.first({ where: { storage_path: path } });
  if (!photo?.job_id || (photo.kind !== 'before' && photo.kind !== 'after')) return false;
  const dv = await repo().dealer_vehicles.first({ where: { job_id: photo.job_id, dealer_id: dealerId } });
  return Boolean(dv);
}

/** Before/after photos the techs took for this vehicle's job (dealer-visible kinds only). */
export async function jobPhotosFor(jobId: string | null | undefined): Promise<{ id: string; kind: 'before' | 'after'; path: string; caption?: string | null }[]> {
  if (!jobId) return [];
  const rows = await repo().job_photos.list({ where: { job_id: jobId }, orderBy: 'created_at' });
  return rows.filter((r) => r.kind === 'before' || r.kind === 'after').map((r) => ({ id: r.id, kind: r.kind as 'before' | 'after', path: r.storage_path, caption: r.caption }));
}
