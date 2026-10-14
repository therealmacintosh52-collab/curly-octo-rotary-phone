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

-- 0052: an RO becomes an invoice when it is converted; these tests authorize a job's lines and convert it.
create or replace function pg_temp.invoice_it(p_job uuid) returns void language plpgsql security definer as $$
declare a uuid;
begin
  insert into public.job_authorizations (company_id, job_id, kind, amount, name, method, by_staff)
  select company_id, id, 'initial', 0, 'Test', 'in_person', true from public.jobs where id = p_job returning id into a;
  update public.job_services set authorization_id = a where job_id = p_job and authorization_id is null;
  update public.jobs set completed_at = coalesce(completed_at, now()), qc_at = coalesce(qc_at, now()), odometer_out = coalesce(odometer_out, 1) where id = p_job;
  perform public.convert_ro_to_invoice(p_job);
end $$;

-- 0055: finished and checked (the tests that are not about completion skip the ceremony)
create or replace function pg_temp.finish_it(p_job uuid) returns void language plpgsql security definer as $$
begin
  update public.estimate_jobs set cause = coalesce(cause, 'Worn'), correction = coalesce(correction, 'Replaced'), status = 'done', done_at = now() where id in (select estimate_job_id from public.job_services where job_id = p_job and estimate_job_id is not null);
  update public.jobs set completed_at = coalesce(completed_at, now()), qc_at = coalesce(qc_at, now()), odometer_out = coalesce(odometer_out, 1) where id = p_job;
end $$;

create or replace function pg_temp.has_event(p_subject uuid, p_kind text) returns boolean language sql security definer as $$
  select exists (select 1 from public.events where subject_id = p_subject and kind = p_kind)
$$;
create or replace function pg_temp.declined_list(p_job uuid) returns text language sql security definer as $$
  select public._run_subject('job', p_job) ->> 'declined_list'
$$;

-- Retail work normally starts from an estimate (0048); these tests log retail jobs directly on purpose.
select set_config('app.allow_retail_job', 'on', false);

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
  f := public.jobs_filtered(p_q => 'R-200', p_scope => 'all');
  assert (f -> 'rows' -> 0 ->> 'customer') = 'Ana Lopez' and (f -> 'rows' -> 0 ->> 'customer_id') = c.id::text, '0037: jobs list shows the customer';
  f := public.jobs_filtered(p_q => '555-0100', p_scope => 'all');
  assert (f ->> 'count')::int >= 1, '0037: jobs search by phone';
  f := public.jobs_filtered(p_q => 'Lopez', p_scope => 'all');
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
  perform public.record_retail_payment((select v from r_ids where k = 'job_r200'), (public.retail_charge((select v from r_ids where k = 'job_r200')) ->> 'balance')::numeric, 'cash', null);
  t := public.customer_timeline(v_ana);
  assert (t -> 'stats' ->> 'lifetime_spend')::numeric >= 200 and (t -> 'stats' ->> 'lifetime_spend')::numeric = (t -> 'jobs' -> 0 ->> 'paid_amount')::numeric, '0037: owner sees lifetime spend';
  f := public.customers_filtered();
  assert (f -> 'rows' -> 0 ->> 'lifetime_spend')::numeric = (t -> 'stats' ->> 'lifetime_spend')::numeric, '0037: list shows spend to the owner';

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

-- =============================================================================
-- 0038: catalog, size-class prices, modifiers, settings, resources
-- =============================================================================
create or replace function pg_temp.size_price(p_service uuid, p_size public.vehicle_size) returns numeric
language sql security definer as $$
  select price from public.service_prices_by_size where service_id = p_service and size_class = p_size;
$$;

-- Seeded defaults exist once, and only once after a re-run.
select pg_temp.logout();
-- The fixture users were created after the seed: a re-run adds them as techs and nothing else.
select public.seed_retail_defaults('00000000-0000-4000-8000-000000000001');
do $$
declare n int; v_company uuid := '00000000-0000-4000-8000-000000000001';
begin
  select count(*) into n from public.services where company_id = v_company and retail; assert n = 13, '0038: twelve retail services + Other on the shop menu: ' || n;
  select count(*) into n from public.services where company_id = v_company and placeholder; assert n = 12, '0038: placeholders flagged';
  select count(*) into n from public.service_prices_by_size where company_id = v_company; assert n = 48, '0038: four sizes per retail service';
  select count(*) into n from public.resources where company_id = v_company and kind = 'bay'; assert n = 6, '0038: six bays';
  select count(*) into n from public.resources where company_id = v_company and kind = 'lift'; assert n = 2, '0038: two lifts';
  select count(*) into n from public.resources where company_id = v_company and kind = 'tech' and profile_id is not null; assert n >= 2, '0038: a tech per active detailer: ' || n;
  select count(*) into n from public.business_hours where company_id = v_company and not closed; assert n = 6, '0038: Mon–Sat open';
  assert (select deposit_value from public.retail_settings where company_id = v_company) = 20, '0038: 20% deposit default';
  assert (select email_templates ? 'booking_confirmed' from public.retail_settings where company_id = v_company), '0038: templates seeded';
  perform public.seed_retail_defaults(v_company);
  select count(*) into n from public.services where company_id = v_company and retail; assert n = 13, '0038: seeding again adds nothing';
  select count(*) into n from public.resources where company_id = v_company; assert n = 8 + (select count(*) from public.profiles where company_id = v_company and active and role in ('detailer','manager')), '0038: resources seeded once';
end $$;

-- The owner prices by size, quotes, and sees the catalog with money.
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_full uuid; v_oil uuid; v_other uuid; q jsonb; cat jsonb; n int;
begin
  select id into v_full from public.services where name = 'Full detail';
  select id into v_oil from public.services where name = 'Oil change';
  select id into v_other from public.services where name = 'Other';
  assert pg_temp.size_price(v_full, 'suv_truck') = 240, '0038: matrix seeded';

  q := public.quote_total('suv_truck', jsonb_build_array(jsonb_build_object('service_id', v_full, 'modifiers', jsonb_build_array('soil_heavy', 'pet_hair', 'nope')), jsonb_build_object('service_id', v_oil)));
  assert (q ->> 'subtotal')::numeric = 240 + 60 + 40 + 75, '0038: quote subtotal: ' || (q ->> 'subtotal');
  assert (q ->> 'tax')::numeric = 0, '0038: company tax rate 0 → no tax';
  assert (q -> 'lines' -> 1 ->> 'taxable')::boolean, '0038: oil change is a parts line';
  assert (q ->> 'duration_minutes')::int = 285, '0038: quote duration';
  assert (q ->> 'placeholder')::boolean, '0038: placeholder flag surfaces';

  update public.companies set tax_rate = 0.0875 where id = public.current_company_id();
  q := public.quote_total('suv_truck', jsonb_build_array(jsonb_build_object('service_id', v_full), jsonb_build_object('service_id', v_oil)));
  assert (q ->> 'tax')::numeric = 6.56 and (q ->> 'total')::numeric = 321.56, '0038: tax on the parts line only: ' || (q ->> 'tax');
  update public.retail_settings set tax_all_lines = true where company_id = public.current_company_id();
  q := public.quote_total('suv_truck', jsonb_build_array(jsonb_build_object('service_id', v_full), jsonb_build_object('service_id', v_oil)));
  assert (q ->> 'tax')::numeric = 27.56, '0038: tax on every line when set: ' || (q ->> 'tax');
  update public.retail_settings set tax_all_lines = false where company_id = public.current_company_id();
  update public.companies set tax_rate = 0 where id = public.current_company_id();

  q := public.quote_total('sedan', jsonb_build_array(jsonb_build_object('service_id', v_other, 'price', 45, 'label', 'Headlight resto'), jsonb_build_object('service_id', v_full, 'price', 1)));
  assert (q -> 'lines' -> 0 ->> 'line_total')::numeric = 45 and (q -> 'lines' -> 0 ->> 'name') = 'Headlight resto' and (q -> 'lines' -> 1 ->> 'line_total')::numeric = 200, '0038: Other takes the typed amount, list lines ignore it';

  -- the owner changes a size price; the placeholder flag is theirs to clear
  update public.service_prices_by_size set price = 210 where service_id = v_full and size_class = 'sedan';
  update public.services set placeholder = false where id = v_full;
  assert pg_temp.size_price(v_full, 'sedan') = 210, '0038: owner edits the matrix';

  cat := public.retail_catalog();
  assert jsonb_array_length(cat -> 'services') >= 13 and (cat -> 'settings' ->> 'hold_minutes')::int = 30 and jsonb_array_length(cat -> 'hours') = 7, '0038: catalog shape';
  assert (select (s -> 'prices' ->> 'sedan')::numeric from jsonb_array_elements(cat -> 'services') s where s ->> 'name' = 'Full detail') = 210, '0038: owner sees matrix prices in the catalog';

  -- the shop's chips are the retail menu; a dealership's chips are the dealer menu
  select count(*) into n from public.dealership_price_list('00000000-0000-4000-8000-000000000103') where name in ('Full detail', 'Oil change'); assert n = 2, '0038: shop menu';
  select count(*) into n from public.dealership_price_list('00000000-0000-4000-8000-000000000103') where name = 'PDI'; assert n = 0, '0038: no dealer items at the shop';
  select count(*) into n from public.dealership_price_list('00000000-0000-4000-8000-000000000101') where name = 'Full detail'; assert n = 0, '0038: no retail items on a dealership';
  select count(*) into n from public.dealership_price_list('00000000-0000-4000-8000-000000000101') where name = 'Other'; assert n = 1, '0038: Other on both menus';
  -- a service flagged for both menus shows on both
  update public.services set retail = true where name = 'Paint Correction (1-step)';
  select count(*) into n from public.dealership_price_list('00000000-0000-4000-8000-000000000103') where name = 'Paint Correction (1-step)'; assert n = 1, '0038: separate but addable';
  update public.services set retail = false where name = 'Paint Correction (1-step)';
end $$;

-- A retail job is priced from the vehicle's size; dealer jobs unchanged.
do $$
declare v_full uuid; v_ana uuid := (select v from r_ids where k = 'cust_ana'); v_mazda uuid := (select v from r_ids where k = 'veh_mazda'); v_truck uuid; j public.jobs; veh public.vehicles;
begin
  select id into v_full from public.services where name = 'Full detail';
  -- the Mazda was set to sedan by hand in the 0037 block → 210 (edited above)
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000103', 'tag_number', 'R-300', 'vehicle_id', v_mazda,
        'services', jsonb_build_array(jsonb_build_object('service_id', v_full, 'price', 5))));
  assert pg_temp.js_price(j.id) = 210, '0038: retail job priced by the vehicle size (sedan): ' || pg_temp.js_price(j.id);
  veh := public.save_vehicle(jsonb_build_object('customer_id', v_ana, 'model', 'F-150', 'make', 'Ford', 'year', 2021, 'body_class', 'Pickup'));
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000103', 'tag_number', 'R-301', 'vehicle_id', veh.id,
        'services', jsonb_build_array(jsonb_build_object('service_id', v_full))));
  assert pg_temp.js_price(j.id) = 240, '0038: retail job priced by the vehicle size (suv_truck): ' || pg_temp.js_price(j.id);
  -- editing the services re-prices by the same vehicle
  perform public.update_job(j.id, jsonb_build_object('services', jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'Oil change')))));
  assert pg_temp.js_price(j.id) = 75, '0038: edit re-prices by size: ' || pg_temp.js_price(j.id);
  -- no vehicle → sedan price
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000103', 'tag_number', 'R-302', 'customer_id', v_ana, 'color', 'Red',
        'services', jsonb_build_array(jsonb_build_object('service_id', v_full))));
  assert pg_temp.js_price(j.id) = 210, '0038: retail job without a vehicle uses the sedan price';
  -- a dealership job is untouched by the matrix
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'DX1', 'color', 'Red',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  assert pg_temp.js_price(j.id) = 205, '0038: dealer job still at the dealer price: ' || pg_temp.js_price(j.id);
end $$;

-- Admin: sees catalog prices (can_price_jobs) but cannot write them; manager sees none.
select pg_temp.login('10000000-0000-4000-8000-000000000005');
do $$
declare cat jsonb; n int;
begin
  cat := public.retail_catalog();
  assert (select s -> 'prices' from jsonb_array_elements(cat -> 'services') s where s ->> 'name' = 'Full detail') is not null, '0038: admin reads catalog prices';
  begin
    insert into public.service_prices_by_size (company_id, service_id, size_class, price) values (public.current_company_id(), (select id from public.services where name = 'Tire shine'), 'xl', 99);
    raise exception 'expected owner-only matrix';
  exception when sqlstate '42501' then null; end;
  update public.retail_settings set hold_minutes = 45 where company_id = public.current_company_id();
  get diagnostics n = row_count; assert n = 1, '0038: admin edits booking policy';
  update public.retail_settings set hold_minutes = 30 where company_id = public.current_company_id();
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare cat jsonb; n int;
begin
  cat := public.retail_catalog();
  assert (select s -> 'prices' from jsonb_array_elements(cat -> 'services') s where s ->> 'name' = 'Full detail') = 'null'::jsonb, '0038: manager sees no prices';
  select count(*) into n from public.service_prices_by_size; assert n = 0, '0038: matrix hidden from a manager';
  select count(*) into n from public.resources; assert n > 0, '0038: manager reads resources (for the calendar)';
  update public.retail_settings set hold_minutes = 45 where company_id = public.current_company_id();
  get diagnostics n = row_count; assert n = 0, '0038: manager cannot edit booking policy';
end $$;
select pg_temp.logout();

-- =============================================================================
-- 0039: estimates
-- =============================================================================
create or replace function pg_temp.anon() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  select set_config('role', 'anon', false);
$$;

select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare
  v_ana uuid := (select v from r_ids where k = 'cust_ana'); v_mazda uuid := (select v from r_ids where k = 'veh_mazda');
  v_full uuid; v_clay uuid; v_tire uuid; v_other uuid; e public.estimates; d jsonb; s jsonb; f jsonb; n int;
begin
  select id into v_full from public.services where name = 'Full detail';
  select id into v_clay from public.services where name = 'Clay bar';
  select id into v_tire from public.services where name = 'Tire shine';
  select id into v_other from public.services where name = 'Other';
  update public.companies set tax_rate = 0.0875 where id = public.current_company_id();

  e := public.create_estimate(jsonb_build_object(
    'customer_id', v_ana, 'vehicle_id', v_mazda, 'po_number', 'PO-7', 'internal_notes', 'secret', 'customer_notes', 'Thanks for coming in',
    'options', jsonb_build_array(
      jsonb_build_object('tier', 'good', 'name', 'Good', 'lines', jsonb_build_array(jsonb_build_object('service_id', v_full))),
      jsonb_build_object('tier', 'better', 'name', 'Better', 'recommended', true, 'lines', jsonb_build_array(jsonb_build_object('service_id', v_full), jsonb_build_object('service_id', v_clay, 'modifiers', jsonb_build_array('pet_hair'))))
    ),
    'addons', jsonb_build_array(jsonb_build_object('service_id', v_tire, 'default_on', true), jsonb_build_object('service_id', v_other, 'label', 'Headlight resto', 'price', 45))));
  assert e.display_number = 'EST-000001' and e.status = 'draft' and e.size_class = 'sedan' and length(e.token) >= 30, '0039: estimate created: ' || e.display_number;
  -- headline = recommended option (210 + 70 + 40 pet hair = 320) + default-on add-ons (15) = 335, no tax (labor)
  assert e.subtotal = 335 and e.tax = 0 and e.total = 335 and e.deposit_required = 67, '0039: headline total and deposit: ' || e.total || ' / ' || e.deposit_required;
  assert (select count(*) from public.estimate_options where estimate_id = e.id) = 2 and (select count(*) from public.estimate_lines where estimate_id = e.id) = 5, '0039: options and lines stored';
  insert into r_ids values ('est1', e.id);

  d := public.estimate_detail(e.id);
  assert (d ->> 'internal_notes') = 'secret' and (d -> 'options' -> 1 ->> 'total')::numeric = 320 and (d -> 'customer' ->> 'phone') is not null, '0039: owner detail with money and notes';
  f := public.estimates_filtered(p_q => 'Lopez');
  assert (f ->> 'count')::int = 1 and (f -> 'rows' -> 0 ->> 'total')::numeric = 335, '0039: list finds by customer, money for the owner';

  -- edit: back to draft, re-priced
  e := public.update_estimate(e.id, jsonb_build_object('options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Just the detail', 'lines', jsonb_build_array(jsonb_build_object('service_id', v_full))))));
  assert e.total = 210 and (select count(*) from public.estimate_options where estimate_id = e.id) = 1 and (select count(*) from public.estimate_lines where estimate_id = e.id) = 1, '0039: edit replaces options';
  e := public.update_estimate(e.id, jsonb_build_object(
    'options', jsonb_build_array(
      jsonb_build_object('tier', 'good', 'name', 'Good', 'lines', jsonb_build_array(jsonb_build_object('service_id', v_full))),
      jsonb_build_object('tier', 'better', 'name', 'Better', 'recommended', true, 'lines', jsonb_build_array(jsonb_build_object('service_id', v_full), jsonb_build_object('service_id', v_clay)))),
    'addons', jsonb_build_array(jsonb_build_object('service_id', v_tire, 'default_on', true), jsonb_build_object('service_id', v_other, 'label', 'Headlight resto', 'price', 45))));
  assert e.total = 295, '0039: re-priced: ' || e.total;

  s := public.send_estimate(e.id);
  assert (s ->> 'token') = e.token and (select status from public.estimates where id = e.id) = 'sent', '0039: sent';
  assert public.estimate_link(e.id) = e.token, '0039: owner reads the link';
end $$;

-- A manager reads the estimate without money; cannot write.
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare v_est uuid := (select v from r_ids where k = 'est1'); d jsonb; f jsonb; n int;
begin
  d := public.estimate_detail(v_est);
  assert (d -> 'total') = 'null'::jsonb and (d -> 'options' -> 0 -> 'total') = 'null'::jsonb and (d -> 'options' -> 0 -> 'lines' -> 0 -> 'unit_price') = 'null'::jsonb, '0039: manager sees no money';
  assert (d ->> 'display_number') = 'EST-000001' and jsonb_array_length(d -> 'options') = 2, '0039: manager sees the estimate itself';
  f := public.estimates_filtered();
  assert (f -> 'rows' -> 0 -> 'total') = 'null'::jsonb, '0039: list hides money';
  begin
    perform public.send_estimate(v_est);
    raise exception 'expected owner/admin only';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.estimate_link(v_est);
    raise exception 'expected link hidden from a manager';
  exception when sqlstate '42501' then null; end;
  begin
    select count(*) into n from public.estimates where total > 0;
    raise exception 'expected money column unreadable';
  exception when sqlstate '42501' then null; end;
end $$;

-- The customer: by token, as anon. Sees their quote with prices, not the shop's notes or other customers.
select pg_temp.logout();
create temp table r_tok as select token from public.estimates where display_number = 'EST-000001';
grant select on r_tok to anon;
select pg_temp.anon();
do $$
declare v_token text := (select token from r_tok); d jsonb; r jsonb; n int; v_opt uuid; v_addon uuid;
begin
  begin
    select count(*) into n from public.estimates;
    raise exception 'expected no table access for anon';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.estimate_by_token('nope');
    raise exception 'expected not found';
  exception when sqlstate 'P0002' then null; end;

  d := public.estimate_by_token(v_token);
  assert (d ->> 'display_number') = 'EST-000001' and (d -> 'internal_notes') = 'null'::jsonb and (d -> 'customer' ->> 'display_name') = 'Ana' and (d -> 'customer' -> 'phone') = 'null'::jsonb, '0039: public view hides notes and contact';
  assert (d -> 'options' -> 1 ->> 'total')::numeric = 280 and (d -> 'addons' -> 1 ->> 'line_total')::numeric = 45 and (d -> 'policy' ->> 'deposit_value')::numeric = 20, '0039: public view carries the prices and policy';
  perform public.estimate_mark_viewed(v_token);
  perform public.estimate_mark_viewed(v_token);

  select (o ->> 'id')::uuid into v_opt from jsonb_array_elements(d -> 'options') o where o ->> 'tier' = 'better';
  select (a ->> 'id')::uuid into v_addon from jsonb_array_elements(d -> 'addons') a where a ->> 'name' = 'Headlight resto';
  begin
    perform public.estimate_respond(v_token, jsonb_build_object('option_id', v_opt, 'name', 'Ana Lopez'));
    raise exception 'expected signature required';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.estimate_respond(v_token, jsonb_build_object('option_id', v_opt, 'name', 'Ana Lopez', 'signature_path', 'somewhere/else.png'));
    raise exception 'expected bad signature path';
  exception when sqlstate '22023' then null; end;
  r := public.estimate_respond(v_token, jsonb_build_object('option_id', v_opt, 'approved_line_ids', jsonb_build_array(v_addon), 'name', 'Ana Lopez',
         'signature_path', '00000000-0000-4000-8000-000000000001/estimates/' || (d ->> 'id') || '/sig.png', 'pay_choice', 'deposit', 'ip', '1.2.3.4'));
  -- Better (280) + Headlight resto (45) = 325; tire shine was default-on but not approved
  assert (r ->> 'status') = 'accepted' and (r ->> 'total')::numeric = 325 and (r ->> 'deposit_required')::numeric = 65, '0039: accepted with the chosen option and add-on: ' || r::text;
  begin
    perform public.estimate_respond(v_token, jsonb_build_object('option_id', v_opt, 'name', 'again', 'signature_path', 'x'));
    raise exception 'expected already answered';
  exception when sqlstate 'P0001' then null; end;
