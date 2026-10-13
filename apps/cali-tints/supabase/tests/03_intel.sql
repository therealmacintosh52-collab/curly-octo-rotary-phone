-- Intel: trouble codes and vehicle intelligence (0045). Runs after 02_retail.sql on the same database.
\set ON_ERROR_STOP on

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, false);
  select set_config('role', 'authenticated', false);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', false);
  select set_config('request.jwt.claims', '', false);
$$;

-- The seed: 194 generic definitions, the safety flags where they belong.
do $$
declare n int;
begin
  select count(*) into n from public.dtc_codes; assert n = 194, '0045: 194 definitions, got ' || n;
  assert (select safety_flag from public.dtc_codes where code = 'C0035') = 'brakes', '0045: C0035 flags the brakes';
  assert (select safety_flag from public.dtc_codes where code = 'P0A80') = 'ev_high_voltage', '0045: P0A80 flags high voltage';
  assert (select system from public.dtc_codes where code = 'P0300') = 'ignition_misfire', '0045: P0300 system';
  assert (select count(*) from public.dtc_codes where safety_flag is not null) = 30, '0045: 30 safety-flagged codes';
end $$;

-- A detailer reads definitions and logs lookups for the company; the cache is out of reach.
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare d jsonb; r jsonb; ok boolean;
begin
  d := public.dtc_definitions(array['p0300', 'U0100', 'P9999']);
  assert jsonb_array_length(d) = 2 and (d -> 0 ->> 'code') = 'P0300' and (d -> 1 ->> 'code') = 'U0100', '0045: definitions by code, case-insensitive, unknown skipped: ' || d::text;
  assert (d -> 0 -> 'common_causes') ? 'Spark plugs', '0045: causes carried';
  perform public.log_intel_lookup('code', 'P0300 P0171');
  perform public.log_intel_lookup('vin', '4T1BF1FK5CU123456');
  perform public.log_intel_lookup('code', 'P0300 P0171'); -- again: moves to the top, no duplicate
  r := public.recent_intel_lookups(5);
  assert jsonb_array_length(r) = 2 and (r -> 0 ->> 'query') = 'P0300 P0171' and (r -> 1 ->> 'kind') = 'vin', '0045: recent lookups deduplicated, newest first: ' || r::text;
  begin
    perform * from public.provider_cache; ok := true;
  exception when insufficient_privilege then ok := false; end;
  assert not ok, '0045: the provider cache is service-role only';
  -- the decode lands on the car
  perform public.set_vehicle_specs((select id from public.vehicles order by created_at limit 1), '2.5L I4', '{"EngineHP": "203"}'::jsonb, 'NHTSA');
  assert (select engine from public.vehicles order by created_at limit 1) = '2.5L I4', '0045: engine kept';
  assert (select specs ->> 'EngineHP' from public.vehicles order by created_at limit 1) = '203', '0045: specs kept';
  begin
    perform public.set_vehicle_specs(gen_random_uuid(), 'x', '{}'::jsonb, 'NHTSA'); ok := true;
  exception when others then ok := false; end;
  assert not ok, '0045: specs on a car that is not ours is refused';
end $$;
select pg_temp.logout();

-- Another company sees none of it.
do $$
declare v_other uuid := gen_random_uuid(); v_user uuid := gen_random_uuid(); r jsonb;
begin
  insert into public.companies (id, name) values (v_other, 'Other Shop');
  -- the auth trigger creates the profile from the metadata, like a real sign-up
  insert into auth.users (id, email, raw_user_meta_data) values (v_user, 'other@example.com', jsonb_build_object('company_id', v_other, 'role', 'owner', 'full_name', 'Other Owner'));
  perform pg_temp.login(v_user);
  r := public.recent_intel_lookups(5);
  assert jsonb_array_length(r) = 0, '0045: lookups are per company: ' || r::text;
  assert (select count(*) from public.intel_lookups) = 0, '0045: RLS hides other companies'' lookups';
  perform pg_temp.logout();
  delete from public.profiles where id = v_user;
  delete from auth.users where id = v_user;
  delete from public.companies where id = v_other;
end $$;
select pg_temp.logout();

-- ===========================================================================
-- 0046 — the shop's fix library
-- ===========================================================================
create temp table r3 (k text primary key, v uuid);
grant all on r3 to authenticated;
-- the part price is not readable by app users; the tests read it as the table owner
create or replace function pg_temp.part_price(p_fix uuid, p_name text) returns numeric language sql security definer as $$
  select unit_price from public.fix_parts where fix_id = p_fix and name = p_name
$$;

