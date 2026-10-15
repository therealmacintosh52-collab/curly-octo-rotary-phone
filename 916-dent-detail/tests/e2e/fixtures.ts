import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rndOctet = () => Math.floor(Math.random() * 250) + 1;

/**
 * Every test gets its own client IP (x-forwarded-for) so the per-IP rate limits of the server under test
 * (quote, booking, chat, signup) are exercised by the test that means to, not tripped by test order.
 */
export const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => { await provide({ 'x-forwarded-for': `10.${rndOctet()}.${rndOctet()}.${rndOctet()}` }); },
});
export { expect };

/** Two real JPEGs the upload pipeline accepts (generated once into the OS temp dir). */
export async function photoFiles(n = 2): Promise<string[]> {
  const dir = join(tmpdir(), 'd916-e2e-fixtures');
  mkdirSync(dir, { recursive: true });
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const p = join(dir, `dent-${i}.jpg`);
    if (!existsSync(p)) writeFileSync(p, await sharp({ create: { width: 2000, height: 1500, channels: 3, background: ['#6b7280', '#374151', '#9ca3af'][i % 3]! } }).jpeg({ quality: 80 }).toBuffer());
    out.push(p);
  }
  return out;
}

/** Serious/critical axe violations on the current page (WCAG 2.0/2.1/2.2 A+AA + best practice). */
export async function axeSerious(page: Page, include?: string): Promise<string[]> {
  // @axe-core/playwright resolves its own playwright-core copy, so the Page types are structurally equal but nominally different
  let b = new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']);
  if (include) b = b.include(include);
  const r = await b.analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.impact}:${v.id} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(' ')} :: ${v.nodes[0]?.html.slice(0, 100)}`);
}

/** Collects page errors and console errors; ignore known-benign resource noise by pattern. */
export function watchErrors(page: Page, ignore: RegExp = /favicon/i): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !ignore.test(m.text())) errors.push(`console: ${m.text()}`); });
  return errors;
}

/** Scroll top to bottom so scroll-revealed sections and the hero beats are in the DOM/painted before auditing. */
export async function exposeFullPage(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}
