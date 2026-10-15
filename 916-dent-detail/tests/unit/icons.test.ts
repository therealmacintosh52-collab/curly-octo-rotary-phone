// Flat D-mark icons (P9-004): every size exists, uses the brand colours, the small ones are legible, the maskable one respects the safe zone,
// every manifest/metadata reference resolves, and the 3D logo is still what the header and the OG image use.
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PUB = join(import.meta.dirname, '..', '..', 'public');
const SRC = join(import.meta.dirname, '..', '..', 'src');
const raw = async (f: string) => { const { data, info } = await sharp(join(PUB, f)).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
const isGold = (r: number, g: number, b: number) => Math.abs(r - 0xc9) < 40 && Math.abs(g - 0xa2) < 40 && Math.abs(b - 0x4a) < 50;
const isOnyx = (r: number, g: number, b: number) => r < 30 && g < 30 && b < 30;

describe('flat D-mark icons', () => {
  it('has every size, exactly', async () => {
    const sizes: Record<string, number> = { 'favicon-16.png': 16, 'favicon-32.png': 32, 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'favicon-512.png': 512, 'icon-maskable-512.png': 512, 'admin/icon-192.png': 192, 'admin/icon-512.png': 512, 'admin/icon-maskable-512.png': 512 };
    for (const [f, s] of Object.entries(sizes)) { const m = await sharp(join(PUB, f)).metadata(); expect([f, m.width, m.height]).toEqual([f, s, s]); }
  });
  it('favicon.ico holds 16, 32 and 48 px PNG frames', () => {
    const b = readFileSync(join(PUB, 'favicon.ico'));
    expect(b.readUInt16LE(2)).toBe(1); const n = b.readUInt16LE(4); expect(n).toBe(3);
    expect([0, 1, 2].map((i) => b.readUInt8(6 + i * 16))).toEqual([16, 32, 48]);
    for (let i = 0; i < n; i++) { const off = b.readUInt32LE(6 + i * 16 + 12); expect(b.subarray(off, off + 8).toString('hex')).toBe('89504e470d0a1a0a'); }
  });
  it('uses the brand colours: onyx background corners, gold ink, nothing else dominant', async () => {
    for (const f of ['favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'favicon-512.png', 'icon-maskable-512.png']) {
      const { data, w, h } = await raw(f);
      const px = (x: number, y: number) => [data[(y * w + x) * 3]!, data[(y * w + x) * 3 + 1]!, data[(y * w + x) * 3 + 2]!] as const;
      for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]] as const) expect(isOnyx(...px(x, y)), `${f} corner`).toBe(true);
      let gold = 0, onyx = 0;
      for (let i = 0; i < data.length; i += 3) { if (isGold(data[i]!, data[i + 1]!, data[i + 2]!)) gold++; else if (isOnyx(data[i]!, data[i + 1]!, data[i + 2]!)) onyx++; }
      expect(gold / (w * h), `${f} gold coverage`).toBeGreaterThan(f === 'favicon-16.png' ? 0.2 : f.includes('maskable') ? 0.07 : 0.1);
      expect((gold + onyx) / (w * h), `${f}: almost every pixel is gold or onyx (no mush)`).toBeGreaterThan(f.includes('16') ? 0.7 : 0.85);
    }
  });
  it('small sizes are crisp: most gold pixels are fully saturated gold, not blended', async () => {
    for (const f of ['favicon-16.png', 'favicon-32.png']) {
      const { data } = await raw(f);
      let solid = 0, ink = 0;
      for (let i = 0; i < data.length; i += 3) if (data[i]! > 60) { ink++; if (isGold(data[i]!, data[i + 1]!, data[i + 2]!)) solid++; }
      expect(solid / ink, f).toBeGreaterThan(0.6);
    }
  });
  it('the maskable icons keep the mark inside the 40% safe-zone circle', async () => {
    for (const f of ['icon-maskable-512.png', 'admin/icon-maskable-512.png']) {
      const { data, w, h } = await raw(f);
      const c = w / 2; let worst = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; if (data[i]! > 80) worst = Math.max(worst, Math.hypot(x - c, y - c)); }
      expect(worst / w, f).toBeLessThanOrEqual(0.4);
    }
  });
  it('the SVG favicon is valid, gold and tiny', () => {
    const svg = readFileSync(join(PUB, 'favicon.svg'), 'utf8');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[\d. -]+"/);
    expect(svg).toContain('#C9A24A');
    expect(svg.length).toBeLessThan(1500);
  });
  it('every icon referenced by the manifests and the metadata exists', () => {
    const refs = [
      ...[...readFileSync(join(SRC, 'app', 'manifest.ts'), 'utf8').matchAll(/src: '([^']+)'/g)].map((m) => m[1]!),
      ...[...readFileSync(join(SRC, 'app', 'admin', 'manifest.webmanifest', 'route.ts'), 'utf8').matchAll(/src: '([^']+)'/g)].map((m) => m[1]!),
      ...[...readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8').matchAll(/url: '(\/(?:favicon|icon|apple)[^']+)'/g)].map((m) => m[1]!),
    ];
    expect(refs.length).toBeGreaterThanOrEqual(8);
    for (const r of refs) expect(existsSync(join(PUB, r)), r).toBe(true);
  });
  it('the 3D logo is untouched: OG image and header still use the 3D art, not the flat mark', () => {
    const layout = readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8');
    expect(layout).toContain("url: '/og-image.jpg'");
    expect(readFileSync(join(SRC, 'components', 'Logo.tsx'), 'utf8')).toMatch(/d-mark-\d+\.webp|logo-640\.webp/);
    expect(readFileSync(join(import.meta.dirname, '..', '..', 'scripts', 'media.mjs'), 'utf8')).toMatch(/resize\(\{ height: 560 \}\)/); // og step composites logo-transparent.png
  });
});