-- A detailer writes a fix; the part price they typed is not kept (they cannot price).
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare d jsonb; v_veh uuid := (select id from public.vehicles order by created_at limit 1); ok boolean;
begin
  d := public.save_fix(jsonb_build_object('vehicle_id', v_veh, 'title', 'Misfire on cold start, worn spark plugs', 'year', 2019, 'make', 'Toyota', 'model', 'Camry', 'engine', '2.5L I4',
        'mileage', 61000, 'symptoms', 'Shakes at idle when cold, check engine light flashing on hard acceleration', 'codes', jsonb_build_array('p0300', 'P0171', 'p0300'),
        'tests', jsonb_build_array(jsonb_build_object('test', 'Misfire counters', 'result', 'cyl 2 and 3')), 'root_cause', 'Plugs worn past gap, coil boots oil soaked',
        'fix_description', 'Replaced plugs and the two oil-soaked coil boots, cleared codes and road tested', 'labor_hours', 1.5,
        'parts', jsonb_build_array(jsonb_build_object('name', 'Spark plug', 'part_number', 'SP-4', 'quantity', 4, 'unit_price', 11.5), jsonb_build_object('name', 'Coil boot', 'quantity', 2))));
  insert into r3 values ('fix1', (d ->> 'id')::uuid);
  assert (d ->> 'version')::int = 1 and d -> 'codes' = '["P0171", "P0300"]'::jsonb, '0046: created, codes upper-cased and deduplicated: ' || (d -> 'codes')::text;
  assert (d ->> 'is_mine')::boolean and (d ->> 'can_edit')::boolean and not (d ->> 'can_delete')::boolean, '0046: the author may edit, not delete';
  assert (d -> 'parts' -> 0 ->> 'unit_price') is null, '0046: a detailer sees no part price';
  assert pg_temp.part_price((d ->> 'id')::uuid, 'Spark plug') is null, '0046: and does not store one';
  begin
    perform unit_price from public.fix_parts; ok := true;
  exception when insufficient_privilege then ok := false; end;
  assert not ok, '0046: nobody reads part prices from the table';
  begin
    perform public.confirm_fix((d ->> 'id')::uuid, 'fixed'); ok := true;
  exception when insufficient_privilege then ok := false; end;
  assert not ok, '0046: no voting on your own fix';
  begin
    perform public.save_fix(jsonb_build_object('title', 'Twelve chars ok', 'year', 2019, 'make', 'Toyota', 'model', 'Camry', 'symptoms', 'long enough symptoms', 'codes', jsonb_build_array('X1234'), 'root_cause', 'root', 'fix_description', 'long enough fix text')); ok := true;
  exception when others then ok := false; end;
  assert not ok, '0046: a bad trouble code is refused';
end $$;
select pg_temp.logout();

-- An advisor prices the parts and votes; the edit keeps a revision with its note.
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare v_id uuid := (select v from r3 where k = 'fix1'); d jsonb;
begin
  d := public.save_fix(jsonb_build_object('id', v_id, 'vehicle_id', (select vehicle_id from public.fixes where id = v_id), 'title', 'Misfire on cold start, worn spark plugs', 'year', 2019, 'make', 'Toyota', 'model', 'Camry', 'engine', '2.5L I4',
        'mileage', 61000, 'symptoms', 'Shakes at idle when cold, check engine light flashing on hard acceleration', 'codes', jsonb_build_array('P0300', 'P0171'),
        'tests', jsonb_build_array(jsonb_build_object('test', 'Misfire counters', 'result', 'cyl 2 and 3')), 'root_cause', 'Plugs worn past gap, coil boots oil soaked, valve cover gasket leaking oil into the wells',
        'fix_description', 'Replaced plugs and the two oil-soaked coil boots, cleared codes and road tested', 'labor_hours', 1.5, 'change_note', 'Found why the boots were wet',
        'parts', jsonb_build_array(jsonb_build_object('name', 'Spark plug', 'part_number', 'SP-4', 'quantity', 4, 'unit_price', 11.5), jsonb_build_object('name', 'Coil boot', 'quantity', 2, 'unit_price', 9))));
  assert (d ->> 'version')::int = 2 and (d -> 'revisions' -> 0 ->> 'version')::int = 1 and (d -> 'revisions' -> 0 ->> 'change_note') = 'Found why the boots were wet', '0046: the edit bumps the version and keeps the old one: ' || (d -> 'revisions')::text;
  assert (d -> 'parts' -> 0 ->> 'unit_price')::numeric = 11.5, '0046: an advisor sees and sets part prices';
  assert not (d ->> 'is_mine')::boolean and (d ->> 'can_edit')::boolean, '0046: an advisor may edit another''s fix';
  d := public.confirm_fix(v_id, 'fixed', 'Same thing on a 2020');
  assert (d ->> 'confirm_count')::int = 1 and (d ->> 'my_vote') = 'fixed', '0046: one vote for';
