/**
 * Built-in booking calendar (see BookingCalendar.astro). Pure client code:
 * draws the month, enables open days inside the booking window, lists start
 * times that fit the service inside business hours, fills the request form,
 * and builds the text / add-to-calendar fallbacks. The form itself is sent by
 * the shared quote-form handler in site.ts.
 */
import { shopNow, fmtHour, openState } from '../lib/hours';

interface Svc { slug: string; name: string; minutes: number }
interface Cfg {
  tz: string; hours: ([number, number] | null)[]; slot: number; lead: number; weeks: number;
  phone: string; phoneLink: string; name: string; address: string; services: Svc[]; placeholder: boolean;
}

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

  // Service radios
  el.querySelectorAll<HTMLInputElement>('input[name=svc]').forEach((r) => {
    if (service && r.value === service.slug) r.checked = true;
    r.addEventListener('change', () => {
      service = cfg.services.find((s) => s.slug === r.value) ?? null;
      time = null; renderSlots(); renderSummary();
      el.querySelector('[data-step=day]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  if (q.get('note')) f('note').value = q.get('note')!.slice(0, 300);

  const isOpenDay = (y: number, m: number, d: number) => {
    const utc = Date.UTC(y, m, d);
    const dow = new Date(utc).getUTCDay();
    return Boolean(cfg.hours[dow]) && utc >= todayUTC && utc <= lastUTC;
  };

  function renderCal() {
    const { y, m } = view;
    title.textContent = `${MONTHS[m]} ${y}`;
    grid.innerHTML = '';
    const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
    const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (let i = 0; i < first; i++) grid.appendChild(Object.assign(document.createElement('span'), { className: 'cal__pad' }));
    for (let d = 1; d <= count; d++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cal__day'; b.textContent = String(d); b.setAttribute('role', 'gridcell');
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
      b.addEventListener('click', () => { time = t; renderSlots(); renderSummary(); summary.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
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
    summary.innerHTML = `<b>${service!.name}</b><br>${dateStr} at ${timeStr}<br><small>${service!.minutes >= 360 ? 'Drop-off; we text when it is ready.' : `Allow about ${Math.round(service!.minutes / 60)} hour${service!.minutes >= 120 ? 's' : ''}.`}</small>`;
    f('service').value = service!.name; f('date').value = dateStr; f('time').value = timeStr;
    f('duration').value = `${service!.minutes} minutes`;
    f('subject').value = `Booking request: ${service!.name}, ${dateStr} ${timeStr}`;
    // ISO-ish local stamps for calendar links (shop local time, no zone shift).
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = `${day!.y}${pad(day!.m + 1)}${pad(day!.d)}T${pad(Math.floor(time! / 60))}${pad(time! % 60)}00`;
    const endMin = time! + service!.minutes;
    const end = `${day!.y}${pad(day!.m + 1)}${pad(day!.d)}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`;
    const gcal = new URL('https://calendar.google.com/calendar/render');
    gcal.searchParams.set('action', 'TEMPLATE');
    gcal.searchParams.set('text', `${service!.name} — ${f('vehicle' as never)?.value || 'customer vehicle'}`);
    gcal.searchParams.set('dates', `${start}/${end}`);
    gcal.searchParams.set('ctz', cfg.tz);
    gcal.searchParams.set('location', cfg.address);
    gcal.searchParams.set('details', `Booking request via ${location.host}. ${f('note').value}`);
    f('gcal').value = gcal.href;

    const body = `Booking request: ${service!.name} on ${dateStr} at ${timeStr}. Vehicle: ${(el.querySelector<HTMLInputElement>('#bk-vehicle')?.value) || '(add vehicle)'}. ${f('note').value}`.trim();
    (el.querySelector<HTMLAnchorElement>('[data-sms]')!).href = `sms:${cfg.phoneLink}?&body=${encodeURIComponent(body)}`;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cali Tints//Booking//EN', 'BEGIN:VEVENT',
      `UID:${start}-${service!.slug}@calitints`, `DTSTAMP:${start}`, `DTSTART;TZID=${cfg.tz}:${start}`, `DTEND;TZID=${cfg.tz}:${end}`,
      `SUMMARY:${service!.name} at ${cfg.name}`, `LOCATION:${cfg.address}`, `DESCRIPTION:Requested online. The shop confirms by text or call. ${cfg.phone}`,
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
  renderCal(); renderSlots(); renderSummary();
  el.querySelectorAll<HTMLInputElement>('#bk-vehicle, [data-f-note]').forEach((i) => i.addEventListener('input', () => { if (!submit.disabled) renderSummary(); }));
}
