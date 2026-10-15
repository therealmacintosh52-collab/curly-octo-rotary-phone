#!/usr/bin/env node
// Walks the whole dealer portal in MOCK mode: landing -> signup -> (owner) approval -> CSV bulk submit with error rows ->
// photo upload -> status changes -> add-on proposal + dealer approval -> statement PDF -> net-terms invoice -> paid.
// Runs on a phone viewport (390x844) with desktop spot checks, screenshots every step, runs axe on every dealer page.
//   (server)  ADMIN_DEMO_LOGIN=1 npx next start -p 3105        # production build, zero keys
//   node scripts/dealers-flow.mjs [baseUrl=http://localhost:3105] [outDir=./.shots/dealers]
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] || 'http://localhost:3105';
const out = process.argv[3] || '.shots/dealers';
mkdirSync(out, { recursive: true });
const fixtures = join(tmpdir(), 'd916-dealer-fixtures');
mkdirSync(fixtures, { recursive: true });
const photos = [];
for (const [i, c] of [[1, '#6b7280'], [2, '#374151'], [3, '#9ca3af']]) {
  const p = join(fixtures, `car-${i}.jpg`);
  writeFileSync(p, await sharp({ create: { width: 2400, height: 1800, channels: 3, background: c } }).jpeg({ quality: 80 }).toBuffer());
  photos.push(p);
}
// check-digit-valid VINs
const V = ['1HGCM82633A004352', '1M8GDM9AXKP042788', '11111111111111111'];
const BAD = '1HGCM82633A004353';
const stamp = Date.now().toString(36);
const S = (n) => `E2E-${stamp}-${n}`;

const problems = [];
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log('  FAIL:', msg); } else console.log('  ok:', msg); };
const ymNow = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit' }).format(new Date());

const browser = await chromium.launch();
const errors = [];
// a unique client IP per run keeps the per-IP rate limits (signup 5/h, sheet 6/h) from tripping on repeated runs
const fakeIp = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const newCtx = async (opts) => {
  const ctx = await browser.newContext({ ...opts, extraHTTPHeaders: { 'x-forwarded-for': fakeIp } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${page.url()} :: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of 40[134]/.test(m.text())) errors.push(`${page.url()} :: ${m.text()}`); });
  return { ctx, page };
};
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const desktop = { viewport: { width: 1440, height: 900 } };
const { page: dealer, ctx: dealerCtx } = await newCtx(phone);
const { page: owner } = await newCtx(phone);

async function shot(page, name, full = true) { await page.waitForTimeout(450); await page.screenshot({ path: join(out, `${name}.png`), fullPage: full }); }
async function axe(page, name) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  check(bad.length === 0, `axe ${name}: ${bad.map((v) => `${v.id}(${v.nodes.length}: ${v.nodes[0]?.target.join(' ')})`).join(', ') || 'no serious/critical'}`);
}
// admin pages keep a service worker / sync loop alive, so 'networkidle' never settles there
const go = async (page, path) => { await page.goto(base + path, { waitUntil: path.startsWith('/admin') ? 'load' : 'networkidle' }); if (path.startsWith('/admin')) await page.waitForTimeout(700); };

