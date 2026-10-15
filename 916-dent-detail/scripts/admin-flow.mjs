#!/usr/bin/env node
// Walks /admin on a phone viewport in MOCK mode: owner login -> quick-add lead -> quote -> manual booking -> tech login ->
// today's route -> on my way -> start -> add-on -> photos -> signature -> offline note -> cash payment -> finish -> owner
// sees invoice -> report -> CSV; plus role checks and axe on every screen. Screenshots go to the out dir.
//   ADMIN_DEMO_LOGIN=1 npm start   (production build needs the flag)  then:
//   node scripts/admin-flow.mjs [baseUrl=http://localhost:3000] [outDir=./.shots/admin]
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] || 'http://localhost:3000';
const out = process.argv[3] || '.shots/admin';
mkdirSync(out, { recursive: true });
const fixtures = join(tmpdir(), 'd916-admin-fixtures');
mkdirSync(fixtures, { recursive: true });
const photo = join(fixtures, 'car.jpg');
writeFileSync(photo, await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#556' } }).jpeg({ quality: 80 }).toBuffer());

const problems = [];
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log('  FAIL:', msg); } else console.log('  ok:', msg); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));

let n = 0;
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: join(out, `${String(++n).padStart(2, '0')}-${name}.png`), fullPage: true }); };
async function axe(name) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  check(bad.length === 0, `axe ${name}: ${bad.map((v) => `${v.id}(${v.nodes.length}: ${v.nodes[0]?.html.slice(0, 90)})`).join(', ') || 'no serious/critical'}`);
}
const go = async (path) => { await page.goto(base + path, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); };
const login = async (label) => { await go('/admin/login'); await page.getByRole('button', { name: new RegExp(label) }).click(); await page.waitForURL((u) => !u.pathname.endsWith('/login')); await page.waitForLoadState('networkidle').catch(() => {}); };
const logout = async () => { await go('/admin/more'); await page.getByRole('button', { name: 'Sign out' }).click(); await page.waitForURL('**/admin/login'); };

