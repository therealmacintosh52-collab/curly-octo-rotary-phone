#!/usr/bin/env node
// 916 Dent & Detail media pipeline. Re-runnable: every output is regenerated
// from brand/ sources. Requires ffmpeg + ffprobe on PATH and `npm i` (sharp).
//
//   node scripts/media.mjs            # everything
//   node scripts/media.mjs logo og    # only some steps
//
// Steps: logo · favicons · og · video · frames · beading · manifest
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync, statSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { keyLogo } from './lib-logo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = join(ROOT, 'brand');
const PUB = join(ROOT, 'public');
const GEN = join(ROOT, 'src', 'generated');
const ONYX = '#0B0B0C';

// Frame sampling: source is 241 frames @24fps. Every 2nd frame → 121 frames (0..240),
// so the last (fully beaded) frame is included.
const FRAME_STEP = 2;
const FRAME_Q = 80;
// Desktop panel is roughly square-to-portrait, so the desktop set is a 720x1000
// crop of the same 720x1280 source (no upscaling: the source is only 720 wide).
const DESK_CROP = { left: 0, top: 140, width: 720, height: 1000 };

const log = (...a) => console.log('[media]', ...a);
const ensure = (d) => mkdirSync(d, { recursive: true });
const clean = (d) => { rmSync(d, { recursive: true, force: true }); ensure(d); };
const size = (p) => statSync(p).size;
const dirBytes = (d) => readdirSync(d).reduce((s, f) => s + size(join(d, f)), 0);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const b64 = async (s) => `data:image/webp;base64,${(await s.webp({ quality: 50 }).toBuffer()).toString('base64')}`;
const report = {};

function sh(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

// ---------- logo ----------
async function alphaBBox(buf, W, H, win = [0, 0, W, H], thr = 40) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = win[1]; y < win[3]; y++) for (let x = win[0]; x < win[2]; x++) {
    if (buf[(y * W + x) * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

async function padSquare(input, side, padFrac, bg) {
  const inner = Math.round(side * (1 - 2 * padFrac));
  const fg = await sharp(input).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: side, height: side, channels: 4, background: bg } })
    .composite([{ input: fg, gravity: 'centre' }]).png();
}

let keyed; // cached
async function getKeyed() {
  if (keyed) return keyed;
  const { buf, W, H } = await keyLogo(join(BRAND, 'logo.jpg'), { lo: 8, hi: 120, gamma: 0.85 });
  keyed = { buf, W, H, png: await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer() };
  return keyed;
}

