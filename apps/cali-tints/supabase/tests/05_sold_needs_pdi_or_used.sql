-- SQL tests for 0071: a Sold car must also be charged as PDI or Used.
-- Users: ...001 owner, ...002 detailer, ...004 manager, ...005 admin. Services: PDI ...204, Sold ...209, Used ...201, Service Loaner ...202.

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, false);
  select set_config('role', 'authenticated', false);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', false);
  select set_config('request.jwt.claims', '', false);
$$;
create temp table sold_t (k text primary key, v text);
grant all on sold_t to authenticated;

-- The flags follow the service names
do $$
begin
  update public.services set sold_marker = true where id = '00000000-0000-4000-8000-000000000209'; -- 01_flows switched it off for its plain-line tests
  assert (select sold_marker from public.services where id = '00000000-0000-4000-8000-000000000209'), '0071: Sold is the sold marker';
  assert (select satisfies_sold from public.services where id = '00000000-0000-4000-8000-000000000204'), '0071: PDI satisfies it';
  assert (select satisfies_sold from public.services where id = '00000000-0000-4000-8000-000000000201'), '0071: Used satisfies it';
  assert not (select sold_marker or satisfies_sold from public.services where id = '00000000-0000-4000-8000-000000000202'), '0071: other services are plain';
end $$;

-- A detailer: Sold alone is refused, with PDI or Used it is saved
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare j public.jobs;
begin
  begin
    perform public.create_job(jsonb_build_object('client_id', '20000000-0000-4000-8000-0000000000b1', 'dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'SOLD1', 'year', 2023, 'make', 'Mercedes-Benz', 'model', 'GLC 300', 'color', 'White',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000209'))));
    raise exception 'expected refused';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'A sold car must also be charged as PDI or Used', '0071: the message: ' || sqlerrm;
  end;
  assert not exists (select 1 from public.jobs where tag_number = 'SOLD1'), '0071: nothing was saved';

  j := public.create_job(jsonb_build_object('client_id', '20000000-0000-4000-8000-0000000000b2', 'dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'SOLD2', 'year', 2023, 'make', 'Mercedes-Benz', 'model', 'GLC 300', 'color', 'White',
    'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000209'), jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000204'))));
  insert into sold_t values ('pdi_job', j.id::text);
  j := public.create_job(jsonb_build_object('client_id', '20000000-0000-4000-8000-0000000000b3', 'dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'SOLD3', 'year', 2023, 'make', 'Mercedes-Benz', 'model', 'GLC 300', 'color', 'White',
    'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000209'), jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  -- no Sold: unaffected
  j := public.create_job(jsonb_build_object('client_id', '20000000-0000-4000-8000-0000000000b4', 'dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'PLAIN1', 'year', 2023, 'make', 'Mercedes-Benz', 'model', 'GLC 300', 'color', 'White',
    'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000202'))));
  insert into sold_t values ('plain_job', j.id::text);
  assert (select count(*) from public.jobs where tag_number in ('SOLD2', 'SOLD3', 'PLAIN1')) = 3, '0071: PDI, Used and non-sold jobs save';
  -- a detailer does not see the flag list
  assert cardinality(public.jobs_missing_sold_charge()) = 0, '0071: a detailer gets no flag list';
end $$;
select pg_temp.logout();

-- An edit that drops PDI or Used from a sold job is refused for a manager too; adding it fixes it
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare v_job uuid := (select v from sold_t where k = 'pdi_job')::uuid;
begin
  begin
    perform public.update_job(v_job, jsonb_build_object('services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000209'))));
    raise exception 'expected refused';
  exception when sqlstate 'P0001' then null; end;
  perform public.update_job(v_job, jsonb_build_object('services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000209'), jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  assert (select count(*) from public.job_services where job_id = v_job) = 2, '0071: swapping PDI for Used is fine';
  -- a notes-only edit does not touch the services and is not blocked
  perform public.update_job(v_job, '{"notes":"ok"}'::jsonb);
end $$;
select pg_temp.logout();

-- Older open jobs that lack the charge are flagged for owner, admin and manager (set up as the superuser, as 0070 and earlier left them)
do $$
declare v_job uuid;
begin
  select id into v_job from public.jobs where tag_number = 'SOLD3';
  delete from public.job_services where job_id = v_job and service_id = '00000000-0000-4000-8000-000000000201';
  insert into sold_t values ('legacy', v_job::text);
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
begin
  assert (select v from sold_t where k = 'legacy')::uuid = any (public.jobs_missing_sold_charge()), '0071: a manager sees the legacy Sold-only job flagged';
  assert cardinality(public.jobs_missing_sold_charge()) = 1, '0071: only the lacking job is flagged: ' || cardinality(public.jobs_missing_sold_charge());
  -- the manager adjusts it
  perform public.update_job((select v from sold_t where k = 'legacy')::uuid, jsonb_build_object('services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000209'), jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000204'))));
  assert cardinality(public.jobs_missing_sold_charge()) = 0, '0071: adjusting clears the flag';
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_job uuid := (select v from sold_t where k = 'legacy')::uuid;
begin
  assert cardinality(public.jobs_missing_sold_charge()) = 0, '0071: the owner sees the same list';
end $$;
select pg_temp.logout();

-- Jobs already on an invoice are not flagged
do $$
declare v_job uuid := (select v from sold_t where k = 'legacy')::uuid;
begin
  delete from public.job_services where job_id = v_job and service_id = '00000000-0000-4000-8000-000000000204';
  assert public._job_sold_missing_charge(v_job), '0071: setup: the job lacks PDI or Used again';
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs set invoice_id = (select id from public.invoices limit 1), status = 'invoiced' where id = v_job;
  perform set_config('app.bypass_lock', 'off', true);
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
begin
  assert not ((select v from sold_t where k = 'legacy')::uuid = any (public.jobs_missing_sold_charge())), '0071: a job already on an invoice is not flagged';
end $$;
select pg_temp.logout();
