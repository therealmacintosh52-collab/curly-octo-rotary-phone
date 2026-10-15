#!/usr/bin/env node
// axe-core accessibility audit of every route, mobile + desktop, normal + reduced motion.
//   node scripts/axe.mjs [baseUrl=http://localhost:3000]
// Exit 1 if any serious/critical violation is found.
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.argv[2] || 'http://localhost:3000';
const routes = ['/', '/services', '/dealers', '/pricing', '/reviews', '/book', '/this-page-does-not-exist'];
const contexts = [
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' },
  { name: 'mobile-reduced', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' },
];

const browser = await chromium.launch();
let serious = 0;
for (const c of contexts) {
  const { name, ...opts } = c;
  const ctx = await browser.newContext(opts);
  for (const r of routes) {
    const page = await ctx.newPage();
    await page.goto(base + r, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    // expose the full page (hero beats are revealed by scroll) before auditing
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    serious += bad.length;
    const line = res.violations.map((v) => `${v.impact}:${v.id}(${v.nodes.length})`).join(' ') || 'none';
    console.log(`${name.padEnd(15)} ${r.padEnd(26)} passes=${res.passes.length} violations: ${line}`);
    for (const v of bad) for (const n of v.nodes.slice(0, 3)) console.log('   ->', v.id, n.target.join(' '), n.failureSummary?.split('\n')[1]?.trim());
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`serious/critical violations: ${serious}`);
process.exit(serious ? 1 : 0);
