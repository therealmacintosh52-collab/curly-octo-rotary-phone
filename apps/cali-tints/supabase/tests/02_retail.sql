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