end $$;
select pg_temp.logout();

-- Owner: the authorization is recorded, viewed counts moved, and the estimate becomes a job at the snapshot prices.
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_est uuid := (select v from r_ids where k = 'est1'); d jsonb; j public.jobs; n int; e public.estimates; t jsonb;
begin
  d := public.estimate_detail(v_est);
  assert (d ->> 'status') = 'accepted' and (d ->> 'view_count')::int = 2 and (d ->> 'first_viewed_at') is not null, '0039: viewed and accepted';
  assert jsonb_array_length(d -> 'authorizations') = 1 and (d -> 'authorizations' -> 0 ->> 'method') = 'online' and (d -> 'authorizations' -> 0 ->> 'pay_choice') = 'deposit' and (d -> 'authorizations' -> 0 ->> 'total')::numeric = 325, '0039: authorization recorded';
  j := public.convert_estimate_to_job(v_est, jsonb_build_object('performed_at', now()));
  assert j.customer_id = (select v from r_ids where k = 'cust_ana') and j.vehicle_id = (select v from r_ids where k = 'veh_mazda') and j.tag_number = 'E-000001' and j.notes = 'Thanks for coming in', '0039: job from the estimate: ' || j.tag_number;
  select count(*) into n from public.job_services where job_id = j.id; assert n = 3, '0039: three lines on the job (full, clay, headlight): ' || n;
  assert (select sum(p.price) from public.job_service_prices_v p where p.job_id = j.id) = 325, '0039: job priced at the snapshot';
  assert (select label from public.job_services where job_id = j.id and service_id = (select id from public.services where name = 'Other')) = 'Headlight resto', '0039: Other keeps its label';
  assert (select job_id from public.estimates where id = v_est) = j.id, '0039: estimate linked to the job';
  assert (public.convert_estimate_to_job(v_est)).id = j.id, '0039: converting twice returns the same job';
  -- cannot edit or re-send an accepted estimate
  begin
    perform public.update_estimate(v_est, jsonb_build_object('po_number', 'x'));
    raise exception 'expected locked';
  exception when sqlstate 'P0001' then null; end;
  -- staff-recorded acceptance on a second estimate, and the timeline shows both
  e := public.create_estimate(jsonb_build_object('customer_id', (select v from r_ids where k = 'cust_ana'),
         'options', jsonb_build_array(jsonb_build_object('name', 'Clay', 'lines', jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'Clay bar')))))));
  assert e.size_class = 'sedan' and e.total = 70, '0039: no vehicle → sedan';
  e := public.mark_estimate_accepted(e.id, (select id from public.estimate_options where estimate_id = e.id), '{}', 'Ana on the phone', 'phone');
  assert e.status = 'accepted' and (select method from public.estimate_authorizations where estimate_id = e.id) = 'phone', '0039: staff approval';
  t := public.customer_timeline((select v from r_ids where k = 'cust_ana'));
  assert jsonb_array_length(t -> 'estimates') = 2 and (t -> 'estimates' -> 0 ->> 'total')::numeric = 70, '0039: timeline lists estimates';
  -- decline + expiry
  e := public.create_estimate(jsonb_build_object('customer_id', (select v from r_ids where k = 'cust_ana'), 'expires_at', now() - interval '1 day',
         'options', jsonb_build_array(jsonb_build_object('name', 'Old', 'lines', jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'Clay bar')))))));
  perform public.send_estimate(e.id);
  assert (select expires_at from public.estimates where id = e.id) > now(), '0039: sending an expired draft extends it';
  insert into r_ids values ('est_old', e.id);
  update public.companies set tax_rate = 0 where id = public.current_company_id();
end $$;
select pg_temp.logout();
update public.estimates set expires_at = now() - interval '1 hour' where id = (select v from r_ids where k = 'est_old');
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
do $$
declare n int;
begin
  n := public.expire_estimates();
  assert n = 1, '0039: one expired: ' || n;
end $$;
select set_config('request.jwt.claims', '', false);

-- ===========================================================================
-- 0040: booking. Slots, holds, confirm → lead, staff booking, check-in → job.
-- ===========================================================================
select pg_temp.logout();
create temp table r_days as select date_trunc('week', now() + interval '14 days')::date as mon;   -- a Monday one to two weeks out
grant select on r_days to anon, authenticated;
create temp table r_atok (k text primary key, token text);
grant all on r_atok to anon, authenticated;
grant select on r_ids to anon;

select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare
  v_mon date := (select mon from r_days); v_full uuid; v_pc uuid; v_oil uuid; s jsonb; n int; d jsonb;
begin
  select id into v_full from public.services where name = 'Full detail';
  select id into v_pc from public.services where name = 'Paint correction (1-stage)';
  select id into v_oil from public.services where name = 'Oil change';
  insert into r_ids values ('svc_full', v_full), ('svc_pc', v_pc), ('svc_oil', v_oil), ('svc_other', (select id from public.services where name = 'Other'));

  s := public.find_slots(jsonb_build_array(jsonb_build_object('service_id', v_full)), v_mon, v_mon);
  assert jsonb_array_length(s) = 11, '0040: full detail on a Monday: 08:00 to 13:00 every 30 min = 11, got ' || jsonb_array_length(s);
  assert (s -> 0 ->> 'starts_at')::timestamptz = (v_mon + time '08:00') at time zone 'America/Los_Angeles', '0040: first slot at opening in the shop timezone';
  assert (s -> 10 ->> 'ends_at')::timestamptz = (v_mon + time '17:00') at time zone 'America/Los_Angeles', '0040: last slot ends at closing';
  s := public.find_slots(jsonb_build_array(jsonb_build_object('service_id', v_full)), v_mon - 1, v_mon - 1);
  assert jsonb_array_length(s) = 0, '0040: Sunday is closed';
  -- paint correction: needs the correction skill; nobody has it yet
  s := public.find_slots(jsonb_build_array(jsonb_build_object('service_id', v_pc)), v_mon, v_mon);
  assert jsonb_array_length(s) = 0, '0040: no qualified tech → no slots';
  -- the lead time: nothing today inside two hours
  s := public.find_slots(jsonb_build_array(jsonb_build_object('service_id', v_full)), current_date, current_date + 1);
  assert not exists (select 1 from jsonb_array_elements(s) x where (x ->> 'starts_at')::timestamptz < now() + interval '2 hours'), '0040: lead time honoured';
  -- too far ahead
  s := public.find_slots(jsonb_build_array(jsonb_build_object('service_id', v_full)), current_date + 100, current_date + 100);
  assert jsonb_array_length(s) = 0, '0040: beyond max_days_ahead';
end $$;