end $$;
select pg_temp.logout();

-- The detailer saves again without a price: the advisor's prices stay. A manager votes against.
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare v_id uuid := (select v from r3 where k = 'fix1'); d jsonb;
begin
  d := public.save_fix(jsonb_build_object('id', v_id, 'vehicle_id', (select vehicle_id from public.fixes where id = v_id), 'title', 'Misfire on cold start, worn spark plugs', 'year', 2019, 'make', 'Toyota', 'model', 'Camry', 'engine', '2.5L I4',
        'mileage', 61000, 'symptoms', 'Shakes at idle when cold, check engine light flashing on hard acceleration', 'codes', jsonb_build_array('P0300', 'P0171'),
        'tests', '[]'::jsonb, 'root_cause', 'Plugs worn past gap, coil boots oil soaked, valve cover gasket leaking oil into the wells',
        'fix_description', 'Replaced plugs and the two oil-soaked coil boots, cleared codes and road tested', 'labor_hours', 1.5,
        'parts', jsonb_build_array(jsonb_build_object('name', 'Spark plug', 'part_number', 'SP-4', 'quantity', 4), jsonb_build_object('name', 'Coil boot', 'quantity', 2))));
  assert pg_temp.part_price(v_id, 'Spark plug') = 11.5, '0046: a detailer''s re-save keeps the advisor''s part price';
  assert (d -> 'parts' -> 0 ->> 'unit_price') is null, '0046: while still showing none to them';
  assert (d ->> 'version')::int = 3, '0046: tests changed, version 3';
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare v_id uuid := (select v from r3 where k = 'fix1'); d jsonb; ok boolean;
begin
  d := public.confirm_fix(v_id, 'not_fixed', 'Needed the gasket too');
  assert (d ->> 'confirm_count')::int = 1 and (d ->> 'deny_count')::int = 1 and (d ->> 'net_score')::int = 0, '0046: one for, one against: ' || d::text;
  assert jsonb_array_length(d -> 'notes') = 2, '0046: the notes are listed';
  d := public.confirm_fix(v_id, 'fixed'); -- changes their vote
  assert (d ->> 'confirm_count')::int = 2 and (d ->> 'deny_count')::int = 0 and (d ->> 'net_score')::int = 2, '0046: a changed vote recounts';
  d := public.unconfirm_fix(v_id);
  assert (d ->> 'confirm_count')::int = 1 and (d ->> 'net_score')::int = 1 and (d ->> 'my_vote') is null, '0046: a withdrawn vote recounts';
  begin
    perform public.delete_fix(v_id); ok := true;
  exception when insufficient_privilege then ok := false; end;
  assert not ok, '0046: a manager cannot delete a fix';
end $$;
select pg_temp.logout();

