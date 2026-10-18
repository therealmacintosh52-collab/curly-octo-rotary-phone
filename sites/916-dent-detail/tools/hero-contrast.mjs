// Pixel contrast under hero text: hides the copy, screenshots the image/scrim, takes the p99 luminance in each text box.
// node tools/hero-contrast.mjs <baseUrl> [reduced|nojs]   (needs playwright + sharp on NODE_PATH). Fails (exit 1) under 4.5:1 (3:1 for the 26px+ lines).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');
const base = process.argv[2];
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const TEXT = { '.hero-eyebrow': ['#F3EEE3', 4.5], '.l1': ['#F3EEE3', 3], '.l2': ['#F3EEE3', 3], '.l3': ['#8E6E2E', 3], '.hero-sub': ['#F3EEE3', 4.5], '.hero-note': ['#F3EEE3', 4.5], '.hero-cap': ['#F3EEE3', 4.5] };
const browser = await chromium.launch({ args: ['--no-sandbox'] });
let fail = 0;
for (const [w, h, states] of (process.argv[3] ? [[390, 844, [0]], [1280, 800, [0]]] : [[390, 844, [0, 0.5, 1.2, 2.4]], [1280, 800, [0, 1, 2]]])) {
  const mode = process.argv[3] || '';
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, bypassCSP: true, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference', javaScriptEnabled: mode !== 'nojs' });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  for (const s of states) {
    await page.evaluate((y) => window.scrollTo(0, y * innerHeight), s);
    await page.waitForTimeout(700);
    const boxes = await page.evaluate((sel) => Object.fromEntries(sel.map((q) => { const e = document.querySelector(q); const r = e.getBoundingClientRect(); const vis = getComputedStyle(e).opacity; return [q, { x: r.x, y: r.y, w: r.width, h: r.height, vis: +vis }]; })), Object.keys(TEXT));
    await page.addStyleTag({ content: '.hero-copy *{visibility:hidden!important}.hero-cap{visibility:hidden!important}' });
    const png = await page.screenshot();
    await page.evaluate(() => document.querySelectorAll('style').forEach((x) => { if (x.textContent.includes('visibility:hidden!important')) x.remove(); }));
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    for (const [q, b] of Object.entries(boxes)) {
      if (b.vis < 0.5 || b.h === 0) continue;
      const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y)), x1 = Math.min(info.width, Math.ceil(b.x + b.w)), y1 = Math.min(info.height - 80 * (w < 600), Math.ceil(b.y + b.h));
      if (x1 <= x0 || y1 <= y0) continue;
      const ls = [];
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const i = (y * info.width + x) * info.channels; ls.push(0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2])); }
      ls.sort((a, c) => a - c);
      const p99 = ls[Math.floor(ls.length * 0.99)];
      const [col, need] = TEXT[q];
      const cr = (L(col) + 0.05) / (p99 + 0.05);
      const bad = cr < need; if (bad) fail++;
      console.log(`${w}px scroll ${s} ${q.padEnd(14)} p99 bg lum ${p99.toFixed(3)} contrast ${cr.toFixed(2)} need ${need} ${bad ? 'FAIL' : 'ok'}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(fail ? `FAILURES: ${fail}` : 'all sampled hero text passes');
process.exit(fail ? 1 : 0);