-- A tech learns paint correction; a day is blacked out
select pg_temp.logout();
update public.resources set skills = skills || '{correction}' where id = (select id from public.resources where kind = 'tech' and company_id = '00000000-0000-4000-8000-000000000001' order by sort_order limit 1);
-- the other techs do the mechanical work (oil, brakes)
update public.resources set skills = skills || '{mechanic}' where kind = 'tech' and company_id = '00000000-0000-4000-8000-000000000001' and id <> (select id from public.resources where kind = 'tech' and company_id = '00000000-0000-4000-8000-000000000001' order by sort_order limit 1);
insert into public.blackout_days (company_id, day, reason) values ('00000000-0000-4000-8000-000000000001', (select mon + 1 from r_days), 'Test');
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_mon date := (select mon from r_days); s jsonb;
begin
  s := public.find_slots(jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_pc'))), v_mon, v_mon);
  assert jsonb_array_length(s) = 5, '0040: correction only in its 08:00–10:00 window: 5 starts, got ' || jsonb_array_length(s);
  s := public.find_slots(jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full'))), v_mon + 1, v_mon + 1);
  assert jsonb_array_length(s) = 0, '0040: blackout day has no slots';
end $$;

-- The customer, as anon: a hold, the contention on the two lifts, the confirm.
select pg_temp.logout();
select set_config('request.jwt.claims', '', false);
select set_config('role', 'anon', false);
do $$
declare
  v_mon date := (select mon from r_days); v_oil uuid := (select v from r_ids where k = 'svc_oil'); v_full uuid := (select v from r_ids where k = 'svc_full');
  v_8 timestamptz := (v_mon + time '08:00') at time zone 'America/Los_Angeles';
  h jsonb; h2 jsonb; s jsonb; c jsonb; n int;
begin
  -- the public catalog: retail services only, no Other, prices by size, questions
  c := public.public_catalog();
  assert jsonb_array_length(c -> 'services') = 12 and not exists (select 1 from jsonb_array_elements(c -> 'services') x where x ->> 'name' = 'Other'), '0040: public catalog is the retail menu without Other';
  assert (select x -> 'prices' ->> 'suv_truck' from jsonb_array_elements(c -> 'services') x where x ->> 'name' = 'Full detail')::numeric = 240, '0040: public prices by size';
  assert (c -> 'settings' ->> 'hold_minutes')::int = 30 and (c -> 'company' ->> 'timezone') = 'America/Los_Angeles', '0040: public settings';
  assert (public.public_quote('suv_truck', jsonb_build_array(jsonb_build_object('service_id', v_full, 'modifiers', jsonb_build_array('pet_hair')))) ->> 'total')::numeric = 280, '0040: public quote with a modifier';
  begin
    perform public.public_quote('sedan', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_other'), 'price', 10)));
    raise exception 'expected Other refused online';
  exception when sqlstate '22023' then null; end;

  h := public.create_hold(jsonb_build_object('size_class', 'suv_truck', 'lines', jsonb_build_array(jsonb_build_object('service_id', v_oil)), 'starts_at', v_8, 'intake', jsonb_build_object('pet_hair', false)));
  assert (h ->> 'display_number') = 'APT-000001' and (h ->> 'total')::numeric = 75 and (h ->> 'deposit_required')::numeric = 15 and (h ->> 'hold_expires_at')::timestamptz > now() + interval '25 minutes' and (h ->> 'has_customer')::boolean = false, '0040: hold created: ' || h::text;
  insert into r_atok values ('hold1', h ->> 'token');
  h2 := public.create_hold(jsonb_build_object('size_class', 'sedan', 'lines', jsonb_build_array(jsonb_build_object('service_id', v_oil)), 'starts_at', v_8));
  insert into r_atok values ('hold2', h2 ->> 'token');
  begin
    perform public.create_hold(jsonb_build_object('size_class', 'sedan', 'lines', jsonb_build_array(jsonb_build_object('service_id', v_oil)), 'starts_at', v_8));
    raise exception 'expected both lifts taken';
  exception when sqlstate 'P0001' then null; end;
  s := public.find_slots(jsonb_build_array(jsonb_build_object('service_id', v_oil)), v_mon, v_mon);
  assert not exists (select 1 from jsonb_array_elements(s) x where (x ->> 'starts_at')::timestamptz = v_8), '0040: a held slot is not offered';
  assert exists (select 1 from jsonb_array_elements(s) x where (x ->> 'starts_at')::timestamptz = v_8 + interval '1 hour'), '0040: the next free lift slot is';
  -- a bay-only job still fits at 08:00 (6 bays, 2 in use)
  s := public.find_slots(jsonb_build_array(jsonb_build_object('service_id', v_full)), v_mon, v_mon);
  assert exists (select 1 from jsonb_array_elements(s) x where (x ->> 'starts_at')::timestamptz = v_8), '0040: bays still free at 08:00';
  -- anon cannot read the tables
  begin
    select count(*) into n from public.appointments;
    raise exception 'expected anon denied';
  exception when sqlstate '42501' then null; end;

  -- confirm: a new customer and their car are created; sms consent timestamped
  c := public.confirm_hold(h ->> 'token', jsonb_build_object(
    'contact', jsonb_build_object('first_name', 'Jordan', 'last_name', 'Lee', 'phone', '(916) 555-0199', 'email', 'Jordan@Example.com', 'sms_opt_in', true, 'marketing_opt_in', false),
    'vehicle', jsonb_build_object('year', 2021, 'make', 'Ford', 'model', 'F-150', 'color', 'Black'), 'pay_choice', 'at_shop', 'customer_notes', 'Gate code 1234'));
  assert (c ->> 'status') = 'lead' and (c ->> 'pay_choice') = 'at_shop', '0040: hold confirmed into a lead: ' || c::text;
  c := public.confirm_hold(h ->> 'token', '{}'::jsonb);
  assert (c ->> 'status') = 'lead', '0040: confirming twice is harmless';
  -- a missing name is refused
  begin
    perform public.confirm_hold(h2 ->> 'token', jsonb_build_object('contact', jsonb_build_object('phone', '9165550000')));
    raise exception 'expected name required';
  exception when sqlstate '22023' then null; end;

  -- the customer's view
  c := public.appointment_by_token(h ->> 'token');
  assert (c -> 'customer' ->> 'display_name') = 'Jordan' and (c -> 'customer' -> 'phone') = 'null'::jsonb and (c -> 'vehicle' ->> 'name') = '2021 Ford F-150' and (c ->> 'can_change')::boolean and (c -> 'services' -> 0 ->> 'line_total')::numeric = 75 and (c -> 'resources') = '[]'::jsonb, '0040: public appointment view: ' || c::text;
end $$;
select set_config('role', 'postgres', false);
select set_config('request.jwt.claims', '', false);

do $$
declare c public.customers; v public.vehicles; n int; a public.appointments;
begin
  select * into c from public.customers where phone_digits = '9165550199';
  assert c.first_name = 'Jordan' and c.source = 'online_booking' and c.sms_opt_in and c.sms_opt_in_at is not null and not c.marketing_opt_in and c.email = 'jordan@example.com', '0040: customer created from the booking';
  select * into v from public.vehicles where customer_id = c.id;
  assert v.model = 'F-150' and v.size_class = 'suv_truck', '0040: vehicle created with the size picked';
  select * into a from public.appointments where token = (select token from r_atok where k = 'hold1');
  assert a.status = 'lead' and a.customer_id = c.id and a.vehicle_id = v.id and a.customer_notes = 'Gate code 1234' and a.hold_expires_at is null, '0040: lead links the records';
  insert into r_ids values ('appt_lead', a.id), ('cust_jordan', c.id);
  -- the second hold runs out
  update public.appointments set hold_expires_at = now() - interval '1 minute' where token = (select token from r_atok where k = 'hold2');
  n := public.release_expired_holds();
  assert n = 1, '0040: one hold released: ' || n;
  assert (select status from public.appointments where token = (select token from r_atok where k = 'hold2')) = 'cancelled', '0040: expired hold cancelled';
end $$;

-- An expired hold gives its lift back; a confirmed lead cannot be confirmed by a stranger; cancel inside the window refused.
select set_config('request.jwt.claims', '', false);
select set_config('role', 'anon', false);
do $$
declare v_mon date := (select mon from r_days); v_8 timestamptz := (v_mon + time '08:00') at time zone 'America/Los_Angeles'; s jsonb; c jsonb; t text := (select token from r_atok where k = 'hold2');
begin
  s := public.find_slots(jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_oil'))), v_mon, v_mon);
  assert exists (select 1 from jsonb_array_elements(s) x where (x ->> 'starts_at')::timestamptz = v_8), '0040: the released lift is offered again';
  begin
    perform public.confirm_hold(t, jsonb_build_object('contact', jsonb_build_object('first_name', 'Late', 'phone', '9165550001')));
    raise exception 'expected expired hold refused';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.appointment_by_token('not-a-token-at-all-really');
    raise exception 'expected bad token';
  exception when sqlstate 'P0002' then null; end;
end $$;
select set_config('role', 'postgres', false);
update public.appointments set starts_at = now() + interval '1 hour', ends_at = now() + interval '2 hours' where id = (select v from r_ids where k = 'appt_lead');
select set_config('request.jwt.claims', '', false);
select set_config('role', 'anon', false);
do $$
declare c jsonb; t text := (select token from r_atok where k = 'hold1');
begin
  c := public.appointment_by_token(t);
  assert not (c ->> 'can_change')::boolean, '0040: inside the notice window';
  begin
    perform public.cancel_by_token(t, 'changed my mind');
    raise exception 'expected cancel refused inside 24 h';
  exception when sqlstate 'P0001' then null; end;
end $$;
select set_config('role', 'postgres', false);
update public.appointments set starts_at = (select (mon + time '08:00') at time zone 'America/Los_Angeles' from r_days), ends_at = (select (mon + time '08:45') at time zone 'America/Los_Angeles' from r_days) where id = (select v from r_ids where k = 'appt_lead');

-- Staff: a manager books and confirms; a detailer cannot; check-in makes the job; the owner sees money.
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare
  v_mon date := (select mon from r_days); v_ana uuid := (select v from r_ids where k = 'cust_ana'); v_mazda uuid := (select v from r_ids where k = 'veh_mazda');
  v_clay uuid; a jsonb; cal jsonb; j public.jobs; t jsonb;
begin
  select id into v_clay from public.services where name = 'Clay bar';
  a := public.book_appointment(jsonb_build_object('customer_id', v_ana, 'vehicle_id', v_mazda, 'lines', jsonb_build_array(jsonb_build_object('service_id', v_clay)), 'starts_at', (v_mon + time '09:00') at time zone 'America/Los_Angeles', 'notes', 'Regular'));
  assert (a ->> 'status') = 'booked' and (a ->> 'source') = 'staff' and (a -> 'total') = 'null'::jsonb and (a -> 'services' -> 0 ->> 'name') = 'Clay bar' and jsonb_array_length(a -> 'resources') = 2, '0040: manager books without seeing money: ' || a::text;
  insert into r_ids values ('appt_staff', (a ->> 'id')::uuid);
  -- the lead is confirmed
  a := public.set_appointment_status((select v from r_ids where k = 'appt_lead'), 'booked');
  assert (a ->> 'status') = 'booked' and (a ->> 'confirmed_at') is not null, '0040: lead confirmed';
  -- check in: the job exists with the lines at the appointment prices
  a := public.set_appointment_status((select v from r_ids where k = 'appt_lead'), 'in_progress');
  assert (a ->> 'job_id') is not null, '0040: check-in creates the job';
  select * into j from public.jobs where id = (a ->> 'job_id')::uuid;
  assert j.tag_number = 'A-000001' and j.customer_id = (select v from r_ids where k = 'cust_jordan') and j.appointment_id = (a ->> 'id')::uuid and j.model = 'F-150', '0040: the job carries the customer, car and appointment: ' || j.tag_number;
  assert (select count(*) from public.job_services where job_id = j.id) = 1, '0040: one line on the job';
  a := public.set_appointment_status((select v from r_ids where k = 'appt_lead'), 'done');
  assert (a ->> 'status') = 'done', '0040: done';
  -- the calendar
  cal := public.calendar_range((v_mon::timestamp) at time zone 'America/Los_Angeles', ((v_mon + 1)::timestamp) at time zone 'America/Los_Angeles');
  assert jsonb_array_length(cal -> 'items') = 2 and (cal -> 'items' -> 0 -> 'total') = 'null'::jsonb and jsonb_array_length(cal -> 'resources') >= 10, '0040: calendar for a manager: ' || jsonb_array_length(cal -> 'items');
  -- reschedule within the day
  a := public.reschedule_appointment((select v from r_ids where k = 'appt_staff'), (v_mon + time '10:00') at time zone 'America/Los_Angeles');
  assert (a ->> 'starts_at')::timestamptz = (v_mon + time '10:00') at time zone 'America/Los_Angeles' and (a ->> 'ends_at')::timestamptz = (v_mon + time '11:00') at time zone 'America/Los_Angeles', '0040: rescheduled';
  assert length(public.appointment_link((select v from r_ids where k = 'appt_staff'))) >= 30, '0040: manager reads the manage link';
  t := public.customer_timeline(v_ana);
  assert jsonb_array_length(t -> 'appointments') = 1 and (t -> 'appointments' -> 0 ->> 'status') = 'booked', '0040: timeline lists appointments';
  begin
    perform public.release_expired_holds();
    raise exception 'expected service role only';
  exception when sqlstate '42501' then null; end;
end $$;

select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
begin
  begin
    perform public.book_appointment(jsonb_build_object('customer_id', (select v from r_ids where k = 'cust_ana'), 'lines', '[]'::jsonb, 'starts_at', now() + interval '3 days'));
    raise exception 'expected detailer refused';
  exception when sqlstate '42501' then null; end;
  assert jsonb_array_length(public.calendar_range(now() - interval '1 day', now() + interval '60 days') -> 'items') >= 2, '0040: a detailer reads the calendar';
  begin
    perform public.appointment_link((select v from r_ids where k = 'appt_staff'));
    raise exception 'expected link hidden from a detailer';
  exception when sqlstate '42501' then null; end;
end $$;

-- Owner: money on the calendar; booking from an approved estimate keeps its numbers; the summary for Today.
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_mon date := (select mon from r_days); v_est uuid := (select v from r_ids where k = 'est1'); a jsonb; cal jsonb; td jsonb;
begin
  cal := public.calendar_range((v_mon::timestamp) at time zone 'America/Los_Angeles', ((v_mon + 1)::timestamp) at time zone 'America/Los_Angeles');
  assert (select (x ->> 'total')::numeric from jsonb_array_elements(cal -> 'items') x where x ->> 'display_number' = 'APT-000001') = 75, '0040: owner sees totals on the calendar';
  a := public.book_appointment(jsonb_build_object('estimate_id', v_est, 'starts_at', (v_mon + time '11:00') at time zone 'America/Los_Angeles'));
  assert (a ->> 'source') = 'estimate' and (a ->> 'total')::numeric = 325 and (a ->> 'deposit_required')::numeric = 65 and jsonb_array_length(a -> 'services') = 3 and (a ->> 'customer_notes') = 'Thanks for coming in', '0040: booked from the estimate at its numbers: ' || a::text;
  -- check-in links the job the estimate already made
  a := public.set_appointment_status((a ->> 'id')::uuid, 'in_progress');
  assert (a ->> 'job_id')::uuid = (select job_id from public.estimates where id = v_est), '0040: the estimate''s job is reused';
  td := public.retail_today_appointments();
  assert td ? 'leads' and td ? 'holds' and td ? 'today', '0040: today summary';
  begin
    perform public.book_appointment(jsonb_build_object('estimate_id', v_est, 'starts_at', (v_mon + time '12:00') at time zone 'America/Los_Angeles'));
  exception when others then null; end;
end $$;
select pg_temp.logout();

-- ===========================================================================
-- 0041: deposits, the balance at the counter, the signed receipt.
-- ===========================================================================
-- The customer pays the deposit online for the lead (APT-000001 is done; use the staff booking for Ana: appt_staff, booked).
select set_config('request.jwt.claims', '', false);
select set_config('role', 'anon', false);
do $$
declare t text := (select token from r_atok where k = 'hold1'); d jsonb; n int;
begin
  -- hold1 is done already: a deposit is refused
  begin
    perform public.start_deposit_by_token('appointment', t);
    raise exception 'expected no deposit on a finished appointment';
  exception when sqlstate 'P0001' then null; end;
  begin
    select count(*) into n from public.payments;
    raise exception 'expected anon denied';
  exception when sqlstate '42501' then null; end;
end $$;
select set_config('role', 'postgres', false);
-- a fresh public booking for Jordan: hold → lead with "pay the deposit"
select set_config('request.jwt.claims', '', false);
select set_config('role', 'anon', false);
do $$
declare v_mon date := (select mon from r_days); h jsonb; c jsonb; d jsonb;
begin
  h := public.create_hold(jsonb_build_object('size_class', 'sedan', 'lines', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full'))), 'starts_at', (v_mon + 1 + time '13:00') at time zone 'America/Los_Angeles'));
  -- v_mon + 1 is blacked out; the engine refuses
  raise exception 'expected blackout refused';
exception when sqlstate 'P0001' then null;
end $$;
do $$
declare v_mon date := (select mon from r_days); h jsonb; c jsonb; d jsonb;
begin
  h := public.create_hold(jsonb_build_object('size_class', 'sedan', 'lines', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full'))), 'starts_at', (v_mon + 2 + time '13:00') at time zone 'America/Los_Angeles'));
  insert into r_atok values ('dep1', h ->> 'token');
  c := public.confirm_hold(h ->> 'token', jsonb_build_object('contact', jsonb_build_object('first_name', 'Jordan', 'phone', '(916) 555-0199'), 'pay_choice', 'deposit'));
  assert (c ->> 'status') = 'lead' and (c ->> 'deposit_required')::numeric = 42, '0041: lead with a 20% deposit on 210: ' || c::text;
  d := public.start_deposit_by_token('appointment', h ->> 'token');
  assert (d ->> 'amount')::numeric = 42 and (d ->> 'amount_cents')::int = 4200 and (d -> 'customer' ->> 'first_name') = 'Jordan' and (d ->> 'display_number') like 'APT-%', '0041: deposit link data: ' || d::text;
  insert into r_atok values ('pay1', d ->> 'payment_id');
  -- asking again reuses the same pending row
  assert (public.start_deposit_by_token('appointment', h ->> 'token') ->> 'payment_id') = (d ->> 'payment_id'), '0041: one pending row';
end $$;
select set_config('role', 'postgres', false);
select set_config('request.jwt.claims', '', false);

-- The server attaches the Clover session; the webhook pays it; the lead is booked.
do $$
declare v_pay uuid := (select token::uuid from r_atok where k = 'pay1'); r jsonb; a public.appointments; n int;
begin
  perform public.attach_checkout_session(v_pay, 'sess_abc123', '{"href":"https://example"}'::jsonb);
  r := public.record_payment_system_retail(jsonb_build_object('checkout_session_id', 'sess_nope', 'status', 'paid'));
  assert (r ->> 'ok')::boolean = false, '0041: unknown session ignored';
  r := public.record_payment_system_retail(jsonb_build_object('checkout_session_id', 'sess_abc123', 'status', 'paid', 'provider_ref', 'PAY1', 'raw', '{"x":1}'::jsonb));
  assert (r ->> 'ok')::boolean and (r ->> 'status') = 'paid', '0041: webhook pays: ' || r::text;
  select * into a from public.appointments where token = (select token from r_atok where k = 'dep1');
  assert a.status = 'booked' and a.deposit_paid_at is not null and a.deposit_payment_id = v_pay and a.confirmed_at is not null, '0041: a paid deposit books the lead';
  r := public.record_payment_system_retail(jsonb_build_object('checkout_session_id', 'sess_abc123', 'status', 'paid'));
  assert (r ->> 'already')::boolean, '0041: webhook twice is harmless';
  insert into r_ids values ('appt_dep', a.id);
  n := public.expire_pending_payments();
  assert n = 0, '0041: nothing stale yet';
end $$;

-- The customer sees the deposit as paid; staff see the ledger; the manager cannot see amounts.
select set_config('request.jwt.claims', '', false);
select set_config('role', 'anon', false);
do $$
declare c jsonb := public.appointment_by_token((select token from r_atok where k = 'dep1'));
begin
  assert (c ->> 'status') = 'booked' and (c ->> 'deposit_paid_at') is not null and (c ->> 'deposit_paid')::numeric = 42 and (c -> 'payments') = '[]'::jsonb, '0041: public view shows the deposit paid: ' || c::text;
  begin
    perform public.start_deposit_by_token('appointment', (select token from r_atok where k = 'dep1'));
    raise exception 'expected already paid';
  exception when sqlstate 'P0001' then null; end;
end $$;
select set_config('role', 'postgres', false);
select set_config('request.jwt.claims', '', false);

select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare a jsonb; n int;
begin
  a := public.appointment_detail((select v from r_ids where k = 'appt_dep'));
  assert jsonb_array_length(a -> 'payments') = 1 and (a -> 'payments' -> 0 -> 'amount') = 'null'::jsonb and (a -> 'deposit_paid') = 'null'::jsonb and (a -> 'payments' -> 0 ->> 'status') = 'paid', '0041: manager sees the payment, not the amount: ' || (a -> 'payments')::text;
  select count(*) into n from public.payments; assert n >= 1, '0041: manager lists payments';
  begin
    select count(*) into n from public.payments where amount > 0;
    raise exception 'expected amount column hidden';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.retail_money_summary();
    raise exception 'expected owner/admin only';
  exception when sqlstate '42501' then null; end;
  -- a deposit taken at the shop for Ana's staff booking books nothing new (already booked) but lands on the ledger
  a := public.record_deposit_at_shop((select v from r_ids where k = 'appt_staff'), 'cash', 'till');
  assert (a ->> 'deposit_paid_at') is not null and jsonb_array_length(a -> 'payments') = 1, '0041: deposit at the shop';
  begin
    perform public.record_deposit_at_shop((select v from r_ids where k = 'appt_staff'), 'clover_online', 'X');
    raise exception 'expected owner only for a hand-matched online payment';
  exception when sqlstate '42501' then null; end;
end $$;

-- The owner: check in the deposit-paid booking, the balance at the counter, the receipt.
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare a jsonb; ch jsonb; j public.jobs; r jsonb; m jsonb; s jsonb; v_pay uuid; v_job uuid; v_sig text;
begin
  a := public.set_appointment_status((select v from r_ids where k = 'appt_dep'), 'in_progress');
  v_job := (a ->> 'job_id')::uuid;
  assert v_job is not null, '0041: checked in';
  ch := public.retail_charge(v_job);
  assert (ch ->> 'total')::numeric = 210 and (ch ->> 'deposit_paid')::numeric = 42 and (ch ->> 'balance')::numeric = 168 and (ch ->> 'amount_cents')::int = 16800 and (ch ->> 'signature_required')::boolean, '0041: balance = total − deposit: ' || ch::text;
  j := public.record_retail_payment(v_job, 168, 'clover', 'FLEX-1');
  assert j.paid_at is not null and j.paid_amount = 210, '0041: the job is paid in full (deposit + balance): ' || j.paid_amount;
  assert (select status from public.appointments where id = (select v from r_ids where k = 'appt_dep')) = 'done', '0041: paying the job finishes the appointment';
  ch := public.retail_charge(v_job);
  assert (ch ->> 'balance')::numeric = 0 and jsonb_array_length(ch -> 'payments') = 2, '0041: ledger shows both payments';
  -- the receipt is signed under the job's folder only
  begin
    perform public.sign_receipt(v_job, 'elsewhere/sig.png', 'Jordan Lee');
    raise exception 'expected bad path';
  exception when sqlstate '22023' then null; end;
  v_sig := '00000000-0000-4000-8000-000000000001/receipts/' || v_job::text || '/sig.png';
  s := public.sign_receipt(v_job, v_sig, 'Jordan Lee');
  r := public.job_receipt(v_job);
  assert (r ->> 'signed_name') = 'Jordan Lee' and (r ->> 'has_signature')::boolean and (r ->> 'total')::numeric = 210 and (r ->> 'balance')::numeric = 0 and jsonb_array_length(r -> 'lines') = 1 and (r -> 'token') = 'null'::jsonb, '0041: receipt: ' || r::text;
  assert length(public.receipt_link(v_job)) >= 30, '0041: receipt link';
  insert into r_atok values ('rcpt', public.receipt_link(v_job));
  insert into r_ids values ('job_dep', v_job);
  -- refund part of the deposit
  select id into v_pay from public.payments where appointment_id = (select v from r_ids where k = 'appt_dep') and kind = 'deposit' and status = 'paid';
  r := public.refund_payment(v_pay, 10, 'goodwill');
  assert (r ->> 'kind') = 'refund' and (r ->> 'amount')::numeric = 10, '0041: refund recorded';
  begin
    perform public.refund_payment(v_pay, 33);
    raise exception 'expected refund capped';
  exception when sqlstate '22023' then null; end;
  m := public.retail_money_summary();
  assert (m ->> 'deposits_week')::numeric >= 56 and (m -> 'deposits_outstanding' ->> 'count')::int >= 0, '0041: money summary: ' || m::text;
  s := public.customer_timeline((select v from r_ids where k = 'cust_jordan'));
  assert jsonb_array_length(s -> 'payments') >= 3, '0041: timeline lists payments';
end $$;

-- The customer opens the receipt by its token: first name only, the signature noted, no refs.
select set_config('request.jwt.claims', '', false);
select set_config('role', 'anon', false);
do $$
declare r jsonb := public.receipt_by_token((select token from r_atok where k = 'rcpt'));
begin
  assert (r -> 'customer' ->> 'display_name') = 'Jordan' and (r -> 'customer' -> 'phone') = 'null'::jsonb and (r ->> 'total')::numeric = 210 and (r ->> 'signed_name') = 'Jordan Lee' and (r -> 'payments' -> 0 -> 'provider_ref') = 'null'::jsonb, '0041: public receipt: ' || r::text;
  begin
    perform public.receipt_by_token('not-a-real-token-at-all');
    raise exception 'expected bad token';
  exception when sqlstate 'P0002' then null; end;
end $$;
select set_config('role', 'postgres', false);
select set_config('request.jwt.claims', '', false);

-- A deposit paid on the estimate books the appointment the moment the customer picks a time.
do $$
declare e public.estimates; v_pay uuid; d jsonb;
begin
  -- EST-000002 (Ana, accepted by phone in the 0039 block) has no appointment: pay its deposit
  select * into e from public.estimates where display_number = 'EST-000002';
  d := public._start_deposit(e.company_id, null, e.id);
  v_pay := (d ->> 'payment_id')::uuid;
  perform public.record_payment_system_retail(jsonb_build_object('payment_id', v_pay, 'status', 'paid', 'provider_ref', 'PAY2'));
  insert into r_ids values ('est2', e.id);
  insert into r_atok values ('est2tok', e.token);
end $$;
select set_config('request.jwt.claims', '', false);
select set_config('role', 'anon', false);
do $$
declare v_mon date := (select mon from r_days); h jsonb; c jsonb;
begin
  h := public.create_hold(jsonb_build_object('estimate_token', (select token from r_atok where k = 'est2tok'), 'starts_at', (v_mon + 3 + time '09:00') at time zone 'America/Los_Angeles'));
  assert (h ->> 'has_customer')::boolean, '0041: estimate hold knows the customer';
  c := public.confirm_hold(h ->> 'token', '{}'::jsonb);
  assert (c ->> 'status') = 'booked', '0041: deposit paid on the estimate → booked on confirm: ' || c::text;
end $$;
select set_config('role', 'postgres', false);
select set_config('request.jwt.claims', '', false);
select pg_temp.logout();

-- ===========================================================================
-- 0042: events, rules, runs, the text queue, quiet hours, the review rule.
-- ===========================================================================
-- Events were recorded by the writes above (holds, leads, bookings, payments, estimates).
do $$
declare n int; k text;
begin
  select count(*) into n from public.events where kind = 'hold.created'; assert n >= 3, '0042: holds recorded: ' || n;
  select count(*) into n from public.events where kind = 'booking.lead'; assert n >= 2, '0042: leads recorded: ' || n;
  select count(*) into n from public.events where kind = 'booking.booked' and payload ->> 'by' = 'deposit'; assert n >= 1, '0042: a deposit booked a lead';
  select count(*) into n from public.events where kind = 'booking.booked' and payload ->> 'by' = 'staff'; assert n >= 1, '0042: staff confirmed a lead';
  select count(*) into n from public.events where kind = 'booking.checked_in'; assert n >= 2, '0042: check-ins recorded';
  select count(*) into n from public.events where kind = 'booking.rescheduled'; assert n >= 1, '0042: moves recorded';
  select count(*) into n from public.events where kind = 'hold.expired'; assert n >= 1, '0042: expired holds recorded';
  select count(*) into n from public.events where kind = 'payment.paid'; assert n >= 3, '0042: payments recorded: ' || n;
  select count(*) into n from public.events where kind = 'job.paid'; assert n >= 1, '0042: paid jobs recorded';
  select count(*) into n from public.events where kind = 'estimate.sent'; assert n >= 1, '0042: estimate sent recorded';
  select count(*) into n from public.events where kind = 'estimate.viewed'; assert n = 1, '0042: first view only: ' || n;
  select count(*) into n from public.events where kind = 'estimate.accepted'; assert n >= 2, '0042: approvals (online + staff) recorded: ' || n;
  select count(*) into n from public.automation_rules where company_id = '00000000-0000-4000-8000-000000000001' and system; assert n = 13, '0042+0055: thirteen shipped rules: ' || n;
  perform public.seed_automation_defaults('00000000-0000-4000-8000-000000000001');
  select count(*) into n from public.automation_rules where company_id = '00000000-0000-4000-8000-000000000001'; assert n = 13, '0042: seeding twice adds nothing';
end $$;

-- The runner (service role): enqueue, claim, complete; quiet hours; the review skip rules; the text queue.
do $$
declare r jsonb; runs jsonb; n int; v_job uuid := (select v from r_ids where k = 'job_dep'); v_cust uuid := (select v from r_ids where k = 'cust_jordan'); one jsonb; v_run uuid; v_q uuid;
begin
  -- outside quiet hours for the test
  update public.retail_settings set quiet_from = '00:00', quiet_to = '00:00', review_url = 'https://g.page/r/example/review' where company_id = '00000000-0000-4000-8000-000000000001';
  r := public.enqueue_due_runs();
  assert (r ->> 'events')::int > 0 and (r ->> 'runs')::int > 0, '0042: enqueued: ' || r::text;
  select count(*) into n from public.events where processed_at is null; assert n = 0, '0042: every event processed';
  -- the review request waits review_delay_minutes; everything due now is claimable
  select count(*) into n from public.automation_runs ar join public.automation_rules rl on rl.id = ar.rule_id where rl.key = 'job_review' and ar.status = 'queued' and ar.due_at > now(); assert n >= 1, '0042: review request scheduled for later';
  runs := public.claim_runs(100);
  assert jsonb_array_length(runs) > 0, '0042: runs claimed: ' || jsonb_array_length(runs);
  -- a claimed run carries what the sender needs
  select x into one from jsonb_array_elements(runs) x where x ->> 'rule_key' = 'booking_booked' limit 1;
  assert one is not null and (one -> 'subject' ->> 'token') is not null and (one -> 'settings' -> 'email_templates') ? 'booking_confirmed' and (one -> 'company' ->> 'timezone') = 'America/Los_Angeles', '0042: run payload: ' || coalesce(one::text, 'none');
  v_run := (one ->> 'run_id')::uuid;
  perform public.complete_run(v_run, 'sent', 'msg_123');
  assert (select status from public.automation_runs where id = v_run) = 'sent', '0042: run completed';
  -- runs for customers without an email are skipped with the reason
  select count(*) into n from public.automation_runs where status = 'skipped' and result like 'no email%'; assert n >= 1, '0042: skipped runs explain why';
  -- the text queue
  v_q := public.queue_text('00000000-0000-4000-8000-000000000001', v_cust, '(916) 555-0199', 'Hi Jordan, see you tomorrow', 'reminder', v_run);
  assert v_q is not null, '0042: text queued';
  assert public.queue_text('00000000-0000-4000-8000-000000000001', v_cust, 'no phone', 'x') is null, '0042: no phone, no text';
  -- the review run: fast-forward it, claim it, complete it → review_requested_at
  update public.automation_runs ar set due_at = now() - interval '1 minute' from public.automation_rules rl where rl.id = ar.rule_id and rl.key = 'job_review' and ar.subject_id = v_job;
  runs := public.claim_runs(100);
  select x into one from jsonb_array_elements(runs) x where x ->> 'rule_key' = 'job_review' and (x ->> 'subject_id')::uuid = v_job;
  assert one is not null and (one -> 'settings' ->> 'review_url') like 'https://g.page%', '0042: review run claimed with the link';
  perform public.complete_run((one ->> 'run_id')::uuid, 'sent', 'msg_rev');
  assert (select review_requested_at from public.customers where id = v_cust) is not null, '0042: review asked is stamped on the customer';
  -- a second paid job inside the skip window is skipped
  perform public._emit('00000000-0000-4000-8000-000000000001', 'job.paid', 'job', v_job, v_cust, '{}'::jsonb);
  perform public.enqueue_due_runs();
  update public.automation_runs ar set due_at = now() - interval '1 minute' from public.automation_rules rl where rl.id = ar.rule_id and rl.key = 'job_review' and ar.status = 'queued';
  perform public.claim_runs(100);
  select count(*) into n from public.automation_runs ar join public.automation_rules rl on rl.id = ar.rule_id where rl.key = 'job_review' and ar.status = 'skipped' and ar.result like 'asked within%'; assert n >= 1, '0042: review not asked twice';
  -- quiet hours hold a run
  update public.retail_settings set quiet_from = '00:00', quiet_to = '23:59' where company_id = '00000000-0000-4000-8000-000000000001';
  perform public._emit('00000000-0000-4000-8000-000000000001', 'booking.cancelled', 'appointment', (select v from r_ids where k = 'appt_staff'), (select v from r_ids where k = 'cust_ana'), '{}'::jsonb);
  perform public.enqueue_due_runs();
  runs := public.claim_runs(100);
  assert not exists (select 1 from jsonb_array_elements(runs) x where x ->> 'rule_key' = 'booking_cancelled'), '0042: quiet hours hold the cancellation email';
  assert exists (select 1 from public.automation_runs ar join public.automation_rules rl on rl.id = ar.rule_id where rl.key = 'booking_cancelled' and ar.status = 'queued'), '0042: still queued for the morning';
  update public.retail_settings set quiet_from = '20:00', quiet_to = '08:00' where company_id = '00000000-0000-4000-8000-000000000001';
  -- derived: a hold about to run out gets exactly one hold.expiring event
  update public.appointments set status = 'hold', hold_expires_at = now() + interval '5 minutes', cancelled_at = null where token = (select token from r_atok where k = 'hold2');
  perform public._derive_events(); perform public._derive_events();
  select count(*) into n from public.events where kind = 'hold.expiring' and subject_id = (select id from public.appointments where token = (select token from r_atok where k = 'hold2')); assert n = 1, '0042: one hold.expiring: ' || n;
end $$;

-- Staff: owner/admin manage rules and read the log; everyone works the text queue; nobody else reads the tables.
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare rules jsonb; r jsonb; lg jsonb; q jsonb; n int;
begin
  rules := public.automation_rules_list();
  assert jsonb_array_length(rules) = 13, '0042: owner lists the rules';
  select x into r from jsonb_array_elements(rules) x where x ->> 'key' = 'job_review';
  r := public.save_automation_rule(jsonb_build_object('id', r ->> 'id', 'enabled', false, 'delay_minutes', 60, 'event_kind', 'something.else'));
  assert (r ->> 'enabled')::boolean = false and (r ->> 'delay_minutes')::int = 60 and (r ->> 'event_kind') = 'job.paid', '0042: system rule keeps its kind';
  r := public.save_automation_rule(jsonb_build_object('name', 'Thank you a week later', 'event_kind', 'job.paid', 'delay_minutes', 10080, 'action', jsonb_build_object('kind', 'email', 'template', 'review_request')));
  assert (r ->> 'system')::boolean = false, '0042: custom rule';
  perform public.delete_automation_rule((r ->> 'id')::uuid);
  assert jsonb_array_length(public.automation_rules_list()) = 13, '0042: custom rule deleted';
  lg := public.automation_log(50);
  assert jsonb_array_length(lg) > 0 and (lg -> 0) ? 'status' and (lg -> 0) ? 'rule', '0042: the log';
  q := public.text_queue_list();
  assert jsonb_array_length(q) = 1 and (q -> 0 ->> 'customer') = 'Jordan Lee' and (q -> 0 ->> 'body') like 'Hi Jordan%', '0042: the text queue: ' || q::text;
  perform public.text_queue_done((q -> 0 ->> 'id')::uuid);
  assert jsonb_array_length(public.text_queue_list()) = 0, '0042: text marked sent';
  perform public.mark_reviewed((select v from r_ids where k = 'cust_jordan'));
  assert (select reviewed_at from public.customers where id = (select v from r_ids where k = 'cust_jordan')) is not null, '0042: marked reviewed';
  begin
    perform public.enqueue_due_runs();
    raise exception 'expected service role only';
  exception when sqlstate '42501' then null; end;
  begin
    select count(*) into n from public.events;
    raise exception 'expected events hidden';
  exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare n int;
begin
  begin
    perform public.automation_rules_list();
    raise exception 'expected owner/admin only';
  exception when sqlstate '42501' then null; end;
  select count(*) into n from public.automation_rules; assert n = 0, '0042: detailer sees no rules';
  assert jsonb_array_length(public.text_queue_list()) = 0, '0042: detailer reads the queue';
end $$;
select pg_temp.logout();

-- 0043: the repair order: advisor, RO numbers, findings ------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000006', 'adv@test', '{"role":"advisor","full_name":"Alex"}');

select pg_temp.logout();
do $$
declare n int; m int;
begin
  select count(*) into n from public.jobs j join public.dealerships d on d.id = j.dealership_id where d.retail and j.ro_number is null;
  assert n = 0, '0043: every retail job has an RO number';
  select count(*) into n from public.jobs j join public.dealerships d on d.id = j.dealership_id where not d.retail and j.ro_number is not null;
  assert n = 0, '0043: dealer jobs have none';
  select count(*), count(distinct ro_number) into n, m from public.jobs where ro_number is not null;
  assert n = m and (select min(ro_number) from public.jobs where ro_number is not null) = 'RO-000001', '0043: sequential from RO-000001';
  assert (select role::text from public.profiles where id = '10000000-0000-4000-8000-000000000006') = 'advisor', '0043: advisor profile';
end $$;

-- the advisor: every job, estimates with money, no invoices / settings / cash by hand
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare e public.estimates; s jsonb; n int; v_est uuid; j public.jobs; v_price numeric;
  v_ana uuid := (select v from r_ids where k = 'cust_ana'); v_mazda uuid := (select v from r_ids where k = 'veh_mazda');
begin
  assert public.is_admin() and public.can_price_jobs() and not public.is_owner_admin() and not public.is_owner(), '0043: advisor predicates';
  select count(*) into n from public.jobs; assert n >= 5, '0043: advisor sees every job';
  e := public.create_estimate(jsonb_build_object('customer_id', v_ana, 'vehicle_id', v_mazda, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote',
         'lines', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_other'), 'label', 'Buff the hood', 'price', 90))))));
  v_est := e.id;
  assert e.total >= 90, '0043: advisor prices an estimate: ' || e.total;
  s := public.send_estimate(v_est);
  assert length(s ->> 'token') >= 20 and length(public.estimate_link(v_est)) >= 20, '0043: advisor sends and reads the link';
  assert (public.estimate_detail(v_est) ->> 'total') is not null, '0043: advisor sees estimate money';
  assert public.retail_money_summary() ? 'collected_week', '0043: advisor sees the money tiles';
  assert public.team_dashboard() is not null, '0043: advisor has the team dashboard';
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000103', 'tag_number', 'ADV-1', 'vehicle_id', v_mazda,
         'services', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')))));
  assert j.ro_number like 'RO-%', '0043: a new retail job gets an RO number: ' || coalesce(j.ro_number, 'null');
  insert into r_ids values ('job_adv', j.id);
  select price into v_price from public.dealership_price_list('00000000-0000-4000-8000-000000000101') limit 1;
  assert v_price is null, '0043: the dealer price list stays owner/admin';
  select count(*) into n from public.invoices; assert n = 0, '0043: no invoices';
  select count(*) into n from public.invoice_payments; assert n = 0, '0043: no invoice payments';
  select count(*) into n from public.service_prices_v; assert n = 0, '0043: no price list';
  select count(*) into n from public.dealership_service_prices; assert n = 0, '0043: no dealer prices';
  update public.companies set name = 'x'; get diagnostics n = row_count; assert n = 0, '0043: cannot edit the company';
  update public.retail_settings set hold_minutes = 31; get diagnostics n = row_count; assert n = 0, '0043: cannot edit retail settings';
  begin
    perform public.automation_rules_list();
    raise exception 'expected owner/admin only';
  exception when sqlstate '42501' then null; end;
  -- 0056: the advisor may record a payment by hand (the amount is still capped by the balance)
  perform public.record_retail_payment(j.id, 10, 'cash', null);
  assert jsonb_array_length(public.retail_charge(j.id) -> 'payments') = 1, '0056: the advisor recorded the payment';
  begin
    update public.profiles set role = 'owner' where id = '10000000-0000-4000-8000-000000000004';
    get diagnostics n = row_count;
    assert n = 0, '0043: cannot change another role';
  exception when sqlstate '42501' then null; end;
end $$;

-- the manager is still refused on estimates; the detailer still sees no money
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
begin
  begin
    perform public.create_estimate(jsonb_build_object('customer_id', (select v from r_ids where k = 'cust_ana'), 'options', '[]'::jsonb));
    raise exception 'expected refusal';
  exception when sqlstate '42501' then null; end;
end $$;

-- findings: the detailer writes on their own job, not on the advisor's
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare j public.jobs; f jsonb; g jsonb; lst jsonb; n int;
  v_ana uuid := (select v from r_ids where k = 'cust_ana'); v_mazda uuid := (select v from r_ids where k = 'veh_mazda');
begin
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000103', 'tag_number', 'DET-1', 'vehicle_id', v_mazda,
         'services', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')))));
  insert into r_ids values ('job_det', j.id);
  f := public.add_finding(jsonb_build_object('job_id', j.id, 'severity', 'urgent', 'title', 'Rear pads at 2 mm', 'body', 'Metal soon', 'recommended_service_id', (select v from r_ids where k = 'svc_oil')));
  assert (f ->> 'status') = 'open' and (f ->> 'severity') = 'urgent' and (f ->> 'vehicle_id')::uuid = v_mazda and (f ->> 'recommended_service') is not null and (f ->> 'job_ro_number') like 'RO-%', '0043: finding added: ' || f::text;
  g := public.add_finding(jsonb_build_object('job_id', j.id, 'kind', 'note', 'title', 'Customer waits', 'severity', 'urgent'));
  assert (g ->> 'severity') = 'ok' and (g ->> 'kind') = 'note', '0043: a note has no severity';
  insert into r_ids values ('finding_pads', (f ->> 'id')::uuid);
  -- media on the finding
  insert into public.job_photos (company_id, job_id, kind, storage_path, size_bytes, finding_id, mime, duration_s, created_by)
    values (j.company_id, j.id, 'video', j.company_id::text || '/' || j.id::text || '/clip.mp4', 1200000, (f ->> 'id')::uuid, 'video/mp4', 12.5, auth.uid());
  lst := public.job_findings(j.id);
  assert jsonb_array_length(lst) = 2 and jsonb_array_length(lst -> 0 -> 'media') = 1 and (lst -> 0 -> 'media' -> 0 ->> 'kind') = 'video', '0043: the notes tab lists both with media: ' || lst::text;
  f := public.update_finding((f ->> 'id')::uuid, jsonb_build_object('body', 'Metal very soon', 'severity', 'soon'));
  assert (f ->> 'body') = 'Metal very soon' and (f ->> 'severity') = 'soon', '0043: finding edited';
  begin
    perform public.update_finding((f ->> 'id')::uuid, jsonb_build_object('status', 'approved'));
    raise exception 'expected: approval comes from the estimate';
  exception when sqlstate '22023' then null; end;
  -- storage: own company folder may be overwritten, another company's not
  insert into storage.objects (bucket_id, name) values ('job-photos', j.company_id::text || '/' || j.id::text || '/clip.mp4');
  update storage.objects set name = name where bucket_id = 'job-photos' and name like j.company_id::text || '/%'; get diagnostics n = row_count; assert n = 1, '0043: own upload may be overwritten';
  begin
    insert into storage.objects (bucket_id, name) values ('job-photos', '00000000-0000-4000-8000-000000000009/x/clip.mp4');
    raise exception 'expected: other company folder refused';
  exception when sqlstate '42501' then null; end;
  -- not on someone else's job
  begin
    perform public.add_finding(jsonb_build_object('job_id', (select v from r_ids where k = 'job_adv'), 'title', 'Nope'));
    raise exception 'expected refusal on another job';
  exception when sqlstate '42501' then null; end;
  assert jsonb_array_length(public.job_findings((select v from r_ids where k = 'job_adv'))) = 0, '0043: nothing listed for another job';
end $$;

-- the advisor sees the finding from last time on the next visit, and may close it
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare lst jsonb; f jsonb; tl jsonb; d jsonb; n int;
begin
  lst := public.vehicle_open_findings((select v from r_ids where k = 'veh_mazda'), (select v from r_ids where k = 'job_adv'));
  assert jsonb_array_length(lst) = 1 and (lst -> 0 ->> 'title') = 'Rear pads at 2 mm', '0043: from last time: ' || lst::text;
  tl := public.customer_timeline((select v from r_ids where k = 'cust_ana'));
  assert (select (x ->> 'open_findings')::int from jsonb_array_elements(tl -> 'vehicles') x where (x ->> 'id')::uuid = (select v from r_ids where k = 'veh_mazda')) = 1, '0043: timeline counts open findings';
  assert (select x ->> 'ro_number' from jsonb_array_elements(tl -> 'jobs') x where (x ->> 'id')::uuid = (select v from r_ids where k = 'job_det')) like 'RO-%', '0043: timeline carries the RO number';
  assert (select x ->> 'ro_number' from jsonb_array_elements(public.jobs_filtered(null, null, null, null, null, null, 'all', 50, 0, 'all') -> 'rows') x where (x ->> 'id')::uuid = (select v from r_ids where k = 'job_det')) like 'RO-%', '0043: the jobs list carries the RO number';
  f := public.update_finding((select v from r_ids where k = 'finding_pads'), jsonb_build_object('status', 'declined'));
  assert (f ->> 'status') = 'declined', '0043: declined stays on the vehicle';
  assert jsonb_array_length(public.vehicle_open_findings((select v from r_ids where k = 'veh_mazda'), (select v from r_ids where k = 'job_adv'))) = 1, '0043: declined still resurfaces';
  begin
    perform public.delete_finding((select v from r_ids where k = 'finding_pads'));
    raise exception 'expected: not the author, not owner/admin';
  exception when sqlstate '42501' then null; end;
end $$;

-- the owner removes it, media rows included
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare d jsonb; n int;
begin
  d := public.delete_finding((select v from r_ids where k = 'finding_pads'));
  assert jsonb_array_length(d -> 'paths') = 1, '0043: delete returns the media paths: ' || d::text;
  select count(*) into n from public.job_photos where finding_id = (select v from r_ids where k = 'finding_pads'); assert n = 0, '0043: media rows gone';
end $$;
select pg_temp.logout();

-- 0044: estimates on the repair order: line types, supplies, per-item approval, onto the RO
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare e public.estimates; d jsonb; o jsonb; n int; v_lr uuid; v_ana uuid := (select v from r_ids where k = 'cust_ana'); v_mazda uuid := (select v from r_ids where k = 'veh_mazda');
  v_job uuid := (select v from r_ids where k = 'job_det'); f jsonb; v_find uuid; s jsonb;
begin
  -- settings: a 5 % supplies fee capped at $10, parts taxable, labor not; a default rate of $120
  update public.retail_settings set shop_supplies_pct = 5, shop_supplies_cap = 10, parts_taxable_default = true, labor_taxable_default = false where company_id = public.current_company_id();
  update public.companies set tax_rate = 0.10 where id = public.current_company_id();
  select id into v_lr from public.labor_rates where company_id = public.current_company_id() and is_default;
  assert v_lr is not null and (select rate from public.labor_rates where id = v_lr) = 120, '0044: default labor rate seeded';
  -- a finding on the detailer's RO to quote from
  f := public.add_finding(jsonb_build_object('job_id', v_job, 'severity', 'urgent', 'title', 'Front pads at 2 mm', 'recommended_service_id', (select v from r_ids where k = 'svc_oil')));
  v_find := (f ->> 'id')::uuid;
  -- the supplement on the RO: service 210 (full detail on a sedan) + labor 2.5 h × 120 + part 2 × 40 + fee 25 + sublet 150 = 765
  e := public.create_estimate(jsonb_build_object('job_id', v_job, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote', 'lines', jsonb_build_array(
         jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')),
         jsonb_build_object('line_type', 'labor', 'label', 'Replace front pads', 'hours', 2.5, 'finding_id', v_find),
         jsonb_build_object('line_type', 'part', 'label', 'Brake pads', 'part_number', 'BP-123', 'vendor', 'NAPA', 'qty', 2, 'price', 40, 'cost', 22),
         jsonb_build_object('line_type', 'fee', 'label', 'Disposal fee', 'price', 25),
         jsonb_build_object('line_type', 'sublet', 'label', 'Rotor resurfacing', 'vendor', 'Machine shop', 'price', 150))))));
  assert e.kind = 'supplement' and e.job_id = v_job and e.customer_id = v_ana and e.vehicle_id = v_mazda, '0044: supplement on the RO carries its customer and car';
  o := public.estimate_detail(e.id) -> 'options' -> 0;
  assert (o ->> 'labor_subtotal')::numeric = 300 and (o ->> 'shop_supplies')::numeric = 10 and (o ->> 'subtotal')::numeric = 765, '0044: labor subtotal, capped supplies, subtotal: ' || o::text;
  -- tax only on the parts (80 × 10 %)
  assert e.subtotal = 765 and e.shop_supplies = 10 and e.tax = 8 and e.total = 783, '0044: totals: ' || e.subtotal || ' / ' || e.shop_supplies || ' / ' || e.tax || ' / ' || e.total;
  assert (select status from public.job_findings where id = v_find) = 'quoted' and (select estimate_line_id from public.job_findings where id = v_find) is not null, '0044: the finding is on the estimate';
  d := public.estimate_detail(e.id);
  assert (select count(*) from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'line_type' = 'labor' and (l ->> 'hours')::numeric = 2.5 and (l ->> 'rate')::numeric = 120) = 1, '0044: labor line in the json';
  assert (select (l ->> 'cost')::numeric from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'line_type' = 'part') = 22 and (d -> 'job' ->> 'ro_number') like 'RO-%' and jsonb_array_length(d -> 'findings') >= 1, '0044: cost for staff, the RO, the findings';
  insert into r_ids values ('est_sup', e.id), ('finding_pads2', v_find);
  -- labor without hours is refused
  begin
    perform public.create_estimate(jsonb_build_object('customer_id', v_ana, 'options', jsonb_build_array(jsonb_build_object('name', 'x', 'lines', jsonb_build_array(jsonb_build_object('line_type', 'labor', 'label', 'Work'))))));
    raise exception 'expected hours required';
  exception when sqlstate '22023' then null; end;
  s := public.send_estimate(e.id);
  assert (select status from public.job_findings where id = v_find) = 'quoted', '0044: still quoted once sent';
  -- the manager sees the lines but no rate or cost
  select count(*) into n from public.services where line_kind is not null; assert n = 0, '0044: no system services yet';
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare d jsonb;
begin
  d := public.estimate_detail((select v from r_ids where k = 'est_sup'));
  assert (select l -> 'rate' from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'line_type' = 'labor') = 'null'::jsonb
     and (select l -> 'cost' from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'line_type' = 'part') = 'null'::jsonb
     and (select (l ->> 'hours')::numeric from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'line_type' = 'labor') = 2.5, '0044: manager sees hours, not rate or cost';
  begin
    insert into public.labor_rates (company_id, name, rate) values (public.current_company_id(), 'Diag', 150);
    raise exception 'expected manager cannot add rates';
  exception when sqlstate '42501' then null; end;
end $$;
-- the customer: sees rate but not cost, unticks the part, signs
select pg_temp.logout();
drop table if exists r_tok; create temp table r_tok as select token, id from public.estimates where id = (select v from r_ids where k = 'est_sup');
grant select on r_tok to anon;
select pg_temp.anon();
do $$
declare v_token text := (select token from r_tok); d jsonb; r jsonb; v_opt uuid; v_keep uuid[]; v_part uuid;
begin
  d := public.estimate_by_token(v_token);
  assert (select (l ->> 'rate')::numeric from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'line_type' = 'labor') = 120
     and (select l -> 'cost' from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'line_type' = 'part') = 'null'::jsonb
     and (d -> 'options' -> 0 ->> 'shop_supplies')::numeric = 10 and (d -> 'policy' ->> 'shop_supplies_pct')::numeric = 5 and (d -> 'job' ->> 'ro_number') like 'RO-%' and jsonb_array_length(d -> 'findings') >= 1, '0044: the customer sees the rate, supplies, the RO and the findings, not the cost: ' || (d -> 'policy')::text;
  v_opt := (d -> 'options' -> 0 ->> 'id')::uuid;
  select array_agg((l ->> 'id')::uuid) into v_keep from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'line_type' <> 'part';
  select (l ->> 'id')::uuid into v_part from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'line_type' = 'part';
  r := public.estimate_respond(v_token, jsonb_build_object('option_id', v_opt, 'approved_line_ids', to_jsonb(v_keep), 'name', 'Ana Lopez',
         'signature_path', '00000000-0000-4000-8000-000000000001/estimates/' || (d ->> 'id') || '/sig.png', 'pay_choice', 'at_shop'));
  -- without the part: 685 + 10 supplies, no taxable lines left → 695
  assert (r ->> 'status') = 'accepted' and (r ->> 'total')::numeric = 695, '0044: per-item approval drops the part: ' || r::text;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare v_est uuid := (select v from r_ids where k = 'est_sup'); v_job uuid := (select v from r_ids where k = 'job_det'); j public.jobs; n int; d jsonb; je jsonb;
begin
  assert (select customer_approved from public.estimate_lines where estimate_id = v_est and line_type = 'part') = false
     and (select customer_approved from public.estimate_lines where estimate_id = v_est and line_type = 'labor') = true, '0044: the answer is on the lines';
  assert (select status from public.job_findings where id = (select v from r_ids where k = 'finding_pads2')) = 'approved', '0044: the finding is approved';
  -- the approval put the approved work on the RO by itself (0048); the staff button is only a fallback and changes nothing
  select count(*) into n from public.job_services where job_id = v_job; assert n = 5, '0048: the approval applied the supplement: ' || n;
  j := public.convert_estimate_to_job(v_est);
  assert j.id = v_job, '0044: a supplement lands on its RO';
  select count(*) into n from public.job_services where job_id = v_job; assert n = 5, '0044: full detail kept once, labor, fee, sublet, supplies added: ' || n;
  assert (select label from public.job_services js join public.services s on s.id = js.service_id where js.job_id = v_job and s.line_kind = 'labor') = 'Replace front pads — 2.50 h @ $120.00', '0044: labor label';
  assert pg_temp.js_price(v_job, (select id from public.services where line_kind = 'shop_supplies')) = 10, '0044: supplies row';
  d := public.retail_charge(v_job);
  -- 210 (the job's own full detail) + 300 + 25 + 150 + 10 = 695, tax 0 (no taxable lines approved)
  assert (d ->> 'subtotal')::numeric = 695 and (d ->> 'tax')::numeric = 0 and (d ->> 'balance')::numeric = 695, '0044: the counter balance carries the supplement: ' || (d ->> 'subtotal') || ' / ' || (d ->> 'tax');
  assert (select applied_at from public.estimates where id = v_est) is not null, '0044: applied';
  assert (public.convert_estimate_to_job(v_est)).id = v_job and (select count(*) from public.job_services where job_id = v_job) = 5, '0044: applying twice adds nothing';
  je := public.job_estimates(v_job);
  assert jsonb_array_length(je) = 1 and (je -> 0 ->> 'kind') = 'supplement' and (je -> 0 ->> 'lines')::int = 4 and (je -> 0 ->> 'applied_at') is not null, '0044: the RO lists its estimate: ' || je::text;
  -- two labor lines on one job are allowed now
  d := to_jsonb(public.create_estimate(jsonb_build_object('job_id', v_job, 'options', jsonb_build_array(jsonb_build_object('name', 'More', 'lines', jsonb_build_array(
         jsonb_build_object('line_type', 'labor', 'label', 'Bleed brakes', 'hours', 0.5), jsonb_build_object('line_type', 'labor', 'label', 'Road test', 'hours', 0.25)))))));
  perform public.mark_estimate_accepted((d ->> 'id')::uuid, (select id from public.estimate_options where estimate_id = (d ->> 'id')::uuid), '{}', 'Ana on the phone', 'phone');
  j := public.convert_estimate_to_job((d ->> 'id')::uuid);
  select count(*) into n from public.job_services js join public.services s on s.id = js.service_id where js.job_id = v_job and s.line_kind = 'labor'; assert n = 3, '0044: repeated labor rows: ' || n;
  -- the hidden services never reach the menus
  assert (select count(*) from jsonb_array_elements(public.retail_catalog() -> 'services') s where s ->> 'name' in ('Labor', 'Parts', 'Fee', 'Sublet', 'Shop supplies')) = 0, '0044: system services hidden from the catalog';
  assert jsonb_array_length(public.retail_catalog() -> 'labor_rates') = 1, '0044: the catalog carries the labor rates';
  update public.retail_settings set shop_supplies_pct = 0, shop_supplies_cap = null where company_id = public.current_company_id();
  update public.companies set tax_rate = 0 where id = public.current_company_id();
end $$;
select pg_temp.logout();

-- 0047: retail's own invoices, apart from the dealership side -----------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_job uuid := (select v from r_ids where k = 'job_det'); n int; l jsonb; d jsonb; first_no text;
declare r record;
begin
  -- (0052) the invoice number is minted at conversion: convert the repair orders these tests built
  for r in select j.id from public.jobs j join public.dealerships dd on dd.id = j.dealership_id
           where dd.retail and j.deleted_at is null and j.invoiced_at is null and exists (select 1 from public.job_services js where js.job_id = j.id) loop
    perform pg_temp.invoice_it(r.id);
  end loop;
  -- numbers: every converted retail job has RI-…, no dealership job has one, all distinct
  select count(*) into n from public.jobs j join public.dealerships dd on dd.id = j.dealership_id where dd.retail and j.invoiced_at is not null and j.retail_invoice_number is null;
  assert n = 0, '0047: every converted retail job has an invoice number: ' || n;
  select count(*) into n from public.jobs j join public.dealerships dd on dd.id = j.dealership_id where not dd.retail and j.retail_invoice_number is not null;
  assert n = 0, '0047: no dealership job has a retail invoice number';
  assert (select count(*) from public.jobs where retail_invoice_number is not null and retail_invoice_number !~ '^RI-[0-9]{6}$') = 0, '0047: RI format';
  assert (select count(*) - count(distinct retail_invoice_number) from public.jobs where retail_invoice_number is not null) = 0, '0047: numbers are unique';
  -- never on a dealership invoice
  assert (select count(*) from public.jobs j join public.dealerships dd on dd.id = j.dealership_id where dd.retail and j.invoice_id is not null) = 0, '0047: no retail job is on a monthly invoice';
  -- the lists are apart
  assert (select count(*) from jsonb_array_elements(public.jobs_filtered(p_status => 'all') -> 'rows') x where (x ->> 'retail')::boolean) = 0, '0047: the dealership Jobs list holds no retail car';
  assert (select count(*) from jsonb_array_elements(public.jobs_filtered(p_status => 'all', p_scope => 'retail') -> 'rows') x where not (x ->> 'retail')::boolean) = 0
     and (public.jobs_filtered(p_status => 'all', p_scope => 'retail') ->> 'count')::int > 0, '0047: the retail scope holds retail cars only';
  assert (public.jobs_filtered(p_status => 'all', p_scope => 'all') ->> 'count')::int = (public.jobs_filtered(p_status => 'all') ->> 'count')::int + (public.jobs_filtered(p_status => 'all', p_scope => 'retail') ->> 'count')::int, '0047: all = dealer + retail';
  -- the owner's list and page
  l := public.retail_invoices_filtered(null, 'all');
  assert (l ->> 'count')::int = (select count(*) from public.jobs where retail_invoice_number is not null) and (l -> 'rows' -> 0 ->> 'number') like 'RI-%', '0047: the list: ' || (l ->> 'count');
  assert (select count(*) from jsonb_array_elements(l -> 'rows') x where x ->> 'status' not in ('unpaid', 'partial', 'paid', 'void')) = 0, '0047: statuses';
  assert (select x ->> 'status' from jsonb_array_elements(l -> 'rows') x where (x ->> 'id')::uuid = v_job) in ('unpaid', 'partial'), '0047: the open repair order is an open invoice';
  assert exists (select 1 from jsonb_array_elements(public.retail_invoices_filtered(null, 'open') -> 'rows') x where (x ->> 'id')::uuid = v_job), '0047: open filter';
  assert not exists (select 1 from jsonb_array_elements(public.retail_invoices_filtered(null, 'paid') -> 'rows') x where (x ->> 'id')::uuid = v_job), '0047: paid filter excludes it';
  first_no := (select retail_invoice_number from public.jobs where id = v_job);
  assert jsonb_array_length(public.retail_invoices_filtered(first_no, 'all') -> 'rows') = 1, '0047: search by number';
  d := public.retail_invoice_detail(v_job);
  assert (d ->> 'invoice_number') = first_no and (d ->> 'ro_number') like 'RO-%' and jsonb_array_length(d -> 'lines') > 0 and (d -> 'company' ->> 'name') is not null, '0047: the page carries numbers, lines, the shop';
  -- a dealership job is not an invoice here
  begin
    perform public.retail_invoice_detail((select j.id from public.jobs j join public.dealerships dd on dd.id = j.dealership_id where not dd.retail limit 1));
    raise exception 'expected dealership job refused';
  exception when sqlstate 'P0002' then null; end;
  -- dashboards: dealership money and counts leave retail out; the retail block has its own money
  assert (public.dashboard_stats('2000-01-01', '2100-01-01') -> 'income' ->> 'jobs')::int
       = (select count(*) from public.jobs j join public.dealerships dd on dd.id = j.dealership_id where not dd.retail and j.deleted_at is null), '0047: dashboard_stats counts dealership cars only';
  d := public.retail_dashboard();
  assert (d -> 'money' ->> 'unpaid_invoices')::int >= 1 and (d -> 'money' ->> 'unpaid_total')::numeric > 0 and (d -> 'month' ->> 'cars') is not null, '0047: the retail dashboard block: ' || d::text;
end $$;
select pg_temp.logout();

-- the advisor opens retail invoices; manager and detailer do not (counts only on the dashboard)
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
begin
  assert (public.retail_invoices_filtered(null, 'all') ->> 'count')::int > 0 and (public.retail_dashboard() -> 'money') <> 'null'::jsonb, '0047: advisor sees retail invoices and money';
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare v_job uuid := (select v from r_ids where k = 'job_det');
begin
  begin perform public.retail_invoices_filtered(null, 'all'); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
  begin perform public.retail_invoice_detail(v_job); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
  assert public.retail_dashboard() -> 'money' = 'null'::jsonb and (public.retail_dashboard() -> 'month' ->> 'cars') is not null, '0047: a manager sees retail counts, no money';
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
begin
  begin perform public.retail_invoices_filtered(null, 'all'); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
  begin perform public.retail_dashboard(); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();

-- 0048: a retail customer starts with an estimate; approving it makes the invoice --
select pg_temp.login('10000000-0000-4000-8000-000000000001');
drop table if exists e48; create temp table e48 (k text primary key, v text);
grant all on e48 to authenticated, anon;
do $$
declare e public.estimates; s jsonb; v_ana uuid := (select v from r_ids where k = 'cust_ana'); v_mazda uuid := (select v from r_ids where k = 'veh_mazda');
begin
  -- the plain job log no longer takes the shop's location (the tests above set the escape hatch; clear it here)
  perform set_config('app.allow_retail_job', 'off', false);
  begin
    perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000103', 'tag_number', 'NOPE-1',
      'services', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')))));
    raise exception 'expected the retail location to be refused';
  exception when sqlstate 'P0001' then
    assert sqlerrm like 'Retail work starts from an estimate%', '0048: refusal text: ' || sqlerrm;
  end;
  -- dealership jobs are untouched
  perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'D48-1', 'color', 'Red', 'year', 2024, 'make', 'Mercedes-Benz', 'model', 'GLE 450',
    'services', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')))));
  e := public.create_estimate(jsonb_build_object('customer_id', v_ana, 'vehicle_id', v_mazda, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote', 'lines', jsonb_build_array(
         jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')),
         jsonb_build_object('service_id', (select v from r_ids where k = 'svc_other'), 'label', 'Buff the hood', 'price', 90))))));
  insert into e48 values ('est', e.id::text), ('total', e.total::text);
  assert e.job_id is null, '0048: a draft estimate has no job';
  s := public.send_estimate(e.id);
  insert into e48 values ('token', public.estimate_link(e.id));
  assert (select count(*) from public.jobs where tag_number = replace(e.display_number, 'EST-', 'E-')) = 0, '0048: nothing exists before approval';
end $$;
select pg_temp.logout();
select pg_temp.anon();
do $$
declare v_token text := (select v from e48 where k = 'token'); d jsonb; r jsonb; v_opt uuid;
begin
  d := public.estimate_by_token(v_token);
  v_opt := (d -> 'options' -> 0 ->> 'id')::uuid;
  r := public.estimate_respond(v_token, jsonb_build_object('option_id', v_opt, 'name', 'Ana Lopez', 'pay_choice', 'at_shop',
         'signature_path', '00000000-0000-4000-8000-000000000001/estimates/' || (d ->> 'id') || '/sig.png'));
  assert r ->> 'status' = 'accepted', '0048: approved';
  begin
    perform public.estimate_respond(v_token, jsonb_build_object('option_id', v_opt, 'name', 'again', 'signature_path', '00000000-0000-4000-8000-000000000001/estimates/' || (d ->> 'id') || '/sig.png'));
    raise exception 'expected already answered';
  exception when sqlstate 'P0001' then null; end;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_est uuid := (select v from e48 where k = 'est')::uuid; j public.jobs; ed jsonb; e public.estimates; n int; l jsonb; d jsonb; v_cust uuid;
begin
  ed := public.estimate_detail(v_est);
  assert (ed ->> 'job_id') is not null and (ed ->> 'applied_at') is not null, '0048: approval created the job and applied it';
  v_cust := (ed -> 'customer' ->> 'id')::uuid;
  select * into j from public.jobs where id = (ed ->> 'job_id')::uuid;
  assert j.ro_number like 'RO-%' and j.retail_invoice_number is null and j.invoiced_at is null and j.customer_id = v_cust and j.vehicle_id = (ed -> 'vehicle' ->> 'id')::uuid and j.invoice_id is null, '0048/0052: approval makes the RO (numbered, no invoice yet)';
  assert (ed ->> 'ro_number') = j.ro_number, '0052: the RO number was minted with the estimate (at send) and the job kept it';
  assert (select count(*) from public.job_services where job_id = j.id) = 2, '0048: both approved lines are on it';
  assert (ed -> 'job' ->> 'invoice_number') is null and (ed -> 'job' ->> 'invoiced_at') is null, '0052: the estimate shows no invoice yet';
  assert (select count(*) from public.job_services where job_id = j.id and estimate_line_id is not null and authorization_id is not null) = 2 and (select count(*) from public.job_services where job_id = j.id and authorization_id is null) = 0, '0052: lines tie to their estimate line and the authorization';
  assert (select count(*) from public.job_authorizations where job_id = j.id and kind = 'estimate' and estimate_id = v_est) = 1, '0052: the authorization is on the RO';
  assert (public.retail_charge(j.id) ->> 'subtotal')::numeric = (ed ->> 'subtotal')::numeric, '0048: at the quoted prices';
  assert (public.retail_charge(j.id) ->> 'total')::numeric = (ed ->> 'total')::numeric, '0048: the RO total is the estimate total';
  assert (select count(*) from public.jobs where customer_id = v_cust and tag_number = replace(ed ->> 'display_number', 'EST-', 'E-')) = 1, '0048: exactly one job';
  assert (public.convert_estimate_to_job(v_est)).id = j.id and (select count(*) from public.job_services where job_id = j.id) = 2, '0048: the fallback button changes nothing';
  assert not exists (select 1 from jsonb_array_elements(public.retail_invoices_filtered(null, 'all') -> 'rows') x where (x ->> 'id')::uuid = j.id), '0052: work in progress is not in Retail → Invoices';
  begin perform public.retail_invoice_detail(j.id); raise exception 'expected no invoice yet'; exception when sqlstate 'P0002' then null; end;
  -- converting issues the invoice number once
  perform pg_temp.finish_it(j.id);
  assert (public.convert_ro_to_invoice(j.id) ->> 'invoice_number') ~ '^RI-[0-9]{6}$', '0052: convert mints the RI number';
  select * into j from public.jobs where id = j.id;
  assert j.invoiced_at is not null and j.retail_invoice_number is not null, '0052: invoiced';
  begin perform public.convert_ro_to_invoice(j.id); raise exception 'expected already invoiced'; exception when sqlstate 'P0001' then null; end;
  l := public.retail_invoices_filtered(j.retail_invoice_number, 'all');
  assert jsonb_array_length(l -> 'rows') = 1 and (l -> 'rows' -> 0 ->> 'status') = 'unpaid' and (l -> 'rows' -> 0 ->> 'customer') is not null, '0048: it shows in Retail → Invoices as unpaid';
  d := public.retail_invoice_detail(j.id);
  assert jsonb_array_length(d -> 'lines') = 2 and (d ->> 'invoice_number') = j.retail_invoice_number, '0048: the invoice page';
  assert j.detailer_id = '10000000-0000-4000-8000-000000000001', '0048: the owner holds it until reassigned';
  -- a declined estimate creates nothing
  n := (select count(*) from public.jobs);
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'No', 'lines', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')))))));
  perform public.send_estimate(e.id);
  perform public.decline_estimate(e.id, 'too much');
  assert (select count(*) from public.jobs) = n, '0048: a declined estimate creates no job';
  -- staff recording the approval (in person) makes the invoice too
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Yes', 'lines', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')))))));
  perform public.send_estimate(e.id);
  e := public.mark_estimate_accepted(e.id, (select (o ->> 'id')::uuid from jsonb_array_elements(public.estimate_detail(e.id) -> 'options') o limit 1), '{}', 'Ana at the counter', 'in_person');
  assert (public.estimate_detail(e.id) ->> 'job_id') is not null and (public.estimate_detail(e.id) ->> 'ro_number') is not null, '0048: a counter approval makes the RO too';
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$ begin
  begin perform public.retail_invoices_filtered(null, 'all'); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();
