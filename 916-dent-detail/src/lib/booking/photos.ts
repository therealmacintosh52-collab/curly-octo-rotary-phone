// Photo storage for quotes/bookings. Live: private Supabase Storage bucket. Mock: in-memory (lost on restart).
import { randomUUID } from 'node:crypto';
import { bookingConfig } from '@/config/booking';
import { photosBucket, supabaseAdmin } from '@/lib/db/admin-client';
import { isImageBytes, type QuotePhoto } from '@/lib/quote';

const G = globalThis as unknown as { __mockPhotos?: Map<string, { buf: Buffer; type: string }> };
const mem = () => (G.__mockPhotos ??= new Map());
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
import { PHOTO_PATH_RE } from './photos-path';
export { PHOTO_PATH_RE };

export type SavedPhoto = { path: string; mediaType: QuotePhoto['mediaType']; bytes: number };

export async function savePhoto(buf: Buffer): Promise<SavedPhoto | { error: 'not_image' | 'too_large' }> {
  if (buf.length > bookingConfig.photos.maxBytes) return { error: 'too_large' };
  const mediaType = isImageBytes(buf);
  if (!mediaType) return { error: 'not_image' };
  const path = `quotes/${randomUUID()}.${EXT[mediaType]}`;
  const sb = supabaseAdmin();
  if (sb) {
    const { error } = await sb.storage.from(photosBucket()).upload(path, buf, { contentType: mediaType, upsert: false });
    if (error) throw new Error('storage upload failed');
  } else mem().set(path, { buf, type: mediaType });
  return { path, mediaType, bytes: buf.length };
}

export async function loadPhoto(path: string): Promise<QuotePhoto | null> {
  if (!PHOTO_PATH_RE.test(path)) return null;
  const sb = supabaseAdmin();
  let buf: Buffer | null = null;
  if (sb) {
    const { data } = await sb.storage.from(photosBucket()).download(path);
    if (data) buf = Buffer.from(await data.arrayBuffer());
  } else buf = mem().get(path)?.buf ?? null;
  if (!buf) return null;
  const mediaType = isImageBytes(buf);
  return mediaType ? { mediaType, base64: buf.toString('base64') } : null;
}