async function logo() {
  const { buf, W, H, png } = await getKeyed();
  const bb = await alphaBBox(buf, W, H, [0, 0, W, H], 24);
  const pad = 12;
  const full = { left: Math.max(0, bb.left - pad), top: Math.max(0, bb.top - pad), width: 0, height: 0 };
  full.width = Math.min(W - full.left, bb.width + 2 * pad); full.height = Math.min(H - full.top, bb.height + 2 * pad);
  const out = join(PUB, 'brand'); ensure(out);
  await sharp(png).extract(full).png({ compressionLevel: 9 }).toFile(join(out, 'logo-transparent.png'));
  await sharp(png).extract(full).resize(640).webp({ quality: 88, alphaQuality: 90 }).toFile(join(out, 'logo-640.webp'));
  // D-mark: house + D + speed lines (window chosen from the 1408² source; bbox tightened by alpha).
  const dWin = [380, 300, 1000, 790];
  const db = await alphaBBox(buf, W, H, dWin, 70);
  const side = Math.max(db.width, db.height) + 24;
  const dm = { left: Math.round(db.left + db.width / 2 - side / 2), top: Math.round(db.top + db.height / 2 - side / 2), width: side, height: side };
  const dmark = await sharp(png).extract(dm).png().toBuffer();
  await sharp(dmark).png({ compressionLevel: 9 }).toFile(join(out, 'd-mark.png'));
  // Clean mark: median-filtered alpha drops the isolated particle specks (they turn to mush at icon sizes).
  const clean = async (region) => {
    const rgb = await sharp(png).extract(region).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    // alpha curve: anything under ~35% opacity (glow haze, faint particles) → 0, then median to drop specks
    const a0 = await sharp(png).extract(region).extractChannel(3).raw().toBuffer();
    for (let i = 0; i < a0.length; i++) a0[i] = Math.max(0, Math.min(255, Math.round((a0[i] - 90) * (255 / 165))));
    const a = await sharp(a0, { raw: { width: region.width, height: region.height, channels: 1 } }).median(7).extractChannel(0).raw().toBuffer();
    return sharp(rgb.data, { raw: rgb.info }).joinChannel(a, { raw: { width: region.width, height: region.height, channels: 1 } }).png().toBuffer();
  };
  const dmClean = await clean(dm);
  await sharp(dmClean).png({ compressionLevel: 9 }).toFile(join(out, 'd-mark-clean.png'));
  for (const s of [96, 192]) await sharp(dmClean).resize(s).webp({ quality: 90, alphaQuality: 95 }).toFile(join(out, `d-mark-${s}.webp`));
  // D + speed lines only (no roof) for 16/32 px icons
  const dOnly = await alphaBBox(buf, W, H, [415, 470, 900, 748], 140);
  // exact bbox (no square growth: that would reach the wordmark); padSquare letterboxes it later
  await sharp(await clean(dOnly)).png({ compressionLevel: 9 }).toFile(join(out, 'd-only-clean.png'));
  report.logo = { 'logo-transparent.png': size(join(out, 'logo-transparent.png')), 'd-mark.png': size(join(out, 'd-mark.png')), dmarkCrop: dm, logoCrop: full };
  log('logo', kb(report.logo['logo-transparent.png']), 'd-mark', kb(report.logo['d-mark.png']));
}

// ---------- favicons ----------
function buildIco(pngs) { // ICO container with embedded PNGs (Vista+ format)
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length); let off = 6 + dir.length;
  pngs.forEach(({ s, buf }, i) => {
    const o = i * 16; dir.writeUInt8(s >= 256 ? 0 : s, o); dir.writeUInt8(s >= 256 ? 0 : s, o + 1);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6); dir.writeUInt32LE(buf.length, o + 8); dir.writeUInt32LE(off, o + 12); off += buf.length;
  });
  return Buffer.concat([head, dir, ...pngs.map((p) => p.buf)]);
}

async function favicons() {
  const dmark = join(PUB, 'brand', 'd-mark-clean.png');
  const donly = join(PUB, 'brand', 'd-only-clean.png');
  if (!existsSync(dmark) || !existsSync(donly)) await logo();
  const bg = { r: 11, g: 11, b: 12, alpha: 1 };
  const sizes = { 16: 0.02, 32: 0.04, 180: 0.12, 512: 0.16 };
  const ico = [];
  for (const [s, padF] of Object.entries(sizes)) {
    const n = Number(s);
    const buf = await (await padSquare(n <= 32 ? donly : dmark, n, padF, bg)).png({ compressionLevel: 9, palette: n >= 180, quality: 92, effort: 10 }).toBuffer();
    const name = n === 180 ? 'apple-touch-icon.png' : `favicon-${n}.png`;
    writeFileSync(join(PUB, name), buf);
    if (n <= 32) ico.push({ s: n, buf });
  }
  // maskable 512 (safe zone = central 80%) for the web manifest
  await (await padSquare(dmark, 512, 0.22, bg)).png({ palette: true, quality: 92, effort: 10 }).toFile(join(PUB, 'icon-maskable-512.png'));
  // 48 for the ICO's third size
  ico.push({ s: 48, buf: await (await padSquare(donly, 48, 0.04, bg)).toBuffer() });
  writeFileSync(join(PUB, 'favicon.ico'), buildIco(ico));
  report.favicons = Object.fromEntries(['favicon.ico', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'favicon-512.png', 'icon-maskable-512.png'].map((f) => [f, size(join(PUB, f))]));
  log('favicons', JSON.stringify(report.favicons));
}

// ---------- OG 1200x630 ----------
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()); }