select set_config('app.allow_retail_job', 'on', false);

-- 0049: mileage on the estimate ---------------------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare e public.estimates; ed jsonb; v_cust uuid := (select v from r_ids where k = 'cust_ana'); v_veh uuid := (select v from r_ids where k = 'veh_mazda'); n int; v_job uuid;
begin
  n := (select count(*) from public.odometer_readings where vehicle_id = v_veh);
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'vehicle_id', v_veh, 'odometer', '48,210', 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote',
         'lines', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')))))));
  ed := public.estimate_detail(e.id);
  assert (ed ->> 'odometer')::int = 48210, '0049: the estimate carries the mileage';
  assert (select reading from public.odometer_readings where vehicle_id = v_veh order by read_at desc limit 1) = 48210 and (select count(*) from public.odometer_readings where vehicle_id = v_veh) = n + 1, '0049: logged on the car';
  -- saving again with the same mileage does not log a second reading; a new mileage does
  perform public.update_estimate(e.id, jsonb_build_object('odometer', 48210));
  assert (select count(*) from public.odometer_readings where vehicle_id = v_veh) = n + 1, '0049: no duplicate reading';
  perform public.update_estimate(e.id, jsonb_build_object('odometer', 48300));
  assert (select reading from public.odometer_readings where vehicle_id = v_veh order by read_at desc limit 1) = 48300, '0049: a changed mileage is logged';
  -- approval attaches it to the job
  perform public.send_estimate(e.id);
  perform public.mark_estimate_accepted(e.id, (select (o ->> 'id')::uuid from jsonb_array_elements(public.estimate_detail(e.id) -> 'options') o limit 1), '{}', 'Ana', 'in_person');
  v_job := (public.estimate_detail(e.id) ->> 'job_id')::uuid;
  assert v_job is not null and (select reading from public.odometer_readings where job_id = v_job) = 48300, '0049: the job carries the mileage';
  perform pg_temp.invoice_it(v_job);
  assert (public.retail_invoice_detail(v_job) ->> 'odometer')::int = 48300, '0049: the invoice shows the mileage';
  -- the car lookup: plate with any spacing/case, or VIN; nothing for an unknown car
  declare v_plate text; v_vin text; f jsonb; begin
    perform public.save_vehicle(jsonb_build_object('id', v_veh, 'plate', '7ABC123', 'vin', 'JM1BK32F781234567'));
    select plate, vin into v_plate, v_vin from public.vehicles where id = v_veh;
    if v_plate is not null then
      f := public.find_vehicle(lower(substr(v_plate, 1, 2)) || ' - ' || substr(v_plate, 3), null);
      assert (f ->> 'vehicle_id')::uuid = v_veh and (f ->> 'customer') is not null and (f ->> 'last_odometer')::int = 48300, '0049: find by a loosely typed plate: ' || coalesce(f::text, 'null');
    end if;
    if v_vin is not null then
      assert (public.find_vehicle(null, lower(v_vin)) ->> 'vehicle_id')::uuid = v_veh, '0049: find by VIN';
    end if;
    assert public.find_vehicle('ZZZ 999', 'ZZZZZZZZZZZZZZZZZ') is null, '0049: an unknown car finds nothing';
    assert public.find_vehicle(null, null) is null and public.find_vehicle('', '') is null, '0049: empty finds nothing';
  end;
  assert (select count(*) from public.odometer_readings where vehicle_id = v_veh) = n + 2, '0049: the reading was attached, not duplicated';