// ------------------------------------------------------------------ 1 landing
console.log('# landing');
await go(dealer, '/dealers');
await dealer.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await dealer.waitForTimeout(900); await dealer.evaluate(() => window.scrollTo(0, 0));
check((await dealer.title()) === 'Dealership Recon & Dent Repair Sacramento | 916 Dent & Detail', 'title follows SEO convention');
check((await dealer.locator('h1').count()) === 1, 'one h1');
check((await dealer.locator('#main').getByText('Request wholesale sheet').count()) >= 7, 'every rate row says "Request wholesale sheet" while placeholders');
check((await dealer.locator('#main').getByText('[OWNER] set wholesale rates').count()) === 1, 'visible [OWNER] marker for wholesale sheet');
check(!(await dealer.locator('main').innerText()).match(/\$\s?\d/), 'no dollar amount anywhere on the dealer landing page');
const ld = await dealer.$$eval('script[type="application/ld+json"]', (n) => n.map((x) => x.textContent));
check(ld.some((t) => t.includes('"FAQPage"')), 'FAQPage JSON-LD present');
check(ld.some((t) => t.includes('"BreadcrumbList"')), 'BreadcrumbList JSON-LD present');
check((await (await dealer.request.get(`${base}/sitemap.xml`)).text()).includes('/dealers/signup'), 'sitemap lists /dealers/signup');
await shot(dealer, '01-landing-mobile');
await axe(dealer, 'landing');
// wholesale sheet request -> lead
await dealer.getByLabel('Your name').first().fill('Sam Recon');
await dealer.getByLabel('Dealership or company').fill(`Sheet Test Motors ${stamp}`);
await dealer.locator('#sh-email').fill(`sam-${stamp}@example.com`);
await dealer.getByRole('button', { name: 'Request the wholesale sheet' }).last().click();
await dealer.locator('#main').getByText(/We will email you the wholesale sheet/).waitFor();
check(true, 'wholesale sheet request accepted (lead created)');
await shot(dealer, '02-sheet-requested', false);

// ------------------------------------------------------------------ 2 signup (pending)
console.log('# signup');
await go(dealer, '/dealers/signup');
await shot(dealer, '03-signup-empty');
await dealer.getByRole('button', { name: 'Create dealer account' }).click();
check(await dealer.locator('#businessName-err').isVisible(), 'signup validation shown');
await axe(dealer, 'signup (with errors)');
await dealer.getByLabel('Business name').fill(`E2E Motors ${stamp}`);
await dealer.getByLabel(/Dealer license number/).fill('');
await dealer.getByLabel('Your name').fill('Pat Manager');
await dealer.getByLabel('Phone').fill('916 555 0123');
await dealer.getByLabel('Your email').fill(`pat-${stamp}@e2e.example`);
await dealer.locator('#lot0').fill('1 Auto Mall Dr, Roseville, CA 95661');
await dealer.getByRole('button', { name: 'Add another lot' }).click();
await dealer.locator('#lot1').fill('2 Folsom Blvd, Folsom, CA 95630');
await dealer.getByLabel('Accounts payable email').fill(`ap-${stamp}@e2e.example`);
await dealer.getByLabel(/Expected vehicles per month/).fill('40');
await dealer.getByLabel('I would like net terms').check();
await shot(dealer, '04-signup-filled');
await dealer.getByRole('button', { name: 'Create dealer account' }).click();
await dealer.waitForURL('**/dealers/dashboard');
check(await dealer.locator('#main').getByText('Your account is waiting for approval').isVisible(), 'new account is pending');
await shot(dealer, '05-pending');
await axe(dealer, 'dashboard (pending)');
await go(dealer, '/dealers/dashboard/submit');
check(await dealer.locator('#main').getByText(/Submitting opens when your account is approved/).isVisible(), 'pending dealer cannot submit');
const blocked = await dealer.request.post(`${base}/api/dealers/vehicles`, { data: { csv: `vin\n${V[0]}` }, headers: { Origin: base } });
check(blocked.status() === 403, 'API refuses a pending dealer (403)');

// ------------------------------------------------------------------ 3 owner approval
console.log('# owner approval');
await go(owner, '/admin/login');
await owner.getByRole('button', { name: /DEMO Owner/ }).click();
await owner.waitForURL((u) => !u.pathname.endsWith('/login'));
await go(owner, '/admin/dealers');
check(await owner.getByText(`E2E Motors ${stamp}`).isVisible(), 'owner sees the pending dealer');
await shot(owner, '06-admin-dealers');
await axe(owner, 'admin/dealers');
await owner.getByRole('link', { name: new RegExp(`E2E Motors ${stamp}`) }).click();
await owner.getByRole('button', { name: 'Approve account' }).waitFor();
await shot(owner, '07-admin-dealer-pending');
await owner.getByLabel('Net terms').first().selectOption('30');
await owner.getByRole('button', { name: 'Approve account' }).click();
await owner.getByRole('button', { name: 'Pause account' }).waitFor(); // the approve form is replaced by the active-account controls
check(true, 'owner approved the dealer with Net 30');
const dealerUrl = owner.url();

