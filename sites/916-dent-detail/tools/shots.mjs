// Screenshots + console/CSP error capture. node tools/shots.mjs <baseUrl> <outDir> [path,...] [--w=390,1280] [--js=off] [--reduced]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [base, out, list] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = Object.fromEntries(process.argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const widths = (opt.w || '390,1280').split(',').map(Number);
const paths = (list || '/').split(',');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 800 }, deviceScaleFactor: 1, javaScriptEnabled: opt.js !== 'off', reducedMotion: opt.reduced !== undefined ? 'reduce' : 'no-preference', isMobile: w < 600, hasTouch: w < 600 });
  for (const p of paths) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
    await page.goto(base + p, { waitUntil: 'load' });
    await page.waitForTimeout(opt.wait ? Number(opt.wait) : 1200);
    const name = (p.replace(/\W+/g, '_') || 'home') + '-' + w + (opt.js === 'off' ? '-nojs' : '') + (opt.reduced !== undefined ? '-rm' : '');
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: opt.full !== undefined });
    if (opt.scroll) {
      for (const f of opt.scroll.split(',')) {
        await page.evaluate((fr) => window.scrollTo(0, Number(fr) * innerHeight), f);
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${out}/${name}-s${f}.png` });
      }
    }
    console.log(name, errs.length ? '\n  ' + errs.join('\n  ') : 'no console errors');
    await page.close();
  }
  await ctx.close();
}
await browser.close();