end $$;
select pg_temp.logout();

-- 0050: findings on the estimate, carried onto the invoice, seen by the customer ---
select pg_temp.login('10000000-0000-4000-8000-000000000001');
drop table if exists e50; create temp table e50 (k text primary key, v text);
grant all on e50 to authenticated, anon;
do $$
declare e public.estimates; v_cust uuid := (select v from r_ids where k = 'cust_ana'); v_veh uuid := (select v from r_ids where k = 'veh_mazda');
begin
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'vehicle_id', v_veh, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote',
         'lines', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')))))));
  insert into e50 values ('est', e.id::text), ('token', public.estimate_link(e.id));
end $$;
select pg_temp.logout();
-- the tech (a detailer) inspects before anything is approved
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare v_est uuid := (select v from e50 where k = 'est')::uuid; f jsonb; n jsonb; m jsonb; v_company uuid := '00000000-0000-4000-8000-000000000001';
begin
  f := public.add_finding(jsonb_build_object('estimate_id', v_est, 'severity', 'urgent', 'title', 'Front pads at 2 mm', 'body', 'Metal on metal soon', 'recommended_service_id', (select v from r_ids where k = 'svc_oil')));
  assert (f ->> 'estimate_id')::uuid = v_est and (f ->> 'job_id') is null and (f ->> 'customer_visible')::boolean, '0050: a finding on an estimate';
  insert into e50 values ('finding', f ->> 'id');
  m := public.add_finding_media((f ->> 'id')::uuid, jsonb_build_object('path', v_company || '/estimates/' || v_est || '/a.jpg', 'mime', 'image/jpeg', 'size', 1000));
  perform public.add_finding_media((f ->> 'id')::uuid, jsonb_build_object('path', v_company || '/estimates/' || v_est || '/b.mp4', 'mime', 'video/mp4', 'size', 5000, 'duration', 12.5));
  begin
    perform public.add_finding_media((f ->> 'id')::uuid, jsonb_build_object('path', 'someone-else/x.jpg', 'mime', 'image/jpeg', 'size', 10));
    raise exception 'expected bad path';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.add_finding_media((f ->> 'id')::uuid, jsonb_build_object('path', v_company || '/x.exe', 'mime', 'application/x-msdownload', 'size', 10));
    raise exception 'expected bad type';
  exception when sqlstate '22023' then null; end;
  n := public.add_finding(jsonb_build_object('estimate_id', v_est, 'kind', 'note', 'title', 'Customer is a repeat, discount ok', 'customer_visible', false));
  assert (n ->> 'customer_visible')::boolean = false and (n ->> 'severity') = 'ok', '0050: an internal note';
  assert jsonb_array_length(public.estimate_findings(v_est)) = 2 and jsonb_array_length(public.estimate_findings(v_est) -> 0 -> 'media') = 2, '0050: the panel lists both, with media';
  -- the tech has no money and cannot send findings
  begin perform public.mark_findings_sent(v_est); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
  begin perform public.estimate_detail(v_est); exception when others then null; end;
