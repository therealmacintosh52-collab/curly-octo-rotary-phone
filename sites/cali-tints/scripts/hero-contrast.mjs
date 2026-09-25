/**
 * Measure the hero copy against the pixels actually behind it, across the clip.
 *
 *   node scripts/hero-contrast.mjs
 *
 * A video hero cannot be checked the way ordinary text is: there is no
 * background colour to read off computed style, and the worst frame is rarely
 * the first one. So this steps through the clip, hides the copy, screenshots
 * the band the copy occupies, and compares the text colours against the
 * BRIGHTEST pixel in that band — the worst case, not the average.
 *
 * Exits non-zero if any sampled second falls below 4.5:1.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TMP = mkdtempSync(path.join(os.tmpdir(), 'herocontrast-'));

// Each piece of hero copy, with the colour it is painted in. Measured against
// its OWN bounding box — not a rectangle around all of them, which would drag
// in the empty right-hand side of the frame where no text sits and report a
// failure the reader could never see.
const SAMPLES = [
  ['eyebrow', '.hero-v .eyebrow', [255, 148, 85]],
  ['headline', '.hero-v h1', [255, 255, 255]],
  ['promise', '.hero-v__promise', [255, 217, 189]],
  ['meta', '.hero-v__meta', [211, 218, 241]],
];

// Since the copy moved off the frame and onto a solid panel, every row of the
// table below should read the SAME number. A column that moves from second to
// second means something has been laid back over the video — which is the whole
// failure this hero was rebuilt to make impossible. Keep the check for that.

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, url);
  if (url.endsWith('/')) file = path.join(file, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const buf = readFileSync(file);
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  // Range matters here: video is the whole point of this check.
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = Number(m[1] || 0);
    const end = Math.min(Number(m[2] || buf.length - 1), buf.length - 1);
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${buf.length}`, 'Content-Length': end - start + 1 });
    res.end(buf.subarray(start, end + 1));
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': buf.length });
  res.end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// 'load', not 'networkidle': a streaming video means the network never goes idle.
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForTimeout(2500);

// The box to measure is where the GLYPHS are, not where the element is. A <p>
// is a block: its box spans the whole column even when the sentence fills half
// of it, and sampling that empty tail picks up whatever is behind the far side
// of the frame. Range.getClientRects() gives the real line boxes instead.
const boxes = await page.evaluate((sel) => sel.map(([name, q]) => {
  const el = document.querySelector(q);
  if (!el) return null;
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 2 && r.height > 2);
  if (!rects.length) return null;
  // Pad by a few px: antialiasing bleeds glyph edges outward.
  return {
    name,
    rects: rects.map((r) => ({
      x: Math.max(0, Math.round(r.x + window.scrollX) - 3),
      y: Math.max(0, Math.round(r.y + window.scrollY) - 3),
      width: Math.round(r.width) + 6, height: Math.round(r.height) + 6,
    })),
  };
}), SAMPLES.map(([n, q]) => [n, q]));

if (!boxes.some(Boolean)) { console.log('No video hero on this page — nothing to check.'); await browser.close(); server.close(); process.exit(0); }

const duration = await page.evaluate(() =>
  new Promise((res) => {
    const v = document.querySelector('[data-hero-video]');
    if (!v) return res(0);
    if (v.duration) return res(v.duration);
    v.addEventListener('loadedmetadata', () => res(v.duration || 0), { once: true });
    setTimeout(() => res(v.duration || 0), 3000);
  }));

if (!duration) {
  console.log('The hero video did not load — is hasVideo set, and can this browser decode it?');
  await browser.close(); server.close(); process.exit(1);
}

// Hide the copy; the scrim and the video stay exactly as they render.
await page.evaluate(() => { document.querySelector('.hero-v__inner').style.visibility = 'hidden'; });

const steps = [];
for (let t = 0; t < duration; t += 1) steps.push(Number(t.toFixed(1)));
if (steps.at(-1) !== Number((duration - 0.1).toFixed(1))) steps.push(Number((duration - 0.1).toFixed(1)));

let worst = Infinity;
let worstAt = null;
const rows = [];

for (const t of steps) {
  await page.evaluate((time) => {
    const v = document.querySelector('[data-hero-video]');
    if (v) { v.pause(); v.currentTime = time; }
  }, t);
  await page.waitForTimeout(450);
  const per = [];
  let brightest = [0, 0, 0];
  let bl = -1;
  for (let i = 0; i < SAMPLES.length; i++) {
    const entry = boxes[i];
    if (!entry) { per.push(null); continue; }
    let b = [0, 0, 0];
    let best = -1;
    for (let k = 0; k < entry.rects.length; k++) {
      const box = entry.rects[k];
      const shot = path.join(TMP, `t${t}-${i}-${k}.png`);
      // fullPage: the copy can sit below the fold (the clip runs its full 16:9,
      // so on a laptop the hero fills the window), and a viewport-relative clip
      // outside it throws rather than returning the pixels.
      await page.screenshot({ path: shot, clip: box, fullPage: true });
      const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
      for (let j = 0; j < data.length; j += info.channels) {
        const px = [data[j], data[j + 1], data[j + 2]];
        const l = lum(px);
        if (l > best) { best = l; b = px; }
      }
    }
    if (best > bl) { bl = best; brightest = b; }
    per.push(ratio(SAMPLES[i][2], b));
  }
  const vals = per.filter((v) => v !== null);
  const min = Math.min(...vals);
  if (min < worst) { worst = min; worstAt = t; }
  rows.push([t, brightest, per, min]);
}

console.log(`Hero copy vs the brightest pixel inside each element's own box — ` +
            `${steps.length} frames across ${duration.toFixed(1)}s\n`);
console.log(`  ${'t'.padStart(5)}  ` + SAMPLES.map(([n]) => n.padStart(9)).join('  ') + '   min');
for (const [t, , per, min] of rows) {
  console.log(`  ${(t + 's').padStart(5)}  ` +
              per.map((v) => (v === null ? '—' : v.toFixed(2)).padStart(9)).join('  ') +
              `   ${min.toFixed(2)} ${min >= 4.5 ? 'ok' : 'LOW'}`);
}

await browser.close();
server.close();
rmSync(TMP, { recursive: true, force: true });

console.log(`\nworst: ${worst.toFixed(2)}:1 at t=${worstAt}s (need 4.5:1)`);
if (worst < 4.5) {
  console.log('Strengthen .hero-v__scrim in src/styles/global.css.');
  process.exit(1);
}
