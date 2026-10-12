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