end $$;
select pg_temp.logout();
-- the customer opens the link of a quote still being prepared: sees the visible finding, cannot answer
select pg_temp.anon();
do $$
declare v_token text := (select v from e50 where k = 'token'); d jsonb;
begin
  d := public.estimate_by_token(v_token);
  assert d ->> 'status' = 'draft' and jsonb_array_length(d -> 'findings') = 1 and (d -> 'findings' -> 0 ->> 'title') = 'Front pads at 2 mm', '0050: the draft link shows the visible finding only: ' || (d -> 'findings')::text;
  assert not exists (select 1 from jsonb_array_elements(d -> 'findings') x where x ->> 'title' like 'Customer is a repeat%'), '0050: the internal note stays internal';
  begin
    perform public.estimate_respond(v_token, jsonb_build_object('option_id', (d -> 'options' -> 0 ->> 'id')::uuid, 'name', 'Ana', 'signature_path', '00000000-0000-4000-8000-000000000001/estimates/' || (d ->> 'id') || '/s.png'));
    raise exception 'expected a draft to be unanswerable';
  exception when sqlstate 'P0001' then null; end;
end $$;
select pg_temp.logout();
-- the advisor sends the findings, then the estimate; the customer approves
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare v_est uuid := (select v from e50 where k = 'est')::uuid; r jsonb;
begin
  r := public.mark_findings_sent(v_est);
  assert (r ->> 'findings_sent_at') is not null and (public.estimate_detail(v_est) ->> 'findings_sent_at') is not null, '0050: findings sent is recorded';
  perform public.send_estimate(v_est);
end $$;
select pg_temp.logout();
select pg_temp.anon();
do $$
declare v_token text := (select v from e50 where k = 'token'); d jsonb;
begin
  d := public.estimate_by_token(v_token);
  perform public.estimate_respond(v_token, jsonb_build_object('option_id', (d -> 'options' -> 0 ->> 'id')::uuid, 'name', 'Ana Lopez', 'signature_path', '00000000-0000-4000-8000-000000000001/estimates/' || (d ->> 'id') || '/s.png'));
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_est uuid := (select v from e50 where k = 'est')::uuid; v_job uuid; d jsonb; v_link text;
begin
  v_job := (public.estimate_detail(v_est) ->> 'job_id')::uuid;
  assert v_job is not null, '0050: approved';
  assert (select count(*) from public.job_findings where estimate_id = v_est and job_id = v_job) = 2 and (select count(*) from public.job_photos where estimate_id = v_est and job_id = v_job) = 2, '0050: findings and media moved onto the job';
  assert jsonb_array_length(public.estimate_findings(v_est)) = 2 and jsonb_array_length(public.job_findings(v_job)) >= 2, '0050: estimate and job list the same rows';
  v_link := public.receipt_link(v_job);
  assert length(v_link) >= 20 and (public.receipt_by_token(v_link) ->> 'invoice_number') is null, '0052: the customer link works on work in progress, with no invoice number yet';
  perform pg_temp.invoice_it(v_job);
  d := public.retail_invoice_detail(v_job);
  assert jsonb_array_length(d -> 'findings') >= 2, '0050: the invoice carries the findings';
  -- the invoice link works while it is unpaid, and shows only what the customer may see
  v_link := public.receipt_link(v_job);
  assert length(v_link) >= 20, '0050: an invoice link for an unpaid invoice';
  insert into e50 values ('rtoken', v_link);
end $$;
select pg_temp.logout();
select pg_temp.anon();
do $$
declare d jsonb; v_token text := (select v from e50 where k = 'rtoken');
begin
  d := public.receipt_by_token(v_token);
  assert d ->> 'paid_at' is null and (d ->> 'balance')::numeric > 0 and (d ->> 'invoice_number') like 'RI-%', '0050: the customer opens the unpaid invoice';
  assert (select count(*) from jsonb_array_elements(d -> 'findings') x where x ->> 'title' like 'Front pads%') = 1 and not exists (select 1 from jsonb_array_elements(d -> 'findings') x where x ->> 'title' like 'Customer is a repeat%'), '0050: the invoice page shows the visible findings only';
end $$;
select pg_temp.logout();
-- after approval the tech who is not on the job can no longer write on the estimate
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
begin
  begin
    perform public.add_finding(jsonb_build_object('estimate_id', (select v from e50 where k = 'est')::uuid, 'title', 'late'));
    raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();

-- 0051: engine details on the car, Diagnosis / Repairs sections, blank drafts ---
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_cust uuid := (select v from r_ids where k = 'cust_ana'); v_veh uuid := (select v from r_ids where k = 'veh_mazda'); e public.estimates; ed jsonb; v public.vehicles; f jsonb; v_job uuid; r jsonb;
begin
  v := public.save_vehicle(jsonb_build_object('id', v_veh, 'trim', 'Touring', 'engine_size', '2.5L', 'engine_code', 'py-vps'));
  assert v.engine_size = '2.5L' and v.engine_code = 'PY-VPS' and v.trim = 'Touring', '0051: engine size and code saved (code upper-cased)';
  f := public.find_vehicle(null, (select vin from public.vehicles where id = v_veh));
  assert f ->> 'engine_size' = '2.5L' and f ->> 'engine_code' = 'PY-VPS' and f ->> 'trim' = 'Touring', '0051: the lookup carries them';
  -- a blank draft: the tech can start documenting before anything is itemized; it cannot be sent
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'vehicle_id', v_veh, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote', 'lines', '[]'::jsonb))));
  assert e.status = 'draft' and e.total = 0, '0051: a blank draft';
  begin perform public.send_estimate(e.id); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  -- itemized: a diagnosis and the repairs
  e := public.update_estimate(e.id, jsonb_build_object('options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote', 'lines', jsonb_build_array(
         jsonb_build_object('line_type', 'labor', 'label', 'Diagnose the noise', 'hours', 1, 'section', 'diagnosis'),
         jsonb_build_object('line_type', 'labor', 'label', 'Replace front pads', 'hours', 1.5),
         jsonb_build_object('line_type', 'part', 'label', 'Brake pads', 'price', 60, 'section', 'repair'))))));
  ed := public.estimate_detail(e.id);
  assert (select count(*) from jsonb_array_elements(ed -> 'options' -> 0 -> 'lines') l where l ->> 'section' = 'diagnosis') = 1
     and (select count(*) from jsonb_array_elements(ed -> 'options' -> 0 -> 'lines') l where l ->> 'section' = 'repair') = 2, '0051: lines carry their section';
  assert ed -> 'vehicle' ->> 'engine_size' = '2.5L' and ed -> 'vehicle' ->> 'trim' = 'Touring' and ed -> 'vehicle' ->> 'vin' is not null and ed -> 'vehicle' ->> 'year' is not null, '0051: the estimate carries the car in full';
  insert into e50 values ('e51', e.id::text) on conflict (k) do update set v = excluded.v;
  -- a draft that never went anywhere can be removed; a sent one cannot
  perform public.send_estimate(e.id);
  begin perform public.delete_draft_estimate(e.id); raise exception 'expected refused'; exception when sqlstate 'P0001' then null; end;
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote', 'lines', '[]'::jsonb))));
  r := public.delete_draft_estimate(e.id);
  assert (r ->> 'id')::uuid = e.id, '0051: removed';
  begin perform public.estimate_detail(e.id); raise exception 'still there'; exception when sqlstate 'P0002' then null; end;
end $$;
select pg_temp.logout();
-- the customer approves: the diagnosis line reads "Diagnosis · ..." on the invoice
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_est uuid := (select v from e50 where k = 'e51')::uuid; e public.estimates; v_job uuid; d jsonb;
begin
  perform public.mark_estimate_accepted(v_est, (select (o ->> 'id')::uuid from jsonb_array_elements(public.estimate_detail(v_est) -> 'options') o limit 1), '{}', 'Ana', 'in_person');
  v_job := (public.estimate_detail(v_est) ->> 'job_id')::uuid;
  perform pg_temp.invoice_it(v_job);
  d := public.retail_invoice_detail(v_job);
  assert exists (select 1 from jsonb_array_elements(d -> 'lines') l where l ->> 'name' like 'Diagnosis · Diagnose the noise%'), '0051: the diagnosis line on the invoice: ' || (d -> 'lines')::text;
  assert exists (select 1 from jsonb_array_elements(d -> 'lines') l where l ->> 'name' like 'Replace front pads%'), '0051: the repair line';
end $$;
select pg_temp.logout();

-- 0052: one repair order through its stages -----------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare
  v_cust uuid := (select v from r_ids where k = 'cust_ana'); v_veh uuid := (select v from r_ids where k = 'veh_mazda');
  e public.estimates; ed jsonb; s public.estimates; j public.jobs; v_job uuid; r jsonb;
begin
  -- the concern in the customer's words; the RO number only once the estimate is sent
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'vehicle_id', v_veh, 'customer_concern', 'Squeal when I brake, worse in the morning',
         'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote', 'lines', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')))))));
  ed := public.estimate_detail(e.id);
  assert (ed ->> 'customer_concern') = 'Squeal when I brake, worse in the morning' and (ed ->> 'ro_number') is null, '0052: the concern is saved; no RO number on a draft';
  perform public.update_estimate(e.id, jsonb_build_object('customer_concern', 'Squeal when I brake'));
  assert (public.estimate_detail(e.id) ->> 'customer_concern') = 'Squeal when I brake', '0052: the concern is editable';
  perform public.send_estimate(e.id);
  ed := public.estimate_detail(e.id);
  assert (ed ->> 'ro_number') like 'RO-%', '0052: the RO number is minted when it is sent';
  perform public.send_estimate(e.id);
  assert (public.estimate_detail(e.id) ->> 'ro_number') = (ed ->> 'ro_number'), '0052: sending again keeps it';
  assert (public.estimate_detail(e.id) -> 'customer' ->> 'id') is not null and (ed -> 'advisor') is not null, '0052: the advisor rides on the estimate';
  -- approval (in person) makes the RO under that number, carrying the concern and the advisor
  perform public.mark_estimate_accepted(e.id, (select (o ->> 'id')::uuid from jsonb_array_elements(ed -> 'options') o limit 1), '{}', 'Ana at the counter', 'in_person');
  v_job := (public.estimate_detail(e.id) ->> 'job_id')::uuid;
  select * into j from public.jobs where id = v_job;
  assert j.ro_number = ed ->> 'ro_number' and j.customer_concern = 'Squeal when I brake' and j.advisor_id = '10000000-0000-4000-8000-000000000001' and j.invoiced_at is null, '0052: the RO keeps the number, the concern and the advisor';
  -- a supplement carries the RO it was written for
  s := public.create_estimate(jsonb_build_object('job_id', v_job, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'More', 'lines', jsonb_build_array(
         jsonb_build_object('line_type', 'labor', 'label', 'Machine the rotors', 'hours', 1))))));
  assert (public.estimate_detail(s.id) ->> 'ro_number') = j.ro_number, '0052: a supplement carries the RO number';
  perform public.mark_estimate_accepted(s.id, (select id from public.estimate_options where estimate_id = s.id), '{}', 'Ana by phone', 'phone');
  assert (select count(*) from public.job_authorizations where job_id = v_job) = 2 and (select count(*) from public.job_authorizations where job_id = v_job and kind = 'change_order' and method = 'phone') = 1, '0052: the change order is its own authorization';
  assert (select count(*) from public.job_services where job_id = v_job and authorization_id is null) = 0, '0052: every line is authorized';
  r := public.ro_authorizations(v_job);
  assert jsonb_array_length(r) = 2 and (r -> 0 ->> 'amount') is not null, '0052: the owner reads the authorizations with amounts';
end $$;
select pg_temp.logout();

-- an unauthorized line blocks the invoice; payments wait for the invoice; the plain editor cannot touch retail lines
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare j public.jobs;
begin
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000103', 'tag_number', 'R-520', 'vehicle_id', (select v from r_ids where k = 'veh_mazda'),
        'services', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')))));
  insert into r_ids values ('job_unauth', j.id);
  begin perform public.convert_ro_to_invoice(j.id); raise exception 'expected refused'; exception when sqlstate 'P0001' then null; end;
  perform set_config('app.allow_retail_job', 'off', false);
  begin perform public.record_retail_payment(j.id, 10, 'cash'); raise exception 'expected refused'; exception when sqlstate 'P0001' then
    assert sqlerrm like 'Convert the repair order%', '0052: no payment before the invoice: ' || sqlerrm;
  end;
  begin perform public.update_job(j.id, jsonb_build_object('services', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full'))))); raise exception 'expected refused';
  exception when sqlstate 'P0001' then
    assert sqlerrm like 'Retail work changes through an estimate', '0052: retail lines change through an estimate: ' || sqlerrm;
  end;
  perform set_config('app.allow_retail_job', 'on', false);
end $$;
select pg_temp.logout();

-- check-in: mileage in, the concern, the initial authorization (signature), the RO opens
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare
  a jsonb; v_clay uuid; v_mon date := (select mon from r_days); v_ana uuid := (select v from r_ids where k = 'cust_ana'); v_veh uuid := (select v from r_ids where k = 'veh_mazda'); j public.jobs; v_id uuid;
begin
  select id into v_clay from public.services where name = 'Clay bar';
  a := public.book_appointment(jsonb_build_object('customer_id', v_ana, 'vehicle_id', v_veh, 'lines', jsonb_build_array(jsonb_build_object('service_id', v_clay)), 'starts_at', (v_mon + time '15:00') at time zone 'America/Los_Angeles'));
  v_id := (a ->> 'id')::uuid;
  insert into r_ids values ('appt_checkin', v_id);
  begin perform public.check_in_appointment(v_id, jsonb_build_object('name', 'Ana Lopez', 'odometer', 52100)); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  begin perform public.check_in_appointment(v_id, jsonb_build_object('name', 'Ana Lopez', 'signature_path', 'elsewhere/x.png')); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  begin perform public.check_in_appointment(v_id, jsonb_build_object('name', '', 'signature_path', '00000000-0000-4000-8000-000000000001/checkins/' || v_id || '/s.png')); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  a := public.check_in_appointment(v_id, jsonb_build_object('name', 'Ana Lopez', 'odometer', '52,100', 'concern', 'Wants it back by 5', 'amount_limit', 120,
         'signature_path', '00000000-0000-4000-8000-000000000001/checkins/' || v_id || '/s.png'));
  assert (a ->> 'status') = 'in_progress' and (a ->> 'job_id') is not null, '0052: checked in, the RO is open';
  select * into j from public.jobs where id = (a ->> 'job_id')::uuid;
  assert j.customer_concern = 'Wants it back by 5' and j.advisor_id = '10000000-0000-4000-8000-000000000006', '0052: the concern and the advisor are on the RO';
  assert (select reading from public.odometer_readings where job_id = j.id) = 52100, '0052: mileage in is on the RO';
  assert (select count(*) from jsonb_array_elements(public.ro_authorizations(j.id)) x where x ->> 'kind' = 'initial' and x ->> 'name' = 'Ana Lopez' and (x ->> 'amount')::numeric = 120 and (x ->> 'has_signature')::boolean) = 1, '0052: the initial authorization is recorded';
  assert (select count(*) from public.job_services where job_id = j.id and authorization_id is null) = 0, '0052: the booked services are authorized by it';
  perform pg_temp.finish_it(j.id);
  perform public.convert_ro_to_invoice(j.id);
  assert (select retail_invoice_number from public.jobs where id = j.id) like 'RI-%', '0052: an advisor converts an authorized RO';
  begin perform public.check_in_appointment(v_id, jsonb_build_object('name', 'Ana Lopez', 'signature_path', '00000000-0000-4000-8000-000000000001/checkins/' || v_id || '/s.png')); raise exception 'expected refused'; exception when sqlstate 'P0001' then null; end;
end $$;
select pg_temp.logout();

-- a detailer does not check cars in; the manager does and never sees amounts
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
begin
  begin perform public.check_in_appointment((select v from r_ids where k = 'appt_checkin'), jsonb_build_object('name', 'x')); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare r jsonb; v_job uuid := (select job_id from public.appointments where id = (select v from r_ids where k = 'appt_checkin'));
begin
  r := public.ro_authorizations(v_job);
  assert jsonb_array_length(r) = 1 and (r -> 0 ->> 'amount') is null and (r -> 0 ->> 'name') = 'Ana Lopez', '0052: the manager sees the authorization, not the amount';
  begin perform public.convert_ro_to_invoice(v_job); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();
-- the dashboard counts invoices, not work in progress
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare d jsonb;
begin
  d := public.retail_dashboard();
  assert (d -> 'money' ->> 'unpaid_invoices')::int = (select count(*) from public.jobs j join public.dealerships dd on dd.id = j.dealership_id where dd.retail and j.deleted_at is null and j.invoiced_at is not null and j.paid_at is null), '0052: unpaid invoices count converted ROs only: ' || d::text;
end $$;
select pg_temp.logout();

-- 0053: what the tech writes on the side, priced in place -----------------------
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare v_cust uuid := (select v from r_ids where k = 'cust_ana'); v_veh uuid := (select v from r_ids where k = 'veh_mazda'); f jsonb; e public.estimates;
begin
  -- the owner opens an estimate; the tech (a detailer) documents on it
  perform pg_temp.logout();
  perform pg_temp.login('10000000-0000-4000-8000-000000000001');
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'vehicle_id', v_veh, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote', 'lines', '[]'::jsonb))));
  insert into e50 values ('e53', e.id::text);
  perform pg_temp.logout();
  perform pg_temp.login('10000000-0000-4000-8000-000000000002');
  f := public.add_finding(jsonb_build_object('estimate_id', e.id, 'title', 'Front brake pads', 'body', 'Pads at 2mm, rotors scored.', 'severity', 'urgent', 'recommendation', 'replace'));
  assert (f ->> 'recommendation') = 'replace', '0053: the recommendation is saved';
  insert into e50 values ('f53', f ->> 'id');
  begin perform public.add_finding(jsonb_build_object('estimate_id', e.id, 'title', 'x', 'recommendation', 'junk')); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  f := public.add_finding(jsonb_build_object('estimate_id', e.id, 'kind', 'note', 'title', 'A note', 'recommendation', 'replace'));
  assert (f ->> 'recommendation') is null, '0053: a note carries no recommendation';
  insert into e50 values ('n53', f ->> 'id');
  f := public.update_finding((select v from e50 where k = 'f53')::uuid, jsonb_build_object('recommendation', 'diagnose'));
  assert (f ->> 'recommendation') = 'diagnose', '0053: the recommendation is editable';
  f := public.update_finding((select v from e50 where k = 'f53')::uuid, jsonb_build_object('recommendation', 'replace'));
  -- a detailer cannot price
  begin perform public.add_finding_lines((select v from e50 where k = 'f53')::uuid, jsonb_build_array(jsonb_build_object('line_type', 'labor', 'label', 'x', 'hours', 1))); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();

select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_f uuid := (select v from e50 where k = 'f53')::uuid; v_e uuid := (select v from e50 where k = 'e53')::uuid; r jsonb; d jsonb; v_rate numeric;
begin
  update public.companies set tax_rate = 0.0875 where id = public.current_company_id();
  update public.retail_settings set shop_supplies_pct = 0, shop_supplies_cap = null, tax_all_lines = false, parts_taxable_default = true, labor_taxable_default = false where company_id = public.current_company_id();
  begin perform public.add_finding_lines((select v from e50 where k = 'n53')::uuid, jsonb_build_array(jsonb_build_object('line_type', 'labor', 'label', 'x', 'hours', 1))); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  begin perform public.add_finding_lines(v_f, jsonb_build_array(jsonb_build_object('line_type', 'service', 'label', 'x'))); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  begin perform public.add_finding_lines(v_f, '[]'::jsonb); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  r := public.add_finding_lines(v_f, jsonb_build_array(
         jsonb_build_object('line_type', 'labor', 'label', 'Replace front pads and rotors', 'hours', 1.5, 'rate', 100),
         jsonb_build_object('line_type', 'part', 'label', 'Front rotor', 'qty', 2, 'price', 40, 'part_number', 'FR-22'),
         jsonb_build_object('line_type', 'fee', 'label', 'Brake fluid disposal', 'price', 12)));
  assert (r ->> 'estimate_id')::uuid = v_e and (r ->> 'subtotal')::numeric = 242, '0053: lines land on the finding''s own estimate: ' || r::text;
  assert (r ->> 'tax')::numeric = 7 and (r ->> 'total')::numeric = 249, '0053: "plus tax": tax on the part only (80 × 8.75 % = 7), total 249: ' || r::text;
  d := public.estimate_detail(v_e);
  assert jsonb_array_length(d -> 'options' -> 0 -> 'lines') = 3 and (d ->> 'total')::numeric = 249, '0053: the estimate carries the three lines';
  assert (select status from public.job_findings where id = v_f) = 'quoted' and (select estimate_line_id from public.job_findings where id = v_f) is not null, '0053: the finding is quoted';
  assert (select count(*) from public.estimate_lines where estimate_id = v_e and finding_id = v_f) = 3, '0053: every line points back to the finding';
  -- an estimate that was already out goes back to draft when it grows
  perform public.send_estimate(v_e);
  r := public.add_finding_lines(v_f, jsonb_build_array(jsonb_build_object('line_type', 'sublet', 'label', 'Machine shop', 'price', 30, 'vendor', 'Sac Machine')));
  assert (select status from public.estimates where id = v_e) = 'draft' and (r ->> 'subtotal')::numeric = 272, '0053: a sent estimate returns to draft when a line is added: ' || r::text;
end $$;
-- a finding on a repair order lands on one open supplement draft
do $$
declare v_job uuid := (select v from r_ids where k = 'job_unauth'); f jsonb; f2 jsonb; r jsonb; r2 jsonb;
begin
  f := public.add_finding(jsonb_build_object('job_id', v_job, 'title', 'Serpentine belt', 'severity', 'soon', 'recommendation', 'replace'));
  f2 := public.add_finding(jsonb_build_object('job_id', v_job, 'title', 'Cabin air filter', 'severity', 'ok', 'recommendation', 'monitor'));
  r := public.add_finding_lines((f ->> 'id')::uuid, jsonb_build_array(jsonb_build_object('line_type', 'labor', 'label', 'Replace serpentine belt', 'hours', 0.5, 'rate', 100), jsonb_build_object('line_type', 'part', 'label', 'Belt', 'price', 45)));
  assert (select kind from public.estimates where id = (r ->> 'estimate_id')::uuid) = 'supplement' and (r ->> 'job_id')::uuid = v_job, '0053: an RO finding opens a supplement draft';
  r2 := public.add_finding_lines((f2 ->> 'id')::uuid, jsonb_build_array(jsonb_build_object('line_type', 'part', 'label', 'Cabin filter', 'price', 20)));
  assert (r2 ->> 'estimate_id') = (r ->> 'estimate_id') and (select count(*) from public.estimates where job_id = v_job and kind = 'supplement' and status = 'draft') = 1, '0053: the next finding joins the same draft: one estimate';
  assert (r2 ->> 'total')::numeric = 50 + 45 + 20 + round(65 * 0.0875, 2), '0053: totals add up with tax on the parts: ' || r2::text;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
begin
  begin perform public.add_finding_lines((select v from e50 where k = 'f53')::uuid, jsonb_build_array(jsonb_build_object('line_type', 'labor', 'label', 'x', 'hours', 1))); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$ begin update public.companies set tax_rate = 0 where id = public.current_company_id(); end $$;
select pg_temp.logout();

-- 0054: named jobs ---------------------------------------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare
  v_cust uuid := (select v from r_ids where k = 'cust_ana'); v_veh uuid := (select v from r_ids where k = 'veh_mazda'); e public.estimates; d jsonb; o jsonb;
begin
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'vehicle_id', v_veh, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote',
    'jobs', jsonb_build_array(
      jsonb_build_object('key', 'oil', 'title', 'Oil change', 'priority', 'optional'),
      jsonb_build_object('key', 'brakes', 'title', 'Front brake service', 'priority', 'safety')),
    'lines', jsonb_build_array(
      jsonb_build_object('line_type', 'labor', 'label', 'Diagnose the noise', 'hours', 1, 'rate', 100, 'section', 'diagnosis'),
      jsonb_build_object('line_type', 'labor', 'label', 'Oil and filter', 'hours', 0.3, 'rate', 100, 'job', 'oil'),
      jsonb_build_object('line_type', 'part', 'label', 'Synthetic oil', 'qty', 5, 'price', 8, 'job', 'oil'),
      jsonb_build_object('line_type', 'labor', 'label', 'Pads and rotors', 'hours', 1.5, 'rate', 100, 'job', 'brakes'),
      jsonb_build_object('line_type', 'part', 'label', 'Pad set', 'price', 89.99, 'job', 'brakes'))))));
  insert into e50 values ('e54', e.id::text);
  d := public.estimate_detail(e.id);
  o := d -> 'options' -> 0;
  assert jsonb_array_length(o -> 'jobs') = 3, '0054: three jobs: ' || (o -> 'jobs')::text;
  assert (o -> 'jobs' -> 0 ->> 'kind') = 'diagnosis' and (o -> 'jobs' -> 1 ->> 'title') = 'Front brake service' and (o -> 'jobs' -> 1 ->> 'priority') = 'safety' and (o -> 'jobs' -> 2 ->> 'title') = 'Oil change', '0054: Diagnosis first, then safety, then optional';
  assert (select count(*) from jsonb_array_elements(o -> 'lines') l where l ->> 'estimate_job_id' is not null) = 5, '0054: every line has its job';
  assert (select count(distinct l ->> 'estimate_job_id') from jsonb_array_elements(o -> 'lines') l) = 3, '0054: lines group into three jobs';
  -- an older caller with no jobs: a default Repairs job
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote', 'lines', jsonb_build_array(jsonb_build_object('line_type', 'fee', 'label', 'Fee', 'price', 5))))));
  d := public.estimate_detail(e.id);
  assert jsonb_array_length(d -> 'options' -> 0 -> 'jobs') = 1 and (d -> 'options' -> 0 -> 'jobs' -> 0 ->> 'title') = 'Repairs', '0054: lines with no job land in Repairs';
  -- the findings priced from the side panel made a job per finding
  assert exists (select 1 from public.estimate_jobs j where j.estimate_id = (select v from e50 where k = 'e53')::uuid and j.title = 'Front brake pads' and j.priority = 'safety'), '0054: a priced finding is a job with its severity as priority';
  insert into e50 values ('e54tok', public.estimate_link((select v from e50 where k = 'e54')::uuid));
  perform public.send_estimate((select v from e50 where k = 'e54')::uuid);
