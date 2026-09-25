/**
 * One OG image per page, rendered from the page's own H1 and eyebrow.
 *
 *   npm run build && npm run og
 *
 * Runs AFTER the build: it reads the built pages for their real headings, then
 * writes dist/assets/og/<slug>.jpg — the exact filenames Base.astro points
 * og:image at. Also writes assets/img/og-cover.jpg as the fallback.
 */
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'assets/og');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const S = JSON.parse(readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8')).site;
const LOGO = path.join(DIST, 'assets/img/logo.png');

if (!existsSync(DIST)) { console.error('Run npm run build first.'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = path.join(dir, e);
    if (statSync(f).isDirectory()) { if (e !== 'assets' && e !== 'static' && e !== 'fonts') walk(f, out); }
    else if (e === 'index.html') out.push(f);
  }
  return out;
}

const pages = walk(DIST).map((file) => {
  const html = readFileSync(file, 'utf8');
  const rel = '/' + path.relative(DIST, file).replace(/\\/g, '/').replace(/index\.html$/, '');
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1]
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
  const eyebrow = (html.match(/class="eyebrow"[^>]*>([\s\S]*?)<\/span>/) || [, ''])[1]
    .replace(/<[^>]+>/g, '').trim();
  const slug = rel === '/' ? 'home' : rel.replace(/^\/|\/$/g, '').replace(/\//g, '-');
  return { rel, slug, h1, eyebrow };
});

const tpl = ({ h1, eyebrow }) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
 *{box-sizing:border-box;margin:0}
 body{width:1200px;height:630px;overflow:hidden;position:relative;display:flex;
   flex-direction:column;justify-content:center;padding:0 80px;color:#fff;
   background:linear-gradient(158deg,#0b0f0b 0%,#1b241b 54%,#0d120d 100%);
   font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
 .glow{position:absolute;inset:0;
   background:radial-gradient(620px 340px at 86% 6%,rgba(128,216,80,.30),transparent 62%),
              radial-gradient(560px 320px at 4% 96%,rgba(42,122,26,.40),transparent 66%)}
 .grid{position:absolute;inset:0;opacity:.10;
   background-image:linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),
                    linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px);
   background-size:64px 64px;-webkit-mask-image:linear-gradient(115deg,#000 10%,transparent 70%)}
 .in{position:relative}
 .chip{background:#fff;border-radius:16px;padding:13px 20px;display:inline-block;margin-bottom:30px;
   box-shadow:0 18px 44px rgba(0,0,0,.34)}
 .chip img{height:88px;display:block}
 .eyebrow{display:block;font-size:19px;font-weight:800;letter-spacing:.17em;
   text-transform:uppercase;color:#9be86a;margin-bottom:16px}
 h1{font-size:${h1.length > 46 ? 52 : 62}px;line-height:1.05;letter-spacing:-.035em;
   font-weight:800;max-width:18ch}
 .meta{position:absolute;right:80px;bottom:58px;text-align:right}
 .meta b{display:block;font-size:34px;font-weight:800;letter-spacing:-.03em}
 .meta span{display:block;font-size:18px;color:#c9d3c5;margin-top:5px}
 .bar{position:absolute;left:0;right:0;bottom:0;height:10px;
   background:linear-gradient(90deg,#80d850 0%,#2a7a1a 60%,#686868 100%)}
</style></head><body>
 <div class="glow"></div><div class="grid"></div>
 <div class="in">
   <span class="chip"><img src="logo.png" alt=""></span>
   ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ''}
   <h1>${h1 || S.name}</h1>
 </div>
 <div class="meta"><b>${S.phone_display}</b><span>${S.street}, ${S.city}, ${S.region}</span></div>
 <div class="bar"></div>
</body></html>`;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
// 'load', not 'networkidle': the hero video streams continuously, so the
// network never goes idle and networkidle would hang or time out.
await page.goto(`file://${path.dirname(LOGO)}/`);

for (const p of pages) {
  await page.setContent(tpl(p), { waitUntil: 'load' });
  await page.screenshot({ path: path.join(OUT, `${p.slug}.jpg`), type: 'jpeg', quality: 84 });
}
await browser.close();

copyFileSync(path.join(OUT, 'home.jpg'), path.join(DIST, 'assets/img/og-cover.jpg'));
console.log(`Wrote ${pages.length} OG images to dist/assets/og/ (+ og-cover.jpg fallback)`);
