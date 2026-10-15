#!/usr/bin/env node
// Phase 6 visual + a11y QA: axe on one service, one city and one blog template, plus mobile + desktop screenshots.
//   node scripts/qa-seo.mjs [baseUrl=http://localhost:3000] [outDir=.shots/seo]
// Needs Playwright browsers (PLAYWRIGHT_BROWSERS_PATH). Exit 1 on serious/critical axe violations.
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3000';
const out = process.argv[3] || '.shots/seo';
mkdirSync(out, { recursive: true });
const routes = { service: '/services/paintless-dent-repair', city: '/areas/folsom', blog: '/blog/can-every-dent-be-fixed-without-paint', hub: '/services' };
const views = [
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
];
const browser = await chromium.launch();
let bad = 0;
for (const v of views) {
  const { name, ...opts } = v;
  const ctx = await browser.newContext(opts);
  for (const [label, path] of Object.entries(routes)) {
    const page = await ctx.newPage();
    await page.goto(base + path, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${label}-${name}.png`, fullPage: true });
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    const hard = res.violations.filter((x) => ['serious', 'critical'].includes(x.impact));
    bad += hard.length;
    console.log(`${name.padEnd(7)} ${path.padEnd(48)} violations: ${res.violations.length} (serious/critical ${hard.length})`);
    for (const x of res.violations) console.log(`   [${x.impact}] ${x.id}: ${x.nodes.length} node(s) e.g. ${x.nodes[0]?.target?.join(' ')}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) { console.log('   HORIZONTAL OVERFLOW'); bad++; }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