end $$;
select pg_temp.logout();
select pg_temp.anon();
do $$
declare v_token text := (select v from e50 where k = 'e54tok'); d jsonb; v_ids jsonb;
begin
  d := public.estimate_by_token(v_token);
  -- approve the diagnosis and the brakes; decline the oil change
  select jsonb_agg(l ->> 'id') into v_ids from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l
   where l ->> 'estimate_job_id' in (select j ->> 'id' from jsonb_array_elements(d -> 'options' -> 0 -> 'jobs') j where j ->> 'title' in ('Diagnosis', 'Front brake service'));
  perform public.estimate_respond(v_token, jsonb_build_object('option_id', d -> 'options' -> 0 ->> 'id', 'approved_line_ids', v_ids, 'name', 'Ana Lopez',
          'signature_path', '00000000-0000-4000-8000-000000000001/estimates/' || (d ->> 'id') || '/s.png'));
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_est uuid := (select v from e50 where k = 'e54')::uuid; d jsonb; v_job uuid;
begin
  d := public.estimate_detail(v_est);
  assert (select status from public.estimate_jobs where estimate_id = v_est and title = 'Diagnosis') = 'approved'
     and (select status from public.estimate_jobs where estimate_id = v_est and title = 'Front brake service') = 'approved'
     and (select status from public.estimate_jobs where estimate_id = v_est and title = 'Oil change') = 'declined', '0054: approved, approved, declined';
  assert (select count(*) from jsonb_array_elements(d -> 'options' -> 0 -> 'jobs') j where j ->> 'status' = 'declined') = 1 and (select count(*) from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'name' = 'Synthetic oil') = 1, '0054: the declined job stays on the record with its lines';
  v_job := (d ->> 'job_id')::uuid;
  assert (select count(*) from public.job_services where job_id = v_job and estimate_job_id is not null) >= 3, '0054: the approved lines carry their job onto the RO';
  assert not exists (select 1 from public.job_services js join public.estimate_jobs j on j.id = js.estimate_job_id where js.job_id = v_job and j.title = 'Oil change'), '0054: the declined job is not on the RO';
end $$;
select pg_temp.logout();

-- 0055: finish, check, invoice, follow up ------------------------------------------
select set_config('app.allow_retail_job', 'off', false);
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare
  v_cust uuid := (select v from r_ids where k = 'cust_ana'); v_veh uuid := (select v from r_ids where k = 'veh_mazda'); e public.estimates; d jsonb; v_job uuid; v_ids jsonb; v_jobs jsonb;
begin
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'vehicle_id', v_veh, 'odometer', 52000, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote',
    'jobs', jsonb_build_array(jsonb_build_object('key', 'brakes', 'title', 'Front brake service', 'priority', 'safety'), jsonb_build_object('key', 'oil', 'title', 'Oil change', 'priority', 'optional')),
    'lines', jsonb_build_array(
      jsonb_build_object('line_type', 'labor', 'label', 'Diagnose the noise', 'hours', 1, 'rate', 100, 'section', 'diagnosis'),
      jsonb_build_object('line_type', 'labor', 'label', 'Pads and rotors', 'hours', 1.5, 'rate', 100, 'job', 'brakes'),
      jsonb_build_object('line_type', 'part', 'label', 'Pad set', 'price', 90, 'job', 'brakes'),
      jsonb_build_object('line_type', 'labor', 'label', 'Oil and filter', 'hours', 0.5, 'rate', 100, 'job', 'oil'))))));
  insert into e50 values ('e55', e.id::text);
  perform public.send_estimate(e.id);
  d := public.estimate_detail(e.id);
  -- the customer approves the diagnosis and the brakes, declines the oil change
  select jsonb_agg((l ->> 'id')::uuid) into v_ids from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'name' <> 'Oil and filter';
  perform public.mark_estimate_accepted(e.id, (d -> 'options' -> 0 ->> 'id')::uuid, (select array_agg(x::uuid) from jsonb_array_elements_text(v_ids) x), 'Ana at the counter', 'in_person');
  v_job := (public.estimate_detail(e.id) ->> 'job_id')::uuid;
  insert into r_ids values ('job55', v_job);
  assert (select count(*) from public.job_services where job_id = v_job) = 3, '0055: three approved lines on the RO';
  -- nothing is invoiced before the work is done and checked
  begin perform public.convert_ro_to_invoice(v_job); raise exception 'expected refused'; exception when sqlstate 'P0001' then assert sqlerrm like 'Finish the work first%', '0055: ' || sqlerrm; end;
  select jsonb_agg(jsonb_build_object('id', ej.id, 'cause', 'Pads worn to 2mm', 'correction', 'Replaced pads and rotors')) into v_jobs from public.estimate_jobs ej where ej.id in (select estimate_job_id from public.job_services where job_id = v_job);
  begin perform public.complete_ro_work(v_job, jsonb_build_object('jobs', v_jobs)); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  begin perform public.complete_ro_work(v_job, jsonb_build_object('odometer_out', 51000, 'jobs', v_jobs)); raise exception 'expected refused'; exception when sqlstate '22023' then assert sqlerrm like 'Mileage out%', '0055: ' || sqlerrm; end;
  begin perform public.complete_ro_work(v_job, jsonb_build_object('odometer_out', 52010, 'jobs', '[]'::jsonb)); raise exception 'expected refused'; exception when sqlstate '22023' then assert sqlerrm like 'Say what caused it%', '0055: ' || sqlerrm; end;
  begin perform public.complete_ro_work(v_job, jsonb_build_object('odometer_out', 52010, 'parts_disposition', 'sold', 'jobs', v_jobs)); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
end $$;
select pg_temp.logout();
-- a detailer who is not on the job cannot finish it
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
begin
  begin perform public.complete_ro_work((select v from r_ids where k = 'job55'), jsonb_build_object('odometer_out', 52010)); raise exception 'expected refused'; exception when sqlstate 'P0002' then null; end;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_job uuid := (select v from r_ids where k = 'job55'); v_jobs jsonb; r jsonb;
begin
  select jsonb_agg(jsonb_build_object('id', ej.id, 'cause', 'Pads worn to 2mm', 'correction', 'Replaced pads and rotors')) into v_jobs from public.estimate_jobs ej where ej.id in (select estimate_job_id from public.job_services where job_id = v_job);
  r := public.complete_ro_work(v_job, jsonb_build_object('odometer_out', 52010, 'parts_disposition', 'returned', 'jobs', v_jobs));
  assert (r ->> 'odometer_out')::int = 52010, '0055: completed with the mileage out';
  assert (select count(*) from public.estimate_jobs where id in (select estimate_job_id from public.job_services where job_id = v_job) and status = 'done' and cause is not null and correction is not null) = 2, '0055: cause and correction saved, the jobs are done';
  assert (select parts_disposition from public.jobs where id = v_job) = 'returned' and (select odometer_out from public.jobs where id = v_job) = 52010, '0055: mileage out and the replaced-parts choice are on the RO';
  assert (select reading from public.odometer_readings where job_id = v_job limit 1) = 52000, '0055: mileage in is still the check-in reading';
  -- the quality check is a second person's: the owner holds this RO, so the advisor signs it
  begin perform public.convert_ro_to_invoice(v_job); raise exception 'expected refused'; exception when sqlstate 'P0001' then assert sqlerrm like 'The quality check%', '0055: ' || sqlerrm; end;
  begin perform public.quality_check_ro(v_job, 'ok'); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
  r := public.ro_invoice_review(v_job);
  assert (r ->> 'completed')::boolean and not (r ->> 'qc')::boolean and not (r ->> 'ready')::boolean and (r ->> 'matches')::boolean, '0055: the review says not ready yet: ' || r::text;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare v_job uuid := (select v from r_ids where k = 'job55'); r jsonb; d jsonb;
begin
  perform public.quality_check_ro(v_job, 'Road tested');
  assert pg_temp.has_event(v_job, 'ro.ready'), '0055: the quality check emits ro.ready';
  r := public.ro_invoice_review(v_job);
  assert (r ->> 'ready')::boolean and (r ->> 'approved_total')::numeric = (r ->> 'linked_total')::numeric and (r ->> 'jobs_not_done')::int = 0, '0055: the review is ready and matches the approved amounts: ' || r::text;
  perform public.convert_ro_to_invoice(v_job);
  d := public.job_receipt(v_job);
  assert jsonb_array_length(d -> 'jobs') = 2 and (d -> 'jobs' -> 0 ->> 'kind') = 'diagnosis' and (d -> 'jobs' -> 1 ->> 'title') = 'Front brake service' and (d -> 'jobs' -> 1 ->> 'cause') = 'Pads worn to 2mm', '0055: the invoice carries the jobs with cause and correction: ' || (d -> 'jobs')::text;
  assert (d -> 'jobs' -> 1 ->> 'total')::numeric = 240 and jsonb_array_length(d -> 'jobs' -> 1 -> 'lines') = 2, '0055: a job total and its lines';
  assert (d -> 'categories' ->> 'labor')::numeric = 250 and (d -> 'categories' ->> 'parts')::numeric = 90, '0055: category totals: ' || (d -> 'categories')::text;
  assert (d ->> 'odometer_out')::int = 52010 and (d ->> 'odometer')::int = 52000 and (d ->> 'parts_disposition') = 'returned', '0055: mileage in and out, parts choice';
  assert jsonb_array_length(d -> 'declined') = 1 and (d -> 'declined' -> 0 ->> 'title') = 'Oil change' and (d -> 'declined' -> 0 ->> 'total')::numeric = 50, '0055: the declined job with its price: ' || (d -> 'declined')::text;
  assert jsonb_array_length(d -> 'authorizations') >= 1 and (d -> 'authorizations' -> 0 ->> 'method') = 'in_person', '0055: the authorization log';
  assert (d ->> 'advisor') is not null and jsonb_typeof(d -> 'taxable_types') = 'array', '0055: advisor initials and taxable types';
end $$;
select pg_temp.logout();
-- paying in full closes the RO and, with declined work, starts the follow-up
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_job uuid := (select v from r_ids where k = 'job55'); d jsonb;
begin
  d := public.retail_charge(v_job);
  perform public.record_retail_payment(v_job, (d ->> 'balance')::numeric, 'cash');
  -- 0056: paying does not close the RO any more; "Close job · Picked up" does, after the customer signs
  assert (select paid_at from public.jobs where id = v_job) is not null and (select closed_at from public.jobs where id = v_job) is null and (select picked_up_at from public.jobs where id = v_job) is null, '0056: paid but not closed yet';
  begin perform public.close_ro(v_job); raise exception 'expected refused'; exception when sqlstate 'P0001' then assert sqlerrm like 'The customer signs first%', '0056: ' || sqlerrm; end;
  perform public.sign_receipt(v_job, '00000000-0000-4000-8000-000000000001/receipts/' || v_job::text || '/p.png', 'Ana Lopez');
  perform public.close_ro(v_job);
  assert (select closed_at from public.jobs where id = v_job) is not null and (select picked_up_at from public.jobs where id = v_job) is not null, '0056: Close job · Picked up closes the RO';
  assert pg_temp.has_event(v_job, 'ro.closed'), '0055: ro.closed is emitted when work was declined';
  begin perform public.close_ro(v_job); raise exception 'expected refused'; exception when sqlstate 'P0001' then assert sqlerrm like '%already closed%', '0056: ' || sqlerrm; end;
  assert pg_temp.declined_list(v_job) like 'Oil change%', '0055: the follow-up knows what was declined: ' || coalesce(pg_temp.declined_list(v_job), 'null');
  assert (select count(*) from public.automation_rules where company_id = public.current_company_id() and key in ('ro_ready', 'declined_followup') and delay_minutes in (0, 20160)) = 2, '0055: the two rules are shipped';
end $$;
select pg_temp.logout();
select set_config('app.allow_retail_job', 'on', false);

-- 0056: how it was paid, split payments, pay before signing --------------------------
select set_config('app.allow_retail_job', 'off', false);
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare
  v_cust uuid := (select v from r_ids where k = 'cust_ana'); v_veh uuid := (select v from r_ids where k = 'veh_mazda'); e public.estimates; d jsonb; v_job uuid; ch jsonb; j public.jobs; r jsonb;
begin
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'vehicle_id', v_veh, 'odometer', 53000, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote',
    'lines', jsonb_build_array(jsonb_build_object('line_type', 'labor', 'label', 'Wiper motor', 'hours', 2, 'rate', 100), jsonb_build_object('line_type', 'part', 'label', 'Motor', 'price', 100, 'taxable', false))))));
  perform public.send_estimate(e.id);
  d := public.estimate_detail(e.id);
  perform public.mark_estimate_accepted(e.id, (d -> 'options' -> 0 ->> 'id')::uuid, (select array_agg((l ->> 'id')::uuid) from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l), 'Ana', 'in_person');
  v_job := (public.estimate_detail(e.id) ->> 'job_id')::uuid;
  insert into r_ids values ('job56', v_job);
  perform pg_temp.finish_it(v_job);
  perform pg_temp.invoice_it(v_job);
  ch := public.retail_charge(v_job);
  assert (ch ->> 'balance')::numeric = (ch ->> 'total')::numeric and (ch ->> 'total')::numeric >= 300, '0056: balance before paying: ' || ch::text;
  -- the customer cannot sign before paying
  begin perform public.sign_receipt(v_job, '00000000-0000-4000-8000-000000000001/receipts/' || v_job::text || '/x.png', 'Ana'); raise exception 'expected refused'; exception when sqlstate 'P0001' then assert sqlerrm like 'Take the payment first%', '0056: ' || sqlerrm; end;
  -- a method nobody knows, and more than the balance, are refused
  begin perform public.record_retail_payment(v_job, 10, 'bitcoin'); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  begin perform public.record_retail_payment(v_job, (ch ->> 'balance')::numeric + 1, 'cash'); raise exception 'expected refused'; exception when sqlstate '22023' then assert sqlerrm like 'That is more than the balance%', '0056: ' || sqlerrm; end;
  -- part cash, part Zelle: the job is paid only when the balance reaches zero
  j := public.record_retail_payment(v_job, 100, 'cash', null);
  assert j.paid_at is null, '0056: part paid stays open';
  ch := public.retail_charge(v_job);
  assert (ch ->> 'paid')::numeric = 100 and (ch ->> 'balance')::numeric = (ch ->> 'total')::numeric - 100 and jsonb_array_length(ch -> 'payments') = 1, '0056: ledger after the first payment: ' || ch::text;
  j := public.record_retail_payment(v_job, (ch ->> 'balance')::numeric, 'zelle', 'Ana L');
  assert j.paid_at is not null and j.payment_method = 'other' and j.picked_up_at is null and j.closed_at is null, '0056: paid in full; Zelle shows as other on the job';
  r := public.job_receipt(v_job);
  assert jsonb_array_length(r -> 'payments') = 2 and (r -> 'payments' -> 1 ->> 'method') = 'zelle' and (r -> 'payments' -> 0 ->> 'method') = 'cash', '0056: the receipt lists how each part was paid: ' || (r -> 'payments')::text;
  assert (select count(*) from public.payments where job_id = v_job and status = 'paid') = 2, '0056: two payments on the ledger';
  begin perform public.record_retail_payment(v_job, 1, 'cash'); raise exception 'expected refused'; exception when sqlstate 'P0001' then assert sqlerrm like 'Already paid%', '0056: ' || sqlerrm; end;
