// RLS + migration test on an in-memory Postgres (PGlite) with Supabase role/auth stubs. Applies EVERY file in supabase/migrations
// in order, then supabase/seed.sql, then asserts who may read/write what for: anon, a signed-in stranger (a customer: customers have
// no accounts, they use signed links through the server), owner, admin, tech A, tech B, dealer 1, dealer 2.
// This is the executable version of tests/rls/rls-intent.md. It tests POLICY INTENT on a real Postgres engine; it is not Supabase
// itself (no PostgREST, no JWT verification, no Storage), so the first run against the real project is still on the launch checklist.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../supabase');
const U = {
  owner: '10000000-0000-4000-8000-000000000001', admin: '10000000-0000-4000-8000-000000000002',
  techA: '10000000-0000-4000-8000-000000000003', techB: '10000000-0000-4000-8000-000000000004',
  dealer1: '10000000-0000-4000-8000-000000000005', dealer2: '10000000-0000-4000-8000-000000000006', stranger: '10000000-0000-4000-8000-000000000007',
};
const ID = {
  tA: '20000000-0000-4000-8000-00000000000a', tB: '20000000-0000-4000-8000-00000000000b', d1: '30000000-0000-4000-8000-000000000001', d2: '30000000-0000-4000-8000-000000000002',
  c1: '40000000-0000-4000-8000-000000000001', c2: '40000000-0000-4000-8000-000000000002', bA: '50000000-0000-4000-8000-00000000000a', bB: '50000000-0000-4000-8000-00000000000b',
  jA: '60000000-0000-4000-8000-00000000000a', jB: '60000000-0000-4000-8000-00000000000b', pB: '70000000-0000-4000-8000-00000000000b', lead: '80000000-0000-4000-8000-000000000001',
  v1: '90000000-0000-4000-8000-000000000001', v2: '90000000-0000-4000-8000-000000000002', inv1: 'a0000000-0000-4000-8000-000000000001', invD1: 'a0000000-0000-4000-8000-0000000000d1',
  conv: 'b0000000-0000-4000-8000-000000000001',
};

