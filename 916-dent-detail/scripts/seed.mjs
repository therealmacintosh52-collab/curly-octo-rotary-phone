#!/usr/bin/env node
// Seed the MOCK store (the zero-key demo database) and write it to a JSON file the dev/prod server can load.
//   npm run seed                      writes .data/mock-db.json  (base data only: services, techs, hours, demo logins, demo dealer)
//   npm run seed -- --demo            + sample customers, leads at every pipeline stage (incl. chat/sms), bookings today/tomorrow, an escalated chat
//   npm run seed -- --out=path.json   choose the file
// Use it:  MOCK_DB_FILE=.data/mock-db.json npm start   (bookings made afterwards persist to the same file)
// Live (Supabase) data is seeded with supabase/seed.sql instead; see README. Nothing here talks to a network or a real account.
import { mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? '').split('=')[1] ?? d;
const out = resolve(arg('out', '.data/mock-db.json'));
const demo = process.argv.includes('--demo');
mkdirSync(dirname(out), { recursive: true });
if (existsSync(out)) rmSync(out); // seed = start clean
process.env.MOCK_DB_FILE = out;

const { mockRepo } = await import('../src/lib/db/mock.ts');
const { SEED_TECH_IDS } = await import('../src/lib/db/seed.ts');
const db = mockRepo();
const tables = (await Promise.all(['services', 'techs', 'profiles', 'tech_availability', 'dealers'].map(async (t) => [t, (await db[t].list()).length]))).map(([t, n]) => `${t}=${n}`);

if (demo) {
  const HOUR = 3_600_000;
  const at = (h) => new Date(Date.now() + h * HOUR).toISOString();
  const mk = async (name, phone, extra = {}) => db.customers.insert({ name, phone, email: `${name.split(' ')[0].toLowerCase()}@example.com`, sms_opt_in: false, ...extra });
  const sam = await mk('Sam Rivera', '+19165550142', { sms_opt_in: true, sms_opt_in_at: new Date().toISOString(), sms_opt_in_text: 'demo seed' });
  const dana = await mk('Dana Whitfield', '+19165550188');
  const pat = await mk('Pat Nguyen', '+19165550123');
  const car = (c, year, make, model, size) => db.vehicles.insert({ customer_id: c.id, year, make, model, size_class: size });
  const rav4 = await car(sam, 2021, 'Toyota', 'RAV4', 'suv');
  const taco = await car(dana, 2020, 'Toyota', 'Tacoma', 'truck');
  await car(pat, 2019, 'Honda', 'Civic', 'sedan');

  const lead = (stage, source, name, phone) => db.leads.insert({ name, phone, stage, source, zip: '95624', notes: 'Demo seed lead' });
  await lead('new', 'google', 'Alex Chen', '+19165550101');
  await lead('new', 'door_knock', 'Hanlees lot (2 trucks)', null);
  await lead('new', 'chat', 'Website chat visitor', null);
  await lead('new', 'sms', 'Texter', '+19165550102');
  await lead('quoted', 'meta_ads', 'Riley Park', '+19165550103');
  const booked = await db.leads.insert({ name: sam.name, phone: sam.phone, customer_id: sam.id, stage: 'booked', source: 'gbp', zip: '95624' });

  const tech = SEED_TECH_IDS[0];
  const booking = (c, v, h, services, status, size) => db.bookings.insert({
    customer_id: c.id, vehicle_id: v?.id ?? null, lead_id: c === sam ? booked.id : null, tech_id: tech, status, services, addons: [], size_class: size,
    starts_at: at(h), ends_at: at(h + 2), duration_min: 120, zip: '95624', address_line: '123 Main St', city: 'Elk Grove', area_status: 'in_area', travel_fee: 0,
    price_low: 200, price_high: 230, needs_review: false, deposit_amount: 50, deposit_status: 'paid', reschedule_count: 0,
  });
  const b1 = await booking(sam, rav4, 3, ['interior'], 'confirmed', 'suv');
  await booking(dana, taco, 27, ['paint-correction'], 'confirmed', 'truck');
  await db.jobs.insert({ booking_id: b1.id, customer_id: sam.id, vehicle_id: rav4.id, tech_id: tech, stage: 'booked' });

  const conv = await db.conversations.insert({ channel: 'sms', external_id: 'demo-seed', status: 'escalated', cost_usd: 0.02, needs_human: true, escalation_reason: 'complaint',
    escalated_at: at(-1), summary: 'Customer says the last detail left swirl marks.', last_message_at: at(-1), state: { v: 1, turn: 2, photos: [], offered: [], bookingIds: [], collected: {}, strikes: 0, injectionAttempts: 0, spam: 0, paused: true, verifiedPhone: pat.phone } });
  await db.conversations.update(conv.id, { customer_id: pat.id });
  await db.messages.insert({ conversation_id: conv.id, role: 'user', content: 'The last detail left swirl marks on my hood. I want someone to call me.', meta: {} });
  await db.messages.insert({ conversation_id: conv.id, role: 'assistant', content: "I'm sorry about that. I've passed this to the owners and they'll reach out to you directly.", meta: {} });
}
await new Promise((r) => setTimeout(r, 400)); // the mock store persists on a 50 ms debounce
const size = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
if (!size) { console.error('seed: nothing was written'); process.exit(1); }
console.log(`seeded mock store -> ${out}\n  base: ${tables.join(' ')}${demo ? `\n  demo: customers=${size.customers.length} leads=${size.leads.length} bookings=${size.bookings.length} conversations=${size.conversations.length}` : ''}`);
console.log(`\nStart the app with it:  MOCK_DB_FILE=${out} npm start`);
