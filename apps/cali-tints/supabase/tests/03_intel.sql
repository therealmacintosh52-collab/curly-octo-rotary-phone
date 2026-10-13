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
