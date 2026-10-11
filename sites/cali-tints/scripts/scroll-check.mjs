/** Scroll-behaviour check: the tint story darkens with scroll, sliders wipe and drag. Screenshots -> qa/. */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
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
  await pg.goto(BASE + '/', { waitUntil: 'load' });
  await pg.waitForTimeout(2500); // gsap boots after load + idle
  const storyTop = await pg.evaluate(() => document.querySelector('[data-tint-story]').getBoundingClientRect().top + window.scrollY);
  const readings = [];
  for (const frac of [0, 0.3, 0.6, 1.0]) {
    await pg.evaluate((y) => window.scrollTo(0, y), storyTop + frac * vp.height * 1.6);
    await pg.waitForTimeout(900);
    const r = await pg.evaluate(() => ({ tint: getComputedStyle(document.querySelector('.story__car')).getPropertyValue('--tint').trim(), vlt: document.querySelector('[data-vlt]').textContent, on: [...document.querySelectorAll('[data-step]')].findIndex((li) => li.classList.contains('is-on')) }));
    readings.push({ frac, ...r });
    await pg.screenshot({ path: path.join(QA, `${label}-story-${Math.round(frac * 100)}.png`) });
  }
  console.log(label, 'story readings', JSON.stringify(readings));
  ok(Number(readings[0].tint) < 0.2 && Number(readings.at(-1).tint) > 0.85, `${label}: tint scrubs ${readings[0].tint} → ${readings.at(-1).tint}`);
  ok(readings[0].vlt === '100' && readings.at(-1).vlt === '5', `${label}: readout ${readings[0].vlt}% → ${readings.at(-1).vlt}%`);
  ok(errors.length === 0, `${label}: no JS errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  await pg.close();
}

// Service page: slider wipes with scroll, then obeys a drag.
const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto(BASE + '/services/window-tinting/', { waitUntil: 'load' });
await pg.waitForTimeout(2500);
const fig = pg.locator('[data-compare]').first();
const top = await fig.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
await pg.evaluate((y) => window.scrollTo(0, y - 800), top); await pg.waitForTimeout(600);
const p0 = await fig.evaluate((el) => el.style.getPropertyValue('--pos'));
await pg.evaluate((y) => window.scrollTo(0, y - 300), top); await pg.waitForTimeout(900);
const p1 = await fig.evaluate((el) => el.style.getPropertyValue('--pos'));
await pg.screenshot({ path: path.join(QA, 'desktop-slider-midwipe.png') });
await pg.evaluate((y) => window.scrollTo(0, y + 200), top); await pg.waitForTimeout(900);
const p2 = await fig.evaluate((el) => el.style.getPropertyValue('--pos'));
console.log('slider pos', p0, p1, p2);
ok(parseFloat(p0) > parseFloat(p2), `slider wipes with scroll: ${p0} → ${p2}`);
// drag: set the range via keyboard
await pg.evaluate((y) => window.scrollTo(0, y - 300), top); await pg.waitForTimeout(400);
const range = fig.locator('[data-compare-range]');
await range.focus(); await range.press('Home'); await pg.waitForTimeout(200);
const pHome = await fig.evaluate((el) => el.style.getPropertyValue('--pos'));
await range.press('End'); await pg.waitForTimeout(200);
const pEnd = await fig.evaluate((el) => el.style.getPropertyValue('--pos'));
ok(pHome === '0%' && pEnd === '100%', `handle obeys the keyboard: ${pHome} / ${pEnd}`);
await pg.evaluate((y) => window.scrollTo(0, y + 300), top); await pg.waitForTimeout(800);
const pAfter = await fig.evaluate((el) => el.style.getPropertyValue('--pos'));
ok(pAfter === '100%', `scroll no longer moves a handle the visitor touched: ${pAfter}`);
await pg.evaluate((y) => window.scrollTo(0, y - 200), top); await pg.waitForTimeout(500);
await pg.screenshot({ path: path.join(QA, 'desktop-slider-difference.png') });
await pg.close();
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
