/**
 * Booking + assistant + widgets check (after npm run build):
 *   - open/closed pill carries a live state
 *   - /book/: calendar draws, an open day and a start time can be picked, the
 *     hidden fields, text link and calendar file fill in, ?service=&note= prefill
 *   - service widgets: shade slider, colour picker, lettering, PPF zones,
 *     builder and symptoms all update "Your pick" and the Book link
 *   - assistant: opens, guided flow answers, book/call actions appear
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
const server=createServer((req,res)=>{const u=decodeURIComponent((req.url||'/').split('?')[0]);if(u.startsWith('/.netlify/functions/chat')){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true,"llm":false}');return;}let f=path.join(DIST,u);if(u.endsWith('/'))f=path.join(f,'index.html');if(!existsSync(f)||statSync(f).isDirectory()){res.writeHead(404);res.end();return;}const buf=readFileSync(f);res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Content-Length':buf.length});res.end(buf);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
let fail = 0;
const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); if (!c) fail++; };
const page = async (vp, mobile = false) => { const pg = await browser.newPage({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile }); pg.on('pageerror', (e) => { console.log('  pageerror:', e.message); fail++; }); return pg; };

// 1. Open/closed pill
{
  const pg = await page({ width: 1440, height: 900 });
  await pg.goto(BASE + '/book/', { waitUntil: 'load' }); await pg.waitForSelector('.cal__day'); await pg.waitForTimeout(600);
  const pill = await pg.evaluate(() => { const el = document.querySelector('.page-head [data-open-now]'); return { cls: el.className, label: el.querySelector('[data-open-label]').textContent }; });
  ok(/is-open|is-closed/.test(pill.cls) && /Open|Closed/.test(pill.label), `open-now pill is live: "${pill.label}"`);

  // 2. Booking flow
  const days = await pg.locator('.cal__day:not(:disabled)').count();
  ok(days > 0, `calendar shows ${days} bookable days this month`);
  await pg.locator('.book__svc').first().click();
  // first enabled day (this month, or flip to next)
  let dayBtn = pg.locator('.cal__day:not(:disabled)').first();
  if (!(await dayBtn.count())) { await pg.locator('[data-cal-next]').click(); dayBtn = pg.locator('.cal__day:not(:disabled)').first(); }
  await dayBtn.click(); await pg.waitForTimeout(200);
  const slotsN = await pg.locator('.slot').count();
  ok(slotsN > 0, `start times offered: ${slotsN}`);
  await pg.locator('.slot').first().click(); await pg.waitForTimeout(200);
  const st = await pg.evaluate(() => ({
    service: document.querySelector('[data-f-service]').value, date: document.querySelector('[data-f-date]').value, time: document.querySelector('[data-f-time]').value,
    subject: document.querySelector('[data-f-subject]').value, gcal: document.querySelector('[data-f-gcal]').value, enabled: !document.querySelector('[data-submit]').disabled,
    sms: document.querySelector('[data-sms]').getAttribute('href'), ics: document.querySelector('[data-ics]').getAttribute('href'), summary: document.querySelector('[data-summary]').textContent,
  }));
  ok(st.service === 'Window Tinting' && /\d{4}/.test(st.date) && /AM|PM/.test(st.time), `hidden fields: ${st.service} / ${st.date} / ${st.time}`);
  ok(st.enabled && /^Booking request:/.test(st.subject), `submit enabled, subject "${st.subject}"`);
  ok(st.gcal.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'), 'owner add-to-Google-Calendar link filled');
  ok(st.sms.startsWith('sms:+19167012005') && st.ics.startsWith('data:text/calendar'), 'text-the-shop and .ics fallbacks ready');
  await pg.screenshot({ path: path.join(QA, 'desktop-book.png') });
  // prefill
  await pg.goto(BASE + '/book/?service=ceramic-coating&note=2021%20Tesla%20Model%203', { waitUntil: 'load' }); await pg.waitForTimeout(500);
  const pre = await pg.evaluate(() => ({ svc: document.querySelector('input[name=svc]:checked')?.value, note: document.querySelector('[data-f-note]').value }));
  ok(pre.svc === 'ceramic-coating' && pre.note === '2021 Tesla Model 3', `prefill from the query string: ${pre.svc}, "${pre.note}"`);
  await pg.close();
}

// 3. Widgets
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

// 4. Assistant (guided flow; the stub endpoint reports llm:false)
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

// 5. Phone booking layout
{
  const pg = await page({ width: 390, height: 844 }, true);
  await pg.goto(BASE + '/book/', { waitUntil: 'load' }); await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(QA, 'iphone-book.png'), fullPage: false });
  const w = await pg.evaluate(() => document.documentElement.scrollWidth);
  ok(w <= 390, `booking page fits a phone (${w}px)`);
  await pg.close();
}

await browser.close(); server.close();
process.exit(fail ? 1 : 0);
