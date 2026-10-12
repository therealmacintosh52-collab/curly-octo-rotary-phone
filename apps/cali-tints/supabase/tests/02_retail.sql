-- SQL tests for the retail side (0037+). Runs after 01_flows.sql on the same
-- database: the fixture users and the seed's retail dealership exist already.

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, false);
  select set_config('role', 'authenticated', false);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', false);
  select set_config('request.jwt.claims', '', false);
$$;
create or replace function pg_temp.js_price(p_job uuid, p_service uuid default null) returns numeric
language sql security definer as $$
  select price from public.job_services where job_id = p_job and (p_service is null or service_id = p_service) limit 1;
$$;

create temp table r_ids (k text primary key, v uuid);
grant all on r_ids to authenticated;

-- 0037: helpers -------------------------------------------------------------
do $$
begin
  assert public.phone_digits('(916) 555-0100') = '9165550100', 'phone digits';
  assert public.phone_digits('+1 916 555 0100') = '9165550100', 'country code dropped';
  assert public.phone_digits('') is null and public.phone_digits(null) is null, 'empty phone';
  assert public.size_class_for_body('Sedan/Saloon') = 'sedan', 'sedan';
  assert public.size_class_for_body('Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)') = 'suv_truck', 'suv';
  assert public.size_class_for_body('Pickup') = 'suv_truck', 'pickup';
  assert public.size_class_for_body('Hatchback/Liftback/Notchback') = 'compact', 'hatch';
  assert public.size_class_for_body('Coupe') = 'compact', 'coupe';
  assert public.size_class_for_body('Van') = 'xl' and public.size_class_for_body('Minivan') = 'xl', 'van';
  assert public.size_class_for_body('Cargo Van') = 'xl', 'cargo van';
  assert public.size_class_for_body(null) = 'sedan', 'unknown body';
end $$;

-- 0037: a detailer logs a walk-in with a customer and a vehicle ---------------
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare c public.customers; v public.vehicles; j public.jobs; n int; t jsonb; f jsonb;
begin
  c := public.save_customer(jsonb_build_object('first_name', ' Ana ', 'last_name', 'Lopez', 'phone', '(916) 555-0100', 'email', 'Ana@Example.com',
                                               'sms_opt_in', true, 'tags', jsonb_build_array('vip', ' ', 'vip', 'referral')));
  assert c.display_name = 'Ana Lopez' and c.phone_digits = '9165550100' and c.email_lc = 'ana@example.com', '0037: customer normalised';
  assert c.sms_opt_in and c.sms_opt_in_at is not null and not c.marketing_opt_in and c.marketing_opt_in_at is null, '0037: consent timestamps';
  assert c.tags = array['referral', 'vip'] or c.tags = array['vip', 'referral'], '0037: tags trimmed and distinct: ' || array_to_string(c.tags, ',');
  insert into r_ids values ('cust_ana', c.id);

  -- duplicate by phone, by email, not by nothing
  select count(*) into n from public.find_duplicate_customers('+1 916-555-0100', null); assert n = 1, '0037: dup by phone';
  select count(*) into n from public.find_duplicate_customers(null, 'ANA@example.com'); assert n = 1, '0037: dup by email';
  select count(*) into n from public.find_duplicate_customers('916-555-0199', 'nobody@example.com'); assert n = 0, '0037: no dup';
  select count(*) into n from public.find_duplicate_customers('916-555-0100', null, c.id); assert n = 0, '0037: exclude self';

  begin
    perform public.save_customer(jsonb_build_object('first_name', '', 'phone', ''));
    raise exception 'expected identity required';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.save_customer(jsonb_build_object('first_name', 'Bad', 'email', 'not-an-email'));
    raise exception 'expected email check';
  exception when sqlstate '22023' then null; end;

  v := public.save_vehicle(jsonb_build_object('customer_id', c.id, 'vin', 'jm1bl1sf9a1234567', 'year', 2010, 'make', 'Mazda', 'model', 'Mazda3',
                                              'body_class', 'Hatchback/Liftback/Notchback', 'color', 'Blue', 'plate', 'abc1234', 'odometer', 120500));
  assert v.vin = 'JM1BL1SF9A1234567' and v.plate = 'ABC1234', '0037: vehicle normalised';
  assert v.size_class = 'compact' and v.size_class_source = 'nhtsa', '0037: size from NHTSA body class';
  assert (select count(*) from public.odometer_readings where vehicle_id = v.id) = 1, '0037: odometer with the vehicle';
  insert into r_ids values ('veh_mazda', v.id);

  v := public.save_vehicle(jsonb_build_object('id', v.id, 'size_class', 'sedan'));
  assert v.size_class = 'sedan' and v.size_class_source = 'manual', '0037: manual size override';

  begin
    perform public.save_vehicle(jsonb_build_object('customer_id', c.id, 'vin', 'BADVIN'));
    raise exception 'expected vin check';
  exception when sqlstate '22023' then null; end;

  -- a vehicle on a dealership job is refused
  begin
    perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'RX1', 'color', 'Blue',
      'vehicle_id', v.id, 'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
    raise exception 'expected retail-only link';
  exception when sqlstate '22023' then null; end;

  -- a retail job fills the car from the vehicle and logs the mileage
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000103', 'tag_number', 'R-200', 'vehicle_id', v.id, 'odometer', 121000,
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  assert j.customer_id = c.id and j.vehicle_id = v.id, '0037: job linked to customer and vehicle';
  assert j.vin = 'JM1BL1SF9A1234567' and j.year = 2010 and j.make = 'Mazda' and j.model = 'Mazda3' and j.color = 'Blue', '0037: car filled from the vehicle';
  assert (select reading from public.odometer_readings where job_id = j.id) = 121000, '0037: odometer on the job';
  insert into r_ids values ('job_r200', j.id);

  -- the Jobs list carries the customer and finds them by phone
  f := public.jobs_filtered(p_q => 'R-200');
  assert (f -> 'rows' -> 0 ->> 'customer') = 'Ana Lopez' and (f -> 'rows' -> 0 ->> 'customer_id') = c.id::text, '0037: jobs list shows the customer';
  f := public.jobs_filtered(p_q => '555-0100');
  assert (f ->> 'count')::int >= 1, '0037: jobs search by phone';
  f := public.jobs_filtered(p_q => 'Lopez');
  assert (f ->> 'count')::int >= 1, '0037: jobs search by name';

  -- the customer list and timeline: no money for a detailer
  f := public.customers_filtered(p_q => '0100');
  assert (f ->> 'count')::int = 1 and (f -> 'rows' -> 0 -> 'lifetime_spend') = 'null'::jsonb and (f -> 'rows' -> 0 ->> 'visits')::int = 1, '0037: customers list by phone, no money';
  f := public.customers_filtered(p_q => 'mazda3');
  assert (f ->> 'count')::int = 1, '0037: customers list by vehicle';
  t := public.customer_timeline(c.id);
  assert jsonb_array_length(t -> 'vehicles') = 1 and jsonb_array_length(t -> 'jobs') = 1 and (t -> 'stats' -> 'lifetime_spend') = 'null'::jsonb, '0037: timeline shape, no money';
  assert (t -> 'vehicles' -> 0 -> 'odometer' ->> 'reading')::int = 121000, '0037: latest odometer on the vehicle';

  -- a detailer may not archive or merge
  begin
    perform public.archive_customer(c.id, true);
    raise exception 'expected admin only';
  exception when sqlstate '42501' then null; end;
