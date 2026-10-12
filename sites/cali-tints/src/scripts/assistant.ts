/**
 * The assistant widget (see Assistant.astro).
 *
 * Two brains, one UI:
 *  - Guided flow (this file): keyword intents, a short question path, honest
 *    answers from site.json, and always a route to book or call. Runs on any
 *    host with no server.
 *  - Claude (netlify/functions/chat.mjs): if the endpoint answers GET with
 *    {llm:true}, messages go there instead and the reply + action buttons are
 *    rendered. If a request fails, the guided flow answers that turn.
 */
import { openState } from '../lib/hours';

interface Svc { slug: string; name: string; blurb: string; pricing: string; includes: string[]; keywords: string[] }
interface Cfg { name: string; opener: string; quick: string[]; phone: string; phoneLink: string; hours: string; services: Svc[] }
interface Action { label: string; href: string }
interface Turn { role: 'user' | 'assistant'; content: string }

const root = document.querySelector<HTMLElement>('[data-assistant]');
if (root) boot(root);

function boot(el: HTMLElement) {
  const cfg = JSON.parse(el.dataset.config || '{}') as Cfg;
  const panel = el.querySelector<HTMLElement>('#asst-panel')!;
  const launch = el.querySelector<HTMLButtonElement>('[data-asst-open]')!;
  const log = el.querySelector<HTMLElement>('[data-asst-log]')!;
  const quick = el.querySelector<HTMLElement>('[data-asst-quick]')!;
  const form = el.querySelector<HTMLFormElement>('[data-asst-form]')!;
  const input = form.querySelector<HTMLInputElement>('input')!;
  const ENDPOINT = '/.netlify/functions/chat';
  const history: Turn[] = [];
  let llm = false;
  let probed = false;
  let state: { service?: Svc; vehicle?: string; goal?: string; asked?: string } = {};

  const KEY = 'calitints-asst';
  try { const saved = sessionStorage.getItem(KEY); if (saved) history.push(...(JSON.parse(saved) as Turn[])); } catch {}

  const open = () => {
    panel.hidden = false; launch.setAttribute('aria-expanded', 'true'); el.classList.add('is-open');
    if (!log.childElementCount) { history.length ? history.forEach((t) => bubble(t.role, t.content)) : say(cfg.opener, [], cfg.quick); }
    probe(); setTimeout(() => input.focus(), 50);
  };
  const close = () => { panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); el.classList.remove('is-open'); };
  launch.addEventListener('click', () => (panel.hidden ? open() : close()));
  el.querySelector('[data-asst-close]')!.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  // Anything on the page can open the assistant: <a href="#ask">.
  document.querySelectorAll<HTMLAnchorElement>('a[href="#ask"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); open(); }));

  function bubble(role: Turn['role'], text: string, actions: Action[] = []) {
    const d = document.createElement('div');
    d.className = `asst__msg asst__msg--${role}`;
    const p = document.createElement('p'); p.textContent = text; d.appendChild(p);
    if (actions.length) {
      const row = document.createElement('div'); row.className = 'asst__actions';
      actions.forEach((a) => { const b = document.createElement('a'); b.className = 'btn btn-sm ' + (a.href.startsWith('tel:') ? 'btn-dark' : 'btn-accent'); b.href = a.href; b.textContent = a.label; row.appendChild(b); });
      d.appendChild(row);
    }
    log.appendChild(d); log.scrollTop = log.scrollHeight;
  }
  function chips(items: string[]) {
    quick.innerHTML = '';
    items.forEach((t) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'asst__chip'; b.textContent = t; b.addEventListener('click', () => send(t)); quick.appendChild(b); });
  }
  function say(text: string, actions: Action[] = [], next: string[] = []) {
    bubble('assistant', text, actions); history.push({ role: 'assistant', content: text }); persist(); chips(next);
  }
  function persist() { try { sessionStorage.setItem(KEY, JSON.stringify(history.slice(-30))); } catch {} }

  async function probe() {
    if (probed) return; probed = true;
    try { const r = await fetch(ENDPOINT, { method: 'GET' }); if (r.ok) { const j = await r.json(); llm = Boolean(j.llm); } } catch { llm = false; }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); const t = input.value.trim(); if (t) { input.value = ''; send(t); } });

  async function send(text: string) {
    bubble('user', text); history.push({ role: 'user', content: text }); persist(); chips([]);
    const typing = document.createElement('div'); typing.className = 'asst__msg asst__msg--assistant asst__typing'; typing.innerHTML = '<span></span><span></span><span></span>'; log.appendChild(typing); log.scrollTop = log.scrollHeight;
    let out: { reply: string; actions: Action[]; next?: string[] } | null = null;
    if (llm) {
      try {
        const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: history.slice(0, -1).slice(-16), text }) });
        if (r.ok) { const j = await r.json(); if (j.reply) out = { reply: j.reply, actions: j.actions || [], next: ['Book a time', 'Call the shop'] }; }
      } catch {}
    }
    if (!out) out = guided(text);
    typing.remove();
    say(out.reply, out.actions, out.next || []);
  }

  // ------------------------------------------------------------ guided flow
  const callAction = (): Action[] => {
    const st = openState();
    return st.open ? [{ label: `Open now · call ${cfg.phone}`, href: `tel:${cfg.phoneLink}` }] : [];
  };
  const bookAction = (s?: Svc, note?: string): Action => {
    const u = new URL('/book/', location.origin);
    if (s) u.searchParams.set('service', s.slug);
    if (note) u.searchParams.set('note', note.slice(0, 300));
    return { label: s ? `Book ${s.name.toLowerCase()}` : 'Book a time', href: u.pathname + u.search };
  };
  const find = (t: string): Svc | undefined => {
    const lc = t.toLowerCase();
    const table: [RegExp, string][] = [
      [/tint|shade|vlt|window film|dark(er)? windows|heat/, 'window-tinting'],
      [/remov|peel|bubbl|purple|old tint|strip/, 'tint-removal-repair'],
      [/wrap|colou?r change|matte|satin|chrome delete/, 'vinyl-wraps'],
      [/fleet|van|truck lettering|business|logo|commercial|decal/, 'commercial-wraps'],
      [/ppf|clear bra|rock chip|paint protection|protect.*paint|new car/, 'paint-protection-film'],
      [/ceramic coat|coating|gloss|hydrophobic/, 'ceramic-coating'],
      [/detail|clean|wash|vacuum|shampoo|smell|odou?r/, 'detailing'],
      [/swirl|scratch|polish|correction|hazy/, 'paint-correction'],
      [/smoke|tail ?light|head ?light|camera|carplay|speaker|stereo|remote start|custom/, 'customization'],
      [/seat|leather|upholst|headliner|carpet|torn/, 'upholstery'],
      [/inspect|mechanic|brake|noise|check engine|warning light|service|oil|pre-?purchase/, 'inspections-mechanic'],
    ];
    const hit = table.find(([re]) => re.test(lc));
    return hit ? cfg.services.find((s) => s.slug === hit[1]) : undefined;
  };
  const looksLikeVehicle = (t: string) => /\b(19|20)\d{2}\b/.test(t) || /\b(toyota|honda|ford|chevy|chevrolet|tesla|bmw|mercedes|audi|lexus|nissan|kia|hyundai|subaru|jeep|ram|dodge|gmc|mazda|vw|volkswagen|porsche|acura|infiniti|rivian|truck|suv|sedan|coupe|van|motorcycle)\b/i.test(t);

  function guided(text: string): { reply: string; actions: Action[]; next: string[] } {
    const lc = text.toLowerCase();
    const st = openState();
    if (/^(hi|hello|hey)\b/.test(lc)) return { reply: cfg.opener, actions: [], next: cfg.quick };
    if (/hour|open|close|when are you/.test(lc)) return { reply: `${st.label}. ${cfg.hours}.`, actions: [...callAction(), bookAction(state.service)], next: ['Book a time', 'Tint prices'] };
    if (/where|address|located|directions|map/.test(lc)) return { reply: `2400 Fulton Ave, Suite F, Sacramento, CA 95825, in Arden-Arcade between Business 80 and Highway 50. Parking is in front of the suite.`, actions: [{ label: 'Directions', href: 'https://www.google.com/maps/dir/?api=1&destination=2400+Fulton+Ave+Suite+F+Sacramento+CA+95825' }, ...callAction()], next: ['Book a time', 'Call the shop'] };
    if (/call|phone|talk to (a |some)?(one|person)/.test(lc)) {
      return st.open
        ? { reply: `We're open right now. Call ${cfg.phone} and the person who answers does the work.`, actions: callAction(), next: ['Book a time'] }
        : { reply: `${st.label}. You can book a time now and the shop confirms by text when it opens, or leave your number on the booking page and they'll call you back.`, actions: [bookAction(state.service)], next: ['Book a time'] };
    }
    if (/legal|law|70|ticket|how dark/.test(lc)) return { reply: `California: front side windows must let 70% or more light through, the windshield only gets a strip above the AS-1 line, and anything behind the front doors can be as dark as you like. We set every car to that.`, actions: [{ label: 'The tint law, explained', href: '/advice/california-window-tint-law/' }, bookAction(cfg.services.find((s) => s.slug === 'window-tinting'))], next: ['Tint prices', 'Book a time'] };
    if (/book|appointment|schedule|reserve|slot/.test(lc)) {
      const note = [state.vehicle, state.goal].filter(Boolean).join(' · ');
      return { reply: state.service ? `Let's get ${state.service.name.toLowerCase()} on the calendar. Pick a day and a start time; the shop confirms by text.` : `Pick the service on the booking page, then a day and time. The shop confirms by text.`, actions: [bookAction(state.service, note), ...callAction()], next: [] };
    }
    const svc = find(text);
    if (svc && (!state.service || svc.slug !== state.service.slug)) {
      state.service = svc; state.asked = 'vehicle';
      return { reply: `${svc.name} it is. ${svc.blurb} What's the car — year, make and model?`, actions: [], next: ['Just want a price', 'Book a time'] };
    }
    if (/price|cost|how much|quote|\$/.test(lc)) {
      const s = state.service;
      return {
        reply: s ? `${s.pricing}. Send the car and what you want and the shop comes back with a number; or book a slot and they quote it on the day before anything starts.` : `Everything is quoted on your vehicle, not a menu. Tell me what you want done and the car, and I'll point you to the right page and get the shop a note.`,
        actions: [bookAction(s, state.vehicle), ...callAction()], next: s ? ['Book a time'] : ['Tint', 'Wrap', 'PPF', 'Ceramic coating'],
      };
    }
    if (looksLikeVehicle(text) || state.asked === 'vehicle') {
      state.vehicle = text; state.asked = 'goal';
      const s = state.service;
      return s
        ? { reply: `Got it, ${text}. For ${s.name.toLowerCase()} that covers: ${s.includes.join('; ')}. ${s.pricing}. Want to pick a day?`, actions: [bookAction(s, text), ...callAction()], next: ['Book a time', 'What does it cost?'] }
        : { reply: `Got it, ${text}. What's the goal: less heat, a new look, protecting the paint, or fixing something?`, actions: [], next: ['Less heat', 'New look', 'Protect the paint', 'Fix something'] };
    }
    if (/heat|hot|sun|glare|uv/.test(lc)) { state.service = cfg.services.find((s) => s.slug === 'window-tinting'); state.goal = 'heat'; return { reply: `Heat is window film. Ceramic film cuts the most heat without going dark; the fronts stay at the legal 70%. What's the car?`, actions: [], next: ['Book a time', 'What does it cost?'] }; }
    if (/look|style|colou?r|new look/.test(lc)) { state.service = cfg.services.find((s) => s.slug === 'vinyl-wraps'); state.goal = 'looks'; return { reply: `A new look is usually a wrap: colour change, satin or matte, or a chrome delete. Paint stays protected underneath. What's the car?`, actions: [], next: ['Book a time', 'What does it cost?'] }; }
    if (/protect/.test(lc)) { state.service = cfg.services.find((s) => s.slug === 'paint-protection-film'); state.goal = 'protection'; return { reply: `Protecting paint is film on the front end (rock chips) and a ceramic coating over everything (UV, bird droppings, easier washing). Many people do both. What's the car?`, actions: [], next: ['Book a time', 'Ceramic coating instead'] }; }
    if (/fix|problem|broken|wrong/.test(lc)) return { reply: `Tell me what you see: peeling tint, swirled paint, a torn seat, a warning light, a noise. I'll match it to the right service.`, actions: [], next: ['Peeling tint', 'Swirled paint', 'Torn seat', 'Warning light'] };
    if (/thank/.test(lc)) return { reply: `Any time. The booking page is open around the clock and the shop confirms by text.`, actions: [bookAction(state.service)], next: [] };
    // Fallback: honest, with a route out.
    return {
      reply: `I didn't catch that. I can help with tint, wraps, PPF, ceramic coating, detailing, paint correction, upholstery and inspections, or get you booked.${st.open ? ` The shop is open now if you'd rather call.` : ''}`,
      actions: [bookAction(state.service), ...callAction()], next: cfg.quick,
    };
  }
}
