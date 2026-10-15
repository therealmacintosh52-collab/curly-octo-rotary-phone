// Hero video repair: removes the stray white "chip" (a bright white ring / crescent that grows out of the dent's lower
// edge, peaks at source frames 28-31 and drifts left and down before it disappears at frame 35) from the 720x1280 source
// frames. Diagnosis (viewed frame by frame, see DECISIONS P9-001): n = 0-based source frame.
//   n <= 20   thin white crescent along the dent's lower lip: part of the real specular highlight, kept
//   n 21-26   crescent thickens and brightens: faded out gradually (RAMP)
//   n 27-33   white ring / chip, brightest at 28-31, moving: removed completely
//   n >= 35   gone in the source
// Method: inside a fixed region, mask near-white pixels (not the blue reflections), dilate, then fill the hole by
// Laplace diffusion from its border (a smooth dark blue patch, which is what the dent floor looks like on both sides in
// time) and add 1 level of grain like the source. Pure JS, deterministic, no external tools.
export const REPAIR = {
  box: { x0: 372, y0: 700, x1: 512, y1: 805 }, // where the chip lives (source px); the door seam (x~365) and rocker chrome (y>808) are outside
  from: 21,   // first frame touched
  full: 27,   // fully removed from here ...
  to: 34,     // ... through here (n=34 still has a sliver; 35 is clean)
  tail: 36,   // frames 35..36 get a tiny cleanup only if something white is still in the box
  dilate: 8,
};

const MIN_BLOB = 24;
const isWhite = (R, G, B) => R > 62 && R > 0.62 * B;

export function repairWeight(n, cfg = REPAIR) {
  if (n < cfg.from || n > cfg.tail) return 0;
  if (n >= cfg.full) return 1;
  return (n - cfg.from + 1) / (cfg.full - cfg.from + 1); // 1/7 ... 6/7 ramp
}

/** rgb: Uint8 raw RGB (W*H*3). Returns a repaired copy (or the same buffer if weight is 0). */
export function repairFrame(rgb, W, H, n, cfg = REPAIR) {
  const w = repairWeight(n, cfg);
  if (w === 0) return rgb;
  const { x0, y0, x1, y1 } = cfg.box; const bw = x1 - x0, bh = y1 - y0;
  const m = new Uint8Array(bw * bh);
  let any = 0;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const i = ((y0 + y) * W + x0 + x) * 3;
    if (isWhite(rgb[i], rgb[i + 1], rgb[i + 2])) { m[y * bw + x] = 1; any++; }
  }
  if (!any) return rgb;
  // keep only connected blobs of >= MIN_BLOB px: isolated near-white pixels on the blue reflection lines are not the chip
  // (and dilating them would punch square holes into those lines)
  const seen = new Uint8Array(bw * bh), stack = [];
  for (let s0 = 0; s0 < bw * bh; s0++) {
    if (!m[s0] || seen[s0]) continue;
    const comp = []; stack.push(s0); seen[s0] = 1;
    while (stack.length) {
      const k = stack.pop(); comp.push(k); const x = k % bw, y = (k / bw) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue;
        const q = yy * bw + xx; if (m[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    if (comp.length < MIN_BLOB) for (const k of comp) m[k] = 0;
  }
  // dilate (square, separable)
  const r = cfg.dilate;
  const tmp = new Uint8Array(bw * bh), mask = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    let v = 0; for (let k = -r; k <= r && !v; k++) { const xx = x + k; if (xx >= 0 && xx < bw && m[y * bw + xx]) v = 1; } tmp[y * bw + x] = v;
  }
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    let v = 0; for (let k = -r; k <= r && !v; k++) { const yy = y + k; if (yy >= 0 && yy < bh && tmp[yy * bw + x]) v = 1; } mask[y * bw + x] = v;
  }
  // diffusion fill per channel (Jacobi, initialised from the mean of known border pixels)
  const out = Buffer.from(rgb);
  const fill = new Float32Array(bw * bh);
  for (let c = 0; c < 3; c++) {
    let sum = 0, cnt = 0;
    for (let k = 0; k < bw * bh; k++) if (!mask[k]) { sum += rgb[((y0 + (k / bw | 0)) * W + x0 + (k % bw)) * 3 + c]; cnt++; }
    const mean = cnt ? sum / cnt : 0;
    for (let k = 0; k < bw * bh; k++) fill[k] = mask[k] ? mean * 0.5 : rgb[((y0 + (k / bw | 0)) * W + x0 + (k % bw)) * 3 + c];
    let a = fill, b = new Float32Array(fill);
    for (let it = 0; it < 400; it++) {
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const k = y * bw + x;
        if (!mask[k]) { b[k] = a[k]; continue; }
        const l = a[x > 0 ? k - 1 : k], rr = a[x < bw - 1 ? k + 1 : k], u = a[y > 0 ? k - bw : k], d = a[y < bh - 1 ? k + bw : k];
        b[k] = (l + rr + u + d) / 4;
      }
      [a, b] = [b, a];
    }
    // soft alpha: blur the mask a little so the patch edge has no seam; weight w ramps the effect in over time
    let seed = (n * 2654435761 + c) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const k = y * bw + x; if (!mask[k]) continue;
      let s = 0, q = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue; s += mask[yy * bw + xx]; q++;
      }
      const alpha = (s / q) * w; // 1 deep inside the hole, falling off at its rim
      const i = ((y0 + y) * W + x0 + x) * 3 + c;
      const g = a[k] + (rnd() + rnd() + rnd() - 1.5) * 1.2; // ~1 level grain
      out[i] = Math.max(0, Math.min(255, Math.round(rgb[i] * (1 - alpha) + g * alpha)));
    }
  }
  return out;
}
