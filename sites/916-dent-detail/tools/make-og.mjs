// Renders 1200x630 share images with Chromium + the site's own fonts. Usage: node make-og.mjs <jobs.json> <outDir>
// Needs playwright (resolved via NODE_PATH) and CHROME_PATH or a playwright-installed chromium.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3];
mkdirSync(out, { recursive: true });
const fonts = pathToFileURL(join(root, 'build', 'fonts')).href;
const logo = pathToFileURL(join(root, 'build', 'img', 'logo-transparent.png')).href;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const page = (t, sub) => `<!doctype html><meta charset=utf-8><style>
@font-face{font-family:M;src:url(${fonts}/michroma-400.woff2)}@font-face{font-family:I;src:url(${fonts}/inter-600.woff2);font-weight:600}
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;background:#0B0B0C;position:relative;overflow:hidden;color:#F3EEE3;font-family:I}
.glow{position:absolute;right:-120px;top:-60px;width:760px;height:760px;background:radial-gradient(circle,rgba(201,162,74,.28),rgba(201,162,74,0) 62%)}
.frame{position:absolute;inset:28px;border:1px solid rgba(201,162,74,.45)}
.logo{position:absolute;right:70px;top:110px;height:400px}
.k{position:absolute;left:84px;top:84px;font:600 20px I;letter-spacing:.16em;text-transform:uppercase;color:#C9A24A}
h1{position:absolute;left:84px;top:150px;width:640px;font:400 ${t.length > 34 ? 42 : 52}px/1.18 M}
.s{position:absolute;left:84px;bottom:84px;width:640px;font:600 22px/1.4 I;color:#8C8F96}
.rule{position:absolute;left:84px;bottom:150px;width:96px;height:2px;background:#C9A24A}
</style><div class=glow></div><div class=frame></div><img class=logo src="${logo}"><p class=k>916 Dent &amp; Detail</p><h1>${esc(t)}</h1><div class=rule></div><p class=s>${esc(sub)}</p>`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 } });
const p = await ctx.newPage();
for (const j of jobs) {
  const f = join(out, `_${j.slug}.html`);
  writeFileSync(f, page(j.title, j.sub));
  await p.goto(pathToFileURL(f).href);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(80);
  await p.screenshot({ path: join(out, `${j.slug}.raw.png`) });
}
await browser.close();
