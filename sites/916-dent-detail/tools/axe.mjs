// axe-core on every page of a served build at 390 and 1280. node tools/axe.mjs <baseUrl> [path,path|all] ; needs axe-core + playwright on NODE_PATH
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSrc = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.argv[2];
let paths = (process.argv[3] || 'all');
if (paths === 'all') {
  const sm = await (await fetch(base + '/sitemap.xml')).text();
  paths = [...sm.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]).concat('/404.html');
} else paths = paths.split(',');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
let total = 0;
for (const w of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, bypassCSP: true });
  for (const p of paths) {
    const page = await ctx.newPage();
    await page.goto(base + p, { waitUntil: 'load' });
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
    await page.addScriptTag({ content: axeSrc });
    const r = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'], resultTypes: ['violations', 'incomplete'] }));
    const v = r.violations;
    total += v.length;
    console.log(`${w} ${p}: ${v.length} violations${r.incomplete.length ? ', ' + r.incomplete.length + ' incomplete (' + r.incomplete.map((i) => i.id).join(',') + ')' : ''}`);
    for (const x of v) console.log('   ', x.id, x.impact, x.nodes.length, x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | '), '::', x.help);
    if (process.env.DETAIL) for (const x of r.incomplete) console.log('   incomplete', x.id, x.nodes.slice(0, 6).map((n) => n.target.join(' ') + ' [' + (n.any[0]?.message || '').slice(0, 80) + ']').join('\n      '));
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log('TOTAL violations', total);
