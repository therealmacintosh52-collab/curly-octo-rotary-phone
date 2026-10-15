#!/usr/bin/env node
// One-off developer tool (NOT part of `npm run media`): traces the 3D logo's slanted D + speed lines into a flat vector.
// Output: brand/d-mark-flat.svg (committed; scripts/media.mjs rasterises it for every icon size).
//
//   npm i --no-save potrace          (pure JS port of potrace; deliberately not a project dependency)
//   node scripts/trace-dmark.mjs
//
// Method: luminance-key brand/logo.jpg, take the D + speed-lines window (the roof/shield is left out on purpose: it is what turns to mush at
// 16 px), binarise the alpha with a LOW threshold so the darker bevel facets of the gold still count as ink, upsample 3x, trace with potrace
// (curves, 2-px speck removal), then flatten to one gold fill. The trace is checked by overlaying it on the source (see DECISIONS P9-004).
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { keyLogo } from './lib-logo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let potrace;
try { potrace = (await import('potrace')).default ?? (await import('potrace')); } catch {
  console.error('potrace is not installed. Run: npm i --no-save potrace'); process.exit(2);
}

const WIN = { left: 400, top: 440, width: 500, height: 330 }; // D + speed lines in the 1408x1408 logo, with margin (roof stub, shield bracket and sparkles are inside it and get filtered out below)
const SCALE = 3;
const THRESH = Number(process.env.TRACE_THRESHOLD || 70); // 0-255 alpha; low on purpose

const { buf, W, H } = await keyLogo(join(ROOT, 'brand', 'logo.jpg'), { lo: 10, hi: 60, gamma: 1 });
const w = WIN.width * SCALE, h = WIN.height * SCALE;
const alpha = await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).extract(WIN).extractChannel(3)
  .resize(w, h, { kernel: 'lanczos3' }).blur(2.2).raw().toBuffer(); // blur: brushed-metal texture must not become a wobbly outline
const ink = new Uint8Array(w * h);
for (let i = 0; i < ink.length; i++) ink[i] = alpha[i] >= THRESH ? 1 : 0;

// keep the glyph pieces only: connected components that are big enough and do not touch the window's top/right edge
// (the roof stub touches the top edge, the shield bracket the right edge, sparkles are tiny)
const lab = new Int32Array(w * h); const comps = [];
for (let s0 = 0; s0 < ink.length; s0++) {
  if (!ink[s0] || lab[s0]) continue;
  const id = comps.length + 1; const st = [s0]; lab[s0] = id; let area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
  while (st.length) {
    const k = st.pop(); area++; const x = k % w, y = (k / w) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    for (const q of [k - 1, k + 1, k - w, k + w]) if (q >= 0 && q < ink.length && ink[q] && !lab[q] && (Math.abs((q % w) - x) <= 1)) { lab[q] = id; st.push(q); }
  }
  comps.push({ id, area, x0, y0, x1, y1 });
}
const keep = new Set(comps.filter((c) => c.area > 4000 && c.y0 > 3 && c.x1 < w - 3).map((c) => c.id));
console.log('components', comps.filter((c) => c.area > 500).map((c) => `${c.area}px [${c.x0},${c.y0}-${c.x1},${c.y1}]${keep.has(c.id) ? ' KEEP' : ''}`).join(' | '));
const bw = Buffer.alloc(w * h);
for (let i = 0; i < bw.length; i++) bw[i] = keep.has(lab[i]) ? 0 : 255;
const png = await sharp(bw, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();

const svg = await new Promise((res, rej) => potrace.trace(png, { turdSize: 60, alphaMax: 1.0, optCurve: true, optTolerance: 0.6, threshold: 128, blackOnWhite: true, color: '#C9A24A', background: 'transparent' }, (e, s) => (e ? rej(e) : res(s))));
writeFileSync(join(ROOT, 'brand', 'd-mark-flat.trace.svg'), svg);
console.log('wrote brand/d-mark-flat.trace.svg', svg.length, 'bytes; canvas', w, 'x', h, '(source window', JSON.stringify(WIN), 'x', SCALE, ')');