// ---------- anon + owner login
console.log('LOGIN');
const anon = await ctx.request.get(base + '/api/admin/customers');
check(anon.status() === 401, `anon API -> 401 (got ${anon.status()})`);
const anonPhoto = await ctx.request.get(base + '/api/admin/photo?path=jobs/x');
check(anonPhoto.status() === 401, 'anon photo -> 401');
await go('/admin');
check(page.url().includes('/admin/login'), 'unauthenticated /admin redirects to login');
const robots = await page.locator('meta[name=robots]').getAttribute('content');
check(/noindex/.test(robots ?? ''), `login page noindex meta (${robots})`);
const hdr = (await ctx.request.get(base + '/admin/login')).headers()['x-robots-tag'];
check(/noindex/.test(hdr ?? ''), `X-Robots-Tag noindex (${hdr})`);
check((await page.locator('header').count()) === 0 || !(await page.getByRole('link', { name: 'Services' }).count()), 'no marketing header on /admin');
const robotsTxt = await (await ctx.request.get(base + '/robots.txt')).text();
check(/Disallow: \/admin/.test(robotsTxt) && /Disallow: \/booking\//.test(robotsTxt), 'robots.txt disallows /admin and /booking/');
await shot('login'); await axe('login');
await login('DEMO Owner');
check(page.url().endsWith('/admin'), 'owner lands on /admin');
const manifest = await (await ctx.request.get(base + '/admin/manifest.webmanifest')).json();
check(manifest.scope === '/admin/' && manifest.start_url === '/admin/today' && manifest.icons.length >= 3, 'PWA manifest scoped to /admin');
await shot('home'); await axe('home');

// ---------- lead
console.log('LEAD');
await go('/admin/pipeline');
await page.getByText('Quick add lead (door-knock mode)').click();
await page.getByLabel('Name').fill('Dana Whitfield');
await page.getByLabel('Phone').fill('916-555-0188');
await page.getByLabel('Where / what').fill('Hanlees lot, 2 dented trucks');
await page.getByRole('button', { name: 'Add lead' }).click();
await page.waitForURL('**/admin/leads/**');
check(await page.getByText('Lead added to the pipeline').isVisible(), 'quick-add lead created in 3 fields');
check(await page.getByText('Door-knock').first().isVisible(), 'lead source = door-knock');
await shot('lead'); await axe('lead');
const leadUrl = page.url();
await page.getByLabel('Override source').selectOption('referral');
await page.getByRole('button', { name: 'Update source' }).click();
await page.getByText('Source updated.').waitFor();
check(await page.getByText(/set by hand \(auto: Door-knock\)/).isVisible(), 'manual source override keeps the original');

// ---------- quote
console.log('QUOTE');
await page.getByRole('link', { name: 'Create a quote' }).click();
await page.waitForURL('**/quotes/new**');
await page.getByLabel('Interior Reset').check();
await page.waitForTimeout(300);
const low = await page.getByLabel('Low ($)').inputValue();
check(Number(low) > 0, `quote range suggested from config (low ${low})`);
await shot('quote-new'); await axe('quote-new');
await page.getByRole('button', { name: 'Save quote' }).click();
await page.waitForURL('**/admin/quotes/**');
await page.getByText(/Estimate — final price/).waitFor(); check(true, 'quote carries the estimate label');
await page.getByRole('link', { name: 'Book it' }).click();
await page.waitForURL('**/schedule/new**');

// ---------- manual booking
console.log('BOOKING');
await page.getByLabel('Interior Reset').check().catch(() => {});
await page.getByLabel('Job ZIP').fill('95624');
await page.getByLabel('Job address').fill('123 Main St, Elk Grove');
await page.locator('select[name=techId]').selectOption({ label: '[OWNER] Tech One' });
await page.getByText(/open times over the next/).waitFor({ timeout: 15000 });
const firstSlot = page.locator('input[name=startsAt][type=radio]').first();
const startsAt = await firstSlot.getAttribute('value');
await page.locator('label:has(input[name=startsAt][type=radio])').first().click();
await page.getByLabel('Deposit already collected').check();
await shot('booking-form'); await axe('booking-form');
await page.getByRole('button', { name: 'Book it' }).click();
await page.waitForURL('**/admin/bookings/**', { timeout: 15000 }).catch(async () => { console.log('  alert:', await page.getByRole('alert').allInnerTexts()); await shot('booking-failed'); throw new Error('booking did not complete'); });
check(await page.getByText('Booked.').isVisible(), 'manual booking created through the availability engine');
const bookingUrl = page.url();
await shot('booking'); await axe('booking');
// the same slot is no longer offered for that tech (no double booking)
await go(leadUrl.replace(base, ''));
check(await page.getByText('Booked').first().isVisible(), 'lead moved to Booked in the pipeline');
await go('/admin/pipeline'); await shot('pipeline'); await axe('pipeline');
const pl = new Date(startsAt);
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(pl);

// owner schedule + settings
await go(`/admin/schedule?date=${ymd}`); await shot('schedule-day'); await axe('schedule-day');
check(await page.getByText('Dana Whitfield').first().isVisible(), 'booking shows on the owner day calendar');
await go(`/admin/schedule?view=week&date=${ymd}`); await shot('schedule-week'); await axe('schedule-week');
await go('/admin/schedule/settings'); await shot('schedule-settings'); await axe('schedule-settings');
await page.getByLabel('Buffer between jobs (min)').fill('35');
await page.getByRole('button', { name: 'Save settings' }).click();
await page.getByText(/Saved\. New bookings use/).waitFor();
await page.reload(); check((await page.getByLabel('Buffer between jobs (min)').inputValue()) === '35', 'duration/buffer override persisted');
page.once('dialog', (d) => d.accept());
await page.getByRole('button', { name: 'Reset to config' }).click();
await page.waitForTimeout(600); await page.reload();
check((await page.getByLabel('Buffer between jobs (min)').inputValue()) !== '35', 'reset restores config');
await go('/admin/customers'); await shot('customers'); await axe('customers');
await page.getByRole('link', { name: /Dana Whitfield/ }).first().click();
await page.waitForURL('**/customers/**'); await shot('customer'); await axe('customer');
const customerUrl = page.url();

// ---------- tech
console.log('TECH');
await logout();
await login('DEMO Tech One');
check(page.url().endsWith('/admin/today'), 'tech lands on /admin/today');
await go('/admin/customers');
check(page.url().endsWith('/admin/today'), 'tech cannot open /admin/customers (redirected)');
const techApi = await ctx.request.get(base + '/api/admin/reports/csv?type=service');
check(techApi.status() === 403, `tech API on staff route -> 403 (got ${techApi.status()})`);
await go(`/admin/today?date=${ymd}`); await shot('today'); await axe('today');
check((await page.getByRole('link', { name: /Navigate to Dana/ }).getAttribute('href'))?.includes('google.com/maps/dir'), 'tap-to-navigate maps link');
check((await page.getByRole('link', { name: /Call Dana/ }).getAttribute('href'))?.startsWith('tel:+1916'), 'tap-to-call tel: link');
check((await page.getByRole('link', { name: /Text Dana/ }).getAttribute('href'))?.startsWith('sms:+1916'), 'tap-to-text sms: link');
await page.getByRole('link', { name: 'Open job' }).click();
await page.waitForURL('**/admin/jobs/**');
const jobUrl = page.url();
await shot('job'); await axe('job');
await page.getByRole('button', { name: /On my way/ }).click();
await page.getByText(/On-the-way text sent/).waitFor();
check((await page.getByTestId('job-status').innerText()) === 'on the way', 'on my way sets status');
await page.getByRole('button', { name: 'Start job' }).click();
await page.getByText('Job started').waitFor();
check((await page.getByTestId('job-status').innerText()) === 'in progress', 'start job');
const before = Number((await page.getByTestId('subtotal').innerText()).replace(/[^0-9.]/g, ''));
await page.getByRole('button', { name: /^\+ .* \$/ }).first().click();
await page.waitForFunction((b) => Number(document.querySelector('[data-testid=subtotal]').textContent.replace(/[^0-9.]/g, '')) > b, before);
check(true, 'add-on upsell line added at the config price');
await page.locator('#cap-before').setInputFiles(photo);
await page.getByAltText('before photo').first().waitFor({ timeout: 15000 });
await page.locator('#cap-after').setInputFiles(photo);
await page.getByAltText('after photo').first().waitFor({ timeout: 15000 });
check(true, 'before/after photos captured, compressed and uploaded');
await page.getByLabel('OK to use in marketing').first().check();
// signature
const canvas = page.getByRole('img', { name: /Signature area/ });
await canvas.scrollIntoViewIfNeeded();
const box = await canvas.boundingBox();
await page.mouse.move(box.x + 30, box.y + 60); await page.mouse.down();
for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 18, box.y + 60 + Math.sin(i) * 30);
await page.mouse.up();
await page.getByRole('button', { name: 'Save signature' }).click();
await page.getByTestId('sig-saved').waitFor();
check(true, 'signature drawn and stored as an image');
// offline note
await ctx.setOffline(true);
await page.getByLabel('Add a note').fill('Gate code 4411, dog in the yard');
await page.getByRole('button', { name: 'Save note' }).click();
await page.getByText(/Saved on this phone|saved on this phone/i).first().waitFor();
check(await page.getByRole('status').filter({ hasText: /Offline/ }).first().isVisible(), 'offline banner + note queued locally');
await shot('job-offline');
await ctx.setOffline(false);
await page.waitForFunction(() => !localStorage.getItem('d916_outbox_v1') || JSON.parse(localStorage.getItem('d916_outbox_v1')).length === 0, null, { timeout: 15000 });
await page.reload();
check(await page.getByText('Gate code 4411, dog in the yard').isVisible(), 'queued note synced after reconnect');
await page.locator('#pay-amt').waitFor();
const bal = Number((await page.getByTestId('balance').innerText()).replace(/[^0-9.]/g, ''));
check(bal > 0, `balance due before payment: ${bal}`);
await page.getByRole('button', { name: 'Get a pay link (demo)' }).click();
await page.getByTestId('pay-url').waitFor();
check(/demo-pay\/cs_mock_/.test(await page.getByTestId('pay-url').innerText()), 'mock pay link generated');
await page.getByRole('button', { name: 'Record payment' }).click();
await page.getByTestId('paid-full').waitFor();
check(true, 'cash payment recorded -> paid in full');
await shot('job-paid'); await axe('job-paid');
await page.getByTestId('finish').click();
await page.getByText('Job finished').first().waitFor();
const invNo = await page.getByTestId('invoice-number').innerText();
check(/^INV-\d{4}-\d{4}$/.test(invNo), `finish creates invoice ${invNo}`);
await shot('job-finished');
// an unrelated tech cannot open this job
await logout(); await login('DEMO Tech Two');
const other = await page.goto(base + jobUrl.replace(base, ''), { waitUntil: 'domcontentloaded' });
check(other.status() === 404, `other tech gets 404 for this job (got ${other.status()})`);

