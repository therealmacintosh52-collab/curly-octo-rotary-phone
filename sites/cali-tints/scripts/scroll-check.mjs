/**
 * Scroll-behaviour check: the tint story sweeps the film on with scroll, the
 * sliders wipe and then obey a drag, the stat numbers count up. Screenshots and
 * a screen recording of a real scroll through the home page land in qa/.
 *
 *   node scripts/scroll-check.mjs            (after npm run build)
 *   qa/scroll.mp4 (+ .webm)  qa/<device>-story-<pct>.png  qa/desktop-slider-*.png
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
const readStory = (pg) => pg.evaluate(() => ({
  p: getComputedStyle(document.querySelector('[data-tint-story]')).getPropertyValue('--p').trim(),
  vlt: document.querySelector('[data-vlt]').textContent,
  bar: Math.round(document.querySelector('.story__bar i').getBoundingClientRect().width / document.querySelector('.story__bar').getBoundingClientRect().width * 100),
  on: [...document.querySelectorAll('[data-step]')].findIndex((li) => li.classList.contains('is-on')),
}));

for (const [label, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['iphone', { width: 390, height: 844 }, true]]) {
  const pg = await browser.newPage({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const errors = []; pg.on('pageerror', (e) => errors.push(e.message));
  await pg.goto(BASE + '/', { waitUntil: 'load' });
  await pg.waitForTimeout(2500); // gsap boots after load + idle
  const counts = await pg.evaluate(() => [...document.querySelectorAll('[data-count]')].map((el) => el.textContent));
  const storyTop = await pg.evaluate(() => document.querySelector('[data-tint-story]').getBoundingClientRect().top + window.scrollY);
  const readings = [];
  for (const frac of [0, 0.3, 0.6, 1.0]) {
    await pg.evaluate((y) => window.scrollTo(0, y), storyTop + frac * vp.height * 2);
    await pg.waitForTimeout(900);
    readings.push({ frac, ...(await readStory(pg)) });
    await pg.screenshot({ path: path.join(QA, `${label}-story-${Math.round(frac * 100)}.png`) });
  }
  console.log(label, 'story readings', JSON.stringify(readings));
  ok(Number(readings[0].p) < 0.05 && Number(readings.at(-1).p) > 0.98, `${label}: film sweeps ${readings[0].p} → ${readings.at(-1).p}`);
  ok(readings[0].vlt === '100' && readings.at(-1).vlt === '5', `${label}: readout ${readings[0].vlt}% → ${readings.at(-1).vlt}%`);
  ok(readings[0].bar === 0 && readings.at(-1).bar === 100, `${label}: bar ${readings[0].bar}% → ${readings.at(-1).bar}%`);
  ok(readings[0].on === 0 && readings[1].on === 0 && readings[2].on === 1 && readings.at(-1).on === 2, `${label}: steps light in order ${readings.map((r) => r.on).join('')}`);
  ok(counts.join('|') === '4.9|48|11', `${label}: stat numbers counted up to ${counts.join(', ')}`);
  ok(errors.length === 0, `${label}: no JS errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  await pg.close();
}

// Service page: slider wipes with scroll, then obeys a drag.
{
  const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await pg.goto(BASE + '/services/window-tinting/', { waitUntil: 'load' });
  await pg.waitForTimeout(2500);
  const fig = pg.locator('[data-compare]').first();
  const h = await fig.evaluate((el) => el.getBoundingClientRect().height);
  const top = await fig.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const pos = () => fig.evaluate((el) => el.style.getPropertyValue('--pos'));
  await pg.evaluate((y) => window.scrollTo(0, y - 900), top); await pg.waitForTimeout(600);
  const p0 = await pos();
  await pg.evaluate((y) => window.scrollTo(0, y - 560), top); await pg.waitForTimeout(900);
  const p1 = await pos();
  await pg.screenshot({ path: path.join(QA, 'desktop-slider-midwipe.png') });
  await pg.evaluate(([y, hh]) => window.scrollTo(0, y + hh / 2 - 300), [top, h]); await pg.waitForTimeout(900);
  const p2 = await pos();
  const hint = await fig.evaluate((el) => getComputedStyle(el.querySelector('.cmp__hint')).opacity);
  console.log('slider pos', p0, p1, p2);
  ok(parseFloat(p0) > parseFloat(p1) && parseFloat(p1) > parseFloat(p2), `slider wipes with scroll: ${p0} → ${p1} → ${p2}`);
  ok(parseFloat(p2) < 1, `wipe completes at the viewport middle: ${p2}`);
  ok(hint === '0', `scroll/drag cue fades once the wipe is done (opacity ${hint})`);
  await pg.evaluate((y) => window.scrollTo(0, y - 300), top); await pg.waitForTimeout(400);
  const range = fig.locator('[data-compare-range]');
  await range.focus(); await range.press('Home'); await pg.waitForTimeout(200);
  const pHome = await pos();
  await range.press('End'); await pg.waitForTimeout(200);
  const pEnd = await pos();
  ok(pHome === '0%' && pEnd === '100%', `handle obeys the keyboard: ${pHome} / ${pEnd}`);
  await pg.evaluate((y) => window.scrollTo(0, y + 300), top); await pg.waitForTimeout(800);
  const pAfter = await pos();
  ok(pAfter === '100%', `scroll no longer moves a handle the visitor touched: ${pAfter}`);
  await pg.evaluate((y) => window.scrollTo(0, y - 200), top); await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(QA, 'desktop-slider-difference.png') });
  await pg.close();
}

// Screen recording: a real wheel scroll through the hero, stat band, story and
// the three home sliders, so the motion can be judged by eye.
{
  const size = { width: 1440, height: 900 };
  const vdir = path.join(QA, 'video-tmp'); mkdirSync(vdir, { recursive: true });
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: vdir, size } });
  const pg = await ctx.newPage();
  await pg.goto(BASE + '/', { waitUntil: 'load' });
  await pg.waitForTimeout(2200);
  await pg.mouse.move(720, 450);
  const trioTop = await pg.evaluate(() => [...document.querySelectorAll('[data-compare]')][0].closest('section').getBoundingClientRect().top + window.scrollY);
  const storyEnd = await pg.evaluate(() => document.querySelector('[data-tint-story]').getBoundingClientRect().top + window.scrollY) + 900 * 2;
  // hero → story (fast), story (slow, the whole pin), story → sliders (medium), sliders (slow)
  const legs = [[Math.min(storyEnd, 1800), 120, 28], [900 * 2, 42, 34], [trioTop - storyEnd - 1800, 140, 28], [1100, 34, 34]];
  for (const [dist, step, wait] of legs) {
    for (let y = 0; y < dist; y += step) { await pg.mouse.wheel(0, step); await pg.waitForTimeout(wait); }
    await pg.waitForTimeout(700);
  }
  // then a drag on the first slider
  const box = await pg.locator('[data-compare]').first().locator('.cmp__stage').boundingBox();
  if (box) {
    const y = box.y + box.height / 2;
    await pg.mouse.move(box.x + box.width * 0.05, y); await pg.mouse.down();
    for (let i = 1; i <= 24; i++) { await pg.mouse.move(box.x + box.width * (0.05 + 0.9 * i / 24), y); await pg.waitForTimeout(30); }
    for (let i = 24; i >= 10; i--) { await pg.mouse.move(box.x + box.width * (0.05 + 0.9 * i / 24), y); await pg.waitForTimeout(30); }
    await pg.mouse.up();
  }
  await pg.waitForTimeout(900);
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