end $$;
select pg_temp.logout();
-- the advisor records a payment by hand; a detailer on someone else's job cannot; nobody closes an unpaid job
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare v_job uuid := (select v from r_ids where k = 'job56'); v_sig text;
begin
  v_sig := '00000000-0000-4000-8000-000000000001/receipts/' || v_job::text || '/s.png';
  perform public.sign_receipt(v_job, v_sig, 'Ana Lopez');
  perform public.close_ro(v_job);
  assert (select picked_up_at from public.jobs where id = v_job) is not null, '0056: the advisor closes the job';
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
begin
  begin perform public.close_ro((select v from r_ids where k = 'job56')); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();
select set_config('app.allow_retail_job', 'on', false);

-- 0057: every retail visit has one primary estimate ----------------------------------
create or replace function pg_temp.shell_ok(p_est uuid, p_job uuid) returns boolean language sql security definer as $$
  select kind = 'quote' and status = 'accepted' and applied_at is not null and ro_number is not distinct from (select ro_number from public.jobs where id = p_job) from public.estimates where id = p_est
$$;
create or replace function pg_temp.shell_lines(p_est uuid, p_job uuid) returns boolean language sql security definer as $$
  select (select count(*) from public.estimate_lines where estimate_id = p_est) = (select count(*) from public.job_services where job_id = p_job)
     and not exists (select 1 from public.job_services where job_id = p_job and estimate_line_id is null)
     and not exists (select 1 from public.estimates where job_id = p_job and id <> p_est and kind = 'quote')
$$;
create or replace function pg_temp.has_est(p_job uuid) returns boolean language sql security definer as $$
  select exists (select 1 from public.estimates where job_id = p_job)
$$;
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_job uuid := (select v from r_ids where k = 'job_r200'); v_est uuid; f jsonb; r jsonb; n integer; m integer;
begin
  assert not pg_temp.has_est(v_job), '0057: the test visit starts with no estimate';
  v_est := public.job_primary_estimate(v_job);
  assert v_est is not null and v_est = public.job_primary_estimate(v_job), '0057: the primary estimate is made once';
  assert pg_temp.shell_ok(v_est, v_job), '0057: shell estimate is an applied quote carrying the number';
  assert pg_temp.shell_lines(v_est, v_job), '0057: its lines mirror the visit and are linked';
  f := public.estimates_filtered(p_stage => 'paid');
  assert exists (select 1 from jsonb_array_elements(f -> 'rows') x where (x ->> 'id')::uuid = v_est and x ->> 'stage' = 'paid' and (x ->> 'job_id')::uuid = v_job), '0057: a paid visit is in the paid stage';
  assert (f -> 'counts' ->> 'paid')::int >= 1, '0057: counts per stage';
  f := public.estimates_filtered(p_stage => 'open');
  assert exists (select 1 from jsonb_array_elements(f -> 'rows') x where (x ->> 'id')::uuid = v_est), '0057: open = not closed, declined or expired';
end $$;
select pg_temp.logout();
-- a manager sees the list without money
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare f jsonb;
begin
  f := public.estimates_filtered(p_stage => 'open');
  assert (select bool_and(x -> 'total' = 'null'::jsonb and x -> 'balance' = 'null'::jsonb) from jsonb_array_elements(f -> 'rows') x), '0057: no money for a manager';
end $$;
select pg_temp.logout();

-- 0058: transfer a visit to a coworker ----------------------------------------------
create or replace function pg_temp.holder_of(p_est uuid) returns uuid language sql security definer as $$ select holder_id from public.estimates where id = p_est $$;
create or replace function pg_temp.tech_of(p_est uuid) returns uuid language sql security definer as $$ select j.detailer_id from public.jobs j join public.estimates e on e.job_id = j.id where e.id = p_est $$;
create or replace function pg_temp.transfer_state(p_id uuid) returns text language sql security definer as $$ select state from public.estimate_transfers where id = p_id $$;
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare
  v_job uuid := (select v from r_ids where k = 'job_r200'); v_est uuid := public.job_primary_estimate((select v from r_ids where k = 'job_r200'));
  t1 uuid; t2 uuid; t3 uuid; m jsonb; c jsonb;
begin
  c := public.transfer_candidates();
  assert jsonb_array_length(c) >= 3 and not exists (select 1 from jsonb_array_elements(c) x where (x ->> 'id') = '10000000-0000-4000-8000-000000000001'), '0058: the picker lists the other staff, not me';
  begin perform public.transfer_estimate(v_est, '10000000-0000-4000-8000-000000000001', 'Checked in', 'to myself'); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  t1 := public.transfer_estimate(v_est, '10000000-0000-4000-8000-000000000002', 'Needs parts ordered', 'Pads are on the shelf');
  m := public.my_transfers();
  assert jsonb_array_length(m -> 'outgoing') = 1 and jsonb_array_length(m -> 'incoming') = 0 and (m -> 'outgoing' -> 0 ->> 'status_label') = 'Needs parts ordered', '0058: the sender sees it as outgoing';
  assert (m -> 'outgoing' -> 0 ->> 'to') ~ '^[A-Z]{1,3}$' and (m -> 'outgoing' -> 0 ->> 'from') ~ '^[A-Z]{1,3}$', '0058: transfers show initials, never names';
  -- a second offer replaces the first
  t2 := public.transfer_estimate(v_est, '10000000-0000-4000-8000-000000000006', 'Checked in', null);
  assert pg_temp.transfer_state(t1) = 'cancelled' and pg_temp.transfer_state(t2) = 'pending', '0058: a new offer cancels the pending one';
  perform public.cancel_transfer(t2);
  assert pg_temp.transfer_state(t2) = 'cancelled', '0058: the sender can cancel';
  t3 := public.transfer_estimate(v_est, '10000000-0000-4000-8000-000000000002', 'In progress', 'Yours now');
  insert into r_ids values ('transfer_1', t3), ('transfer_est', v_est);
  begin perform public.respond_transfer(t3, true); raise exception 'expected refused'; exception when sqlstate 'P0002' then null; end;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare t uuid := (select v from r_ids where k = 'transfer_1'); v_est uuid := (select v from r_ids where k = 'transfer_est'); m jsonb; f jsonb;
begin
  m := public.my_transfers();
  assert jsonb_array_length(m -> 'incoming') = 1 and (m -> 'incoming' -> 0 ->> 'message') = 'Yours now', '0058: the coworker sees it as incoming';
  perform public.respond_transfer(t, true);
  assert pg_temp.transfer_state(t) = 'accepted' and pg_temp.holder_of(v_est) = '10000000-0000-4000-8000-000000000002', '0058: accepting makes them the holder';
  assert pg_temp.tech_of(v_est) = '10000000-0000-4000-8000-000000000002', '0058: a detailer also becomes the tech so the visit opens for them';
  begin perform public.respond_transfer(t, false); raise exception 'expected refused'; exception when sqlstate 'P0001' then null; end;
  f := public.estimates_filtered(p_limit => 200);
  assert exists (select 1 from jsonb_array_elements(f -> 'rows') x where (x ->> 'id')::uuid = v_est and (x ->> 'mine')::boolean), '0058: the visit is mine now';
  assert jsonb_array_length(public.my_transfers() -> 'incoming') = 0, '0058: nothing pending any more';
end $$;
select pg_temp.logout();

-- 0059: signatures — staff-captured approval, declines logged, signature path for staff only
create or replace function pg_temp.est_auth(p_est uuid) returns public.estimate_authorizations language sql security definer as $$ select * from public.estimate_authorizations where estimate_id = p_est limit 1 $$;
create or replace function pg_temp.jauth(p_job uuid, p_kind text) returns public.job_authorizations language sql security definer as $$ select * from public.job_authorizations where job_id = p_job and kind = p_kind and decision = 'approved' limit 1 $$;
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare
  v_cust uuid := (select v from r_ids where k = 'cust_ana'); v_veh uuid := (select v from r_ids where k = 'veh_mazda');
  e public.estimates; ed jsonb; s public.estimates; v_job uuid; v_opt uuid; a public.estimate_authorizations; v_co uuid := (select company_id from public.estimates limit 1);
begin
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'vehicle_id', v_veh,
         'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Quote', 'lines', jsonb_build_array(jsonb_build_object('service_id', (select v from r_ids where k = 'svc_full')))))));
  perform public.send_estimate(e.id);
  ed := public.estimate_detail(e.id);
  v_opt := (select (o ->> 'id')::uuid from jsonb_array_elements(ed -> 'options') o limit 1);
  begin perform public.mark_estimate_accepted(e.id, v_opt, '{}', 'Ana', 'in_person', 'someone-else/estimates/x/y.png'); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  perform public.mark_estimate_accepted(e.id, v_opt, '{}', 'Ana at the counter', 'in_person', (select company_id from public.estimates where id = e.id limit 1)::text || '/estimates/' || e.id::text || '/sig.png', '203.0.113.9', 'Clover Flex');
  a := pg_temp.est_auth(e.id);
  assert a.signature_path like '%/estimates/' || e.id::text || '/sig.png' and a.ip = '203.0.113.9' and a.user_agent = 'Clover Flex' and a.consent_text like 'I agree to sign electronically%', '0059: the staff-captured signature, device and consent line are stored';
  assert public.signature_path_for('estimate', a.id) = a.signature_path, '0059: staff read the path';
  v_job := (public.estimate_detail(e.id) ->> 'job_id')::uuid;
  assert (pg_temp.jauth(v_job, 'estimate')).consent_text like 'I agree to sign electronically%', '0059: the consent line travels to the visit log';
  assert (pg_temp.jauth(v_job, 'estimate')).signature_path is not null and public.signature_path_for('job', (pg_temp.jauth(v_job, 'estimate')).id) is not null, '0059: the visit log signature is readable by staff';
  -- extra work declined is logged
  s := public.create_estimate(jsonb_build_object('job_id', v_job, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'More', 'lines', jsonb_build_array(
         jsonb_build_object('line_type', 'labor', 'label', 'Machine the rotors', 'hours', 1))))));
  perform public.send_estimate(s.id);
  perform public.decline_estimate(s.id, 'too much');
  assert exists (select 1 from jsonb_array_elements(public.ro_authorizations(v_job)) x where x ->> 'decision' = 'declined' and x ->> 'kind' = 'change_order'), '0059: a declined extra-work estimate is logged';
  assert exists (select 1 from jsonb_array_elements(public.ro_authorizations(v_job)) x where x ->> 'decision' = 'approved'), '0059: the approval is still there, marked approved';
  insert into r_ids values ('sig_job', v_job);
end $$;
select pg_temp.logout();
create or replace function pg_temp.any_auth() returns uuid language sql security definer as $$ select id from public.job_authorizations where signature_path is not null limit 1 $$;
-- a detailer cannot read signature paths
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
begin
  assert public.signature_path_for('job', pg_temp.any_auth()) is null, '0059: no signature path for a detailer';
end $$;
select pg_temp.logout();

-- 0061: the fields on a work order ---------------------------------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_est uuid := (select v from r_ids where k = 'transfer_est'); f jsonb; d jsonb; x jsonb;
begin
  perform public.set_estimate_meta(v_est, jsonb_build_object('label', 'VIP Customer', 'parts_status', 'needed', 'status_label', 'Waiting for approval', 'fleet_number', '12', 'due_in', '2026-10-20T09:00:00Z'));
  f := public.estimates_filtered(p_limit => 200);
  x := (select r from jsonb_array_elements(f -> 'rows') r where (r ->> 'id')::uuid = v_est);
  assert x ->> 'label' = 'VIP Customer' and x ->> 'parts_status' = 'needed' and x ->> 'status_label' = 'Waiting for approval' and x ->> 'due_in' is not null, '0061: the list row carries the label, parts, status and due time';
  d := public.estimate_detail(v_est);
  assert d ->> 'label' = 'VIP Customer' and d ->> 'fleet_number' = '12' and (d ->> 'previous_visits') is not null and (d -> 'customer' ->> 'source') is not null and (d -> 'customer' ->> 'best_contact') in ('Text', 'Call'), '0061: the estimate carries its fields, the customer''s history and source';
  begin perform public.set_estimate_meta(v_est, jsonb_build_object('label', 'Nope')); raise exception 'expected refused'; exception when sqlstate '23514' then null; end;
  begin perform public.set_estimate_meta(v_est, jsonb_build_object('parts_status', 'lost')); raise exception 'expected refused'; exception when sqlstate '23514' then null; end;
end $$;
select pg_temp.logout();
-- a tech sets the status word and the parts, not the label
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare v_est uuid := (select v from r_ids where k = 'transfer_est');
begin
  perform public.set_estimate_meta(v_est, jsonb_build_object('status_label', 'Needs parts ordered', 'parts_status', 'ordered'));
  begin perform public.set_estimate_meta(v_est, jsonb_build_object('label', 'Fleet')); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
  begin perform public.set_estimate_meta(v_est, jsonb_build_object('due_out', '2026-10-21T09:00:00Z')); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();

-- 0062: frozen signed copies ---------------------------------------------------------------
create or replace function pg_temp.add_doc(p_est uuid) returns uuid language plpgsql security definer as $$
declare v uuid;
begin
  insert into public.ro_documents (company_id, estimate_id, job_id, kind, source_id, path, sha256, byte_size)
  select e.company_id, e.id, e.job_id, 'estimate', gen_random_uuid(), e.company_id::text || '/estimate/x.pdf', repeat('a', 64), 1234 from public.estimates e where e.id = p_est returning id into v;
  return v;
end $$;
create or replace function pg_temp.try_change_doc(p_id uuid) returns text language plpgsql security definer as $$
begin
  begin update public.ro_documents set sha256 = 'b' where id = p_id; return 'changed'; exception when sqlstate 'P0001' then null; end;
  begin delete from public.ro_documents where id = p_id; return 'deleted'; exception when sqlstate 'P0001' then null; end;
  return 'frozen';
end $$;
do $$
declare v_est uuid := (select v from r_ids where k = 'transfer_est'); v_doc uuid := pg_temp.add_doc((select v from r_ids where k = 'transfer_est'));
begin
  assert pg_temp.try_change_doc(v_doc) = 'frozen', '0062: a signed copy cannot be changed or deleted';
  insert into r_ids values ('doc_1', v_doc);
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_est uuid := (select v from r_ids where k = 'transfer_est'); l jsonb;
begin
  l := public.signed_documents(v_est);
  assert jsonb_array_length(l) >= 1 and (l -> 0 ->> 'sha256') is not null, '0062: staff list the shop copies of a visit';
  assert public.document_path_for((select v from r_ids where k = 'doc_1')) like '%/estimate/x.pdf', '0062: staff get the stored path';
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
begin
  assert jsonb_array_length(public.signed_documents((select v from r_ids where k = 'transfer_est'))) = 0 and public.document_path_for((select v from r_ids where k = 'doc_1')) is null, '0062: a tech sees no copies and no path';
end $$;
select pg_temp.logout();

-- 0063: the Workflow columns — send a work order to a tech, tech_id on list rows, parts follow the status word
create or replace function pg_temp.parts_of(p_est uuid) returns text language sql security definer as $$ select parts_status from public.estimates where id = p_est $$;
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare
  v_est uuid := (select v from r_ids where k = 'transfer_est'); techs jsonb; f jsonb; r jsonb;
begin
  techs := public.retail_technicians();
  assert jsonb_array_length(techs) >= 1 and not exists (select 1 from jsonb_array_elements(techs) x where (x ->> 'id') = '10000000-0000-4000-8000-000000000006'), '0063: the picker lists technicians only';
  begin perform public.send_to_tech(v_est, '10000000-0000-4000-8000-000000000004'); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  perform public.send_to_tech(v_est, '10000000-0000-4000-8000-000000000002');
  assert pg_temp.holder_of(v_est) = '10000000-0000-4000-8000-000000000002' and pg_temp.tech_of(v_est) = '10000000-0000-4000-8000-000000000002', '0063: the advisor sends it, the tech holds it and is the tech';
  f := public.estimates_filtered(p_limit => 200);
  r := (select x from jsonb_array_elements(f -> 'rows') x where (x ->> 'id')::uuid = v_est);
  assert (r ->> 'tech_id') = '10000000-0000-4000-8000-000000000002', '0063: the row names the technician by id';
  perform public.send_to_tech(v_est, null);
  assert pg_temp.holder_of(v_est) = '10000000-0000-4000-8000-000000000006', '0063: sending to nobody puts it back with the advisor';
  f := public.estimates_filtered(p_limit => 200);
  r := (select x from jsonb_array_elements(f -> 'rows') x where (x ->> 'id')::uuid = v_est);
  assert (r ->> 'tech_id') is null, '0063: no tech_id while an advisor holds it';
  perform public.set_estimate_meta(v_est, '{"parts_status":"none"}'::jsonb);
  perform public.set_estimate_meta(v_est, '{"status_label":"Needs parts ordered"}'::jsonb);
  assert pg_temp.parts_of(v_est) = 'needed', '0063: Needs parts ordered marks the parts as needed';
  perform public.set_estimate_meta(v_est, '{"parts_status":"arrived"}'::jsonb);
  assert pg_temp.parts_of(v_est) = 'arrived', '0063: parts can be marked arrived';
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
begin
  begin perform public.send_to_tech((select v from r_ids where k = 'transfer_est'), '10000000-0000-4000-8000-000000000002'); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
begin
  begin perform public.send_to_tech((select v from r_ids where k = 'transfer_est'), '10000000-0000-4000-8000-000000000002'); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();

-- 0064: no edits once an estimate is a work order
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare v_est uuid := (select v from r_ids where k = 'transfer_est');
begin
  begin perform public.update_estimate(v_est, jsonb_build_object('po_number', 'late edit')); raise exception 'expected refused'; exception when sqlstate 'P0001' then null; end;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_est uuid := (select v from r_ids where k = 'transfer_est');
begin
  begin perform public.update_estimate(v_est, jsonb_build_object('po_number', 'late edit')); raise exception 'expected refused'; exception when sqlstate 'P0001' then null; end;
  perform public.set_estimate_meta(v_est, '{"label":"Waiting"}'::jsonb);
end $$;
select pg_temp.logout();

-- 0065: part condition (new / used / rebuilt / reconditioned)
create or replace function pg_temp.set_condition(p_line uuid, p_cond text) returns void language sql security definer as $$ update public.estimate_lines set part_condition = p_cond where id = p_line $$;
create or replace function pg_temp.a_part_line_on_a_job() returns uuid language sql security definer as $$
  select el.id from public.estimate_lines el join public.job_services js on js.estimate_line_id = el.id where el.line_type = 'part' limit 1 $$;
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_job uuid := (select v from r_ids where k = 'job_unauth'); v_ana uuid := (select v from r_ids where k = 'cust_ana'); e public.estimates; d jsonb; v_line uuid := pg_temp.a_part_line_on_a_job(); r jsonb;
begin
  e := public.create_estimate(jsonb_build_object('job_id', v_job, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Extra', 'lines', jsonb_build_array(
         jsonb_build_object('line_type', 'part', 'label', 'Wiper blades', 'price', 20),
         jsonb_build_object('line_type', 'part', 'label', 'Alternator', 'price', 150, 'part_condition', 'rebuilt'),
         jsonb_build_object('line_type', 'fee', 'label', 'Disposal', 'price', 5, 'part_condition', 'used'))))));
  d := public.estimate_detail(e.id);
  assert (select l ->> 'part_condition' from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'name' = 'Wiper blades') = 'new', '0065: a part with no condition is new';
  assert (select l ->> 'part_condition' from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'name' = 'Alternator') = 'rebuilt', '0065: a rebuilt part says so';
  assert (select l ->> 'part_condition' from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') l where l ->> 'name' = 'Disposal') = 'new', '0065: only a part has a condition';
  begin
    perform public.create_estimate(jsonb_build_object('job_id', v_job, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'x', 'lines', jsonb_build_array(jsonb_build_object('line_type', 'part', 'label', 'Pads', 'price', 10, 'part_condition', 'salvaged'))))));
    raise exception 'expected refused';
  exception when sqlstate '22023' then null; end;
  -- the invoice JSON carries the condition of a part that is on a repair order
  assert v_line is not null, '0065: a part line is on a repair order in the test data';
  if v_line is not null then
    perform pg_temp.set_condition(v_line, 'used');
    r := public.job_receipt((select job_id from public.estimates where id = (select estimate_id from public.estimate_lines where id = v_line)));
    assert exists (select 1 from jsonb_array_elements(coalesce(r -> 'jobs', '[]'::jsonb)) j, jsonb_array_elements(coalesce(j -> 'lines', '[]'::jsonb)) l where l ->> 'part_condition' = 'used') or position('"part_condition": "used"' in r::text) > 0, '0065: the invoice shows the part condition';
  end if;
end $$;
select pg_temp.logout();
