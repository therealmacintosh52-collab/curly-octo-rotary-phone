// Client-side photo prep for dealer uploads: decode (EXIF orientation honoured), downscale, re-encode as JPEG under the server limit.
import { bookingConfig } from '@/config/booking';

export async function prepPhoto(file: File): Promise<Blob> {
  const { maxEdgePx, jpegQuality, maxBytes } = bookingConfig.photos;
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(`We couldn't read "${file.name}". Use a JPEG, PNG or WebP photo.`); }
  const scale = Math.min(1, maxEdgePx / Math.max(bmp.width, bmp.height));
  const draw = (k: number, q: number) => new Promise<Blob>((resolve, reject) => {
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale * k); c.height = Math.round(bmp.height * scale * k);
    const ctx = c.getContext('2d'); if (!ctx) return reject(new Error('Canvas unavailable'));
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Encode failed'))), 'image/jpeg', q);
  });
  let blob = await draw(1, jpegQuality);
  if (blob.size > maxBytes) blob = await draw(0.8, 0.7);
  bmp.close?.();
  return blob;
}
