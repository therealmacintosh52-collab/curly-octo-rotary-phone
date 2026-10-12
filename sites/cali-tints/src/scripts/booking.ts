/**
 * Built-in booking calendar (see BookingCalendar.astro). Pure client code:
 * draws the month, enables open days inside the booking window, lists start
 * times that fit the service inside business hours, fills the request form,
 * and builds the text / add-to-calendar fallbacks. The form itself is sent by
 * the shared quote-form handler in site.ts.
 */
import { shopNow, fmtHour, openState } from '../lib/hours';

interface Svc { slug: string; name: string; minutes: number }
interface Q { key: string; label: string; type: 'one' | 'many' | 'text'; options?: string[]; default?: string; placeholder?: string }
interface Cfg {
  tz: string; hours: ([number, number] | null)[]; slot: number; lead: number; weeks: number;
  phone: string; phoneLink: string; name: string; address: string; services: Svc[]; placeholder: boolean;
  endpoint: string; thanks: string; deposits: Record<string, number>; currency: string; fullOptional: boolean;
  questions: Record<string, Q[]>; common: Q[];
}
const LEADS = '/.netlify/functions/leads';
const CHECKOUT = '/.netlify/functions/checkout';

const root = document.querySelector<HTMLElement>('[data-booking]');
if (root) boot(root);