// ------------------------------------------------------------------ 4 bulk submit with an error row
console.log('# bulk submit');
await go(dealer, '/dealers/dashboard/submit');
await dealer.getByRole('button', { name: 'Many vehicles (CSV)' }).click();
const csv = ['vin,stock_number,panels,services,notes',
  `${V[0]},${S(1)},2,dent;interior,Door ding left rear`,
  `${V[1]},${S(2)},,interior,`,
  `${V[0]},${S(3)},,,duplicate of line 2`,
  `${BAD},${S(4)},,,typo in VIN`,
  `${V[2]},${S(5)},,paint magic,`].join('\n');
await dealer.getByLabel('Or paste rows here').fill(csv);
await dealer.getByRole('button', { name: 'Check the file' }).click();
await dealer.locator('#main').getByText(/2 ready/).waitFor();
const pv = await dealer.locator('main').innerText();
check(/3 with errors/.test(pv), 'preview counts 2 ready and 3 with errors');
check(/Duplicate VIN/.test(pv) && /Check digit does not match/.test(pv) && /Unknown service: paint magic/.test(pv), 'per-row error report names each problem');
await shot(dealer, '08-bulk-preview');
await axe(dealer, 'submit (preview)');
await dealer.getByRole('button', { name: /Submit 2 vehicles/ }).click();
await dealer.getByRole('heading', { name: '2 vehicles submitted' }).waitFor();
check(true, '2 vehicles created, 3 rows rejected');
// batch photo upload on the first vehicle (multi-select)
const firstDrop = dealer.locator('input[type=file][accept="image/*"]').first();
await firstDrop.setInputFiles(photos);
await dealer.locator('#main').getByText('Added').first().waitFor({ timeout: 20000 });
await dealer.waitForFunction(() => document.querySelectorAll('.dl-thumb').length >= 3 && [...document.querySelectorAll('.dl-thumb span')].filter((s) => s.textContent === 'Added').length === 3, null, { timeout: 30000 });
check(true, '3 photos uploaded in one batch');
await shot(dealer, '09-bulk-submitted');
await axe(dealer, 'submit (result + photos)');
// single vehicle with VIN validation
await dealer.getByRole('button', { name: 'One vehicle' }).click();
await dealer.getByLabel(/^VIN/).fill(BAD);
check(await dealer.locator('#vin-err').isVisible(), 'single form flags a bad VIN as you type');
await dealer.getByLabel(/^VIN/).fill(V[2]);
check(await dealer.locator('#main').getByText(/VIN check digit is valid/).isVisible(), 'single form confirms a good VIN');
await dealer.getByLabel('Stock number').fill(S(5));
await dealer.getByLabel('Dent Removal (no paint, no body shop)').check();
await dealer.getByLabel('Damaged panels').fill('1');
await shot(dealer, '10-single-form');
await dealer.getByRole('button', { name: 'Submit vehicle' }).click();
await dealer.getByRole('heading', { name: '1 vehicle submitted' }).waitFor();
check(true, 'single vehicle submitted');

// ------------------------------------------------------------------ 5 list, search, board
console.log('# vehicles');
await go(dealer, '/dealers/dashboard/vehicles');
check((await dealer.locator('main a[href*="/vehicles/"]').count()) === 3, 'three vehicles listed');
await dealer.getByLabel(/Search by stock number/).fill(S(2));
await dealer.getByRole('button', { name: 'Search' }).click();
await dealer.waitForURL(/q=/);
check((await dealer.locator('main a[href*="/vehicles/"]').count()) === 1, 'search by stock number narrows to one');
await go(dealer, '/dealers/dashboard/vehicles?view=board');
await shot(dealer, '11-board-mobile');
await axe(dealer, 'vehicles (board)');

