// Client-side photo prep: decode (honoring EXIF orientation), downscale to a max edge, re-encode as JPEG.
import { bookingConfig } from '@/config/booking';

export async function prepPhoto(file: File): Promise<{ blob: Blob; thumb: string }> {
  const { maxEdgePx, jpegQuality } = bookingConfig.photos;
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error("We couldn't read that photo. Try a JPEG or PNG."); }
  const scale = Math.min(1, maxEdgePx / Math.max(bmp.width, bmp.height));
  const draw = (w: number, h: number, q: number) => new Promise<Blob>((resolve, reject) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); if (!ctx) return reject(new Error('Canvas unavailable'));
    ctx.drawImage(bmp, 0, 0, w, h);
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Encode failed'))), 'image/jpeg', q);
  });
  let blob = await draw(Math.round(bmp.width * scale), Math.round(bmp.height * scale), jpegQuality);
  // still over the server limit (very detailed image): step quality down once
  if (blob.size > bookingConfig.photos.maxBytes) blob = await draw(Math.round(bmp.width * scale * 0.8), Math.round(bmp.height * scale * 0.8), 0.7);
  const ts = Math.min(1, 160 / Math.max(bmp.width, bmp.height));
  const tb = await draw(Math.round(bmp.width * ts), Math.round(bmp.height * ts), 0.6);
  const thumb = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(tb); });
  bmp.close?.();
  return { blob, thumb };
}
