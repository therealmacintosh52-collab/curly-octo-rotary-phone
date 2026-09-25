/* Renders one 1200x630 Open Graph image per page into public/assets/og/.
   Run before `astro build` (npm run og). Uses the Chromium that Playwright
   finds on this machine; on Netlify it is not run, the PNGs are committed.

   Pages come from the same data the site is built from, so a new service
   or guide gets an image the next time this runs. */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data = JSON.parse(readFileSync(path.join(root, 'src/data/site.json'), 'utf8'));
const extra = (await import(path.join(root, 'src/data/guides-v2.ts').replace(/\.ts$/, '.js')).catch(() => null))?.extraGuides
  ?? extractExtra(readFileSync(path.join(root, 'src/data/guides-v2.ts'), 'utf8'));

function extractExtra(src) {
  // pull slug/nav pairs out of the TS file without a TS toolchain
  const out = [];
  const re = /slug:\s*'([^']+)'[\s\S]*?nav:\s*'([^']+)'/g;
  let m; while ((m = re.exec(src))) out.push({ slug: m[1], nav: m[2] });
  return out;
}

const pages = [
  { key: 'home', eyebrow: 'Lodi, California', title: 'Honest auto, diesel & fleet repair' },
  { key: 'services', eyebrow: 'Services', title: 'Every service, one shop' },
  ...data.services.map((s) => ({ key: `services-${s.slug}`, eyebrow: 'Service · Lodi, CA', title: s.h1 })),
  { key: 'about', eyebrow: 'About', title: 'The shop that diagnoses before it quotes' },
  { key: 'reviews', eyebrow: `${data.site.rating} out of 5 · ${data.site.review_count} Google reviews`, title: 'What Lodi drivers say' },
  { key: 'contact', eyebrow: 'Contact', title: 'Call, visit or send the form' },
  { key: 'service-areas', eyebrow: 'Service areas', title: 'Serving Lodi and the towns around it' },
  { key: 'advice', eyebrow: 'Advice', title: 'Straight answers about your vehicle' },
  ...data.guides.map((g) => ({ key: `advice-${g.slug}`, eyebrow: 'Advice', title: g.nav })),
  ...extra.map((g) => ({ key: `advice-${g.slug}`, eyebrow: 'Advice', title: g.nav })),
  { key: 'es', eyebrow: 'Lodi, California', title: 'Taller mecánico honesto en Lodi' },
];

const font = (f) => readFileSync(path.join(root, 'public/fonts', f)).toString('base64');
const logo = readFileSync(path.join(root, 'public/assets/img/logo.png')).toString('base64');
const poster = readFileSync(path.join(root, 'public/assets/img/shop-bay-poster.jpg')).toString('base64');

const html = ({ eyebrow, title }) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:SG;src:url(data:font/woff2;base64,${font('space-grotesk-latin-wght-normal.woff2')}) format('woff2-variations');font-weight:300 700}
@font-face{font-family:IN;src:url(data:font/woff2;base64,${font('inter-latin-wght-normal.woff2')}) format('woff2-variations');font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;background:#0a0a1f;color:#fff;font-family:IN,sans-serif;position:relative}
.bg{position:absolute;inset:0;background:url(data:image/jpeg;base64,${poster}) center/cover;opacity:.32;filter:saturate(.8)}
.shade{position:absolute;inset:0;background:linear-gradient(100deg,#0a0a1f 0%,rgba(10,10,31,.86) 45%,rgba(10,10,31,.35) 100%)}
.wrap{position:relative;padding:64px 72px;height:100%;display:flex;flex-direction:column;justify-content:space-between}
.brand{display:flex;align-items:center;gap:18px}
.brand img{width:64px;height:64px;border-radius:50%;background:#fff;padding:4px}
.brand b{font-family:SG;font-size:28px;font-weight:700;letter-spacing:-.02em}
.brand span{display:block;font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:#a6a7c4;margin-top:4px}
.eyebrow{font-family:SG;font-weight:700;font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:#8b7dff;margin-bottom:18px}
h1{font-family:SG;font-weight:700;font-size:${title.length > 38 ? 58 : 70}px;line-height:1.02;letter-spacing:-.03em;max-width:980px}
.foot{display:flex;justify-content:space-between;align-items:flex-end;color:#c4d3e0;font-size:22px}
.foot b{color:#fff;font-family:SG}
.bar{position:absolute;left:0;right:0;bottom:0;height:10px;background:linear-gradient(90deg,#2f22e0,#6a5bff)}
</style></head><body><div class="bg"></div><div class="shade"></div>
<div class="wrap">
  <div class="brand"><img src="data:image/png;base64,${logo}"><div><b>Phil's Auto &amp; Fleet Repair</b><span>Lodi, California</span></div></div>
  <div><div class="eyebrow">${eyebrow}</div><h1>${title.replace(/&/g, '&amp;')}</h1></div>
  <div class="foot"><span><b>(209) 647-4953</b> · 103 E Elm St, Lodi</span><span>Mon–Sat 8–5 · philsautofleet.com</span></div>
</div><div class="bar"></div></body></html>`;

const outDir = path.join(root, 'public/assets/og');
mkdirSync(outDir, { recursive: true });
// PW_CHROME=/path/to/chrome lets a machine without Playwright's own browsers render these
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const p of pages) {
  await page.setContent(html(p), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, `${p.key}.jpg`), type: 'jpeg', quality: 84 });
}
await browser.close();
writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(pages.map((p) => p.key)));
console.log(`${pages.length} OG images written to public/assets/og/`);