function boot(el: HTMLElement) {
  const cfg = JSON.parse(el.dataset.config || '{}') as Cfg;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const q = new URLSearchParams(location.search);

  const grid = el.querySelector<HTMLElement>('[data-cal-grid]')!;
  const title = el.querySelector<HTMLElement>('[data-cal-title]')!;
  const slots = el.querySelector<HTMLElement>('[data-slots]')!;
  const dayLabel = el.querySelector<HTMLElement>('[data-day-label]')!;
  const summary = el.querySelector<HTMLElement>('[data-summary]')!;
  const submit = el.querySelector<HTMLButtonElement>('[data-submit]')!;
  const alt = el.querySelector<HTMLElement>('[data-alt]')!;
  const f = (n: string) => el.querySelector<HTMLInputElement>(`[data-f-${n}]`)!;

  const now = shopNow();
  // Earliest bookable moment: now + lead hours, in shop-local terms.
  const lead = new Date(Date.UTC(now.y, now.m - 1, now.d, 0, now.minutes + cfg.lead * 60));
  const todayUTC = Date.UTC(now.y, now.m - 1, now.d);
  const lastUTC = todayUTC + cfg.weeks * 7 * 86400000;

  let view = { y: now.y, m: now.m - 1 };           // 0-based month for the calendar view
  let service: Svc | null = cfg.services.find((s) => s.slug === q.get('service')) ?? null;
  let day: { y: number; m: number; d: number } | null = null;   // m 0-based
  let time: number | null = null;                   // minutes since midnight

  const compact = Boolean(el.dataset.compact);
  // Service: radios on the full page, a <select> in the compact (hero) card.
  const sel = el.querySelector<HTMLSelectElement>('select[name=svc]');
  if (sel) {
    if (service) sel.value = service.slug; else service = cfg.services.find((s) => s.slug === sel.value) ?? null;
    sel.addEventListener('change', () => { service = cfg.services.find((s) => s.slug === sel.value) ?? null; time = null; pickFirst(); renderCal(); renderSlots(); renderQuestions(); });
  }
  el.querySelectorAll<HTMLInputElement>('input[name=svc]').forEach((r) => {
    if (service && r.value === service.slug) r.checked = true;
    r.addEventListener('change', () => {
      service = cfg.services.find((s) => s.slug === r.value) ?? null;
      time = null; renderSlots(); renderQuestions();
      el.querySelector('[data-step=day]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  if (q.get('note')) f('note').value = q.get('note')!.slice(0, 300);

  // ----------------------------------------------------------- specifics
  // One answer per question key. Defaults first, then anything the query
  // string carries (the assistant and the service widgets link in with
  // ?shade=20%&film=Carbon&body=SUV …), then whatever the visitor taps.
  const qbox = el.querySelector<HTMLElement>('[data-questions]')!;
  const details: Record<string, string | string[]> = {};
  const allQs = (): Q[] => [...((service && cfg.questions[service.slug]) || []), ...cfg.common];
  const match = (qq: Q, v: string) => qq.options?.find((o) => o.toLowerCase() === v.toLowerCase() || o.toLowerCase().startsWith(v.toLowerCase()));
  function seedDetails() {
    for (const qq of allQs()) {
      if (details[qq.key] !== undefined) continue;
      const fromQ = q.get(qq.key);
      if (fromQ) {
        if (qq.type === 'many') { const picks = fromQ.split(',').map((x) => match(qq, x.trim())).filter(Boolean) as string[]; if (picks.length) { details[qq.key] = picks; continue; } }
        else if (qq.type === 'text') { details[qq.key] = fromQ.slice(0, 120); continue; }
        else { const m = match(qq, fromQ); if (m) { details[qq.key] = m; continue; } }
      }
      if (qq.type === 'one' && qq.default) details[qq.key] = qq.default;
    }
  }
  ['year', 'make', 'model'].forEach((k) => { const v = q.get(k); const i = el.querySelector<HTMLInputElement>(`#bk-${k}`); if (v && i) i.value = v.slice(0, 40); });

  function renderQuestions() {
    seedDetails();
    qbox.innerHTML = '';
    const longJob = (service?.minutes ?? 0) >= 360;
    if (longJob) details.wait = 'Drop off';
    for (const qq of allQs()) {
      if (qq.key === 'doors' && details.body === 'Motorcycle') continue;
      const fs = document.createElement('fieldset'); fs.className = `qa qa--${qq.type}`;
      const lg = document.createElement('legend'); lg.textContent = qq.label; fs.appendChild(lg);
      if (qq.type === 'text') {
        const i = document.createElement('input'); i.type = 'text'; i.maxLength = 120; i.placeholder = qq.placeholder || ''; i.value = String(details[qq.key] || ''); i.className = 'qa__text'; i.setAttribute('aria-label', qq.label);
        i.addEventListener('input', () => { details[qq.key] = i.value; renderSummary(); });
        fs.appendChild(i);
      } else {
        const row = document.createElement('div'); row.className = 'qa__opts';
        for (const opt of qq.options || []) {
          const lab = document.createElement('label'); lab.className = 'chip';
          const inp = document.createElement('input'); inp.type = qq.type === 'one' ? 'radio' : 'checkbox'; inp.name = `q_${qq.key}`; inp.value = opt;
          const cur = details[qq.key];
          inp.checked = qq.type === 'one' ? cur === opt : Array.isArray(cur) && cur.includes(opt);
          if (qq.key === 'wait' && longJob && opt !== 'Drop off') inp.disabled = true;
          inp.addEventListener('change', () => {
            if (qq.type === 'one') details[qq.key] = opt;
            else { const set = new Set(Array.isArray(details[qq.key]) ? (details[qq.key] as string[]) : []); inp.checked ? set.add(opt) : set.delete(opt); details[qq.key] = Array.from(set); }
            if (qq.key === 'body') renderQuestions(); else renderSummary();
          });
          const sp = document.createElement('span'); sp.textContent = opt;
          lab.append(inp, sp); row.appendChild(lab);
        }
        fs.appendChild(row);
      }
      qbox.appendChild(fs);
    }
    renderSummary();
  }
  /** Answers as label → value, for the summary, the email, the text and the CRM. */
  function detailsOut(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const qq of allQs()) {
      if (qq.key === 'doors' && details.body === 'Motorcycle') continue;
      const v = details[qq.key];
      const str = Array.isArray(v) ? v.join(', ') : (v || '');
      if (str) out[qq.label] = str;
    }
    return out;
  }
  const vehicleStr = () => ['year', 'make', 'model'].map((k) => (el.querySelector<HTMLInputElement>(`#bk-${k}`)?.value || '').trim()).filter(Boolean).join(' ');

  const isOpenDay = (y: number, m: number, d: number) => {
    const utc = Date.UTC(y, m, d);
    const dow = new Date(utc).getUTCDay();
    return Boolean(cfg.hours[dow]) && utc >= todayUTC && utc <= lastUTC;
  };

  const strip = el.querySelector<HTMLElement>('[data-daystrip]');
  const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MSHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /** Compact card: the next twelve open days as chips. */
  function renderStrip() {
    if (!strip) return;
    strip.innerHTML = '';
    let n = 0;
    for (let i = 0; i <= cfg.weeks * 7 && n < 12; i++) {
      const dt = new Date(todayUTC + i * 86400000);
      const y = dt.getUTCFullYear(), m = dt.getUTCMonth(), d = dt.getUTCDate();
      if (!isOpenDay(y, m, d) || !slotsFor(y, m, d).length) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'daychip';
      b.innerHTML = `<small>${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : SHORT[dt.getUTCDay()]}</small><b>${d}</b><small>${MSHORT[m]}</small>`;
      if (day && day.y === y && day.m === m && day.d === d) { b.classList.add('is-on'); b.setAttribute('aria-pressed', 'true'); }
      b.addEventListener('click', () => { day = { y, m, d }; time = slotsFor(y, m, d)[0] ?? null; renderStrip(); renderSlots(); renderSummary(); });
      strip.appendChild(b); n++;
    }
  }

  function renderCal() {
    renderStrip();
    const { y, m } = view;
    title.textContent = `${MONTHS[m]} ${y}`;
    grid.innerHTML = '';
    const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
    const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (let i = 0; i < first; i++) grid.appendChild(Object.assign(document.createElement('span'), { className: 'cal__pad' }));
    for (let d = 1; d <= count; d++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cal__day'; b.textContent = String(d);
      const ok = isOpenDay(y, m, d);
      b.disabled = !ok;
      if (Date.UTC(y, m, d) === todayUTC) b.classList.add('is-today');
      if (day && day.y === y && day.m === m && day.d === d) b.classList.add('is-on');
      b.setAttribute('aria-label', `${DAYS[new Date(Date.UTC(y, m, d)).getUTCDay()]} ${MONTHS[m]} ${d}${ok ? '' : ', unavailable'}`);
      b.addEventListener('click', () => { day = { y, m, d }; time = null; renderCal(); renderSlots(); renderSummary(); });
      grid.appendChild(b);
    }
    const prev = el.querySelector<HTMLButtonElement>('[data-cal-prev]')!, next = el.querySelector<HTMLButtonElement>('[data-cal-next]')!;
    prev.disabled = y === now.y && m === now.m - 1;
    const lastD = new Date(lastUTC);
    next.disabled = y === lastD.getUTCFullYear() && m === lastD.getUTCMonth();
  }
  el.querySelector('[data-cal-prev]')!.addEventListener('click', () => { view = view.m === 0 ? { y: view.y - 1, m: 11 } : { y: view.y, m: view.m - 1 }; renderCal(); });
  el.querySelector('[data-cal-next]')!.addEventListener('click', () => { view = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 }; renderCal(); });

  /** Start times for a day, honouring the lead time and the service length. */
  function slotsFor(y: number, m: number, d: number): number[] {
    const h = cfg.hours[new Date(Date.UTC(y, m, d)).getUTCDay()];
    if (!h) return [];
    const dur = service?.minutes ?? cfg.slot, dropOff = dur >= 360;
    const open = h[0] * 60, close = h[1] * 60;
    const lastStart = dropOff ? open + 120 : Math.max(open, close - Math.min(dur, 180));
    const out: number[] = [];
    for (let t = open; t <= lastStart; t += cfg.slot) if (Date.UTC(y, m, d, 0, t) >= lead.getTime()) out.push(t);
    return out;
  }
  /** Compact card: land on the first open day and its first start time, so the
      visitor only has to type a name and number. */
  function pickFirst() {
    if (!compact) return;
    for (let i = 0; i <= cfg.weeks * 7; i++) {
      const dt = new Date(todayUTC + i * 86400000);
      const y = dt.getUTCFullYear(), m = dt.getUTCMonth(), d = dt.getUTCDate();
      if (!isOpenDay(y, m, d)) continue;
      const ts = slotsFor(y, m, d);
      if (ts.length) { day = { y, m, d }; time = ts[0]; view = { y, m }; return; }
    }
  }

  function renderSlots() {
    slots.innerHTML = '';
    if (!day) { dayLabel.textContent = 'Choose a day first.'; return; }
    const dow = new Date(Date.UTC(day.y, day.m, day.d)).getUTCDay();
    const h = cfg.hours[dow];
    if (!h) { dayLabel.textContent = 'Closed that day.'; return; }
    const dur = service?.minutes ?? cfg.slot;
    const dropOff = dur >= 360;
    const open = h[0] * 60, close = h[1] * 60;
    // Long jobs are drop-offs: morning starts only. Short jobs must finish before close.
    const lastStart = dropOff ? open + 120 : Math.max(open, close - Math.min(dur, 180));
    dayLabel.textContent = `${DAYS[dow]}, ${MONTHS[day.m]} ${day.d}${service ? ` · ${service.name}${dropOff ? ' (drop-off)' : ''}` : ''}`;
    let any = false;
    for (let t = open; t <= lastStart; t += cfg.slot) {
      const when = Date.UTC(day.y, day.m, day.d, 0, t);
      if (when < lead.getTime()) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'slot'; b.textContent = fmtHour(t / 60);
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', time === t ? 'true' : 'false');
      if (time === t) b.classList.add('is-on');
      b.addEventListener('click', () => { time = t; renderSlots(); renderSummary(); if (!compact) summary.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
      slots.appendChild(b); any = true;
    }
    if (!any) slots.innerHTML = '<p class="slots__none">No start times left that day. Try the next open day.</p>';
  }

  function renderSummary() {
    const ready = Boolean(service && day && time !== null);
    submit.disabled = !ready;
    submit.textContent = ready ? 'Send booking request' : !service ? 'Choose a service to continue' : !day ? 'Choose a day to continue' : 'Choose a time to continue';
    if (!ready) { summary.textContent = 'Pick a service, a day and a time on the left.'; alt.hidden = true; return; }
    const dow = DAYS[new Date(Date.UTC(day!.y, day!.m, day!.d)).getUTCDay()];
    const dateStr = `${dow}, ${MONTHS[day!.m]} ${day!.d}, ${day!.y}`;
    const timeStr = fmtHour(time! / 60);
    const d = detailsOut();
    const svcQs = (cfg.questions[service!.slug] || []).map((qq) => d[qq.label]).filter(Boolean);
    const veh = vehicleStr();
    const car = [veh, [details.doors && details.body !== 'Motorcycle' ? `${details.doors}-door` : '', String(details.body || '').toLowerCase()].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    summary.innerHTML = `<b>${esc(service!.name)}</b>${svcQs.length ? ` · ${esc(svcQs.join(' · '))}` : ''}<br>${car ? esc(car) + '<br>' : '<span class="book__summary-miss">Add the year, make and model below.</span><br>'}${dateStr} at ${timeStr} · ${esc(String(details.wait || ''))}<br><small>${service!.minutes >= 360 ? 'Drop-off; we text when it is ready.' : `Allow about ${Math.round(service!.minutes / 60)} hour${service!.minutes >= 120 ? 's' : ''}.`}${details.confirm ? ` We confirm by ${String(details.confirm).toLowerCase()}.` : ''}</small>`;
    f('service').value = service!.name; f('date').value = dateStr; f('time').value = timeStr;
    f('vehicle').value = car;
    const detailLines = Object.entries(d).map(([k, v]) => `${k}: ${v}`).join('\n');
    f('details').value = detailLines;
    f('duration').value = `${service!.minutes} minutes`;
    f('subject').value = `Booking request: ${service!.name}, ${dateStr} ${timeStr}`;
    // ISO-ish local stamps for calendar links (shop local time, no zone shift).
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = `${day!.y}${pad(day!.m + 1)}${pad(day!.d)}T${pad(Math.floor(time! / 60))}${pad(time! % 60)}00`;
    const endMin = time! + service!.minutes;
    const end = `${day!.y}${pad(day!.m + 1)}${pad(day!.d)}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`;
    const gcal = new URL('https://calendar.google.com/calendar/render');
    gcal.searchParams.set('action', 'TEMPLATE');
    gcal.searchParams.set('text', `${service!.name} — ${car || 'customer vehicle'}`);
    gcal.searchParams.set('dates', `${start}/${end}`);
    gcal.searchParams.set('ctz', cfg.tz);
    gcal.searchParams.set('location', cfg.address);
    gcal.searchParams.set('details', `Booking request via ${location.host}.\n${detailLines}\n${f('note').value}`.trim());
    f('gcal').value = gcal.href;

    const body = `Booking request: ${service!.name} on ${dateStr} at ${timeStr}. Vehicle: ${car || '(add vehicle)'}. ${Object.entries(d).map(([k, v]) => `${k}: ${v}`).join('; ')}. ${f('note').value}`.trim();
    (el.querySelector<HTMLAnchorElement>('[data-sms]')!).href = `sms:${cfg.phoneLink}?&body=${encodeURIComponent(body)}`;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cali Tints//Booking//EN', 'BEGIN:VEVENT',
      `UID:${start}-${service!.slug}@calitints`, `DTSTAMP:${start}`, `DTSTART;TZID=${cfg.tz}:${start}`, `DTEND;TZID=${cfg.tz}:${end}`,
      `SUMMARY:${service!.name} at ${cfg.name}`, `LOCATION:${cfg.address}`, `DESCRIPTION:${[car, ...Object.entries(d).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join('\\n')}\\nThe shop confirms by text or call. ${cfg.phone}`,
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    (el.querySelector<HTMLAnchorElement>('[data-ics]')!).href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    alt.hidden = false;
    // Always a call option during business hours.
    const st = openState();
    let call = el.querySelector<HTMLAnchorElement>('[data-call-now]');
    if (st.open) {
      if (!call) {
        call = document.createElement('a'); call.className = 'btn btn-accent btn-sm'; call.dataset.callNow = '1';
        call.href = `tel:${cfg.phoneLink}`; call.textContent = `Open now · call ${cfg.phone}`; alt.prepend(call);
      }
    } else call?.remove();
  }

  // Prefill a day/time from the query string if given (YYYY-MM-DD, HH:MM).
  const qd = q.get('date'), qt = q.get('time');
  if (qd && /^\d{4}-\d{2}-\d{2}$/.test(qd)) {
    const [y, m, d] = qd.split('-').map(Number);
    if (isOpenDay(y, m - 1, d)) { day = { y, m: m - 1, d }; view = { y, m: m - 1 }; }
    if (qt && /^\d{2}:\d{2}$/.test(qt)) { const [hh, mm] = qt.split(':').map(Number); time = hh * 60 + mm; }
  }
  if (!day) pickFirst();
  renderCal(); renderSlots(); renderQuestions();
  el.querySelectorAll<HTMLInputElement>('#bk-year, #bk-make, #bk-model, [data-f-note]').forEach((i) => i.addEventListener('input', () => { if (!submit.disabled) renderSummary(); }));

  // ------------------------------------------------------------ sending
  // Order: save the lead in the CRM (if the host runs it), then either send
  // the customer to Stripe for the deposit / full payment, or email the shop
  // (if an inbox is connected). Every path ends with a visible result, and
  // the text / call fallbacks stay on screen.
  const form = el.querySelector<HTMLFormElement>('[data-booking-form]')!;
  const statusEl = form.querySelector<HTMLElement>('.form-status')!;
  const payBox = form.querySelector<HTMLElement>('[data-pay]')!;
  const amountBox = form.querySelector<HTMLElement>('[data-pay-amount]')!;
  let crm = false, stripe = false;
  const money = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: cfg.currency.toUpperCase(), maximumFractionDigits: 0 });
  const say = (msg: string, kind: 'ok' | 'err') => { statusEl.textContent = msg; statusEl.className = `form-status show ${kind}`; };
  const payChoice = () => (form.querySelector<HTMLInputElement>('input[name=pay]:checked')?.value) || 'later';

  if (el.dataset.functions) fetch(`${LEADS}?ping=1`).then((r) => (r.ok ? r.json() : null)).then((j) => {
    crm = Boolean(j?.crm); stripe = Boolean(j?.stripe);
    if (stripe) { payBox.hidden = false; if (!cfg.fullOptional) form.querySelector<HTMLElement>('[data-pay-full-opt]')!.hidden = true; renderDeposit(); }
  }).catch(() => {});
  function renderDeposit() {
    const d = service ? cfg.deposits[service.slug] : 0;
    const t = form.querySelector<HTMLElement>('[data-pay-deposit]'); if (t) t.textContent = d ? `${money(d)} by card, secure checkout. Comes off the final price.` : 'Pick a service to see the deposit.';
    amountBox.hidden = payChoice() !== 'full';
  }
  form.querySelectorAll<HTMLInputElement>('input[name=pay]').forEach((r) => r.addEventListener('change', renderDeposit));
  el.querySelectorAll<HTMLInputElement>('input[name=svc]').forEach((r) => r.addEventListener('change', renderDeposit));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if ((form.querySelector<HTMLInputElement>('input[name=_gotcha]')?.value) || (form.querySelector<HTMLInputElement>('input[name=_honey]')?.value)) return;
    if (submit.disabled) return;
    const fd = new FormData(form);
    const payload: Record<string, unknown> = Object.fromEntries(Array.from(fd.entries()).filter(([k]) => !k.startsWith('_') && !k.startsWith('q_') && !k.startsWith('veh_')).map(([k, v]) => [k, String(v)]));
    payload.details = detailsOut();
    const btnLabel = submit.textContent; submit.disabled = true; submit.textContent = 'Sending…';

    let leadId = '';
    if (crm) {
      try { const r = await fetch(LEADS, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, source: 'booking' }) }); if (r.ok) leadId = (await r.json()).id || ''; } catch {}
    }
    const choice = payChoice();
    if (stripe && leadId && choice !== 'later') {
      const amount = choice === 'full' ? Math.round(Number((form.querySelector<HTMLInputElement>('#bk-amount')?.value) || 0) * 100) : 0;
      if (choice === 'full' && amount < 1000) { say('Enter the amount you were quoted, or choose the deposit.', 'err'); submit.disabled = false; submit.textContent = btnLabel; return; }
      try {
        const r = await fetch(CHECKOUT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, kind: choice, amount_cents: amount }) });
        const j = await r.json();
        if (r.ok && j.url) { location.href = j.url; return; }
        say(`Checkout did not open (${j.error || 'error'}). Your request is saved; the shop will text you.`, 'err');
      } catch { say('Checkout did not open. Your request is saved; the shop will text you.', 'err'); }
    }
    // Email the shop when an inbox is connected.
    const action = form.getAttribute('action') || '';
    const emailLive = !(action.includes('REPLACE-ME') || action.includes('example.com'));
    if (emailLive) {
      try {
        const r = await fetch(action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error('bad status');
        location.href = cfg.thanks + (leadId ? `?lead=${leadId}` : ''); return;
      } catch { say(`The email did not go through${leadId ? ', but your request is saved and the shop will text you' : ''}. You can also text or call ${cfg.phone}.`, leadId ? 'ok' : 'err'); }
    } else if (leadId) {
      say(`Request saved. The shop confirms by text, usually within the hour during business hours. Need it sooner? Call ${cfg.phone}.`, 'ok');
      track('generate_lead', { form_id: 'booking' });
    } else {
      say(`This form isn't connected to an inbox yet. Use "Text this to the shop" below, or call ${cfg.phone}, and the slot is yours.`, 'err');
    }
    submit.disabled = false; submit.textContent = btnLabel;
  });
}

function track(name: string, params: Record<string, unknown> = {}) {
  const w = window as unknown as { dataLayer?: unknown[] };
  (w.dataLayer = w.dataLayer || []).push({ event: name, ...params });
}