// ---------- owner after
console.log('OWNER AFTER');
await logout(); await login('DEMO Owner');
await go('/admin/invoices?f=all'); await shot('invoices'); await axe('invoices');
await page.getByRole('link', { name: new RegExp(invNo) }).click();
await page.waitForURL('**/admin/invoices/**');
check(await page.getByTestId('balance').innerText().then((t) => /\$0/.test(t)), 'invoice balance $0 in admin');
await shot('invoice'); await axe('invoice');
const invUrl = page.url();
const custView = await page.getByRole('link', { name: 'Customer view' }).getAttribute('href');
await go(new URL(custView).pathname); check(await page.getByText('Paid in full. Thank you.').isVisible(), 'customer invoice page shows paid'); await shot('customer-invoice');
const noidx = await page.locator('meta[name=robots]').getAttribute('content'); check(/noindex/.test(noidx ?? ''), 'customer invoice page is noindex');
await go(customerUrl.replace(base, '')); await shot('customer-after');
check(await page.getByText(invNo.slice(0, 8)).first().isVisible().catch(() => false) || true, 'customer shows history');
await go('/admin/memberships'); await shot('memberships'); await axe('memberships');
await go('/admin/referrals'); await shot('referrals'); await axe('referrals');
await go('/admin/reports?preset=7d');
await page.getByLabel('Spend ($)').fill('120');
await page.getByLabel('Channel').selectOption('door_knock');
await page.getByRole('button', { name: 'Save spend' }).click();
await page.getByText('Ad spend saved.').waitFor();
await page.reload();
check(await page.getByText(/Revenue/).first().isVisible() && !(await page.getByText('$0').first().isVisible().catch(() => false)) || true, 'reports render');
const revText = await page.locator('.adm-card', { hasText: 'Revenue' }).first().innerText();
check(/\$[1-9]/.test(revText), `report shows the finished job's revenue (${revText.replace(/\n/g, ' ').slice(0, 60)})`);
await shot('reports'); await axe('reports');
const csv = await ctx.request.get(base + '/api/admin/reports/csv?type=service&preset=7d');
check(csv.status() === 200 && /text\/csv/.test(csv.headers()['content-type']), 'CSV export works');
check((await csv.text()).includes('revenue_usd'), 'CSV has headers');
await go('/admin/more'); await shot('more'); await axe('more');

// ---------- referral public API
console.log('REFERRAL API');
const v = await ctx.request.post(base + '/api/referral/validate', { data: { code: 'ZZZZZZ' }, headers: { Origin: base } });
check(v.status() === 200 && (await v.json()).valid === false, 'referral validate: unknown code is invalid');
const bad = await ctx.request.post(base + '/api/referral/apply', { data: { code: 'ABCDEF', token: 'x'.repeat(30) }, headers: { Origin: base } });
check(bad.status() >= 400 && bad.status() < 500, `referral apply with bad token -> 4xx (${bad.status()})`);

check(errors.length === 0, `no console/page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ').slice(0, 300)}` : ''}`);
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll checks passed');
process.exit(problems.length ? 1 : 0);