let db: PGlite;
type Actor = 'anon' | keyof typeof U;
/** Run SQL as an actor (Supabase semantics: anon -> role anon; signed in -> role authenticated + auth.uid()). */
async function as<T>(actor: Actor, fn: () => Promise<T>): Promise<T> {
  await db.exec(actor === 'anon' ? `set role anon; select set_config('request.jwt.claim.sub', '', false);` : `set role authenticated; select set_config('request.jwt.claim.sub', '${U[actor]}', false);`);
  // reset the claim too: the service role (superuser here) has NO jwt, and the tech-column trigger keys off auth.uid() being null
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
const rows = async (sql: string) => (await db.query<Record<string, unknown>>(sql)).rows;
const count = (actor: Actor, table: string, where = 'true') => as(actor, async () => {
  try { return Number((await rows(`select count(*)::int as n from public.${table} where ${where}`))[0]!.n); } catch { return -1; } // -1 = permission denied
});
/** "denied" = permission error, RLS violation, or zero rows affected. */
const denied = (actor: Actor, sql: string) => as(actor, async () => {
  try { const r = await db.query(sql); return (/^\s*select/i.test(sql) ? r.rows.length : (r.affectedRows ?? 0)) === 0; } catch { return true; }
});
const allowed = async (actor: Actor, sql: string) => !(await denied(actor, sql));

beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    -- Supabase default privileges: every role may touch every public table; RLS is the only gate.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    grant usage on schema public, auth to anon, authenticated, service_role;
  `);
  for (const f of readdirSync(path.join(root, 'migrations')).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(path.join(root, 'migrations', f), 'utf8'));
  await db.exec(readFileSync(path.join(root, 'seed.sql'), 'utf8'));
  await db.exec(`
    insert into auth.users(id, email) select v, 'u' || row_number() over () || '@x.test' from unnest(array['${Object.values(U).join("','")}']::uuid[]) v;
    insert into techs(id, name) values ('${ID.tA}','Tech A'), ('${ID.tB}','Tech B');
    insert into profiles(id, role, tech_id) values ('${U.owner}','owner',null), ('${U.admin}','admin',null), ('${U.techA}','tech','${ID.tA}'), ('${U.techB}','tech','${ID.tB}'),
      ('${U.dealer1}','dealer',null), ('${U.dealer2}','dealer',null), ('${U.stranger}','customer',null);
    insert into dealers(id, name, status) values ('${ID.d1}','Dealer One','active'), ('${ID.d2}','Dealer Two','active');
    insert into dealer_users(dealer_id, profile_id) values ('${ID.d1}','${U.dealer1}'), ('${ID.d2}','${U.dealer2}');
    insert into customers(id, name, phone, email) values ('${ID.c1}','Cust One','+19165550101','one@x.test'), ('${ID.c2}','Cust Two','+19165550102','two@x.test');
    insert into vehicles(id, customer_id, make) values ('${ID.v1}','${ID.c1}','Toyota'), ('${ID.v2}','${ID.c2}','Honda');
    insert into leads(id, name, source) values ('${ID.lead}','Lead','google');
    insert into bookings(id, customer_id, vehicle_id, tech_id, status, starts_at, ends_at, duration_min, price_low, price_high) values
      ('${ID.bA}','${ID.c1}','${ID.v1}','${ID.tA}','confirmed','2027-01-05 17:00+00','2027-01-05 19:00+00',120, 200, 230),
      ('${ID.bB}','${ID.c2}','${ID.v2}','${ID.tB}','confirmed','2027-01-05 17:00+00','2027-01-05 19:00+00',120, 300, 330);
    insert into jobs(id, booking_id, customer_id, tech_id) values ('${ID.jA}','${ID.bA}','${ID.c1}','${ID.tA}'), ('${ID.jB}','${ID.bB}','${ID.c2}','${ID.tB}');
    insert into job_photos(id, job_id, kind, storage_path) values ('${ID.pB}','${ID.jB}','after','jobs/b.jpg');
    insert into invoices(id, job_id, customer_id, status, total) values ('${ID.inv1}','${ID.jA}','${ID.c1}','sent', 230);
    insert into invoices(id, dealer_id, status, total) values ('${ID.invD1}','${ID.d1}','sent', 500);
    insert into dealer_vehicles(dealer_id, vin) values ('${ID.d1}','VIN-D1'), ('${ID.d2}','VIN-D2');
    insert into conversations(id, channel, external_id) values ('${ID.conv}','web','x');
    insert into messages(conversation_id, role, content) values ('${ID.conv}','user','hi');
    insert into customer_memory(customer_key, summary) values ('p:+19165550101','x');
  `);
}, 120_000);
afterAll(async () => { await db.close(); });

const STAFF_ONLY = ['leads', 'quotes', 'memberships', 'membership_visits', 'referral_codes', 'referral_credits', 'ad_spend', 'events', 'notification_queue', 'stripe_events', 'conversations', 'messages', 'customer_memory', 'weather_flags', 'blackout_dates', 'admin_blocks'];

describe('migrations apply cleanly in order and seed.sql runs', () => {
  it('every public table has RLS enabled (nothing is readable by default Supabase grants alone)', async () => {
    const off = await rows(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`);
    expect(off).toEqual([]);
  });
  it('seed.sql produced the 6 services, 2 techs with the configured weekly hours and no demo dealer', async () => {
    expect((await rows(`select count(*)::int n from services`))[0]!.n).toBe(6);
    expect((await rows(`select count(*)::int n from techs where id in ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000a2')`))[0]!.n).toBe(2);
    expect((await rows(`select count(*)::int n from tech_availability where tech_id in ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000a2')`))[0]!.n).toBe(12);
    expect((await rows(`select to_char(end_time, 'HH24:MI') t from tech_availability where weekday = 6 limit 1`))[0]!.t).toBe('15:00'); // Saturday closes early, as in config
    expect((await rows(`select count(*)::int n from dealers where name like '[DEMO]%'`))[0]!.n).toBe(0);
  });
  it('seed.sql is idempotent', async () => {
    await db.exec(readFileSync(path.join(root, 'seed.sql'), 'utf8'));
    expect((await rows(`select count(*)::int n from services`))[0]!.n).toBe(6);
  });
});

