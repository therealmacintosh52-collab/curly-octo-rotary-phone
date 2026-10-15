// Upload routes must refuse a body that does not declare its size, or declares too much, BEFORE buffering it.
import { describe, expect, it } from 'vitest';
import { requireContentLength } from '@/lib/api/http';
import { POST as photosPost } from '@/app/api/photos/route';
import { bookingConfig } from '@/config/booking';

const req = (headers: Record<string, string>, body: BodyInit = 'x') => new Request('http://x/api/photos', { method: 'POST', headers, body });
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);

describe('requireContentLength', () => {
  it('411 when the header is missing or not a number, 413 when over the cap, null when fine', async () => {
    expect((requireContentLength(req({}), 100))?.status).toBe(411);
    expect((requireContentLength(req({ 'content-length': 'abc' }), 100))?.status).toBe(411);
    expect((requireContentLength(req({ 'content-length': '-5' }), 100))?.status).toBe(411);
    expect((requireContentLength(req({ 'content-length': '101' }), 100))?.status).toBe(413);
    expect(requireContentLength(req({ 'content-length': '100' }), 100)).toBeNull();
  });
});

describe('POST /api/photos', () => {
  const form = () => { const f = new FormData(); f.set('file', new File([new Uint8Array(JPEG)], 'a.jpg', { type: 'image/jpeg' })); return f; };
  it('refuses an unsized upload and an oversized declaration before reading the body', async () => {
    expect((await photosPost(req({ 'x-forwarded-for': '10.1.1.1' }, form()))).status).toBe(411);
    const big = await photosPost(req({ 'x-forwarded-for': '10.1.1.2', 'content-length': String(bookingConfig.photos.maxBytes + 60_000) }, form()));
    expect(big.status).toBe(413);
  });
  it('accepts a real, sized JPEG; rejects a non-image with the right declared size', async () => {
    const ok = await photosPost(req({ 'x-forwarded-for': '10.1.1.3', 'content-length': '1000' }, form()));
    expect(ok.status).toBe(201);
    const f = new FormData(); f.set('file', new File(['<?php echo 1; ?>'], 'evil.jpg', { type: 'image/jpeg' }));
    const bad = await photosPost(req({ 'x-forwarded-for': '10.1.1.4', 'content-length': '1000' }, f));
    expect(bad.status).toBe(415);
  });
});
