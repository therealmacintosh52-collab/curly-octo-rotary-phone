// Applies supabase/migrations/0001..0004 to an in-memory Postgres (PGlite, with Supabase auth/role stubs) and checks the 0004
// behaviour: open-VIN uniqueness, one statement per dealer per month, status CHECKs, and the tightened dealer RLS.
// Not part of `vitest run` (PGlite is not a repo dependency). Run:  npm i --no-save @electric-sql/pglite && node tests/unit/dealers/migration-0004.check.mjs
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
const dir = new URL('../../../supabase/migrations/', import.meta.url).pathname;
const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
// Supabase stubs: roles, auth schema, auth.uid()
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
`);
for (const f of ['0001_init.sql', '0002_admin.sql', '0003_concierge.sql', '0004_dealers.sql']) {
  try { await db.exec(fs.readFileSync(dir + f, 'utf8')); console.log('applied', f); }
  catch { console.log('FAILED', f); process.exit(1); }
}
// behavior checks of 0004
const q = async (sql, params) => (await db.query(sql, params)).rows;
const d = (await q(`insert into dealers(name,status) values ('T','active') returning id`))[0].id;
await q(`insert into dealer_vehicles(dealer_id,vin,status) values ($1,'V1','submitted')`, [d]);
try { await q(`insert into dealer_vehicles(dealer_id,vin,status) values ($1,'V1','scheduled')`, [d]); console.log('FAIL: duplicate open VIN allowed'); } catch { console.log('ok: duplicate open VIN refused'); }
await q(`update dealer_vehicles set status='cancelled' where vin='V1'`);
await q(`insert into dealer_vehicles(dealer_id,vin,status) values ($1,'V1','submitted')`, [d]); console.log('ok: cancelled VIN can be resubmitted');
await q(`insert into dealer_statements(dealer_id,period_start,period_end,total) values ($1,'2026-09-01','2026-09-30',10)`, [d]);
try { await q(`insert into dealer_statements(dealer_id,period_start,period_end,total) values ($1,'2026-09-01','2026-09-30',10)`, [d]); console.log('FAIL: dup statement allowed'); } catch { console.log('ok: one statement per dealer per month'); }
try { await q(`update dealers set status='rejected' where id=$1`, [d]); console.log('ok: dealers.status accepts rejected'); } catch { console.log('FAIL: rejected status not accepted'); }
try { await q(`update dealer_vehicles set status='bogus'`); console.log('FAIL: bogus status allowed'); } catch { console.log('ok: bogus vehicle status refused'); }
console.log('policies on dealer_vehicles:', (await q(`select policyname, cmd from pg_policies where tablename='dealer_vehicles' order by 1`)).map((r) => `${r.policyname}(${r.cmd})`).join(', '));
console.log('policy job_photos_dealer_read:', (await q(`select 1 from pg_policies where policyname='job_photos_dealer_read'`)).length === 1);
// RLS: a dealer user cannot update status; can insert only submitted/unpriced
const p = (await q(`insert into auth.users(email) values ('u@x') returning id`))[0].id;
await q(`insert into profiles(id,role) values ($1,'dealer')`, [p]);
await q(`insert into dealer_users(dealer_id,profile_id) values ($1,$2)`, [d, p]);
await db.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;`);
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${p}', false);`);
console.log('dealer sees own vehicles:', (await q(`select count(*)::int c from dealer_vehicles`))[0].c);
const upd = await q(`update dealer_vehicles set status='done', price=1 returning id`);
console.log(upd.length === 0 ? 'ok: dealer cannot update vehicle rows (no update policy)' : 'FAIL: dealer updated rows');
try { await q(`insert into dealer_vehicles(dealer_id,vin,status,price) values ($1,'V9','submitted',5)`, [d]); console.log('FAIL: dealer inserted a priced vehicle'); } catch { console.log('ok: dealer cannot insert a priced vehicle'); }
await q(`insert into dealer_vehicles(dealer_id,vin) values ($1,'V10')`, [d]); console.log('ok: dealer can insert a plain submitted vehicle');
await db.exec(`reset role;`);
