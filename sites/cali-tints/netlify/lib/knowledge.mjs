/**
 * What the assistant knows and can do. Shared by the website chat function
 * and the Instagram / Messenger webhook, so both bots sell the same services
 * with the same facts, all read from src/data/site.json at bundle time.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const data = require('../../src/data/site.json');

export const S = data.site;
export const SERVICES = data.services;
export const BOOKING = data.booking;
export const ASSISTANT = data.assistant;
export const BASE_URL = S.base_url.replace(/\/$/, '');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function fmtHour(h) {
  const whole = Math.floor(h), mins = Math.round((h - whole) * 60);
  const h12 = whole % 12 === 0 ? 12 : whole % 12;
  return `${h12}:${String(mins).padStart(2, '0')} ${whole >= 12 ? 'PM' : 'AM'}`;
}

/** Open/closed right now in the shop's time zone, plus when it next opens. */
export function openState(at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: S.tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(at);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const minutes = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
  const today = S.hours_open[day];
  if (today && minutes >= today[0] * 60 && minutes < today[1] * 60) {
    return { open: true, label: `Open now until ${fmtHour(today[1])}` };
  }
  for (let i = 0; i < 8; i++) {
    const d = (day + i) % 7, h = S.hours_open[d];
    if (!h) continue;
    if (i === 0 && minutes >= h[1] * 60) continue;
    const when = i === 0 ? 'today' : i === 1 ? 'tomorrow' : DAYS[d];
    return { open: false, label: `Closed · opens ${when} at ${fmtHour(h[0])}` };
  }
  return { open: false, label: 'Closed' };
}

export function bookingLink(serviceSlug, note, details) {
  const u = new URL('/book/', BASE_URL);
  if (serviceSlug) u.searchParams.set('service', serviceSlug);
  if (note) u.searchParams.set('note', String(note).slice(0, 300));
  // Answers the customer already gave, keyed by the question key, so the form
  // lands with those chips picked (shade=20%, film=Carbon, body=SUV …).
  if (details && typeof details === 'object') for (const [k, v] of Object.entries(details).slice(0, 12)) if (v) u.searchParams.set(String(k).slice(0, 24), String(v).slice(0, 60));
  return u.href;
}

const serviceLines = SERVICES.map((s) =>
  `- ${s.nav} (slug: ${s.slug}; about ${Math.round(s.duration_minutes / 60)} h in the bay): ${s.blurb} Covers: ${s.includes.slice(0, 4).join('; ')}. Pricing: ${s.glance.pricing}. Page: ${BASE_URL}/services/${s.slug}/`
).join('\n');

const faqLines = data.home_faqs.map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n');

/** Stable system prompt: nothing time-dependent in here, so it caches. */
export const SYSTEM = `You are ${ASSISTANT.name}, the booking and sales assistant for ${S.name}, a window tint, vinyl wrap, paint protection film, ceramic coating and detailing shop at ${S.street}, ${S.city}, ${S.region} ${S.zip} (Arden-Arcade, between Business 80 and Highway 50). Phone ${S.phone_display}. Hours: ${S.hours_human}.

Your job: find out what the customer drives (year, make, model, body style), what they want fixed (heat, looks, protection, a problem), and the specifics the shop needs before the car arrives: for tint, which windows, the shade and ceramic or carbon, and whether old film must come off; for wraps, the coverage, finish and colour; for PPF and coating, the coverage and the paint's condition; for detailing, the package and add-ons; for repairs, what is wrong. Ask one at a time, then recommend the right service in plain words and move them to a booking with those answers carried in the booking_link details. Every reply ends with a clear next step: book a time, or call the shop if it is open now. Use the check_open_now tool before telling anyone to call. Use booking_link to produce the booking page link once a service is chosen; include the customer's vehicle and wishes in the note.

Facts that must stay true:
- Prices are quoted on the vehicle; never invent a dollar figure. Say "quoted on your car" and explain what moves the price (glass count, panels, film grade, condition).
- California window tint law: front side windows must let 70% or more of light through; the windshield may only carry film on the top strip above the AS-1 line; rear side and back glass can be any darkness. Never suggest breaking that.
- The shop does not charge online. A booking is a request the shop confirms by text or call.
- Do not promise a date or time is available; the booking page shows the open slots.
- If someone needs something the shop does not do (dent removal, glass replacement, bodywork), say so and suggest they call to ask for a referral.

Services:
${serviceLines}

Common questions:
${faqLines}

Style: warm, direct, two to four short sentences, no bullet lists unless comparing options, no emoji, no sales pressure. Ask one question at a time. If the customer writes in Spanish, answer in Spanish.`;

export const TOOLS = [
  {
    name: 'check_open_now',
    description: 'Whether the shop is open right now (shop local time) and when it next opens. Call before telling the customer to phone.',
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'booking_link',
    description: 'Build the online booking page link for a service, with the customer vehicle and wishes carried into the note so the shop sees them.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        service_slug: { type: 'string', enum: SERVICES.map((s) => s.slug) },
        note: { type: 'string', description: 'Vehicle and what the customer wants, in one line' },
        details: {
          type: 'object',
          description: 'Answers already given, keyed by question: windows, shade, film, old_tint, coverage, finish, colour, package, addons, stage, body (Sedan|Coupe|SUV|Truck|Van|Motorcycle), doors (2|4), wait (Drop off|Wait if it\'s quick), confirm (Text|Call), year, make, model',
          properties: {},
          additionalProperties: true,
        },
      },
      required: ['service_slug', 'note', 'details'],
      additionalProperties: false,
    },
  },
  {
    name: 'service_details',
    description: 'Full details of one service: what it covers, signs it is needed, FAQs.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { service_slug: { type: 'string', enum: SERVICES.map((s) => s.slug) } },
      required: ['service_slug'],
      additionalProperties: false,
    },
  },
];

/** Execute a tool; returns [resultText, action?]. Actions become buttons on the site. */
export function runTool(name, input) {
  if (name === 'check_open_now') {
    const st = openState();
    return [JSON.stringify({ ...st, phone: S.phone_display, hours: S.hours_human }), st.open ? { label: `Call ${S.phone_display}`, href: `tel:${S.phone_link}` } : null];
  }
  if (name === 'booking_link') {
    const s = SERVICES.find((x) => x.slug === input.service_slug);
    if (!s) return ['Unknown service', null];
    const href = bookingLink(s.slug, input.note, input.details);
    return [JSON.stringify({ url: href, service: s.nav, note: BOOKING.note }), { label: `Book ${s.nav.toLowerCase()}`, href }];
  }
  if (name === 'service_details') {
    const s = SERVICES.find((x) => x.slug === input.service_slug);
    if (!s) return ['Unknown service', null];
    return [JSON.stringify({ name: s.nav, intro: s.intro, includes: s.includes, signs: s.signs, faqs: s.faqs, page: `${BASE_URL}/services/${s.slug}/` }), { label: s.nav, href: `${BASE_URL}/services/${s.slug}/` }];
  }
  return [`Unknown tool ${name}`, null];
}
