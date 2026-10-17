-- SQL tests for 0074: canned jobs, past services, a tech on a labor line.
-- Users: ...001 owner, ...002 detailer, ...004 manager, ...005 admin, ...006 advisor.

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, false);
  select set_config('role', 'authenticated', false);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', false);
  select set_config('request.jwt.claims', '', false);
$$;
create temp table c_ids (k text primary key, v text);
grant all on c_ids to authenticated;

-- No direct reads of the table (it holds the shop's cost)
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare v_id uuid; r jsonb;
begin
  begin perform count(*) from public.canned_jobs; raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
  v_id := public.save_canned_job(jsonb_build_object('name', 'Front brake pads', 'category', 'Brakes', 'makes', jsonb_build_array('Toyota', 'Honda', 'Toyota'), 'year_from', 2010, 'year_to', 2020, 'priority', 'safety',
    'lines', jsonb_build_array(
      jsonb_build_object('line_type', 'labor', 'name', 'Replace front pads', 'hours', 1.5),
      jsonb_build_object('line_type', 'part', 'name', 'Pad set', 'qty', 1, 'price', 89.5, 'cost', 52, 'part_number', 'BP-100', 'vendor', 'NAPA'),
      jsonb_build_object('line_type', 'fee', 'name', 'Disposal', 'price', 5))));
  insert into c_ids values ('canned', v_id::text);
  r := public.retail_canned_jobs();
  assert jsonb_array_length(r) = 1 and (r -> 0 ->> 'name') = 'Front brake pads', '0074: listed';
  assert (r -> 0 -> 'makes') = '["Honda", "Toyota"]'::jsonb, '0074: makes de-duplicated and sorted: ' || (r -> 0 ->> 'makes');
  assert jsonb_array_length(r -> 0 -> 'lines') = 3 and (r -> 0 -> 'lines' -> 1 ->> 'part_condition') = 'new', '0074: lines kept, part condition defaults to new';
  assert (r -> 0 -> 'lines' -> 1 ->> 'cost')::numeric = 52, '0074: cost kept for the advisor';
  -- rename and change
  perform public.save_canned_job(jsonb_build_object('id', v_id, 'name', 'Front brake pads (std)', 'lines', '[]'::jsonb));
  assert (select (public.retail_canned_jobs() -> 0 ->> 'name')) = 'Front brake pads (std)', '0074: renamed';
  perform public.save_canned_job(jsonb_build_object('id', v_id, 'name', 'Front brake pads', 'lines', jsonb_build_array(jsonb_build_object('line_type', 'labor', 'name', 'Replace front pads', 'hours', 1.5))));
  begin perform public.save_canned_job('{"name":"front BRAKE pads","lines":[]}'::jsonb); raise exception 'expected 23505';
  exception when unique_violation then null; end;
  begin perform public.save_canned_job('{"name":"","lines":[]}'::jsonb); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
  begin perform public.save_canned_job('{"name":"Bad","lines":[{"line_type":"part","name":""}]}'::jsonb); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
  begin perform public.save_canned_job('{"name":"Bad","priority":"urgent","lines":[]}'::jsonb); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
  begin perform public.save_canned_job('{"name":"Bad","year_from":2020,"year_to":2010,"lines":[]}'::jsonb); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
  begin perform public.delete_canned_job(v_id); raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();

-- A tech and a manager see the names only, and cannot save
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare r jsonb := public.retail_canned_jobs();
begin
  assert jsonb_array_length(r) = 1 and jsonb_array_length(r -> 0 -> 'lines') = 0 and (r -> 0 ->> 'line_count')::int = 1, '0074: a tech sees no lines or cost';
  begin perform public.save_canned_job('{"name":"x","lines":[]}'::jsonb); raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
  assert public.past_services(null, (select id from public.customers limit 1)) = '[]'::jsonb, '0074: no past services for a tech';
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$ begin
  assert jsonb_array_length((public.retail_canned_jobs() -> 0 -> 'lines')) = 0, '0074: a manager sees no lines';
  begin perform public.save_canned_job('{"name":"x","lines":[]}'::jsonb); raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();

-- A tech on a labor line, through the estimate
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare e public.estimates; v_veh uuid; v_cust uuid; d jsonb; v_line uuid;
begin
  select id, customer_id into v_veh, v_cust from public.vehicles where company_id = public.current_company_id() and customer_id is not null limit 1;
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'vehicle_id', v_veh, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Work', 'recommended', true,
    'jobs', jsonb_build_array(jsonb_build_object('key', 'j1', 'title', 'Front brakes', 'kind', 'repair', 'priority', 'safety')),
    'lines', jsonb_build_array(
      jsonb_build_object('line_type', 'labor', 'label', 'Replace pads', 'hours', 1.5, 'job', 'j1', 'tech_id', '10000000-0000-4000-8000-000000000002'),
      jsonb_build_object('line_type', 'labor', 'label', 'Bad tech', 'hours', 1, 'job', 'j1', 'tech_id', '10000000-0000-4000-8000-000000000001'),
      jsonb_build_object('line_type', 'part', 'label', 'Pad set', 'qty', 1, 'price', 90, 'job', 'j1'))))));
  insert into c_ids values ('est', e.id::text), ('cust', v_cust::text), ('veh', v_veh::text);
  d := public.estimate_detail(e.id);
  v_line := (select (x ->> 'id')::uuid from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') x where x ->> 'name' = 'Replace pads');
  insert into c_ids values ('line', v_line::text), ('part', (select (x ->> 'id') from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') x where x ->> 'name' = 'Pad set'));
  assert exists (select 1 from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') x where x ->> 'name' = 'Replace pads' and nullif(x ->> 'tech', '') is not null), '0074: the estimate JSON carries the tech initials';
  assert exists (select 1 from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') x where x ->> 'name' = 'Bad tech' and nullif(x ->> 'tech', '') is null), '0074: a non-tech is not stored';
end $$;
select pg_temp.logout();
do $$ begin
  assert (select tech_id from public.estimate_lines where id = (select v from c_ids where k = 'line')::uuid) = '10000000-0000-4000-8000-000000000002', '0074: tech stored on a labor line';
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare v_line uuid := (select v from c_ids where k = 'line')::uuid;
begin
  perform public.set_line_tech(v_line, null);
  perform public.set_line_tech(v_line, '10000000-0000-4000-8000-000000000002');
  begin perform public.set_line_tech(v_line, '10000000-0000-4000-8000-000000000001'); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
  begin perform public.set_line_tech((select v from c_ids where k = 'part')::uuid, null); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$ begin
  begin perform public.set_line_tech((select v from c_ids where k = 'line')::uuid, null); raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();

-- Past services: only an approved visit counts
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare r jsonb;
begin
  assert public.past_services((select v from c_ids where k = 'veh')::uuid, null) = '[]'::jsonb, '0074: a draft estimate is not a past service';
end $$;
select pg_temp.logout();
do $$
declare est uuid := (select v from c_ids where k = 'est')::uuid;
begin
  update public.estimates set status = 'accepted', accepted_at = now() where id = est;
  update public.estimate_jobs set status = 'approved' where estimate_id = est;
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare r jsonb;
begin
  r := public.past_services((select v from c_ids where k = 'veh')::uuid, null);
  assert jsonb_array_length(r) >= 1, '0074: an approved job is a past service';
  assert exists (select 1 from jsonb_array_elements(r) x where x ->> 'title' = 'Front brakes' and jsonb_array_length(x -> 'lines') = 3), '0074: with its three lines';
  assert jsonb_array_length(public.past_services(null, (select v from c_ids where k = 'cust')::uuid)) >= 1, '0074: by customer too';
  assert public.past_services(null, null) = '[]'::jsonb, '0074: nothing without a car or customer';
end $$;
select pg_temp.logout();

-- Owner deletes
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$ begin
  perform public.delete_canned_job((select v from c_ids where k = 'canned')::uuid);
  assert jsonb_array_length(public.retail_canned_jobs()) = 0, '0074: deleted';
end $$;
select pg_temp.logout();