describe('anon (the public internet with the anon key)', () => {
  it('reads active services and nothing else', async () => {
    expect(await count('anon', 'services')).toBe(6);
    for (const t of ['customers', 'vehicles', 'bookings', 'jobs', 'job_photos', 'invoices', 'payments', 'notes', 'techs', 'tech_availability', 'profiles', 'dealers', 'dealer_users', 'dealer_vehicles', 'dealer_statements', 'settings', 'ad_spend', ...STAFF_ONLY]) {
      expect(await count('anon', t), t).toBeLessThanOrEqual(0);
    }
  });
  it('cannot write anywhere, including services', async () => {
    expect(await denied('anon', `insert into customers(name) values ('x')`)).toBe(true);
    expect(await denied('anon', `insert into leads(name, source) values ('x','google')`)).toBe(true);
    expect(await denied('anon', `update services set active = false`)).toBe(true);
    expect(await denied('anon', `delete from bookings`)).toBe(true);
    expect(await denied('anon', `insert into profiles(id, role) values (gen_random_uuid(), 'owner')`)).toBe(true);
  });
  it('cannot call the service-role-only functions or the policy helper functions', async () => {
    expect(await denied('anon', `select public.next_invoice_number(2027)`)).toBe(true);
    expect(await denied('anon', `select public.merge_customers('${ID.c1}', '${ID.c2}')`)).toBe(true);
    for (const f of ['is_staff()', 'current_role_name()', 'my_tech_id()', 'my_dealer_ids()']) expect(await denied('anon', `select public.${f}`), f).toBe(true);
  });
});

describe('a signed-in stranger (public sign-up is on by default in Supabase): customers have no table access', () => {
  it('sees active services only', async () => {
    expect(await count('stranger', 'services')).toBe(6);
    for (const t of ['customers', 'vehicles', 'bookings', 'jobs', 'job_photos', 'invoices', 'payments', 'notes', 'dealers', 'dealer_vehicles', 'dealer_statements', ...STAFF_ONLY]) expect(await count('stranger', t), t).toBeLessThanOrEqual(0);
    expect(await count('stranger', 'profiles')).toBe(1); // only their own row
  });
  it('cannot promote themselves or write business data', async () => {
    expect(await denied('stranger', `update profiles set role = 'owner' where id = '${U.stranger}'`)).toBe(true);
    expect(await denied('stranger', `insert into profiles(id, role) values ('${U.stranger}', 'owner')`)).toBe(true);
    expect(await denied('stranger', `insert into dealer_users(dealer_id, profile_id) values ('${ID.d1}', '${U.stranger}')`)).toBe(true);
    expect(await denied('stranger', `insert into bookings(customer_id, starts_at, ends_at, duration_min) values ('${ID.c1}', now(), now() + interval '1 hour', 60)`)).toBe(true);
    expect(await denied('stranger', `insert into dealer_vehicles(dealer_id, vin) values ('${ID.d1}', 'EVIL')`)).toBe(true);
  });
});

describe('owner and admin', () => {
  it.each(['owner', 'admin'] as const)('%s reads and writes everything', async (who) => {
    for (const t of ['customers', 'bookings', 'jobs', 'invoices', 'leads', 'conversations', 'messages', 'dealers', 'dealer_vehicles', 'customer_memory', 'profiles']) expect(await count(who, t), t).toBeGreaterThan(0);
    expect(await allowed(who, `update customers set name = 'Cust One' where id = '${ID.c1}'`)).toBe(true);
    expect(await allowed(who, `update bookings set price_low = 201 where id = '${ID.bA}'`)).toBe(true);
    await db.exec(`update bookings set price_low = 200 where id = '${ID.bA}'`);
  });
  it('still cannot call the service-role-only functions through the API roles', async () => {
    expect(await denied('owner', `select public.next_invoice_number(2027)`)).toBe(true);
    expect(await denied('owner', `select public.merge_customers('${ID.c1}', '${ID.c2}')`)).toBe(true);
  });
});

