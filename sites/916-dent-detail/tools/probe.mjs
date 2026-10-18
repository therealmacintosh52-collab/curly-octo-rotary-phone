// Computed-opacity probe: proves no text stays hidden with JS off, reduced motion, a blocked hero script, and after scrolling.
// node tools/probe.mjs <baseUrl>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2];
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const hidden = () => {
  const out = [];
  for (const el of document.querySelectorAll('main *, header *, footer *')) {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (el.closest('details:not([open]) > :not(summary)') || el.closest('.hp,.vh,.err,.ok,.summary,.menu:not([open]) nav,.nav-d .dd')) continue;
    let e = el, op = 1, vis = true;
    while (e && e !== document.documentElement) { const s = getComputedStyle(e); op *= +s.opacity; if (s.display === 'none') { op = 1; vis = true; break; } if (s.visibility === 'hidden') vis = false; e = e.parentElement; }
    if (op < 0.9 || !vis) out.push((el.className || el.tagName) + ' op=' + op.toFixed(2) + (vis ? '' : ' hidden'));
  }
  return out;
};
const cases = [
  ['JS off', { javaScriptEnabled: false }, async () => {}],
  ['reduced motion', { reducedMotion: 'reduce' }, async () => {}],
  ['JS on, loaded, scrolled to end of hero', {}, async (p) => { await p.evaluate(() => window.scrollTo(0, innerHeight * 3.6)); await p.waitForTimeout(900); }],
  ['hero.js blocked (observer/script failure), after 8s', {}, async (p) => { await p.waitForTimeout(8000); }, (p) => p.route(/hero\.[0-9a-f]+\.js/, (r) => r.abort())],
];
let bad = 0;
for (const [name, opts, act, pre] of cases) {
  for (const w of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, ...opts });
    const p = await ctx.newPage();
    if (pre) await pre(p);
    await p.goto(base + '/', { waitUntil: 'load' });
    await p.waitForTimeout(500);
    await act(p);
    const r = await p.evaluate(hidden);
    const canvas = await p.evaluate(() => !!document.querySelector('.hero-media canvas'));
    const img = await p.evaluate(() => { const i = document.querySelector('.hero-media img, .hero-media .ns'); return i ? (i.currentSrc || i.src).split('/').pop() : 'none'; });
    console.log(`${name} @${w}: hidden text elements: ${r.length}${r.length ? ' ' + JSON.stringify(r.slice(0, 5)) : ''}; canvas=${canvas}; hero image=${img}`);
    bad += r.length;
    await ctx.close();
  }
}
// lazy image loads on scroll
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto(base + '/', { waitUntil: 'load' });
await p.evaluate(() => document.querySelector('.gloss img').scrollIntoView());
await p.waitForTimeout(800);
console.log('gloss image decoded after scroll:', await p.evaluate(() => document.querySelector('.gloss img').naturalWidth > 0));
await browser.close();
console.log(bad ? 'HIDDEN CONTENT FOUND' : 'probe ok');
process.exit(bad ? 1 : 0);
