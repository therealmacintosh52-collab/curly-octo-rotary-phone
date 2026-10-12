/**
 * Scroll-behaviour check: reveals run without errors, the stat numbers count
 * up, the home before/after trio and a service page render. Screenshots and
 * a screen recording of a real scroll through the home page land in qa/.
 *
 *   node scripts/scroll-check.mjs            (after npm run build)
 *   qa/scroll.mp4 (+ .webm)  qa/<device>-trio.png  qa/desktop-service-split.png
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { FFMPEG } from './ffmpeg-path.mjs';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const _LOCAL_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.PW_CHROME || (existsSync(_LOCAL_CHROME) ? _LOCAL_CHROME : chromium.executablePath());
const DIST = path.join(ROOT, 'dist'); const QA = path.join(ROOT, 'qa'); mkdirSync(QA, { recursive: true });
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2','.webm':'video/webm','.mp4':'video/mp4'};
const server=createServer((req,res)=>{const u=decodeURIComponent((req.url||'/').split('?')[0]);let f=path.join(DIST,u);if(u.endsWith('/'))f=path.join(f,'index.html');if(!existsSync(f)||statSync(f).isDirectory()){res.writeHead(404);res.end();return;}const buf=readFileSync(f);const type=MIME[path.extname(f)]||'application/octet-stream';const range=req.headers.range;if(range){const m=/bytes=(\d*)-(\d*)/.exec(range);const start=m[1]?+m[1]:0;const end=m[2]?+m[2]:buf.length-1;res.writeHead(206,{'Content-Type':type,'Content-Range':`bytes ${start}-${end}/${buf.length}`,'Accept-Ranges':'bytes','Content-Length':end-start+1});res.end(buf.subarray(start,end+1));return;}res.writeHead(200,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Length':buf.length});res.end(buf);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
let fail = 0;
const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); if (!c) fail++; };

for (const [label, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['iphone', { width: 390, height: 844 }, true]]) {
  const pg = await browser.newPage({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const errors = []; pg.on('pageerror', (e) => errors.push(e.message));
  const missing = []; pg.on('response', (r) => { if (r.status() >= 400) missing.push(r.url()); });
  await pg.goto(BASE + '/', { waitUntil: 'load' });
  await pg.waitForTimeout(2500); // gsap boots after load + idle
  const counts = await pg.evaluate(() => [...document.querySelectorAll('[data-count]')].map((el) => el.textContent));
  const trioTop = await pg.evaluate(() => document.querySelector('.split-img').getBoundingClientRect().top + window.scrollY);
  await pg.evaluate(([y, h]) => window.scrollTo(0, y - h * 0.3), [trioTop, vp.height]); await pg.waitForTimeout(1400);
  const trio = await pg.evaluate(() => [...document.querySelectorAll('.split-img img')].map((im) => im.complete && im.naturalWidth > 0));
  const shown = await pg.evaluate(() => [...document.querySelectorAll('.split-img')].map((el) => getComputedStyle(el.closest('.js-reveal') || el).opacity));
  await pg.screenshot({ path: path.join(QA, `${label}-trio.png`) });
  ok(trio.length === 3 && trio.every(Boolean), `${label}: three before/after images loaded`);
  ok(shown[0] === '1', `${label}: first before/after card revealed (opacity ${shown[0]})`);
  ok(counts.join('|') === '4.9|48|11', `${label}: stat numbers counted up to ${counts.join(', ')}`);
  ok(errors.length === 0, `${label}: no JS errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  ok(missing.length === 0, `${label}: no 4xx/5xx responses${missing.length ? ': ' + missing.join(', ') : ''}`);
  await pg.close();
}

// Service page: the split image and the difference list are present and visible.
{
  const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const missing = []; pg.on('response', (r) => { if (r.status() >= 400) missing.push(r.url()); });
  await pg.goto(BASE + '/services/commercial-wraps/', { waitUntil: 'load' });
  await pg.waitForTimeout(2000);
  const fig = pg.locator('.split-img').first();
  const top = await fig.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await pg.evaluate((y) => window.scrollTo(0, y - 140), top); await pg.waitForTimeout(1400);
  const loaded = await fig.evaluate((el) => { const im = el.querySelector('img'); return im.complete && im.naturalWidth === 1280 && im.naturalHeight === 640; });
  const cap = await fig.evaluate((el) => el.querySelector('figcaption')?.textContent || '');
  await pg.screenshot({ path: path.join(QA, 'desktop-service-split.png') });
  ok(loaded, 'service page: before/after image loaded at 1280x640');
  ok(/AI-generated illustration/.test(cap), `service page: caption says it is an illustration ("${cap}")`);
  ok(missing.length === 0, `service page: no 4xx/5xx responses${missing.length ? ': ' + missing.join(', ') : ''}`);
  await pg.close();
}

// Screen recording: a real wheel scroll through the hero, stat band, the
// quote block and the three before/after cards, so the motion can be judged by eye.
{
  const size = { width: 1440, height: 900 };
  const vdir = path.join(QA, 'video-tmp'); mkdirSync(vdir, { recursive: true });
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: vdir, size } });
  const pg = await ctx.newPage();
  await pg.goto(BASE + '/', { waitUntil: 'load' });
  await pg.waitForTimeout(2200);
  await pg.mouse.move(720, 450);
  const trioTop = await pg.evaluate(() => document.querySelector('.split-img').closest('section').getBoundingClientRect().top + window.scrollY);
  const legs = [[trioTop - 500, 120, 28], [900, 34, 34]];
  for (const [dist, step, wait] of legs) {
    for (let y = 0; y < dist; y += step) { await pg.mouse.wheel(0, step); await pg.waitForTimeout(wait); }
    await pg.waitForTimeout(900);
  }
  await pg.close(); await ctx.close();
  const webm = readdirSync(vdir).find((f) => f.endsWith('.webm'));
  if (webm) {
    const src = path.join(vdir, webm); const outWebm = path.join(QA, 'scroll.webm'); const outMp4 = path.join(QA, 'scroll.mp4');
    if (existsSync(outWebm)) unlinkSync(outWebm);
    renameSync(src, outWebm);
    try {
      execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', outWebm, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outMp4]);
      console.log('recording →', path.relative(ROOT, outMp4), Math.round(statSync(outMp4).size / 1024), 'KB');
    } catch (e) { console.log('mp4 conversion failed, webm kept:', e.message); }
  }
  ok(!!webm, 'screen recording written');
}

await browser.close(); server.close();
process.exit(fail ? 1 : 0);
