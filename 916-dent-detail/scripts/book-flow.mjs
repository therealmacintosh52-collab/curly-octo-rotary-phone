#!/usr/bin/env node
// Walks the whole /book flow in MOCK mode on a phone viewport, taking a screenshot per step, running axe on
// each step, and finishing with the reschedule/cancel page.
//   node scripts/book-flow.mjs [baseUrl=http://localhost:3000] [outDir=./.shots/book]
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] || 'http://localhost:3000';
const out = process.argv[3] || '.shots/book';
mkdirSync(out, { recursive: true });
const fixtures = join(tmpdir(), 'd916-fixtures');
mkdirSync(fixtures, { recursive: true });
const imgs = [];
for (const [i, c] of [[1, '#6b7280'], [2, '#374151']]) {
  const p = join(fixtures, `dent-${i}.jpg`);
  writeFileSync(p, await sharp({ create: { width: 2400, height: 1800, channels: 3, background: c } }).jpeg({ quality: 80 }).toBuffer());
  imgs.push(p);
}

const problems = [];
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log('  FAIL:', msg); } else console.log('  ok:', msg); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

async function shot(name) { await page.waitForTimeout(500); await page.screenshot({ path: join(out, `${name}.png`), fullPage: true }); }
async function axe(name) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  check(bad.length === 0, `axe ${name}: ${bad.map((v) => `${v.id}(${v.nodes.length})`).join(', ') || 'no serious/critical'}`);
}

