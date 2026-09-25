/** Verifies the hero autoplay path and the Low Power Mode fallback against dist/. */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, process.argv[2] || 'dist');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2','.webm':'video/webm','.mp4':'video/mp4'};
const server=createServer((req,res)=>{const u=decodeURIComponent((req.url||'/').split('?')[0]);let f=path.join(DIST,u);if(u.endsWith('/'))f=path.join(f,'index.html');if(!existsSync(f)||statSync(f).isDirectory()){res.writeHead(404);res.end();return;}const buf=readFileSync(f);const type=MIME[path.extname(f)]||'application/octet-stream';const range=req.headers.range;if(range){const m=/bytes=(\d*)-(\d*)/.exec(range);const start=m[1]?+m[1]:0;const end=m[2]?+m[2]:buf.length-1;res.writeHead(206,{'Content-Type':type,'Content-Range':`bytes ${start}-${end}/${buf.length}`,'Accept-Ranges':'bytes','Content-Length':end-start+1});res.end(buf.subarray(start,end+1));return;}res.writeHead(200,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Length':buf.length});res.end(buf);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${server.address().port}`;
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let fail = 0;
for (const [label, args, expect] of [
  ['default policy', [], 'is-playing'],
  ['autoplay refused (Low Power Mode simulated: play() rejects)', ['--autoplay-policy=user-gesture-required'], 'needs-tap'],
]) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', ...args] });
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; pg.on('pageerror', (e) => errors.push(e.message));
  // Chrome always allows MUTED autoplay whatever the policy flag says, so the
  // refusal iOS Low Power Mode produces has to be simulated at the API: play()
  // rejecting with NotAllowedError, exactly as Safari does.
  if (expect === 'needs-tap') await pg.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('play() refused', 'NotAllowedError')); };
  });
  await pg.goto(BASE + '/', { waitUntil: 'load' });
  await pg.waitForTimeout(3500);
  const st = await pg.evaluate(() => { const h = document.querySelector('.hero-v'); const v = document.querySelector('[data-hero-video]'); const tap = document.querySelector('[data-hero-tap]');
    return { cls: h.className, ready: v?.readyState, src: v?.currentSrc?.split('/').pop(), paused: v?.paused, tapShown: tap ? getComputedStyle(tap).display !== 'none' : null }; });
  const ok = st.cls.includes(expect) && (expect === 'is-playing' ? st.ready === 4 && !st.paused && !st.tapShown : st.tapShown && st.paused);
  console.log(`${ok ? '✓' : '✗'} ${label}: classes="${st.cls}" readyState=${st.ready} src=${st.src} paused=${st.paused} tapShown=${st.tapShown}${errors.length ? ' JS errors: ' + errors.join('; ') : ''}`);
  if (!ok) fail++;
  await browser.close();
}
server.close(); process.exit(fail ? 1 : 0);
