/** QA screenshots into qa/. Desktop 1440x900 + 1920x1080, iPhone 390x844, nav open. */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const QA = path.join(ROOT, 'qa');
mkdirSync(QA, { recursive: true });
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain','.webmanifest':'application/manifest+json','.mp4':'video/mp4'};
const server=createServer((req,res)=>{const u=decodeURIComponent((req.url||'/').split('?')[0]);let f=path.join(DIST,u);if(u.endsWith('/'))f=path.join(f,'index.html');if(!existsSync(f)||statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(readFileSync(f));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });

// --- desktop ---
for (const [w,h] of [[1440,900],[1920,1080]]) {
  const pg = await browser.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:1 });
  await pg.goto(BASE+'/', {waitUntil:'load'});
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(QA, `desktop-${w}x${h}-hero.png`) });
  await pg.close();
}
const full = await browser.newPage({ viewport:{width:1440,height:900} });
for (const p of ['/','/services/brake-repair/','/advice/check-engine-light/','/reviews/']) {
  await full.goto(BASE+p,{waitUntil:'load'});
  await full.evaluate(()=>document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager'));
  await full.evaluate(()=>Promise.all(Array.from(document.images).map(i=>i.complete?0:new Promise(r=>{i.onload=r;i.onerror=r}))));
  await full.waitForTimeout(700);
  const name=(p.replace(/^\/|\/$/g,'').replace(/\//g,'-')||'home');
  await full.screenshot({ path: path.join(QA, `desktop-full-${name}.png`), fullPage:true });
}
await full.close();

// --- iPhone 390x844 ---
const phone = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await phone.goto(BASE+'/',{waitUntil:'load'});
await phone.waitForTimeout(500);
await phone.screenshot({ path: path.join(QA,'iphone-390x844-hero.png') });
await phone.click('.nav-toggle');
await phone.waitForTimeout(400);
await phone.screenshot({ path: path.join(QA,'iphone-390x844-nav-open.png') });
const overflow = await phone.evaluate(()=>({s:document.documentElement.scrollWidth,c:document.documentElement.clientWidth}));
console.log(overflow.s>overflow.c+1 ? `  OVERFLOW ${overflow.s}>${overflow.c}` : '  ok no horizontal overflow at 390px');
await phone.close();

await browser.close(); server.close();
console.log('screenshots in qa/');