console.log('# step 1 services');
await page.goto(`${base}/book`, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' });
await shot('01-services-empty');
check(await page.getByRole('button', { name: 'Continue' }).isDisabled(), 'Continue disabled with nothing selected');
await page.getByLabel(/Dent Removal/).check();
await page.getByLabel(/Interior Reset/).check();
await page.getByLabel(/Heavy pet-hair/).check();
await shot('01-services');
await axe('services');
await page.getByRole('button', { name: 'Continue' }).click();

console.log('# step 2 vehicle');
await page.getByLabel('Year', { exact: true }).waitFor();
await page.getByRole('button', { name: 'Continue' }).click(); // empty -> errors
check(await page.getByText(/Enter a 4-digit year/).isVisible(), 'vehicle validation message shown');
await page.getByLabel('Year', { exact: true }).fill('2021');
await page.getByLabel('Make', { exact: true }).fill('Toyota');
await page.getByLabel('Model', { exact: true }).fill('RAV4');
await page.getByLabel(/SUV \/ Crossover/).check();
await shot('02-vehicle');
await axe('vehicle');
await page.getByRole('button', { name: 'Continue' }).click();

console.log('# step 3 photos (required for dents)');
await page.locator('#photo-input').waitFor({ state: 'attached' });
check(await page.getByRole('button', { name: 'Continue' }).isDisabled(), 'Continue blocked until 2 dent photos added');
await shot('03-photos-empty');
await page.locator('#photo-input').setInputFiles(imgs);
await page.getByText(/DEMO estimate/).waitFor({ timeout: 20000 });
check(await page.getByText('Estimate — final price confirmed on inspection.').first().isVisible(), 'estimate label visible');
await shot('03-photos-estimate');
await axe('photos');
await page.getByRole('button', { name: 'Continue' }).click();

console.log('# step 4 area');
await page.getByLabel('ZIP code', { exact: true }).fill('90210');
await page.getByRole('button', { name: 'Check my area' }).click();
await page.getByText(/service map|outside/).first().waitFor();
check(await page.getByRole('button', { name: 'Continue' }).isDisabled(), 'unknown ZIP cannot continue (needs review)');
await shot('04-area-unknown');
await page.getByLabel('ZIP code', { exact: true }).fill('95757');
await page.getByRole('button', { name: 'Check my area' }).click();
await page.getByText('We come to Elk Grove. No travel fee.').waitFor();
await shot('04-area-ok');
await axe('area');
await page.getByRole('button', { name: 'Continue' }).click();

console.log('# step 5 time');
await page.getByRole('group', { name: 'Choose a day' }).waitFor({ timeout: 15000 });
await shot('05-time-empty');
const firstTime = page.locator('[aria-labelledby="times-h"] button').first();
await firstTime.waitFor();
await firstTime.click();
check(await firstTime.getAttribute('aria-pressed') === 'true', 'time slot selected (aria-pressed)');
await shot('05-time');
await axe('time');
await page.getByRole('button', { name: 'Continue' }).click();

console.log('# step 6 contact');
await page.getByLabel('Full name', { exact: true }).fill('Sam Rivera');
await page.getByLabel('Mobile number', { exact: true }).fill('(916) 555-0142');
await page.getByLabel('Email', { exact: true }).fill('sam@example.com');
await page.getByLabel(/Street address/).fill('123 Main St');
check(await page.getByLabel(/Text me about my appointment/).isChecked() === false, 'SMS consent is unchecked by default');
await page.getByLabel(/Text me about my appointment/).check();
await shot('06-contact');
await axe('contact');
await page.getByRole('button', { name: 'Reserve my time' }).click();

console.log('# step 7 deposit');
await page.getByText('DEMO MODE: no card is charged').waitFor({ timeout: 15000 });
await shot('07-deposit');
await axe('deposit');
// back keeps state
await page.getByRole('button', { name: 'Back' }).click();
check(await page.getByLabel('Full name', { exact: true }).inputValue() === 'Sam Rivera', 'Back keeps contact details');
await page.getByRole('button', { name: 'Reserve my time' }).click();
await page.getByText('DEMO MODE: no card is charged').waitFor();
await page.getByRole('button', { name: /Confirm demo deposit/ }).click();

console.log('# step 8 confirmation');
await page.getByRole('heading', { name: "You're booked" }).waitFor({ timeout: 15000 });
await shot('08-confirmation');
await axe('confirmation');
const manage = await page.getByRole('link', { name: 'Change or cancel' }).getAttribute('href');
check(Boolean(manage?.startsWith('/booking/')), 'manage link present');
const events = await page.evaluate(() => (window.dataLayer || []).map((e) => e.event));
check(['booking_started', 'quote_requested', 'booking_completed'].every((e) => events.includes(e)), `track() events fired: ${[...new Set(events)].join(', ')}`);
await page.reload({ waitUntil: 'networkidle' });
check(await page.getByLabel(/Dent Removal/).isChecked() === false, 'draft cleared after booking');

console.log('# manage page');
await page.goto(`${base}${manage}`, { waitUntil: 'networkidle' });
await shot('09-manage');
await axe('manage');
await page.getByRole('button', { name: 'Reschedule' }).click();
await page.getByRole('group', { name: /Times on/ }).waitFor({ timeout: 8000 }).catch(async (e) => { await shot('debug-reschedule'); throw e; });
await shot('10-reschedule');
await page.getByRole('group', { name: /Times on/ }).locator('button').nth(2).click({ force: true });
await page.getByRole('button', { name: 'Confirm new time' }).evaluate((el) => el.click()); // smooth-scroll lib (Lenis) can make Playwright's hit-test flaky
await page.getByText(/Rescheduled to/).waitFor();
await shot('11-rescheduled');
await page.getByRole('button', { name: 'Cancel booking' }).evaluate((el) => el.click());
await shot('12-cancel-confirm');
await page.getByRole('button', { name: 'Yes, cancel' }).evaluate((el) => el.click());
await page.getByText(/Cancelled\./).first().waitFor();
await shot('13-cancelled');

console.log('# keyboard: tab order on step 1');
await page.goto(`${base}/book`, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' });
await page.getByLabel(/Paint Deep-Clean/).focus();
await page.keyboard.press('Space');
check(await page.getByLabel(/Paint Deep-Clean/).isChecked(), 'Space toggles a service checkbox');
await page.keyboard.press('Tab'); await page.keyboard.press('Tab');

check(errors.filter((e) => !/Failed to load resource.*(400|404)|favicon/i.test(e)).length === 0, `no console/page errors (${errors.slice(0, 3).join(' | ') || 'none'})`);
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll checks passed');
process.exit(problems.length ? 1 : 0);