describe('technicians', () => {
  it('see only their own bookings, jobs, customers, vehicles, invoices and photos', async () => {
    expect(await count('techA', 'bookings')).toBe(1);
    expect(await count('techA', 'bookings', `id = '${ID.bB}'`)).toBe(0);
    expect(await count('techA', 'jobs')).toBe(1);
    expect(await count('techA', 'customers')).toBe(1);
    expect(await count('techA', 'customers', `id = '${ID.c2}'`)).toBe(0);
    expect(await count('techA', 'vehicles', `id = '${ID.v2}'`)).toBe(0);
    expect(await count('techA', 'invoices')).toBe(1); // their own job's invoice, not the dealer's
    expect(await count('techA', 'job_photos', `id = '${ID.pB}'`)).toBe(0);
    expect(await count('techB', 'job_photos', `id = '${ID.pB}'`)).toBe(1);
  });
  it('see nothing from the owner-only tables', async () => {
    for (const t of [...STAFF_ONLY, 'dealers', 'dealer_vehicles', 'dealer_statements', 'ad_spend']) expect(await count('techA', t), t).toBeLessThanOrEqual(0);
  });
  it('can move their own booking through the field statuses but not change price, customer or tech', async () => {
    expect(await allowed('techA', `update bookings set status = 'on_the_way' where id = '${ID.bA}'`)).toBe(true);
    expect(await denied('techA', `update bookings set price_low = 1 where id = '${ID.bA}'`)).toBe(true);
    expect(await denied('techA', `update bookings set customer_id = '${ID.c2}' where id = '${ID.bA}'`)).toBe(true);
    expect(await denied('techA', `update bookings set tech_id = '${ID.tB}' where id = '${ID.bA}'`)).toBe(true);
    expect(await denied('techA', `update bookings set status = 'cancelled' where id = '${ID.bA}'`)).toBe(true);
    expect(await denied('techA', `update bookings set status = 'completed' where id = '${ID.bB}'`)).toBe(true); // not their booking
    await db.exec(`update bookings set status = 'confirmed' where id = '${ID.bA}'`);
  });
  it('cannot resurrect a cancelled / completed / expired booking through direct access (legal source status only)', async () => {
    await db.exec(`update bookings set status = 'cancelled' where id = '${ID.bA}'`);
    expect(await denied('techA', `update bookings set status = 'in_progress' where id = '${ID.bA}'`)).toBe(true);
    await db.exec(`update bookings set status = 'confirmed' where id = '${ID.bA}'`);
  });
  it('can update the tech-view fields of their job but not price, owner or dealer; cannot touch invoices or payments', async () => {
    expect(await allowed('techA', `update jobs set summary = 'done well' where id = '${ID.jA}'`)).toBe(true);
    expect(await denied('techA', `update jobs set final_price = 1 where id = '${ID.jA}'`)).toBe(true);
    expect(await denied('techA', `update jobs set tech_id = '${ID.tB}' where id = '${ID.jA}'`)).toBe(true);
    expect(await denied('techA', `update jobs set dealer_id = '${ID.d1}' where id = '${ID.jA}'`)).toBe(true);
    expect(await denied('techA', `update invoices set total = 1 where id = '${ID.inv1}'`)).toBe(true);
    expect(await denied('techA', `insert into payments(booking_id, kind, amount) values ('${ID.bA}', 'balance', 1)`)).toBe(true);
    expect(await denied('techA', `delete from jobs where id = '${ID.jA}'`)).toBe(true);
  });
  it('can add notes to their own job but not to another tech\'s, and cannot edit or delete them', async () => {
    expect(await allowed('techA', `insert into notes(entity_type, entity_id, author_id, body) values ('job', '${ID.jA}', '${U.techA}', 'gate code 1234')`)).toBe(true);
    expect(await denied('techA', `insert into notes(entity_type, entity_id, author_id, body) values ('job', '${ID.jB}', '${U.techA}', 'x')`)).toBe(true);
    expect(await denied('techA', `insert into notes(entity_type, entity_id, author_id, body) values ('job', '${ID.jA}', '${U.owner}', 'spoofed author')`)).toBe(true);
    expect(await denied('techA', `update notes set body = 'x'`)).toBe(true);
    expect(await denied('techA', `delete from notes`)).toBe(true);
  });
  it('cannot read or call the service-role functions', async () => {
    expect(await denied('techA', `select public.merge_customers('${ID.c1}', '${ID.c2}')`)).toBe(true);
  });
});