async function og() {
  const W = 1200, H = 630, r = rng(916);
  let dots = '';
  for (let i = 0; i < 170; i++) {
    const x = W / 2 + gauss(r) * 260, y = H * 0.42 + gauss(r) * 150;
    const rad = 0.6 + r() * r() * 2.6, op = 0.15 + r() * 0.55;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(2)}" fill="#E8CB7A" opacity="${op.toFixed(2)}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="g" cx="50%" cy="46%" r="55%"><stop offset="0" stop-color="#C9A24A" stop-opacity="0.20"/><stop offset="0.45" stop-color="#8E6E2E" stop-opacity="0.07"/><stop offset="1" stop-color="#0B0B0C" stop-opacity="0"/></radialGradient>
      <filter id="b"><feGaussianBlur stdDeviation="1.1"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="${ONYX}"/><rect width="100%" height="100%" fill="url(#g)"/>
    <g filter="url(#b)">${dots}</g></svg>`;
  const logoPng = await sharp(join(PUB, 'brand', 'logo-transparent.png')).resize({ height: 560 }).png().toBuffer();
  await sharp(Buffer.from(svg)).composite([{ input: logoPng, gravity: 'centre' }]).jpeg({ quality: 88, mozjpeg: true }).toFile(join(PUB, 'og-image.jpg'));
  report.og = size(join(PUB, 'og-image.jpg'));
  log('og', kb(report.og));
}

// ---------- video ----------
function probeStreams(p) {
  return sh('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name', '-of', 'csv=p=0', p]).trim().split('\n');
}
async function video() {
  const src = join(BRAND, 'hero-video.mp4');
  const mp4 = join(PUB, 'hero-video.mp4'), webm = join(PUB, 'hero-video.webm');
  // map ONLY the first video stream: drops AAC audio and the attached MJPEG cover.
  sh('ffmpeg', ['-y', '-v', 'error', '-i', src, '-map', '0:v:0', '-an', '-sn', '-dn', '-map_metadata', '-1',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  sh('ffmpeg', ['-y', '-v', 'error', '-i', src, '-map', '0:v:0', '-an', '-sn', '-dn', '-map_metadata', '-1',
    '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', webm]);
  for (const p of [mp4, webm]) {
    const s = probeStreams(p);
    if (s.length !== 1 || !s[0].split(',').includes('video')) throw new Error(`${p} has unexpected streams: ${s.join(' | ')}`);
  }
  report.video = { 'hero-video.mp4': size(mp4), 'hero-video.webm': size(webm) };
  log('video', JSON.stringify(report.video));
}

// ---------- frames + posters ----------
async function frames() {
  const tmp = mkdtempSync(join(tmpdir(), '916-frames-'));
  try {
    sh('ffmpeg', ['-y', '-v', 'error', '-i', join(BRAND, 'hero-video.mp4'), '-map', '0:v:0',
      '-vf', `select='not(mod(n\\,${FRAME_STEP}))'`, '-fps_mode', 'passthrough', join(tmp, 'f%04d.png')]);
    const files = readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
    const M = join(PUB, 'hero', 'm'), D = join(PUB, 'hero', 'd');
    clean(M); clean(D);
    await Promise.all(files.map(async (f, i) => {
      const name = `${String(i).padStart(3, '0')}.webp`;
      const src = join(tmp, f);
      await sharp(src).resize(720).webp({ quality: FRAME_Q, effort: 5 }).toFile(join(M, name));
      await sharp(src).resize(720).extract(DESK_CROP).webp({ quality: FRAME_Q, effort: 5 }).toFile(join(D, name));
    }));
    const n = files.length;
    // Posters: frame 0 (LCP, dent visible) and the last frame (static state for reduced motion / low-end).
    const P = join(PUB, 'hero'); const first = join(tmp, files[0]); const last = join(tmp, files[n - 1]);
    const variants = [['m', null], ['d', DESK_CROP]];
    for (const [k, crop] of variants) {
      for (const [tag, src] of [['poster', first], ['static', last]]) {
        const base = () => { const s = sharp(src).resize(720); return crop ? s.extract(crop) : s; };
        await base().avif({ quality: 50, effort: 6 }).toFile(join(P, `${tag}-${k}.avif`));
        await base().webp({ quality: 78, effort: 6 }).toFile(join(P, `${tag}-${k}.webp`));
      }
    }
    report.frames = { count: n, m: dirBytes(M), d: dirBytes(D), posters: readdirSync(P).filter((f) => /^(poster|static)/.test(f)).reduce((s, f) => ({ ...s, [f]: size(join(P, f)) }), {}) };
    log('frames', n, 'm', kb(report.frames.m), 'd', kb(report.frames.d), JSON.stringify(report.frames.posters));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

// ---------- hero-beading ----------
async function beading() {
  const src = join(BRAND, 'hero-beading.png'); const out = join(PUB, 'beading'); clean(out);
  for (const w of [1122, 640]) {
    await sharp(src).resize(w).avif({ quality: 52, effort: 6 }).toFile(join(out, `beading-${w}.avif`));
    await sharp(src).resize(w).webp({ quality: 78, effort: 6 }).toFile(join(out, `beading-${w}.webp`));
  }
  // pre-blurred + darkened backdrop for the desktop hero (CSS scales it up; no runtime blur filter)
  await sharp(src).resize(360).blur(10).modulate({ brightness: 0.38, saturation: 0.9 }).webp({ quality: 70 }).toFile(join(out, 'beading-backdrop.webp'));
  report.beading = Object.fromEntries(readdirSync(out).map((f) => [f, size(join(out, f))]));
  log('beading', JSON.stringify(report.beading));
}

// ---------- manifest (consumed by the app) ----------
async function manifest() {
  ensure(GEN);
  const count = readdirSync(join(PUB, 'hero', 'm')).filter((f) => f.endsWith('.webp')).length;
  // tiny inline (base64) blur placeholders, computed from the generated files
  const tiny = {
    'poster-m': await b64(sharp(join(PUB, 'hero', 'poster-m.webp')).resize(24).blur(1.2)),
    'poster-d': await b64(sharp(join(PUB, 'hero', 'poster-d.webp')).resize(24).blur(1.2)),
    'beading-backdrop': await b64(sharp(join(BRAND, 'hero-beading.png')).resize(32).blur(1.5).modulate({ brightness: 0.38 })),
  };
  report.tinyBytes = Object.fromEntries(Object.entries(tiny).map(([k, v]) => [k, v.length]));
  const ts = `// GENERATED by scripts/media.mjs — do not edit by hand.
export const heroMedia = {
  frameCount: ${count},
  frameStep: ${FRAME_STEP},
  mobile: { dir: '/hero/m', width: 720, height: 1280 },
  desktop: { dir: '/hero/d', width: ${DESK_CROP.width}, height: ${DESK_CROP.height} },
  poster: {
    m: { avif: '/hero/poster-m.avif', webp: '/hero/poster-m.webp', tiny: ${JSON.stringify(tiny['poster-m'] || '')} },
    d: { avif: '/hero/poster-d.avif', webp: '/hero/poster-d.webp', tiny: ${JSON.stringify(tiny['poster-d'] || '')} },
  },
  static: {
    m: { avif: '/hero/static-m.avif', webp: '/hero/static-m.webp' },
    d: { avif: '/hero/static-d.avif', webp: '/hero/static-d.webp' },
  },
  backdrop: { src: '/beading/beading-backdrop.webp', tiny: ${JSON.stringify(tiny['beading-backdrop'] || '')} },
} as const;

export const frameSrc = (dir: string, i: number) => \`\${dir}/\${String(i).padStart(3, '0')}.webp\`;
`;
  writeFileSync(join(GEN, 'media.ts'), ts);
  log('manifest → src/generated/media.ts');
}

const steps = { logo, favicons, og, video, frames, beading, manifest };
const want = process.argv.slice(2);
const order = want.length ? want : Object.keys(steps);
for (const s of order) { if (!steps[s]) throw new Error(`unknown step ${s}`); await steps[s](); }
writeFileSync(join(ROOT, 'scripts', '.media-report.json'), JSON.stringify(report, null, 2));
log('done');
