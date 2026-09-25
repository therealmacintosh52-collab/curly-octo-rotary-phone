import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
const DIST = path.resolve('dist');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2','.webm':'video/webm','.mp4':'video/mp4'};
const server=createServer((req,res)=>{const u=decodeURIComponent((req.url||'/').split('?')[0]);let f=path.join(DIST,u);if(u.endsWith('/'))f=path.join(f,'index.html');if(!existsSync(f)||statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(readFileSync(f));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
for (const p of ['/','/services/window-tinting/','/reviews/','/contact/']) {
  const pg = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  await pg.goto(BASE+p,{waitUntil:'load'}); await pg.waitForTimeout(400);
  const r = await pg.evaluate(()=>{const out=[];const W=document.documentElement.clientWidth;for(const el of document.querySelectorAll('body *')){const b=el.getBoundingClientRect();if(b.right>W+1&&b.width>0){out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(b.right)} w=${Math.round(b.width)} :: ${(el.textContent||'').trim().slice(0,50)}`);}}return {sw:document.documentElement.scrollWidth,W,out:out.slice(0,12)};});
  console.log(p, r.sw>r.W?'OVERFLOW':'ok', r.sw, r.W); r.out.forEach(x=>console.log('   ',x));
  await pg.close();
}
await browser.close(); server.close();