end $$;

-- 0037: the owner merges a duplicate; money shows ------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare c public.customers; d public.customers; veh public.vehicles; t jsonb; f jsonb; v_ana uuid := (select v from r_ids where k = 'cust_ana');
begin
  d := public.save_customer(jsonb_build_object('first_name', 'Anna', 'phone', '916.555.0100', 'notes', 'Prefers mornings', 'marketing_opt_in', true, 'tags', jsonb_build_array('newsletter')));
  veh := public.save_vehicle(jsonb_build_object('customer_id', d.id, 'model', 'Civic', 'year', 2018, 'make', 'Honda'));
  c := public.merge_customers(v_ana, d.id);
  assert c.id = v_ana and c.marketing_opt_in and c.notes = 'Prefers mornings' and 'newsletter' = any (c.tags) and 'vip' = any (c.tags), '0037: merge fills blanks and unions tags';
  assert (select customer_id from public.vehicles where id = veh.id) = v_ana, '0037: vehicles move on merge';
  assert (select merged_into_id from public.customers where id = d.id) = v_ana and (select archived_at from public.customers where id = d.id) is not null, '0037: merged record archived';
  f := public.customers_filtered();
  assert (f ->> 'count')::int = 1, '0037: merged record hidden from the list';
  begin
    perform public.merge_customers(v_ana, d.id);
    raise exception 'expected already merged';
  exception when sqlstate 'P0001' then null; end;

  -- money for the owner: the retail job is paid at the counter
  perform public.record_retail_payment((select v from r_ids where k = 'job_r200'), 200, 'cash', null);
  t := public.customer_timeline(v_ana);
  assert (t -> 'stats' ->> 'lifetime_spend')::numeric = 200 and (t -> 'jobs' -> 0 ->> 'paid_amount')::numeric = 200, '0037: owner sees lifetime spend';
  f := public.customers_filtered();
  assert (f -> 'rows' -> 0 ->> 'lifetime_spend')::numeric = 200, '0037: list shows spend to the owner';

  -- archive and restore
  perform public.archive_customer(v_ana, true);
  assert (public.customers_filtered() ->> 'count')::int = 0 and (public.customers_filtered(p_archived => true) ->> 'count')::int = 1, '0037: archived list (merged records stay hidden)';
  perform public.archive_customer(v_ana, false);
  assert (public.customers_filtered() ->> 'count')::int = 1, '0037: restored';

  -- editing the job keeps the links; moving it to a dealership drops them
  perform public.update_job((select v from r_ids where k = 'job_r200'), jsonb_build_object('notes', 'x'));
  assert (select customer_id from public.jobs where id = (select v from r_ids where k = 'job_r200')) = v_ana, '0037: links kept on edit';
end $$;

-- 0037: a manager reads but cannot write customers directly past RLS ------------
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare n int;
begin
  select count(*) into n from public.customers; assert n = 2, '0037: manager reads customers';
  assert (public.customers_filtered() -> 'rows' -> 0 -> 'lifetime_spend') = 'null'::jsonb, '0037: manager sees no money';
end $$;
select pg_temp.logout();
