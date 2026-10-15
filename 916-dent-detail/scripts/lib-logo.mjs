// Luminance key for a gold-on-black logo.
// Background is a neutral radial vignette (~5-30 max-channel). We model it as a
// function of radius, then for each pixel compute alpha from how far its max
// channel rises above that background, and un-mix the colour
// F = (C - (1-a)·B) / a so semi-transparent edges keep their gold hue instead
// of carrying a dark fringe (this is what removes the "dark halo").
import sharp from 'sharp';

export async function keyLogo(src, { lo = 7, hi = 120, gamma = 0.85, exclude = [0.09, 0.22, 0.92, 0.76] } = {}) {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const cx = W / 2, cy = H / 2;
  const BIN = 8, nb = Math.ceil(Math.hypot(cx, cy) / BIN) + 1;
  const bins = Array.from({ length: nb }, () => []);
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const i = (y * W + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const inLogo = x > exclude[0] * W && x < exclude[2] * W && y > exclude[1] * H && y < exclude[3] * H;
    if (!inLogo && mx < 60 && mx - mn < 7) bins[Math.floor(Math.hypot(x - cx, y - cy) / BIN)].push(mx);
  }
  // bins inside the logo's box have no samples; they are filled from the nearest ring.
  // per-bin median, then fill gaps by nearest neighbours and smooth
  let bg = bins.map((v) => (v.length > 20 ? v.sort((a, b) => a - b)[v.length >> 1] : NaN));
  for (let k = 0; k < nb; k++) if (Number.isNaN(bg[k])) {
    let a = k, b = k; while (a >= 0 && Number.isNaN(bg[a])) a--; while (b < nb && Number.isNaN(bg[b])) b++;
    bg[k] = a < 0 ? bg[b] : b >= nb ? bg[a] : bg[a] + ((bg[b] - bg[a]) * (k - a)) / (b - a);
  }
  bg = bg.map((_, k) => { let s = 0, n = 0; for (let j = k - 3; j <= k + 3; j++) if (j >= 0 && j < nb) { s += bg[j]; n++; } return s / n; });
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, o = (y * W + x) * 4;
    const B = bg[Math.min(nb - 1, Math.floor(Math.hypot(x - cx, y - cy) / BIN))];
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lift = Math.max(r, g, b) - B;
    let a = Math.min(1, Math.max(0, (lift - lo) / (hi - lo)));
    a = Math.pow(a, gamma);
    if (a <= 0.004) { out[o + 3] = 0; continue; }
    const un = (c) => Math.max(0, Math.min(255, Math.round((c - (1 - a) * B) / a)));
    out[o] = un(r); out[o + 1] = un(g); out[o + 2] = un(b); out[o + 3] = Math.round(a * 255);
  }
  return { buf: out, W, H, bg };
}
