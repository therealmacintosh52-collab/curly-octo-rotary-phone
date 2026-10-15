#!/usr/bin/env node
// Walks the 916 Concierge widget in MOCK mode on a phone viewport: lazy loading, open, chat, photo upload, quote card,
// slots, phone verification, booking hold + deposit card, reload persistence, Escape/focus return, reduced motion, axe.
//   node scripts/concierge-flow.mjs [baseUrl=http://localhost:3000] [outDir=./.shots/concierge]
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] || 'http://localhost:3000';
const out = process.argv[3] || '.shots/concierge';
mkdirSync(out, { recursive: true });
const fixtures = join(tmpdir(), 'd916-concierge-fixtures');
mkdirSync(fixtures, { recursive: true });
const imgs = [];
for (const [i, c] of [[1, '#6b7280'], [2, '#374151']]) {
  const p = join(fixtures, `dent-${i}.jpg`);
  writeFileSync(p, await sharp({ create: { width: 2000, height: 1500, channels: 3, background: c } }).jpeg({ quality: 80 }).toBuffer());
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
const scripts = new Set();
page.on('request', (r) => { if (r.resourceType() === 'script') scripts.add(r.url()); });

async function shot(name) { await page.waitForTimeout(400); await page.screenshot({ path: join(out, `${name}.png`) }); }
async function axe(name, include) {
  let b = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
  if (include) b = b.include(include);
  const r = await b.analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  check(bad.length === 0, `axe ${name}: ${bad.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes[0]?.html.slice(0, 90)}`).join(' | ') || 'no serious/critical'}`);
  const minor = r.violations.filter((v) => !(v.impact === 'serious' || v.impact === 'critical'));
  if (minor.length) console.log('  note: minor axe', minor.map((v) => `${v.id}(${v.impact})`).join(', '));
}
const send = async (text) => {
  await page.getByLabel('Message the 916 Concierge').fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.waitForFunction(() => !document.querySelector('[role="log"] [class*="animate-pulse"]') && document.querySelectorAll('[role="log"] p').length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(500);
};
const lastReply = async () => (await page.locator('[role="log"] > div').last().innerText()).trim();

console.log('# home: launcher present, chat code NOT loaded yet');
await page.goto(base, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' });
const launcher = page.getByRole('button', { name: 'Chat with the 916 Concierge' });
check(await launcher.isVisible(), 'launcher is visible');
const box = await launcher.boundingBox();
check(!!box && box.y + box.height < 844 - 60 && box.x + box.width <= 390, `launcher sits above the sticky CTA bar (y=${Math.round(box?.y ?? 0)}..${Math.round((box?.y ?? 0) + (box?.height ?? 0))})`);
const before = scripts.size;
await shot('01-home-launcher');
check(!(await page.locator('#cc-title').count()), 'chat panel is not in the DOM before interaction');

console.log('# open: lazy chunk loads on click, dialog is accessible');
await launcher.click();
await page.getByRole('dialog', { name: '916 Concierge' }).waitFor();
check(scripts.size > before, `chat chunk fetched on interaction (${scripts.size - before} new script(s))`);
check(await page.getByLabel('Message the 916 Concierge').evaluate((el) => el === document.activeElement), 'input is focused on open');
check((await page.getByRole('dialog').getAttribute('aria-modal')) === 'true', 'aria-modal=true');
await shot('02-open');
await axe('dialog open');

console.log('# chat: dent without photos -> asks for photos, no price');
await send('Hi, I have a door ding on my 2020 Tacoma');
let r = await lastReply();
check(/photo/i.test(r) && !/\$\d/.test(r), `asks for photos, no dollar amount: "${r.slice(0, 110)}"`);
await shot('03-asks-photos');

console.log('# photo upload -> quote card with the estimate label');
await page.locator('input[type=file]').setInputFiles(imgs);
await page.waitForFunction(() => document.querySelectorAll('ul[aria-label="Photos to send"] img').length === 2, null, { timeout: 15000 });
check((await page.locator('ul[aria-label="Photos to send"] img').count()) === 2, 'two photo thumbnails queued');
await page.waitForFunction(() => ![...document.querySelectorAll('ul[aria-label="Photos to send"] li span[role=status]')].length, null, { timeout: 15000 });
await shot('04-photos-queued');
await page.getByRole('button', { name: 'Send message' }).click();
await page.waitForSelector('[role="group"][aria-label="Estimate"]', { timeout: 15000 });
r = await page.locator('[role="log"]').innerText();
check(/Estimate — final price confirmed on inspection\./.test(r), 'estimate label is shown with the range');
check((await page.locator('[role="log"] img[alt^="Photo 1"]').count()) === 1, 'sent photos shown in the transcript');
await page.waitForTimeout(600);
await shot('05-quote-card');

console.log('# zip -> real slots as chips');
await send('my zip is 95624');
await page.waitForSelector('[role="group"][aria-label="Open times"] button', { timeout: 15000 });
const slotCount = await page.locator('[role="group"][aria-label="Open times"] button').count();
check(slotCount >= 2, `${slotCount} real time chips offered`);
await shot('06-slots');
await page.locator('[role="group"][aria-label="Open times"] button').first().click();
await page.waitForTimeout(1500);

console.log('# booking details -> unverified phone -> verification form -> hold + deposit card');
await send('Name: Sam Lee, email: sam@example.com, address: 12 Oak St Elk Grove, car: 2020 Toyota Tacoma');
await page.waitForSelector('#cc-verify-phone', { timeout: 15000 });
check(true, 'verify-phone form appears (booking needs a verified phone)');
await shot('07-verify');
await axe('verify form');
await page.fill('#cc-verify-phone', '(916) 555-0142');
await page.getByRole('button', { name: 'Text me a code' }).click();
await page.waitForSelector('#cc-verify-code');
const hint = await page.locator('label[for=cc-verify-code]').innerText();
check(/424242/.test(hint), 'demo mode shows the mock code hint');
await page.fill('#cc-verify-code', '424242');
await page.getByRole('button', { name: 'Verify', exact: true }).click();
await page.waitForSelector('[data-concierge-deposit]', { timeout: 20000 });
const pay = page.locator('[data-concierge-deposit]');
const href = await pay.getAttribute('href');
check(/\/booking\/[\w-]+\.[\w-]+$/.test(href ?? ''), `deposit card links to the signed booking page (${(href ?? '').slice(0, 40)}...)`);
r = await page.locator('[role="log"]').innerText();
check(/time held for 15 minutes/i.test(r) && /locked in once the deposit/i.test(r), 'hold card + honest "locked in once the deposit goes through" wording');
check(!/\/booking\/[\w-]+\.[\w-]+/.test(await page.locator('[role="log"] p').last().innerText()), 'no raw signed URL in the chat bubble (the card carries the link)');
check(!/you'?re booked/i.test(r), 'bot never says "you\'re booked" before payment');
await page.waitForTimeout(600);
await shot('08-booking-card');
const pp = await ctx.newPage();
await pp.goto(base + new URL(href).pathname, { waitUntil: 'networkidle' });
check(/deposit|50/i.test(await pp.locator('body').innerText()), 'deposit link opens the real booking page');
await pp.screenshot({ path: join(out, '08b-booking-page.png') });
await pp.close();
await axe('booking card');

console.log('# persistence: reload restores the conversation');
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Chat with the 916 Concierge' }).click();
await page.getByRole('dialog').waitFor();
await page.waitForFunction(() => document.querySelectorAll('[role="log"] p').length > 3, null, { timeout: 10000 });
r = await page.locator('[role="log"]').innerText();
check(/door ding/.test(r), 'earlier messages restored after reload');
await shot('09-restored');

console.log('# keyboard: Tab stays inside, Escape closes and returns focus');
for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
check(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'focus stays inside the dialog after 25 Tabs');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check((await page.locator('#cc-title').count()) === 0, 'Escape closes the dialog');
check(await page.evaluate(() => document.activeElement?.hasAttribute('data-concierge-launcher')), 'focus returns to the launcher');

console.log('# reduced motion + page behind does not scroll while open');
const rm = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const p2 = await rm.newPage();
await p2.goto(base, { waitUntil: 'networkidle' });
await p2.getByRole('button', { name: 'Chat with the 916 Concierge' }).click();
await p2.getByRole('dialog').waitFor();
const anims = await p2.evaluate(() => [...document.querySelectorAll('[role=dialog] *')].filter((el) => getComputedStyle(el).animationName !== 'none').length);
check(anims === 0, `no running animations with prefers-reduced-motion (${anims})`);
check((await p2.evaluate(() => getComputedStyle(document.documentElement).overflow)) === 'hidden', 'page behind the dialog is locked');
await rm.close();

console.log('# desktop layout');
const dk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const p3 = await dk.newPage();
await p3.goto(base, { waitUntil: 'networkidle' });
await p3.getByRole('button', { name: 'Chat with the 916 Concierge' }).click();
await p3.getByRole('dialog').waitFor();
await p3.waitForTimeout(400);
await p3.screenshot({ path: join(out, '10-desktop-open.png') });
const dbox = await p3.getByRole('dialog').boundingBox();
check(!!dbox && dbox.width <= 400 && dbox.x + dbox.width <= 1280, `desktop panel is a compact bottom-right card (${Math.round(dbox?.width ?? 0)}px wide)`);
await dk.close();

check(errors.filter((e) => !/favicon|Failed to load resource.*(404|401)/.test(e)).length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
if (problems.length) { console.log(`\n${problems.length} problem(s)`); process.exit(1); }
console.log('\nAll checks passed');