// ------------------------------------------------------------------ 6 owner works the cars
console.log('# owner status + pricing + add-on');
await go(owner, dealerUrl.replace(base, ''));
const card = (stock) => owner.locator('.adm-card', { hasText: `stock ${stock}` }).filter({ has: owner.getByText(/Price for this work/) }).first();
// (a status change re-renders the card with the next buttons, so wait for the next state instead of a "Saved." message)
await card(S(1)).getByLabel('Visit date').fill('2026-10-20');
await card(S(1)).getByRole('button', { name: 'Schedule' }).click();
await card(S(1)).getByRole('button', { name: /Mark in progress/i }).waitFor();
await card(S(1)).getByRole('button', { name: /Mark in progress/i }).click();
await card(S(1)).getByRole('button', { name: 'Mark frontline-ready' }).waitFor();
check(true, 'owner scheduled the first car and started it');
await card(S(1)).getByLabel(/Price for this work/).fill('300');
await card(S(1)).getByRole('button', { name: 'Save price' }).click();
await card(S(1)).getByText('Saved.').waitFor();
await card(S(1)).getByText('Propose an add-on').click();
await card(S(1)).getByLabel('What').fill('Additional panel: right fender');
await card(S(1)).getByLabel('Price (blank = draft)').fill('85');
await card(S(1)).getByRole('button', { name: 'Propose' }).click();
await card(S(1)).getByText(/Sent to the dealer for approval/).waitFor();
check(true, 'owner proposed a priced add-on');
await owner.reload({ waitUntil: 'load' }); await owner.waitForTimeout(600);
await shot(owner, '12-admin-vehicle-addon');
// second car straight through to done, priced
await card(S(2)).getByRole('button', { name: 'Schedule' }).click();
await card(S(2)).getByRole('button', { name: /Mark in progress/i }).waitFor();
await card(S(2)).getByRole('button', { name: /Mark in progress/i }).click();
await card(S(2)).getByRole('button', { name: 'Mark frontline-ready' }).waitFor();
await card(S(2)).getByRole('button', { name: 'Mark frontline-ready' }).click();
await card(S(2)).getByText('Frontline-ready', { exact: true }).waitFor();
await card(S(2)).getByLabel(/Price for this work/).fill('150.50');
await card(S(2)).getByRole('button', { name: 'Save price' }).click();
await card(S(2)).getByText('Saved.').waitFor();

// ------------------------------------------------------------------ 7 dealer approves the add-on, sees status
console.log('# dealer add-on + status');
await go(dealer, '/dealers/dashboard');
check(await dealer.locator('#main').getByText(/Needs your approval/).isVisible(), 'dashboard flags the add-on waiting for approval');
await shot(dealer, '13-dashboard-needs-approval');
await dealer.getByRole('link', { name: /Additional panel: right fender/ }).click();
await dealer.getByRole('button', { name: /Approve add-on/ }).waitFor();
check(await dealer.locator('#main').getByText('Waiting for your decision').isVisible(), 'detail shows the add-on waiting for a decision');
await shot(dealer, '14-vehicle-detail');
await axe(dealer, 'vehicle detail');
await dealer.getByRole('button', { name: /Approve add-on/ }).click();
// Scope to the add-on list: the layout's account badge also says "Approved", which made this wait pass even when the click was lost
// before hydration (the flaky run of P5; root cause in DECISIONS P9-003).
await dealer.locator('section[aria-labelledby="ad-h"]').getByText('Approved', { exact: true }).waitFor();
check(true, 'dealer approved the add-on');
check(await dealer.locator('.dl-step[data-state="now"]').innerText().then((t) => /In progress/.test(t)), 'stepper shows In progress');
await dealer.reload({ waitUntil: 'networkidle' });
const historyText = await dealer.locator('#au-h').locator('xpath=..').innerText();
check(/Add-on approved/.test(historyText) && /Status: In progress/.test(historyText), `audit trail lists the status change and the approval (${historyText.replace(/\s+/g, ' ').slice(0, 200)})`);
// owner finishes car 1
await go(owner, dealerUrl.replace(base, ''));
await card(S(1)).getByRole('button', { name: 'Mark frontline-ready' }).click();
await card(S(1)).getByText('Frontline-ready', { exact: true }).waitFor();
await go(dealer, '/dealers/dashboard/vehicles?status=done');
check((await dealer.locator('main a[href*="/vehicles/"]').count()) === 2, 'two cars are Frontline-ready');