describe('dealers (portal users)', () => {
  it('see only their own dealer, vehicles and invoices', async () => {
    expect(await count('dealer1', 'dealers')).toBe(1);
    expect(await count('dealer1', 'dealer_vehicles')).toBe(1);
    expect(await count('dealer1', 'dealer_vehicles', `vin = 'VIN-D2'`)).toBe(0);
    expect(await count('dealer1', 'invoices')).toBe(1);
    expect(await count('dealer1', 'invoices', `id = '${ID.inv1}'`)).toBe(0); // a retail customer's invoice
    expect(await count('dealer2', 'invoices')).toBe(0);
  });
  it('see no retail data', async () => {
    for (const t of ['customers', 'vehicles', 'bookings', 'jobs', 'payments', 'notes', 'techs', ...STAFF_ONLY]) expect(await count('dealer1', t), t).toBeLessThanOrEqual(0);
  });
  it('can submit a plain vehicle for themselves only, and cannot set status, price, job, invoice or approvals', async () => {
    expect(await allowed('dealer1', `insert into dealer_vehicles(dealer_id, vin) values ('${ID.d1}', 'NEW-1')`)).toBe(true);
    expect(await denied('dealer1', `insert into dealer_vehicles(dealer_id, vin) values ('${ID.d2}', 'NEW-X')`)).toBe(true);
    expect(await denied('dealer1', `insert into dealer_vehicles(dealer_id, vin, status) values ('${ID.d1}', 'NEW-2', 'done')`)).toBe(true);
    expect(await denied('dealer1', `insert into dealer_vehicles(dealer_id, vin, price) values ('${ID.d1}', 'NEW-3', 5)`)).toBe(true);
    expect(await denied('dealer1', `insert into dealer_vehicles(dealer_id, vin, invoice_id) values ('${ID.d1}', 'NEW-4', '${ID.invD1}')`)).toBe(true);
    expect(await denied('dealer1', `update dealer_vehicles set status = 'done'`)).toBe(true);
    expect(await denied('dealer1', `delete from dealer_vehicles`)).toBe(true);
  });
  it('cannot read another tenant\'s before/after photos by pointing a vehicle at their job (job_id must be null on insert)', async () => {
    expect(await count('dealer1', 'job_photos', `id = '${ID.pB}'`)).toBe(0);
    expect(await denied('dealer1', `insert into dealer_vehicles(dealer_id, vin, job_id) values ('${ID.d1}', 'SNOOP', '${ID.jB}')`)).toBe(true);
    expect(await count('dealer1', 'job_photos', `id = '${ID.pB}'`)).toBe(0);
  });
  it('cannot change their own membership, role or dealer record', async () => {
    expect(await denied('dealer1', `insert into dealer_users(dealer_id, profile_id) values ('${ID.d2}', '${U.dealer1}')`)).toBe(true);
    expect(await denied('dealer1', `update dealers set net_terms_approved = true, status = 'active' where id = '${ID.d1}'`)).toBe(true);
    expect(await denied('dealer1', `update profiles set role = 'owner' where id = '${U.dealer1}'`)).toBe(true);
  });
});

describe('integrity guarantees the app relies on', () => {
  it('a technician cannot hold two overlapping live bookings (exclusion constraint)', async () => {
    await expect(db.query(`insert into bookings(tech_id, status, starts_at, ends_at, duration_min) values ('${ID.tA}','confirmed','2027-01-05 18:00+00','2027-01-05 20:00+00',120)`)).rejects.toThrow();
  });
  it('one job per booking (a Stripe webhook racing the customer must not create two)', async () => {
    await expect(db.query(`insert into jobs(booking_id, tech_id) values ('${ID.bA}','${ID.tA}')`)).rejects.toThrow();
  });
  it('a Stripe payment intent can be recorded once', async () => {
    await db.exec(`insert into payments(booking_id, kind, amount, stripe_payment_intent_id) values ('${ID.bA}','deposit',50,'pi_x1')`);
    await expect(db.query(`insert into payments(booking_id, kind, amount, stripe_payment_intent_id) values ('${ID.bA}','deposit',50,'pi_x1')`)).rejects.toThrow();
  });
  it('a Twilio MessageSid is recorded once (webhook retries)', async () => {
    await db.exec(`insert into events(type, entity_id) values ('concierge.sms_in', 'SM1')`);
    await expect(db.query(`insert into events(type, entity_id) values ('concierge.sms_in', 'SM1')`)).rejects.toThrow();
  });
  it('lead sources chat and sms are accepted, junk is not', async () => {
    await db.exec(`insert into leads(name, source) values ('c','chat'), ('s','sms')`);
    await expect(db.query(`insert into leads(name, source) values ('x','tiktok-dance')`)).rejects.toThrow();
  });
  it('invoice numbers count up and are not callable by API roles; merge_customers moves rows atomically (service role)', async () => {
    const a = (await rows(`select public.next_invoice_number(2027) as n`))[0]!.n;
    const b = (await rows(`select public.next_invoice_number(2027) as n`))[0]!.n;
    expect([a, b]).toEqual(['INV-2027-0001', 'INV-2027-0002']);
    const moved = (await rows(`select public.merge_customers('${ID.c1}', '${ID.c2}') as m`))[0]!.m as Record<string, number>;
    expect(moved.bookings).toBe(1);
    expect((await rows(`select count(*)::int n from customers where id = '${ID.c2}'`))[0]!.n).toBe(0);
  });
});
