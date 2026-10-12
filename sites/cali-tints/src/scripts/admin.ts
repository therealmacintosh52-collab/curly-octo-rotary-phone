/**
 * The owner's CRM board (src/pages/admin/index.astro). Signs in with the shop
 * password, lists leads from /.netlify/functions/leads, lets the owner move a
 * lead through New → Confirmed → In the bay → Done (or Lost), text the
 * customer, enter the quote, send a Stripe balance link, record cash, and add
 * notes. Everything is one fetch away; nothing is cached beyond the page.
 */
interface Payment { kind: string; amount_cents: number; when: string; ref: string }
interface Lead {
  id: string; created: string; source: string; status: string; name: string; phone: string; email: string;
  vehicle: string; service: string; date: string; time: string; duration: string; note: string; details?: Record<string, string>; quote_cents: number;
  deposit: { status: string; amount_cents: number }; payments: Payment[]; notes: { when: string; text: string }[]; updated: string;
}
interface Cfg { statuses: [string, string][]; services: string[]; phone: string; currency: string; name: string }

const root = document.querySelector<HTMLElement>('[data-crm]');
if (root) boot(root);

function boot(el: HTMLElement) {
  const cfg = JSON.parse(el.dataset.config || '{}') as Cfg;
  const API = '/.netlify/functions/leads';
  const PAY = '/.netlify/functions/checkout';
  const KEY = 'calitints-admin-key';
  const login = el.querySelector<HTMLFormElement>('[data-crm-login]')!;
  const board = el.querySelector<HTMLElement>('[data-crm-board]')!;
  const offline = el.querySelector<HTMLElement>('[data-crm-offline]')!;
  const list = el.querySelector<HTMLElement>('[data-crm-list]')!;
  const empty = el.querySelector<HTMLElement>('[data-crm-empty]')!;
  const status = login.querySelector<HTMLElement>('.form-status')!;
  const dialog = el.querySelector<HTMLDialogElement>('[data-crm-dialog]')!;
  const dform = el.querySelector<HTMLFormElement>('[data-crm-form]')!;
  let key = '';
  let leads: Lead[] = [];
  let filter = 'open';
  let q = '';
  let stripe = false;

  const money = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: cfg.currency.toUpperCase() });
  const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const paid = (l: Lead) => l.payments.reduce((n, p) => n + (p.amount_cents || 0), 0);
  const label = (k: string) => cfg.statuses.find(([s]) => s === k)?.[1] ?? k;
  const headers = () => ({ 'content-type': 'application/json', 'x-admin-key': key });

  async function load(): Promise<boolean> {
    const r = await fetch(`${API}?summary=1`, { headers: headers() });
    if (r.status === 401) return false;
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    leads = j.leads || [];
    const s = j.summary || {};
    for (const [k, v] of Object.entries({ new: s.new ?? 0, today: s.today ?? 0, week: s.week ?? 0, deposits: money(s.deposits_cents ?? 0) })) {
      const t = el.querySelector<HTMLElement>(`[data-stat=${k}]`); if (t) t.textContent = String(v);
    }
    render();
    return true;
  }

  async function start() {
    if (!el.dataset.functions) { login.hidden = true; offline.hidden = false; return; }
    try {
      const ping = await fetch(`${API}?ping=1`); const j = ping.ok ? await ping.json() : { crm: false };
      stripe = Boolean(j.stripe);
      if (!j.crm) { login.hidden = true; offline.hidden = false; return; }
    } catch { login.hidden = true; offline.hidden = false; return; }
    key = sessionStorage.getItem(KEY) || '';
    if (key && (await load().catch(() => false))) show();
  }
  function show() { login.hidden = true; board.hidden = false; el.querySelector<HTMLElement>('[data-crm-logout]')!.hidden = false; }

  login.addEventListener('submit', async (e) => {
    e.preventDefault();
    key = (login.querySelector<HTMLInputElement>('#crm-pw')!).value;
    status.textContent = 'Checking…'; status.className = 'form-status show';
    try {
      if (await load()) { sessionStorage.setItem(KEY, key); show(); }
      else { status.textContent = 'That password did not match.'; status.className = 'form-status show err'; }
    } catch { status.textContent = 'The CRM did not answer. Is the site on Netlify?'; status.className = 'form-status show err'; }
  });
  el.querySelector('[data-crm-logout]')!.addEventListener('click', () => { sessionStorage.removeItem(KEY); location.reload(); });

  el.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter!; el.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('is-on', x === b)); render();
  }));
  el.querySelector<HTMLInputElement>('[data-crm-search]')!.addEventListener('input', (e) => { q = (e.target as HTMLInputElement).value.toLowerCase(); render(); });

  function visible(): Lead[] {
    return leads.filter((l) => (filter === 'all' ? true : filter === 'open' ? !['done', 'lost'].includes(l.status) : l.status === filter))
      .filter((l) => !q || [l.name, l.phone, l.vehicle, l.service, l.note, ...Object.values(l.details || {})].join(' ').toLowerCase().includes(q));
  }

  function render() {
    const rows = visible();
    list.innerHTML = '';
    empty.hidden = rows.length > 0;
    rows.forEach((l) => list.appendChild(card(l)));
  }

  function card(l: Lead): HTMLElement {
    const d = document.createElement('article');
    d.className = `lead lead--${l.status}`;
    const due = Math.max(0, (l.quote_cents || 0) - paid(l));
    const sms = (text: string) => `sms:${l.phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(text)}`;
    d.innerHTML = `
      <header class="lead__head">
        <div>
          <b>${esc(l.name || 'No name')}</b>
          <span class="lead__meta">${esc(l.service || 'Service not set')}${l.vehicle ? ' · ' + esc(l.vehicle) : ''}</span>
          <span class="lead__meta">${l.date ? esc(l.date) + (l.time ? ' at ' + esc(l.time) : '') : 'No date yet'} · in ${when(l.created)} via ${esc(l.source)}</span>
        </div>
        <div class="lead__badges">
          ${l.deposit.status === 'paid' ? `<span class="badge badge--ok">Deposit ${money(l.deposit.amount_cents)}</span>` : l.deposit.status === 'pending' ? `<span class="badge">Deposit pending</span>` : ''}
          ${l.quote_cents ? `<span class="badge">Quote ${money(l.quote_cents)}${due ? ' · due ' + money(due) : ' · paid'}</span>` : ''}
          <select class="lead__status" aria-label="Status">${cfg.statuses.map(([k, n]) => `<option value="${k}" ${k === l.status ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </div>
      </header>
      ${l.details && Object.keys(l.details).length ? `<dl class="lead__details">${Object.entries(l.details).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      ${l.note ? `<p class="lead__note">“${esc(l.note)}”</p>` : ''}
      ${l.notes.length ? `<ul class="lead__notes">${l.notes.map((n) => `<li><small>${when(n.when)}</small> ${esc(n.text)}</li>`).join('')}</ul>` : ''}
      ${l.payments.length ? `<p class="lead__pay">${l.payments.map((p) => `${p.kind} ${money(p.amount_cents)} (${p.ref === 'manual' ? 'at the shop' : 'card online'})`).join(' · ')}</p>` : ''}
      <div class="lead__actions">
        ${l.phone ? `<a class="btn btn-sm btn-dark" href="tel:${esc(l.phone)}">Call</a>
        <a class="btn btn-sm btn-outline" href="${sms(`Hi ${l.name.split(' ')[0] || ''}, this is ${cfg.name}. Your ${l.service.toLowerCase() || 'booking'}${l.date ? ' on ' + l.date + (l.time ? ' at ' + l.time : '') : ''} is confirmed. Reply here with any questions.`)}">Text confirmation</a>` : ''}
        <label class="lead__quote">Quote $<input type="number" min="0" step="1" value="${l.quote_cents ? (l.quote_cents / 100).toFixed(0) : ''}" placeholder="0" data-quote /></label>
        <button type="button" class="btn btn-sm btn-outline" data-act="quote">Save quote</button>
        ${stripe && due > 0 && l.phone ? `<button type="button" class="btn btn-sm btn-accent" data-act="balance">Send balance link (${money(due)})</button>` : ''}
        <button type="button" class="btn btn-sm btn-outline" data-act="cash">Record payment at shop</button>
        <button type="button" class="btn btn-sm btn-outline" data-act="note">Add note</button>
        <button type="button" class="btn btn-sm btn-outline" data-act="edit">Edit</button>
      </div>`;
    d.querySelector<HTMLSelectElement>('.lead__status')!.addEventListener('change', (e) => patch({ id: l.id, status: (e.target as HTMLSelectElement).value }));
    d.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      const act = b.dataset.act;
      if (act === 'quote') { const v = Number(d.querySelector<HTMLInputElement>('[data-quote]')!.value || 0); await patch({ id: l.id, quote_cents: Math.round(v * 100) }); }
      if (act === 'note') { const t = prompt('Note for this lead'); if (t) await patch({ id: l.id, note: t }); }
      if (act === 'cash') { const v = prompt('Amount taken at the shop, in dollars'); if (v) await patch({ id: l.id, payment: { kind: 'balance', amount_cents: Math.round(Number(v) * 100) } }); }
      if (act === 'edit') openDialog(l);
      if (act === 'balance') {
        b.disabled = true; b.textContent = 'Creating link…';
        try {
          const r = await fetch(PAY, { method: 'POST', headers: headers(), body: JSON.stringify({ lead_id: l.id, kind: 'balance' }) });
          const j = await r.json();
          if (!r.ok || !j.url) throw new Error(j.error || 'failed');
          await navigator.clipboard?.writeText(j.url).catch(() => {});
          location.href = sms(`Hi ${l.name.split(' ')[0] || ''}, here is the secure link to pay the ${money(j.amount_cents)} balance for your ${l.service.toLowerCase() || 'job'} at ${cfg.name}: ${j.url}`);
        } catch (e) { alert(`Could not create the link: ${(e as Error).message}`); }
        b.disabled = false; b.textContent = 'Send balance link';
      }
    }));
    return d;
  }

  async function patch(body: Record<string, unknown>) {
    const r = await fetch(API, { method: 'PATCH', headers: headers(), body: JSON.stringify(body) });
    if (!r.ok) { alert('That did not save. Try again.'); return; }
    await load();
  }

  // Add / edit dialog
  el.querySelector('[data-crm-add]')!.addEventListener('click', () => openDialog(null));
  function openDialog(l: Lead | null) {
    dform.reset();
    (dform.querySelector('[data-dialog-title]') as HTMLElement).textContent = l ? 'Edit lead' : 'Add a lead';
    (dform.elements.namedItem('id') as HTMLInputElement).value = l?.id || '';
    for (const k of ['name', 'phone', 'vehicle', 'service', 'date', 'time']) { const i = dform.elements.namedItem(k) as HTMLInputElement | null; if (i && l) i.value = (l as unknown as Record<string, string>)[k] || ''; }
    dialog.showModal();
  }
  dform.addEventListener('submit', async (e) => {
    const btn = (e as SubmitEvent).submitter as HTMLButtonElement | null;
    if (btn?.value !== 'save') return;
    const f = Object.fromEntries(new FormData(dform).entries()) as Record<string, string>;
    if (f.id) await patch({ ...f, note: f.note || undefined });
    else {
      const r = await fetch(API, { method: 'POST', headers: headers(), body: JSON.stringify({ ...f, source: 'admin' }) });
      if (!r.ok) alert('Could not add the lead.'); else await load();
    }
  });

  // CSV export of what is on screen
  el.querySelector('[data-crm-export]')!.addEventListener('click', () => {
    const cols = ['created', 'status', 'name', 'phone', 'email', 'vehicle', 'service', 'date', 'time', 'quote_cents', 'details', 'note', 'source'];
    const cell = (l: Lead, c: string) => c === 'details' ? Object.entries(l.details || {}).map(([k, v]) => `${k}: ${v}`).join('; ') : String((l as unknown as Record<string, unknown>)[c] ?? '');
    const csv = [cols.join(','), ...visible().map((l) => cols.map((c) => `"${cell(l, c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const a = document.createElement('a'); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; a.download = 'cali-tints-leads.csv'; a.click();
  });

  function esc(s: string) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }
  start();
}
