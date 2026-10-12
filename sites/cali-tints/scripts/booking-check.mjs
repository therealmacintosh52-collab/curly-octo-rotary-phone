/**
 * Booking + payments + CRM + assistant + widgets check (after npm run build).
 *
 * The static build is served with a stand-in for the Netlify functions
 * (in-memory leads, a fake Stripe checkout that bounces to /thank-you/), so
 * the whole customer path and the owner's board run end to end without
 * Netlify or Stripe:
 *   - open/closed pill carries a live state
 *   - /book/: calendar, slots, hidden fields, text / .ics fallbacks, prefill;
 *     the deposit choice appears when payments are on; submitting saves the
 *     lead and lands on the paid thank-you page
 *   - quote form saves a lead even with no inbox connected
 *   - /admin/: sign in, the two leads show, status changes stick, filters
 *   - service widgets update "Your pick" and the Book link
 *   - assistant: guided flow answers with book / call actions
 * Screenshots → qa/.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const _LOCAL_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.PW_CHROME || (existsSync(_LOCAL_CHROME) ? _LOCAL_CHROME : chromium.executablePath());
const DIST = path.join(ROOT, 'dist'); const QA = path.join(ROOT, 'qa'); mkdirSync(QA, { recursive: true });
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2','.webm':'video/webm','.mp4':'video/mp4'};
const ADMIN = 'shop-secret';
const leads = [];
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const readBody = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/.netlify/functions/')) {
    const fn = u.pathname.split('/').pop();
    const body = req.method === 'GET' ? {} : JSON.parse((await readBody(req)) || '{}');
    const owner = req.headers['x-admin-key'] === ADMIN;
    if (fn === 'chat') return send(res, 200, { ok: true, llm: false });
    if (fn === 'leads') {
      if (req.method === 'GET' && u.searchParams.get('ping')) return send(res, 200, { ok: true, crm: true, stripe: true });
      if (req.method === 'GET') return owner ? send(res, 200, { leads, summary: { new: leads.filter((l) => l.status === 'new').length, today: leads.length, week: leads.length, deposits_cents: 5000 } }) : send(res, 401, { error: 'unauthorized' });
      if (req.method === 'POST') { const l = { id: `l${leads.length + 1}`, created: new Date().toISOString(), status: 'new', quote_cents: 0, deposit: { status: 'none', amount_cents: 0 }, payments: [], notes: [], email: '', duration: '', ...body, note: body.message || body.note || '' }; leads.unshift(l); return send(res, 200, { ok: true, id: l.id }); }
      if (req.method === 'PATCH') { if (!owner) return send(res, 401, {}); const l = leads.find((x) => x.id === body.id); if (!l) return send(res, 404, {}); Object.assign(l, body.status ? { status: body.status } : {}, Number.isFinite(body.quote_cents) ? { quote_cents: body.quote_cents } : {}); if (body.note) l.notes.push({ when: new Date().toISOString(), text: body.note }); return send(res, 200, { ok: true, lead: l }); }
    }
    if (fn === 'checkout') {
      if (req.method === 'GET') return send(res, 200, { enabled: true, deposit_cents: 5000, currency: 'usd' });
      const l = leads.find((x) => x.id === body.lead_id); if (!l) return send(res, 404, { error: 'lead not found' });
      return send(res, 200, { url: `/thank-you/?paid=${body.kind}&lead=${l.id}`, amount_cents: 5000 });
    }
    return send(res, 404, { error: 'no such function' });
  }
  const p = decodeURIComponent(u.pathname); let f = path.join(DIST, p); if (p.endsWith('/')) f = path.join(f, 'index.html');
  if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const buf = readFileSync(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Content-Length': buf.length }); res.end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
let fail = 0;
const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); if (!c) fail++; };
const page = async (vp, mobile = false) => { const pg = await browser.newPage({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile }); pg.on('pageerror', (e) => { console.log('  pageerror:', e.message); fail++; }); return pg; };

// 1. Pill + booking flow + deposit checkout
{
  const pg = await page({ width: 1440, height: 900 });
  await pg.goto(BASE + '/book/', { waitUntil: 'load' }); await pg.waitForSelector('.cal__day'); await pg.waitForTimeout(700);
  const pill = await pg.evaluate(() => { const el = document.querySelector('.page-head [data-open-now]'); return { cls: el.className, label: el.querySelector('[data-open-label]').textContent }; });
  ok(/is-open|is-closed/.test(pill.cls) && /Open|Closed/.test(pill.label), `open-now pill is live: "${pill.label}"`);
  const days = await pg.locator('.cal__day:not(:disabled)').count();
  ok(days > 0, `calendar shows ${days} bookable days this month`);
  await pg.locator('.book__svc').first().click();
  let dayBtn = pg.locator('.cal__day:not(:disabled)').first();
  if (!(await dayBtn.count())) { await pg.locator('[data-cal-next]').click(); dayBtn = pg.locator('.cal__day:not(:disabled)').first(); }
  await dayBtn.click(); await pg.waitForTimeout(200);
  const slotsN = await pg.locator('.slot').count();
  ok(slotsN > 0, `start times offered: ${slotsN}`);
  await pg.locator('.slot').first().click(); await pg.waitForTimeout(200);
  const st = await pg.evaluate(() => ({
    service: document.querySelector('[data-f-service]').value, date: document.querySelector('[data-f-date]').value, time: document.querySelector('[data-f-time]').value,
    subject: document.querySelector('[data-f-subject]').value, gcal: document.querySelector('[data-f-gcal]').value, enabled: !document.querySelector('[data-submit]').disabled,
    sms: document.querySelector('[data-sms]').getAttribute('href'), ics: document.querySelector('[data-ics]').getAttribute('href'),
    pay: !document.querySelector('[data-pay]').hidden, depositText: document.querySelector('[data-pay-deposit]').textContent,
  }));
  ok(st.service === 'Window Tinting' && /\d{4}/.test(st.date) && /AM|PM/.test(st.time), `hidden fields: ${st.service} / ${st.date} / ${st.time}`);
  ok(st.enabled && /^Booking request:/.test(st.subject), `submit enabled, subject "${st.subject}"`);
  ok(st.gcal.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'), 'owner add-to-Google-Calendar link filled');
  ok(st.sms.startsWith('sms:+19167012005') && st.ics.startsWith('data:text/calendar'), 'text-the-shop and .ics fallbacks ready');
  ok(st.pay && /\$50/.test(st.depositText), `deposit choice shown with the service deposit: "${st.depositText}"`);
  await pg.fill('#bk-name', 'Ana Diaz'); await pg.fill('#bk-phone', '9165550100'); await pg.fill('#bk-vehicle', '2021 Tesla Model 3'); await pg.fill('#bk-note', '20% rear, ceramic');
  await pg.screenshot({ path: path.join(QA, 'desktop-book.png') });
  await pg.locator('[data-submit]').click();
  await pg.waitForURL(/thank-you\/\?paid=deposit/, { timeout: 8000 }).catch(() => {});
  ok(/thank-you\/\?paid=deposit&lead=l1/.test(pg.url()), `deposit checkout bounced to the thank-you page: ${pg.url().replace(BASE, '')}`);
  await pg.waitForTimeout(300);
  ok(/Deposit received/.test(await pg.locator('h1').textContent()), 'thank-you page shows the deposit state');
  ok(leads.length === 1 && leads[0].vehicle === '2021 Tesla Model 3' && leads[0].source === 'booking', `lead saved in the CRM with the vehicle (${leads[0]?.vehicle})`);
  await pg.goto(BASE + '/book/?service=ceramic-coating&note=2021%20Tesla%20Model%203', { waitUntil: 'load' }); await pg.waitForTimeout(500);
  const pre = await pg.evaluate(() => ({ svc: document.querySelector('input[name=svc]:checked')?.value, note: document.querySelector('[data-f-note]').value }));
  ok(pre.svc === 'ceramic-coating' && pre.note === '2021 Tesla Model 3', `prefill from the query string: ${pre.svc}, "${pre.note}"`);
  await pg.close();
}

// 2. Quote form → CRM even without an inbox
{
  const pg = await page({ width: 1440, height: 900 });
  await pg.goto(BASE + '/contact/', { waitUntil: 'load' }); await pg.waitForTimeout(500);
  const form = pg.locator('form[data-quote-form]').first();
  await form.locator('input[name=name]').fill('Ben Ortiz'); await form.locator('input[name=phone]').fill('9165550101'); await form.locator('input[name=vehicle]').fill('2018 F-150');
  await form.locator('button[type=submit]').click(); await pg.waitForTimeout(800);
  const msg = await form.locator('.form-status').textContent();
  ok(/your request is with the shop/.test(msg), `quote form saved to the CRM: "${msg.slice(0, 60)}…"`);
  ok(leads.length === 2 && leads[0].source === 'quote' && leads[0].name === 'Ben Ortiz', 'quote lead recorded');
  await pg.close();
}

// 3. Owner board
{
  const pg = await page({ width: 1440, height: 900 });
  await pg.goto(BASE + '/admin/', { waitUntil: 'load' }); await pg.waitForTimeout(600);
  await pg.fill('#crm-pw', 'wrong'); await pg.locator('[data-crm-login] button').click(); await pg.waitForTimeout(400);
  ok(/did not match/.test(await pg.locator('[data-crm-login] .form-status').textContent()), 'wrong password is refused');
  await pg.fill('#crm-pw', ADMIN); await pg.locator('[data-crm-login] button').click(); await pg.waitForTimeout(600);
  ok(!(await pg.locator('[data-crm-board]').isHidden()), 'board opens with the right password');
  const cards = await pg.locator('.lead').count();
  ok(cards === 2, `both leads on the board (${cards})`);
  ok((await pg.locator('.lead').first().textContent()).includes('Ben Ortiz'), 'newest lead first');
  await pg.locator('.lead').nth(1).locator('.lead__status').selectOption('confirmed'); await pg.waitForTimeout(500);
  ok(leads.find((l) => l.name === 'Ana Diaz')?.status === 'confirmed', 'status change saved');
  await pg.locator('.lead').nth(1).locator('[data-quote]').fill('350'); await pg.locator('.lead').nth(1).locator('[data-act=quote]').click(); await pg.waitForTimeout(500);
  ok(leads.find((l) => l.name === 'Ana Diaz')?.quote_cents === 35000, 'quote saved as cents');
  ok(await pg.locator('.lead').nth(1).locator('[data-act=balance]').count() === 1, 'balance link button appears once a quote exists');
  await pg.locator('[data-filter=new]').click(); await pg.waitForTimeout(200);
  ok((await pg.locator('.lead').count()) === 1, 'status filter narrows the list');
  await pg.locator('[data-filter=open]').click(); await pg.waitForTimeout(200);
  await pg.screenshot({ path: path.join(QA, 'desktop-admin.png') });
  await pg.close();
}

// 4. Widgets
const widget = async (slug, act, expect) => {
  const pg = await page({ width: 1440, height: 900 });
  await pg.goto(`${BASE}/services/${slug}/`, { waitUntil: 'load' }); await pg.waitForSelector('[data-widget] [data-summary]'); await pg.waitForTimeout(500);
  await act(pg);
  await pg.waitForTimeout(150);
  const r = await pg.evaluate(() => ({ sum: document.querySelector('[data-widget] [data-summary]').textContent, href: document.querySelector('[data-widget] [data-book]').getAttribute('href') }));
  ok(expect.test(r.sum) && r.href.includes('note=') && r.href.includes(`service=${slug}`), `${slug} widget: "${r.sum}" → ${decodeURIComponent(r.href).slice(0, 80)}`);
  await pg.locator('[data-widget]').screenshot({ path: path.join(QA, `widget-${slug}.png`) });
  await pg.close();
};
await widget('window-tinting', async (pg) => { await pg.locator('[data-vlt]').fill('20'); await pg.locator('label:has(input[name=film][value=Carbon])').click(); }, /Carbon film, 20% on the rear/);
await widget('vinyl-wraps', async (pg) => { await pg.locator('label:has(input[name=col][value="Racing red"])').click(); await pg.locator('label:has(input[name=finish][value=Satin])').click(); }, /Full wrap: Racing red, satin/);
await widget('commercial-wraps', async (pg) => { await pg.locator('[data-van-in-name]').fill('Sunrise Plumbing'); await pg.locator('[data-van-count]').fill('3'); }, /3 vehicles lettered for Sunrise Plumbing/);
await widget('paint-protection-film', async (pg) => { await pg.locator('[data-zone-box=doors]').check({ force: true }); }, /Front package plus extras/);
await widget('ceramic-coating', async (pg) => { await pg.locator('[data-years]').fill('5'); }, /about 5 years/);
await widget('paint-correction', async (pg) => { await pg.locator('.iw__pick label').nth(1).click(); }, /Two-stage/);
await widget('detailing', async (pg) => { await pg.locator('[data-item]').nth(0).check({ force: true }); await pg.locator('[data-item]').nth(2).check({ force: true }); }, /Exterior wash and decontamination, Shampoo seats/);
await widget('tint-removal-repair', async (pg) => { await pg.locator('[data-symptom="0"]').click(); }, /Purple or faded/);

// 5. Assistant (guided flow; the stub endpoint reports llm:false)
{
  const pg = await page({ width: 390, height: 844 }, true);
  await pg.goto(BASE + '/', { waitUntil: 'load' }); await pg.waitForTimeout(800);
  await pg.locator('[data-asst-open]').click(); await pg.waitForTimeout(400);
  ok(!(await pg.locator('#asst-panel').isHidden()), 'assistant panel opens');
  const first = await pg.locator('.asst__msg--assistant').first().textContent();
  ok(/Cali/.test(first), `opener: "${first.slice(0, 60)}…"`);
  await pg.locator('#asst-input').fill('I want my windows tinted'); await pg.locator('[data-asst-form] button').click(); await pg.waitForTimeout(600);
  await pg.locator('#asst-input').fill('2019 Honda Civic'); await pg.locator('[data-asst-form] button').click(); await pg.waitForTimeout(600);
  const msgs = await pg.locator('.asst__msg--assistant p').allTextContents();
  const actions = await pg.locator('.asst__actions a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  ok(/Window Tinting it is/.test(msgs[1] || ''), `service recognised: "${(msgs[1] || '').slice(0, 50)}…"`);
  ok(/Got it, 2019 Honda Civic/.test(msgs[2] || ''), `vehicle captured: "${(msgs[2] || '').slice(0, 50)}…"`);
  ok(actions.some((h) => h.startsWith('/book/?service=window-tinting') && h.includes('note=')), `book action carries the car: ${actions.join(' | ')}`);
  await pg.locator('#asst-input').fill('can I call?'); await pg.locator('[data-asst-form] button').click(); await pg.waitForTimeout(600);
  const last = (await pg.locator('.asst__msg--assistant p').allTextContents()).at(-1);
  ok(/open right now|Closed/.test(last), `call answer respects hours: "${last.slice(0, 70)}…"`);
  await pg.screenshot({ path: path.join(QA, 'iphone-assistant.png') });
  await pg.close();
}

// 6. Phone booking layout
{
  const pg = await page({ width: 390, height: 844 }, true);
  await pg.goto(BASE + '/book/', { waitUntil: 'load' }); await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(QA, 'iphone-book.png'), fullPage: false });
  const w = await pg.evaluate(() => document.documentElement.scrollWidth);
  ok(w <= 390, `booking page fits a phone (${w}px)`);
  await pg.close();
}

await browser.close(); server.close();
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
