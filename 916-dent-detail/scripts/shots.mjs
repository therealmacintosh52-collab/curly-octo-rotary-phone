#!/usr/bin/env node
// Visual check: screenshots of the hero at scrub progress 0/35/70/100% and of each home section,
// for mobile (390x844) and desktop (1440x900).
//   node scripts/shots.mjs [baseUrl=http://localhost:3000] [outDir=./.shots] [--reduced]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const reduced = process.argv.includes('--reduced');
const base = args[0] || 'http://localhost:3000';
const out = args[1] || '.shots';
mkdirSync(out, { recursive: true });

const viewports = { mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, desktop: { width: 1440, height: 900, deviceScaleFactor: 1 } };
const browser = await chromium.launch();
for (const [name, vp] of Object.entries(viewports)) {
  const { width, height, ...rest } = vp;
  const ctx = await browser.newContext({ viewport: { width, height }, ...rest, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  await page.goto(base, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);
  const track = await page.evaluate(() => {
    const t = document.querySelector('[data-hero-track]');
    return t ? { top: t.getBoundingClientRect().top + scrollY, h: t.offsetHeight, vh: innerHeight } : null;
  });
  const tag = reduced ? `${name}-reduced` : name;
  for (const p of [0, 0.35, 0.7, 1]) {
    const y = Math.round(track.top + p * (track.h - track.vh));
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: join(out, `${tag}-hero-${Math.round(p * 100)}.png`) });
  }
  const ids = await page.evaluate(() => [...document.querySelectorAll('main section[id]')].map((s) => s.id).filter((id) => id !== 'top'));
  for (const id of ids) {
    await page.evaluate((i) => { const el = document.getElementById(i); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 40); }, id);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: join(out, `${tag}-sec-${id}.png`) });
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(out, `${tag}-footer.png`) });
  console.log(tag, 'sections:', ids.join(','), 'errors:', errors.length ? errors : 'none');
  await ctx.close();
}
await browser.close();