-- A second fix, search, ranking, and the estimate lines.
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare d jsonb;
begin
  d := public.save_fix(jsonb_build_object('title', 'Old Camry rough idle, dirty throttle body', 'year', 2012, 'make', 'Toyota', 'model', 'Camry', 'engine', '2.5L I4', 'symptoms', 'Hunting idle and a stall at stops',
        'codes', jsonb_build_array('P0507'), 'root_cause', 'Carbon in the throttle body', 'fix_description', 'Cleaned the throttle body and relearned the idle', 'labor_hours', 0.8));
  insert into r3 values ('fix2', (d ->> 'id')::uuid);
  d := public.save_fix(jsonb_build_object('title', 'F-150 cold start rattle, VCT phaser', 'year', 2015, 'make', 'Ford', 'model', 'F-150', 'symptoms', 'Loud rattle for two seconds on a cold start',
        'codes', jsonb_build_array('P0016'), 'root_cause', 'Worn phaser lockpin', 'fix_description', 'Replaced the phasers and the timing chain kit'));
  insert into r3 values ('fix3', (d ->> 'id')::uuid);
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare r jsonb; l jsonb;
begin
  r := public.fixes_filtered('misfire');
  assert jsonb_array_length(r) = 1 and (r -> 0 ->> 'id') = (select v::text from r3 where k = 'fix1'), '0046: full-text search finds the misfire fix: ' || r::text;
  assert jsonb_array_length(public.fixes_filtered(null, array['P0016'])) = 1 and jsonb_array_length(public.fixes_filtered()) = 3, '0046: filter by code, and everything';
  assert jsonb_array_length(public.fixes_filtered(null, null, true)) = 0, '0046: the advisor wrote none of them';
  -- the 2019 Camry: the 2019 fix is exact, the 2012 one is outside the 3-year window
  r := public.rank_fixes('toyota', 'camry', 2019, '2.5L I4', null);
  assert jsonb_array_length(r) = 1 and (r -> 0 ->> 'match_level') = 'exact', '0046: ranking window and match level: ' || r::text;
  r := public.rank_fixes('Toyota', 'Camry', 2021, null, array['P0300']);
  assert jsonb_array_length(r) = 1 and (r -> 0 ->> 'match_level') = 'near_year' and (r -> 0 -> 'matched_codes') = '["P0300"]'::jsonb, '0046: near year with a matched code: ' || r::text;
  r := public.rank_fixes('Toyota', 'Camry', 2013, null, array['P0507']);
  assert jsonb_array_length(r) = 1 and (r -> 0 ->> 'id') = (select v::text from r3 where k = 'fix2'), '0046: the older Camry fix for its own code';
  assert jsonb_array_length(public.fixes_for_codes(array['P0300', 'P0016'])) = 2, '0046: fixes for codes across cars';
  -- estimate lines: labor at the default rate, then the parts
  l := public.fix_estimate_lines((select v from r3 where k = 'fix1'));
  assert (l -> 'lines' -> 0 ->> 'line_type') = 'labor' and (l -> 'lines' -> 0 ->> 'hours')::numeric = 1.5 and (l -> 'lines' -> 0 ->> 'rate')::numeric = 120, '0046: labor at the default shop rate: ' || l::text;
  assert jsonb_array_length(l -> 'lines') = 3 and (l -> 'lines' -> 1 ->> 'price')::numeric = 11.5 and (l -> 'lines' -> 1 ->> 'qty')::numeric = 4, '0046: the parts follow: ' || l::text;
  -- photos live under the company's fixes folder
  perform public.add_fix_media((select v from r3 where k = 'fix1'), jsonb_build_array(public.current_company_id()::text || '/fixes/' || (select v::text from r3 where k = 'fix1') || '/a.jpg'));
  assert jsonb_array_length((public.fix_detail((select v from r3 where k = 'fix1'))) -> 'media') = 1, '0046: a photo is registered';
end $$;
do $$
declare ok boolean;
begin
  begin
    perform public.add_fix_media((select v from r3 where k = 'fix1'), jsonb_build_array('somebody-else/fixes/x/a.jpg')); ok := true;
  exception when others then ok := false; end;
  assert not ok, '0046: a photo outside the fix''s folder is refused';
end $$;
select pg_temp.logout();

-- A detailer cannot ask for estimate lines; the owner deletes; another company sees nothing.
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare ok boolean;
begin
  begin
    perform public.fix_estimate_lines((select v from r3 where k = 'fix1')); ok := true;
  exception when insufficient_privilege then ok := false; end;
  assert not ok, '0046: estimate lines are for whoever may price';
end $$;
select pg_temp.logout();
do $$
declare v_other uuid := gen_random_uuid(); v_user uuid := gen_random_uuid(); ok boolean;
begin
  insert into public.companies (id, name) values (v_other, 'Third Shop');
  insert into auth.users (id, email, raw_user_meta_data) values (v_user, 'third@example.com', jsonb_build_object('company_id', v_other, 'role', 'owner', 'full_name', 'Third Owner'));
  perform pg_temp.login(v_user);
  assert jsonb_array_length(public.fixes_filtered()) = 0 and (select count(*) from public.fixes) = 0, '0046: another company sees no fixes';
  assert public.fix_detail((select v from r3 where k = 'fix1')) is null, '0046: nor one by id';
  begin
    perform public.confirm_fix((select v from r3 where k = 'fix1'), 'fixed'); ok := true;
  exception when others then ok := false; end;
  assert not ok, '0046: nor vote on it';
  perform pg_temp.logout();
  delete from public.profiles where id = v_user; delete from auth.users where id = v_user; delete from public.companies where id = v_other;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare d jsonb;
begin
  d := public.delete_fix((select v from r3 where k = 'fix3'));
  assert (select count(*) from public.fixes) = 2 and (select count(*) from public.fix_dtcs where code = 'P0016') = 0, '0046: the owner deletes a fix and its codes go with it';
  d := public.delete_fix((select v from r3 where k = 'fix1'));
  assert jsonb_array_length(d -> 'paths') = 1, '0046: the photo paths come back for cleanup: ' || d::text;
end $$;
select pg_temp.logout();
