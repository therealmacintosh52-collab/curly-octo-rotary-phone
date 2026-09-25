/**
 * Build the hero poster set: JPEG (the floor), WebP and AVIF.
 *
 *   node scripts/posters.mjs
 *
 * If public/assets/video/shop.mp4 exists, frame 1 of the real clip is used, so
 * the poster and the first video frame match exactly and the swap is invisible.
 * Until then it renders the placeholder: the brand gradient with the logo.
 *
 * The poster is the LCP element, so it is deliberately the only large image on
 * the critical path.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IMG = path.join(ROOT, 'public/assets/img');
const VIDEO = path.join(ROOT, 'public/assets/video/shop.mp4');
import { FFMPEG } from './ffmpeg-path.mjs';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const W = 1280, H = 720;

mkdirSync(IMG, { recursive: true });
const base = path.join(IMG, 'hero-poster.png');

// Which second of the ENCODED clip to cut the poster from. 0 keeps the poster
// and the video's first frame identical, which is what you want unless the
// opening frames carry something they should not. Override with POSTER_AT=1.4.
const POSTER_AT = process.env.POSTER_AT || '0';

if (existsSync(VIDEO)) {
  console.log(`• real clip found — cutting the poster at t=${POSTER_AT}s`);
  execFileSync(FFMPEG, ['-y', '-ss', POSTER_AT, '-i', VIDEO, '-vframes', '1',
                        '-vf', `scale=${W}:-2`, base], { stdio: 'ignore' });
} else {
  console.log('• no clip yet — rendering the placeholder poster');
  // A quiet textured ground, deliberately with no logo and no words on it.
  // The hero already carries the wordmark in the nav and the headline over the
  // top; a second lockup inside the poster fought both. This reads as a dark
  // workshop wall until the real clip replaces it.
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0}
    body{width:${W}px;height:${H}px;overflow:hidden;position:relative;
      background:linear-gradient(158deg,#070c33 0%,#0d1550 46%,#05081f 100%)}
    .glow{position:absolute;inset:0;
      background:radial-gradient(760px 420px at 78% 14%,rgba(235,113,45,.24),transparent 64%),
                 radial-gradient(660px 420px at 12% 92%,rgba(12,39,245,.34),transparent 68%)}
    .grid{position:absolute;inset:0;opacity:.13;
      background-image:linear-gradient(rgba(255,255,255,.55) 1px,transparent 1px),
                       linear-gradient(90deg,rgba(255,255,255,.55) 1px,transparent 1px);
      background-size:78px 78px;
      -webkit-mask-image:radial-gradient(120% 90% at 70% 20%,#000 12%,transparent 78%)}
    /* roof trusses, suggested not drawn */
    .truss{position:absolute;inset:0;opacity:.16}
    .truss i{position:absolute;display:block;height:2px;background:#8b9bf5;transform-origin:left}
    .floor{position:absolute;left:0;right:0;bottom:0;height:34%;
      background:linear-gradient(to bottom,rgba(20,32,120,.42),rgba(5,8,31,.9))}
    .floor::after{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:rgba(80,100,220,.5)}
    .vig{position:absolute;inset:0;box-shadow:inset 0 0 220px 60px rgba(3,5,20,.85)}
  </style></head><body>
    <div class="glow"></div><div class="grid"></div>
    <div class="truss">
      <i style="left:6%;top:16%;width:42%;transform:rotate(7deg)"></i>
      <i style="left:52%;top:11%;width:44%;transform:rotate(-6deg)"></i>
      <i style="left:14%;top:27%;width:34%;transform:rotate(-4deg)"></i>
      <i style="left:58%;top:24%;width:36%;transform:rotate(5deg)"></i>
    </div>
    <div class="floor"></div><div class="vig"></div>
  </body></html>`;

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  // 'load', not 'networkidle': the hero video streams continuously, so the
  // network never goes idle and networkidle would hang or time out.
  await page.goto(`file://${IMG}/`);           // so the relative logo.png resolves
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: base });
  await browser.close();
}

const src = sharp(base).resize(W, H, { fit: 'cover' });
await src.clone().jpeg({ quality: 82, progressive: true, mozjpeg: true })
  .toFile(path.join(IMG, 'hero-poster.jpg'));
await src.clone().webp({ quality: 78 }).toFile(path.join(IMG, 'hero-poster.webp'));
await src.clone().avif({ quality: 50, effort: 6 }).toFile(path.join(IMG, 'hero-poster.avif'));

const { statSync, unlinkSync } = await import('node:fs');
unlinkSync(base);
for (const f of ['hero-poster.jpg', 'hero-poster.webp', 'hero-poster.avif']) {
  console.log(`  ${f.padEnd(20)} ${(statSync(path.join(IMG, f)).size / 1024).toFixed(0)} KB`);
}