// ------------------------------------------------------------------ 8 statement PDF + invoice
console.log('# billing');
await go(owner, dealerUrl.replace(base, ''));
await owner.locator('#gs-m').fill(ymNow);
await owner.getByRole('button', { name: 'Build statement' }).click();
await owner.getByText(/Statement created: 2 vehicle/).waitFor();
check(true, 'statement created for 2 priced vehicles (the third car is not finished yet)');
await owner.reload({ waitUntil: 'load' }); await owner.waitForTimeout(600);
owner.once('dialog', (d) => d.accept());
await owner.getByRole('button', { name: /Issue invoice \(Net 30\)/ }).click();
await owner.getByRole('button', { name: 'Mark paid' }).waitFor(); // the issue button is replaced by mark-paid / void once the invoice exists
check(true, 'net-30 invoice issued in mock mode');
await owner.reload({ waitUntil: 'load' }); await owner.waitForTimeout(600);
await shot(owner, '15-admin-billing');
await axe(owner, 'admin dealer detail');
await go(dealer, '/dealers/dashboard/billing');
const bill = await dealer.locator('main').innerText();
check(/\$535\.50/.test(bill), 'dealer sees balance $535.50 (300 + 85 + 150.50)');
check(/Net 30 \(approved\)/.test(bill), 'terms show Net 30 (approved)');
await shot(dealer, '16-billing');
await axe(dealer, 'billing');
const pdfHref = await dealer.locator('a[href$="/pdf"]').first().getAttribute('href');
const pdfRes = await dealerCtx.request.get(base + pdfHref);
const pdfBytes = await pdfRes.body();
check(pdfRes.status() === 200 && pdfBytes.subarray(0, 5).toString() === '%PDF-', 'statement PDF downloads (valid header)');
writeFileSync(join(out, 'statement.pdf'), pdfBytes);
const other = await (await browser.newContext()).request.get(base + pdfHref);
check(other.status() === 401, 'statement PDF refuses an anonymous request');
await dealer.getByRole('link', { name: /^INV-/ }).first().click();
await dealer.locator('#main').getByText('DEMO invoice.').waitFor();
await shot(dealer, '17-invoice-stub');
await axe(dealer, 'invoice');
// owner marks paid
await go(owner, dealerUrl.replace(base, ''));
await owner.getByRole('button', { name: 'Mark paid' }).click();
await owner.getByRole('button', { name: 'Mark paid' }).waitFor({ state: 'detached' });
await go(dealer, '/dealers/dashboard/billing');
check(/\$0\.00/.test(await dealer.locator('main').innerText()), 'balance is $0.00 after owner marks paid');

// ------------------------------------------------------------------ 9 desktop spot checks
console.log('# desktop');
const { page: d } = await newCtx(desktop);
await go(d, '/dealers'); await d.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await d.waitForTimeout(1200); await d.evaluate(() => window.scrollTo(0, 0));
await shot(d, '20-landing-desktop');
await axe(d, 'landing (desktop)');
await d.close();
const { page: dd } = await newCtx(desktop);
await dd.goto(`${base}/dealers/signin`, { waitUntil: 'networkidle' });
await shot(dd, '21-signin-desktop', false);
await axe(dd, 'signin');
check(await dd.getByRole('button', { name: 'Sign in as the demo dealer' }).isVisible(), 'demo sign-in is offered and labelled DEMO');
await dd.getByLabel('Email').fill(`pat-${stamp}@e2e.example`);
await dd.getByRole('button', { name: 'Sign in', exact: true }).click();
await dd.waitForURL('**/dealers/dashboard');
await shot(dd, '22-dashboard-desktop');
await dd.goto(`${base}/dealers/dashboard/vehicles?view=board`, { waitUntil: 'networkidle' });
await shot(dd, '23-board-desktop');
await dd.goto(`${base}/dealers/dashboard/submit`, { waitUntil: 'networkidle' });
await shot(dd, '24-submit-desktop');
await axe(dd, 'submit (desktop)');

check(errors.length === 0, `no console/page errors${errors.length ? `: ${errors.slice(0, 4).join(' | ')}` : ''}`);
await browser.close();
if (problems.length) { console.log(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('\nAll checks passed');
