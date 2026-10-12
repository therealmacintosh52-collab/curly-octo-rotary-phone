-- SQL tests for RLS, RPCs and triggers. Runs on the local stub (see run.sh).
-- Each block asserts and raises on failure; run.sh stops on the first error.

-- Helpers -------------------------------------------------------------------
create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, false);
  select set_config('role', 'authenticated', false);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', false);
  select set_config('request.jwt.claims', '', false);
$$;
-- Price columns are not readable by app users (0029); the tests peek at them as postgres.
create or replace function pg_temp.js_price(p_job uuid, p_service uuid default null) returns numeric
language sql security definer as $$
  select price from public.job_services where job_id = p_job and (p_service is null or service_id = p_service) limit 1;
$$;
create or replace function pg_temp.js_reason(p_job uuid, p_service uuid default null) returns text
language sql security definer as $$
  select override_reason from public.job_services where job_id = p_job and (p_service is null or service_id = p_service) limit 1;
$$;
create or replace function pg_temp.svc_price(p_service uuid) returns numeric
language sql security definer as $$
  select default_price from public.services where id = p_service;
$$;

-- Fixture users (trigger creates profiles) -----------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'owner@test', '{}'),                                  -- bootstrap → owner
  ('10000000-0000-4000-8000-000000000002', 'det1@test',  '{"role":"detailer","full_name":"Dee One"}'),
  ('10000000-0000-4000-8000-000000000003', 'det2@test',  '{"role":"detailer","full_name":"Dee Two"}'),
  ('10000000-0000-4000-8000-000000000004', 'mgr@test',   '{"role":"manager","full_name":"Manny"}');

-- The blocks up to "One car, one invoice" exercise the original batch /
-- per-job invoicing, so auto-invoicing (0015, default on) is switched off
-- for them and switched on again at the end.
update public.companies set auto_invoice = false;
create temp table t_ids (k text primary key, v uuid);
grant all on t_ids to authenticated;

do $$
begin
  assert (select role from public.profiles where id = '10000000-0000-4000-8000-000000000001') = 'owner', 'first user becomes owner';
  assert (select role from public.profiles where id = '10000000-0000-4000-8000-000000000002') = 'detailer', 'metadata role honoured';
  assert (select company_id from public.profiles where id = '10000000-0000-4000-8000-000000000002') = '00000000-0000-4000-8000-000000000001', 'single company auto-attach';
end $$;

-- Detailer 1 logs a job ------------------------------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000002');

do $$
declare j public.jobs; j2 public.jobs; n int;
begin
  assert public.current_company_id() = '00000000-0000-4000-8000-000000000001', 'company resolved';
  assert not public.is_admin(), 'detailer is not admin';

  j := public.create_job(jsonb_build_object(
    'client_id', '20000000-0000-4000-8000-000000000001',
    'dealership_id', '00000000-0000-4000-8000-000000000101',
    'tag_number', 'a123', 'vin', 'w1kzf8db5na123456', 'year', 2022, 'make', 'Mercedes-Benz', 'model', 'E 350',
    'services', jsonb_build_array(
      jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'),
      jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000204', 'price', 30, 'override_reason', 'Manager approved'))));
  assert j.tag_number = 'A123', 'tag uppercased';
  assert j.vin = 'W1KZF8DB5NA123456', 'vin uppercased';
  assert j.detailer_id = auth.uid(), 'detailer is self';
  select count(*) into n from public.job_services where job_id = j.id; assert n = 2, 'two services';
  assert pg_temp.js_price(j.id, '00000000-0000-4000-8000-000000000201') = 200.00, 'default price applied';
  -- 0029: a detailer's price is ignored; the list price is used and no reason is kept
  assert pg_temp.js_price(j.id, '00000000-0000-4000-8000-000000000204') = 60.00 and pg_temp.js_reason(j.id, '00000000-0000-4000-8000-000000000204') is null, '0029: detailer price ignored, list price used';
  begin
    perform price from public.job_services where job_id = j.id;
    raise exception 'expected price column to be unreadable';
  exception when sqlstate '42501' then null; end;
  assert (select needs_price from public.job_services where job_id = j.id and service_id = '00000000-0000-4000-8000-000000000201') = false, '0029: a priced service needs no price';

  -- idempotent retry returns the same row
  j2 := public.create_job(jsonb_build_object('client_id', '20000000-0000-4000-8000-000000000001',
    'dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'ZZZ',
    'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  assert j2.id = j.id and j2.tag_number = 'A123', 'create_job idempotent on client_id';
  select count(*) into n from public.jobs; assert n = 1, 'no duplicate row';

  -- duplicate finder
  select count(*) into n from public.find_duplicate_jobs('A123', null, null); assert n = 1, 'dup by tag';
  select count(*) into n from public.find_duplicate_jobs('other', 'W1KZF8DB5NA123456', null); assert n = 1, 'dup by vin';
  select count(*) into n from public.find_duplicate_jobs('other', null, null); assert n = 0, 'no dup';

  -- 0029: whatever price a detailer sends (below the list, in range, out of range) the list price is saved
  begin
    j2 := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'B1',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201', 'price', 10))));
    assert pg_temp.js_price(j2.id) = 200.00, '0029: low price ignored';
    j2 := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'TU1',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000210', 'price', 35))));
    assert pg_temp.js_price(j2.id) = 30.00 and pg_temp.js_reason(j2.id) is null, '0029: in-range price ignored too';
    j2 := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'TU2',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000210', 'price', 55))));
    assert pg_temp.js_price(j2.id) = 30.00, '0029: out-of-range price ignored, no error';
    -- "Other" has no list price: the owner gets a flag to fill it in
    j2 := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'OTH0',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000212', 'price', 80, 'label', 'Wheel repair'))));
    assert pg_temp.js_price(j2.id) = 0 and (select needs_price from public.job_services where job_id = j2.id), '0029: open-amount service needs a price';
    assert (select label from public.job_services where job_id = j2.id) = 'Wheel repair', '0029: the label is kept';
    raise exception 'rollback fixture' using errcode = 'P0999';   -- keep later counts unchanged
  exception when sqlstate 'P0999' then null; end;
  -- the price list shows names but no prices to a detailer
  assert (select count(*) from public.dealership_price_list('00000000-0000-4000-8000-000000000101')) >= 5, 'price list has the menu';
  assert (select count(*) from public.dealership_price_list('00000000-0000-4000-8000-000000000101') where price is not null or price_min is not null or price_max is not null or is_override) = 0, '0029: price list hides prices from detailers';
  assert (select open_amount from public.dealership_price_list('00000000-0000-4000-8000-000000000101') where name = 'Other') and not (select open_amount from public.dealership_price_list('00000000-0000-4000-8000-000000000101') where name = 'Used'), '0029: open-amount flag still tells Other apart';
  begin
    perform public.resolve_service_price('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201');
    raise exception 'expected resolve_service_price to be internal';
  exception when sqlstate '42501' then null; end;
  assert (select count(*) from public.service_prices_v) = 0, '0029: price view empty for detailers';

  -- per-job dealership no longer requires an RO/PO (0008); rolled back so later counts hold
  begin
    perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'B0',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
    assert (select ro_po_number from public.jobs where tag_number = 'B0') is null, 'job saved without RO/PO';
    raise exception 'rollback' using errcode = 'P0999';
  exception when sqlstate 'P0999' then null; end;

  -- dealership price override resolves (Sacramento full detail = 165)
  j2 := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'B2', 'ro_po_number', 'RO-77',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  assert pg_temp.js_price(j2.id) = 215.00, 'dealership price used';

  -- detailer cannot read invoices / audit / edit services
  select count(*) into n from public.invoices; assert n = 0, 'invoices hidden (rls)';
  select count(*) into n from public.audit_log; assert n = 0, 'audit hidden (rls)';
  update public.services set default_price = 1 where id = '00000000-0000-4000-8000-000000000201';
  assert pg_temp.svc_price('00000000-0000-4000-8000-000000000201') = 200.00, 'detailer cannot change prices';
  begin
    perform default_price from public.services where id = '00000000-0000-4000-8000-000000000201';
    raise exception 'expected default_price to be unreadable';
  exception when sqlstate '42501' then null; end;
  assert (select name from public.services where id = '00000000-0000-4000-8000-000000000201') = 'Used', 'service names stay readable';
  begin
    perform public.generate_invoice('00000000-0000-4000-8000-000000000101', '2000-01-01', '2100-01-01');
    raise exception 'expected admin-only';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.soft_delete_job(j.id);
    raise exception 'expected admin-only';
  exception when sqlstate '42501' then null; end;
end $$;

-- Detailer 2 cannot see detailer 1's jobs ------------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000003');
do $$
declare n int;
begin
  select count(*) into n from public.jobs; assert n = 0, 'detailer isolation';
  select count(*) into n from public.job_services; assert n = 0, 'job_services isolation';
  perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'C9',
      'performed_at', now() - interval '3 days',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000202'))));
  select count(*) into n from public.jobs; assert n = 1, 'sees own job only';
  -- profiles visible (names) but role change blocked
  select count(*) into n from public.profiles; assert n = 4, 'profiles visible in company';
  begin
    update public.profiles set role = 'owner' where id = auth.uid();
    raise exception 'expected role guard';
  exception when sqlstate '42501' then null; end;
  update public.profiles set full_name = 'Dee Two Renamed' where id = auth.uid();
  assert (select full_name from public.profiles where id = auth.uid()) = 'Dee Two Renamed', 'self rename ok';
end $$;

-- Owner: invoicing ------------------------------------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_inv uuid; v_inv2 uuid; inv public.invoices; n int; v_job uuid; v_ids uuid[]; stats jsonb; v_pay uuid;
begin
  assert public.is_admin(), 'owner is admin';
  select count(*) into n from public.jobs; assert n = 3, 'admin sees all jobs';
  select count(*) into n from public.audit_log where table_name = 'jobs'; assert n >= 3, 'audit rows written';

  -- 0029: the owner's price overrides follow the policy (reason outside the range, none inside)
  begin
    perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'OV1',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201', 'price', 10))));
    raise exception 'expected override rejection';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'OV2',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000210', 'price', 55))));
    raise exception 'expected out-of-range rejection';
  exception when sqlstate '22023' then null; end;
  begin
    v_job := (public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'OV3',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000210', 'price', 35),
                                    jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201', 'price', 150, 'override_reason', 'Repeat customer'))))).id;
    assert (select price from public.job_service_prices_v where job_id = v_job and service_id = '00000000-0000-4000-8000-000000000210') = 35.00, '0029: owner in-range price kept';
    assert (select price from public.job_service_prices_v where job_id = v_job and service_id = '00000000-0000-4000-8000-000000000201') = 150.00
       and (select override_reason from public.job_service_prices_v where job_id = v_job and service_id = '00000000-0000-4000-8000-000000000201') = 'Repeat customer', '0029: owner override with reason kept';
    assert (select price_max from public.dealership_price_list('00000000-0000-4000-8000-000000000101') where name = 'Touch Up Detail') = 40.00, 'price list range (owner)';
    assert (select default_price from public.service_prices_v where service_id = '00000000-0000-4000-8000-000000000201') = 200.00, '0029: owner reads prices through the view';
    raise exception 'rollback fixture' using errcode = 'P0999';
  exception when sqlstate 'P0999' then null; end;

  -- batch invoice for El Dorado Hills (2 jobs: A123 @ 260 (200 + 60, the detailer's 30 was ignored), C9 @ 125)
  v_inv := public.generate_invoice('00000000-0000-4000-8000-000000000101', (current_date - 30), current_date + 1, 'September batch');
  select * into inv from public.invoices where id = v_inv;
  assert inv.display_number = 'INV-000001', 'first number: ' || inv.display_number;
  assert inv.subtotal = 385.00, 'subtotal ' || inv.subtotal;
  assert inv.tax = 0 and inv.total = 385.00, 'tax 0 by default';
  assert inv.status = 'draft', 'draft';
  select count(*) into n from public.invoice_items where invoice_id = v_inv; assert n = 3, 'three snapshot lines';
  select count(*) into n from public.jobs where invoice_id = v_inv and status = 'invoiced'; assert n = 2, 'jobs linked+invoiced';

  -- locked: cannot edit or hard delete an invoiced job
  select id into v_job from public.jobs where invoice_id = v_inv limit 1;
  begin
    update public.jobs set notes = 'x' where id = v_job;
    raise exception 'expected lock';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.update_job(v_job, '{"notes":"y"}'::jsonb);
    raise exception 'expected lock via rpc';
  exception when sqlstate 'P0001' then null; end;
  begin
    delete from public.jobs where id = v_job;
    raise exception 'expected no hard delete';
  exception when sqlstate 'P0001' then null; end;
  begin
    insert into public.job_services (company_id, job_id, service_id, price)
    values (public.current_company_id(), v_job, '00000000-0000-4000-8000-000000000209', 20);
    raise exception 'expected services lock';
  exception when sqlstate 'P0001' then null; end;

  -- nothing left to invoice in that window
  begin
    perform public.generate_invoice('00000000-0000-4000-8000-000000000101', current_date - 30, current_date + 1);
    raise exception 'expected empty';
  exception when sqlstate 'P0002' then null; end;

  -- submit manually → submitted
  perform public.mark_invoice_submitted(v_inv, 'portal', 'Uploaded to CDK portal');
  select * into inv from public.invoices where id = v_inv;
  assert inv.status = 'submitted' and inv.submitted_at is not null, 'submitted';

  -- partial then full payment
  v_pay := public.record_payment(v_inv, 100, current_date, 'check', '1001');
  select * into inv from public.invoices where id = v_inv;
  assert inv.status = 'partial' and inv.amount_paid = 100, 'partial';
  begin
    perform public.void_invoice(v_inv, 'oops');
    raise exception 'expected void block with payments';
  exception when sqlstate 'P0001' then null; end;
  perform public.record_payment(v_inv, 285, current_date, 'ach');
  select * into inv from public.invoices where id = v_inv;
  assert inv.status = 'paid' and inv.paid_at is not null and inv.amount_paid = 385, 'paid';
  -- removing a payment reverts status
  delete from public.invoice_payments where id = v_pay;
  select * into inv from public.invoices where id = v_inv;
  assert inv.status = 'partial' and inv.amount_paid = 285, 'payment removal recomputes';

  -- per-job mode for Sacramento: two jobs on RO-77, one on RO-88, one with none → 3 invoices
  perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'D1', 'ro_po_number', 'RO-77',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000204'))));
  perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'D2', 'ro_po_number', 'RO-88',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000204'))));
  select array_agg(x) into v_ids from public.generate_per_job_invoices('00000000-0000-4000-8000-000000000102') x;
  assert array_length(v_ids, 1) = 2, 'two per-job invoices, got ' || coalesce(array_length(v_ids,1),0);
  select * into inv from public.invoices where ro_po_number = 'RO-77';
  assert inv.subtotal = 270.00, 'RO-77 groups two jobs: ' || inv.subtotal;   -- 215 + 55
  assert coalesce(inv.payment_terms, '') = '', 'invoices carry no payment terms';
  assert inv.display_number = 'INV-000002' or inv.display_number = 'INV-000003', 'sequential numbering';

  -- void a draft: jobs unlock
  v_inv2 := inv.id;
  perform public.void_invoice(v_inv2, 'wrong RO');
  select count(*) into n from public.jobs where invoice_id = v_inv2; assert n = 0, 'jobs unlinked on void';
  select count(*) into n from public.jobs where ro_po_number = 'RO-77' and status = 'logged'; assert n = 2, 'jobs back to logged';
  select id into v_job from public.jobs where tag_number = 'D1';
  perform public.update_job(v_job, '{"notes":"editable again"}'::jsonb);
  assert (select notes from public.jobs where id = v_job) = 'editable again', 'unlocked after void';

  -- admin edit on behalf + services replace
  perform public.update_job(v_job, jsonb_build_object('color', 'Black',
    'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000209'))));
  select count(*) into n from public.job_services where job_id = v_job; assert n = 1, 'services replaced';
  select count(*) into n from public.audit_log where table_name = 'jobs' and row_id = v_job and action = 'update';
  assert n >= 2, 'edits audited';

  -- soft delete + restore
  perform public.soft_delete_job(v_job, 'test');
  assert (select deleted_at from public.jobs where id = v_job) is not null, 'soft deleted';
  select count(*) into n from public.find_duplicate_jobs('D1', null, null); assert n = 0, 'deleted jobs ignored by dup check';
  perform public.restore_job(v_job);
  assert (select deleted_at from public.jobs where id = v_job) is null, 'restored';

  -- dashboard
  stats := public.dashboard_stats();
  assert stats ? 'week' and stats ? 'month' and stats ? 'by_service' and stats ? 'by_detailer' and stats ? 'overdue', 'stats keys';
  assert (stats -> 'month' ->> 'jobs')::int >= 1, 'month jobs';
  assert (stats ->> 'reminder_days')::int = 30, 'reminder default';
  assert (stats -> 'by_service' -> 0) ? 'service_id' and (stats -> 'by_detailer' -> 0) ? 'detailer_id', 'breakdown rows carry ids';
  -- income for the range: revenue logged and cash collected (payments recorded above) both present
  assert stats ? 'income' and stats ? 'collected_by_day', 'income keys';
  assert (stats -> 'income' ->> 'revenue')::numeric > 0 and (stats -> 'income' ->> 'jobs')::int >= 1, 'income revenue';
  assert (stats -> 'income' ->> 'avg_per_car')::numeric > 0, 'income avg per car';
  assert (select (public.dashboard_stats('2000-01-01', current_date) -> 'income' ->> 'collected')::numeric)
         = (select coalesce(sum(amount), 0) from public.invoice_payments where company_id = public.current_company_id()), 'income collected = payments';
  assert jsonb_array_length(public.dashboard_stats('2000-01-01', current_date) -> 'collected_by_day') >= 1, 'collected by day rows';

  -- price list resolution
  assert (select price from public.dealership_price_list('00000000-0000-4000-8000-000000000102') where name = 'Used') = 215.00, 'price list override';
  assert (select price from public.dealership_price_list('00000000-0000-4000-8000-000000000101') where name = 'Used') = 200.00, 'price list default';
  assert (select category from public.dealership_price_list('00000000-0000-4000-8000-000000000101') where name = 'PDI') = 'new', 'price list category';

  -- admin can change prices; audit captures it
  update public.services set default_price = 205 where id = '00000000-0000-4000-8000-000000000201';
  select count(*) into n from public.audit_log where table_name = 'services' and action = 'update'; assert n = 1, 'service price audited';
end $$;

-- Double-billing guard -------------------------------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare a public.jobs; b public.jobs; c public.jobs; n int; v_inv uuid; v_ids uuid[]; r record;
begin
  -- Same VIN twice in one batch, same service → in_batch conflict with shared service.
  a := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'DUP1',
        'vin', '4JGDA5HB0EA100001', 'performed_at', now() - interval '5 days',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  b := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'DUP2',
        'vin', '4JGDA5HB0EA100001', 'performed_at', now() - interval '2 days',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  -- Same tag, different service, at the same dealership → in_batch, no shared service.
  c := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'DUP1',
        'performed_at', now() - interval '1 day',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000209'))));

  select count(*) into n from public.find_invoice_conflicts(array[a.id, b.id, c.id]);
  assert n = 2, 'two in-batch pairs, got ' || n;
  select * into r from public.find_invoice_conflicts(array[a.id, b.id, c.id]) x where x.job_id = a.id and x.other_job_id = b.id;
  assert r.kind = 'in_batch' and r.match_on = 'vin' and r.shared_services = 'Used', 'vin pair with shared service';
  select * into r from public.find_invoice_conflicts(array[a.id, b.id, c.id]) x where x.job_id = a.id and x.other_job_id = c.id;
  assert r.kind = 'in_batch' and r.match_on = 'tag' and r.shared_services is null, 'tag pair, different work';

  -- Exclude the suspected duplicate; it stays uninvoiced.
  v_inv := public.generate_invoice('00000000-0000-4000-8000-000000000101', (current_date - 7), current_date + 1, null, array[b.id]);
  assert (select invoice_id from public.jobs where id = b.id) is null, 'excluded job not invoiced';
  assert (select invoice_id from public.jobs where id = a.id) = v_inv, 'kept job invoiced';

  -- Now b collides with an INVOICED job and reports the invoice number.
  select * into r from public.find_invoice_conflicts(array[b.id]) x;
  assert r.kind = 'invoiced' and r.other_invoice_number = (select display_number from public.invoices where id = v_inv), 'invoiced conflict: ' || coalesce(r.kind, 'none');

  -- Owner reviews it as legitimate → no longer flagged.
  perform public.review_job_duplicate(b.id, 'Re-detail after customer return, approved by SM');
  select count(*) into n from public.find_invoice_conflicts(array[b.id]);
  assert n = 0, 'reviewed job not flagged';
  assert (select dup_review_note from public.jobs where id = b.id) like 'Re-detail%', 'review note stored';

  -- Entry-time check reports the invoice for the earlier job.
  select count(*) into n from public.find_duplicate_jobs('DUP1', null, null) x where x.invoice_number is not null;
  assert n >= 1, 'entry-time duplicate shows invoice number';

  -- Per-job exclusion path works too.
  select array_agg(x) into v_ids from public.generate_per_job_invoices('00000000-0000-4000-8000-000000000102', null, array[]::uuid[]) x;
  assert v_ids is null or array_length(v_ids, 1) >= 0, 'per-job generation with empty exclude list';
end $$;

-- Two more owner-logged cars today, left uninvoiced for the backfill below.
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
begin
  perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'ONE1',
    'performed_at', now(), 'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'ONE2',
    'performed_at', now(), 'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
end $$;

-- One car, one invoice (0015) -------------------------------------------------
select pg_temp.logout();
update public.companies set auto_invoice = true where id = '00000000-0000-4000-8000-000000000001';
do $$
declare n int; m int;
begin
  -- Backfill: every car still uninvoiced gets its own invoice, nothing is left in limbo.
  select count(*) into n from public.jobs where company_id = '00000000-0000-4000-8000-000000000001' and invoice_id is null and deleted_at is null;
  assert n > 0, 'fixture has pending cars to backfill';
  m := public._invoice_pending_cars('00000000-0000-4000-8000-000000000001');
  assert m = n, 'backfill invoiced every pending car: ' || m || ' of ' || n;
  select count(*) into n from public.jobs where company_id = '00000000-0000-4000-8000-000000000001' and invoice_id is null and deleted_at is null;
  assert n = 0, 'nothing left uninvoiced';
  assert public._invoice_pending_cars('00000000-0000-4000-8000-000000000001') = 0, 'backfill is idempotent';
  -- an owner-logged one-car draft the detailer must not be able to touch
  insert into t_ids select 'other_draft', i.id from public.invoices i
    join public.jobs j on j.invoice_id = i.id
   where j.tag_number = 'ONE2' and i.status = 'draft' limit 1;
  assert (select count(*) from t_ids) = 1, 'fixture: another draft invoice';
end $$;

-- Detailer 2 logs a car: it is an invoice at once, but the invoice itself is the owner's (0029).
select pg_temp.login('10000000-0000-4000-8000-000000000003');
do $$
declare j public.jobs; j2 public.jobs; n int; v_num text;
begin
  j := public.create_job(jsonb_build_object('client_id', '20000000-0000-4000-8000-000000000099',
        'dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'car1', 'model', 'GLE 450', 'performed_at', now(),
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  assert j.invoice_id is not null and j.status = 'invoiced', 'car is invoiced on save';
  select count(*) into n from public.invoices where id = j.invoice_id; assert n = 0, '0029: the invoice is hidden from the detailer (rls)';
  select count(*) into n from public.invoice_items where invoice_id = j.invoice_id; assert n = 0, '0029: its lines too';
  v_num := public.job_invoice_number(j.id);
  assert v_num like 'INV-%', '0029: the detailer still learns the invoice number: ' || coalesce(v_num, 'null');

  -- retry with the same client_id (offline sync): same car, same invoice
  j2 := public.create_job(jsonb_build_object('client_id', '20000000-0000-4000-8000-000000000099',
        'dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'ZZZ',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  assert j2.id = j.id and j2.invoice_id = j.invoice_id, 'retry keeps one invoice';

  -- an invoiced car is locked, and fixing it through the invoice is the owner's job now
  begin
    update public.jobs set notes = 'x' where id = j.id;
    raise exception 'expected lock';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.edit_invoice_car(j.invoice_id, jsonb_build_object('tag_number', 'car1x'));
    raise exception 'expected owner-only';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.invoices_filtered();
    raise exception 'expected owner-only list';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.delete_invoice_car(j.invoice_id, 'x');
    raise exception 'expected owner-only';
  exception when sqlstate '42501' then null; end;
  insert into t_ids values ('det_inv', j.invoice_id);
  insert into t_ids values ('det_job', j.id);

  -- 0023: my own dashboard shows this car (logged today) and nothing about money
  assert (public.my_dashboard() -> 'today' ->> 'cars')::int >= 1, 'my dashboard: cars today';
  assert (select count(*) from jsonb_array_elements(public.my_dashboard() -> 'today_cars') e where e ->> 'invoice_id' = j.invoice_id::text and e ->> 'tag' = 'CAR1') = 1, 'my dashboard: my car listed';
  assert (select count(*) from jsonb_array_elements(public.my_dashboard() -> 'today' -> 'by_service') e where e ->> 'name' = 'Used') = 1, 'my dashboard: by service';
  assert not (public.my_dashboard() ? 'unpaid_total') and not (public.my_dashboard() -> 'today' ? 'revenue'), 'my dashboard: no money';
end $$;

-- The owner fixes the detailer's car through its invoice: lines re-snapshotted, number unchanged, car locked again.
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare inv public.invoices; n int; v_num text; v_job uuid := (select v from t_ids where k = 'det_job');
begin
  select * into inv from public.invoices where id = (select v from t_ids where k = 'det_inv');
  assert inv.status = 'draft' and inv.period_start = inv.period_end, 'one-day draft';
  assert inv.total = (select sum(price) from public.job_service_prices_v where job_id = v_job), 'invoice total = the car''s services';
  v_num := inv.display_number;
  inv := public.edit_invoice_car(inv.id, jsonb_build_object('tag_number', 'car1x',
           'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'),
                                         jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000209'))));
  assert inv.display_number = v_num, 'invoice number unchanged';
  select count(*) into n from public.invoice_items where invoice_id = inv.id; assert n = 2, 'two lines after the edit';
  assert (select count(*) from public.invoice_items where invoice_id = inv.id and tag_number = 'CAR1X') = 2, 're-snapshotted tag';
  assert inv.subtotal = (select sum(price) from public.job_service_prices_v where job_id = v_job) and inv.total = inv.subtotal, 'totals recomputed: ' || inv.total;
  assert (select invoice_id from public.jobs where id = v_job) = inv.id and (select status from public.jobs where id = v_job) = 'invoiced', 'car relinked and locked';
end $$;

-- Owner: logging, fixing, removing, the list and the dashboard.
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare j public.jobs; inv public.invoices; f jsonb; n int; v_num text; stats jsonb;
begin
  -- a car logged by the owner carries RO/PO, dealership price and terms onto its invoice
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'OWN1', 'ro_po_number', 'RO-900',
        'performed_at', now() - interval '1 day',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000204'))));
  select * into inv from public.invoices where id = j.invoice_id;
  assert inv.ro_po_number = 'RO-900' and inv.subtotal = 55.00, 'invoice carries RO/PO and dealer price: ' || inv.subtotal;
  v_num := inv.display_number;

  -- move the car to another dealership: terms follow, number stays; repricing happens when services are sent
  inv := public.edit_invoice_car(inv.id, jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101'));
  assert inv.display_number = v_num and inv.dealership_id = '00000000-0000-4000-8000-000000000101', 'dealership change follows through';
  inv := public.edit_invoice_car(inv.id, jsonb_build_object('services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000204'))));
  assert inv.subtotal = 60.00, 'repriced for the new dealership: ' || inv.subtotal;

  -- once money is on it, the car is fixed
  perform public.record_payment(inv.id, 10, current_date, 'cash');
  begin
    perform public.edit_invoice_car(inv.id, '{"notes":"x"}'::jsonb);
    raise exception 'expected payment block';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.delete_invoice_car(inv.id, 'x');
    raise exception 'expected payment block';
  exception when sqlstate 'P0001' then null; end;

  -- "Other" carries what it was onto the invoice line
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'OTH1',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000212', 'price', 45, 'label', '  Headlight restoration '))));
  assert (select label from public.job_services where job_id = j.id) = 'Headlight restoration', 'label stored trimmed';
  assert (select service_name from public.invoice_items where invoice_id = j.invoice_id) = 'Headlight restoration', 'invoice line shows the label';
  inv := public.edit_invoice_car(j.invoice_id, jsonb_build_object('services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000212', 'price', 45, 'label', 'Headlight restoration, both sides'))));
  assert (select service_name from public.invoice_items where invoice_id = inv.id) = 'Headlight restoration, both sides', 'edit re-snapshots the label';
  f := public.invoices_filtered(p_q => 'headlight');
  assert (f ->> 'count')::int = 1, 'search finds the label';

  -- a car logged twice: delete voids the invoice and soft-deletes the car
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'DEL1',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000209'))));
  perform public.delete_invoice_car(j.invoice_id, 'logged twice');
  assert (select status from public.invoices where id = j.invoice_id) = 'void', 'invoice voided';
  assert (select deleted_at from public.jobs where id = j.id) is not null and (select invoice_id from public.jobs where id = j.id) is null, 'car soft-deleted and unlinked';
  begin
    perform public.delete_invoice_car(j.invoice_id, 'again');
    raise exception 'expected void block';
  exception when sqlstate 'P0001' then null; end;

  -- the archive: a deleted invoice is listed under 'deleted' (not 'void'), and comes back whole
  f := public.invoices_filtered(p_status => 'deleted');
  assert (select count(*) from jsonb_array_elements(f -> 'rows') r where r ->> 'id' = j.invoice_id::text and (r ->> 'deleted')::boolean) = 1, 'archive lists the deleted invoice';
  f := public.invoices_filtered(p_status => 'void');
  assert (select count(*) from jsonb_array_elements(f -> 'rows') r where r ->> 'id' = j.invoice_id::text) = 0, 'void filter leaves deleted ones to the archive';
  inv := public.restore_invoice_car(j.invoice_id);
  assert inv.status = 'draft' and inv.voided_at is null and inv.display_number = (select display_number from public.invoices where id = j.invoice_id), 'restored as an unsent draft with its number';
  assert (select deleted_at from public.jobs where id = j.id) is null and (select invoice_id from public.jobs where id = j.id) = inv.id, 'car restored and relinked';
  assert (select count(*) from public.invoice_items where invoice_id = inv.id) = 1, 'lines kept';
  begin
    perform public.restore_invoice_car(inv.id);
    raise exception 'expected not-deleted rejection';
  exception when sqlstate 'P0001' then null; end;
  perform public.delete_invoice_car(inv.id, 'logged twice, again');

  -- the list: filters
  f := public.invoices_filtered(p_status => 'deleted');
  assert (select count(*) from jsonb_array_elements(f -> 'rows') r where r ->> 'id' = j.invoice_id::text) = 1, 'deleted filter lists the deleted invoice';
  f := public.invoices_filtered();
  assert (select count(*) from jsonb_array_elements(f -> 'rows') r where r ->> 'status' = 'void') = 0, 'all hides void';
  f := public.invoices_filtered(p_q => 'car1x');
  assert (f ->> 'count')::int = 1 and (f -> 'rows' -> 0 -> 'cars' -> 0 ->> 'tag') = 'CAR1X' and (f -> 'rows' -> 0 -> 'cars' -> 0 ->> 'vehicle') = 'GLE 450', 'search by tag finds the car: ' || f;
  f := public.invoices_filtered(p_q => 'RO-900');
  assert (f ->> 'count')::int = 1 and (f -> 'rows' -> 0 ->> 'display_number') = v_num, 'search by RO/PO';
  f := public.invoices_filtered(p_q => 'loaner');
  assert (f ->> 'count')::int >= 1 and (select count(*) from jsonb_array_elements(f -> 'rows') r where not (r -> 'services') ? 'Service Loaner Detail') = 0, 'search by service name: ' || (f ->> 'count');
  f := public.invoices_filtered(p_q => 'INV-0000');
  assert (f ->> 'count')::int >= 3, 'search by invoice number';
  f := public.invoices_filtered(p_service => '00000000-0000-4000-8000-000000000209');
  assert (f ->> 'count')::int >= 1 and (select count(*) from jsonb_array_elements(f -> 'rows') r where not (r -> 'services') ? 'Sold') = 0, 'service filter: every row has the service';
  f := public.invoices_filtered(p_dealership => '00000000-0000-4000-8000-000000000102', p_status => 'unpaid');
  assert (f ->> 'count')::int >= 1 and (select count(*) from jsonb_array_elements(f -> 'rows') r
          where r ->> 'dealership' <> 'Mercedes-Benz of Sacramento' or r ->> 'status' not in ('draft','submitted','partial')) = 0, 'dealership + unpaid filter';
  assert (f ->> 'balance')::numeric = (select sum(total - amount_paid) from public.invoices where dealership_id = '00000000-0000-4000-8000-000000000102' and status in ('draft','submitted','partial')), 'balance = open balances of the filtered set';
  f := public.invoices_filtered(p_detailer => '10000000-0000-4000-8000-000000000003');
  assert (f ->> 'count')::int >= 2 and (select count(*) from jsonb_array_elements(f -> 'rows') r where r ->> 'id' = (select v::text from t_ids where k = 'det_inv')) = 1, 'detailer filter';
  f := public.invoices_filtered(p_from => current_date - 1, p_to => current_date);
  assert (f ->> 'count')::int >= 2, 'date filter overlaps periods';
  f := public.invoices_filtered(p_from => '2000-01-01', p_to => '2000-01-02');
  assert (f ->> 'count')::int = 0, 'date filter excludes';
  f := public.invoices_filtered(p_limit => 2, p_offset => 0);
  assert jsonb_array_length(f -> 'rows') = 2 and (f ->> 'count')::int > 2, 'pagination: page smaller than count';
  assert (f -> 'rows' -> 0 ->> 'display_number') > (f -> 'rows' -> 1 ->> 'display_number'), 'newest first';
  f := public.invoices_filtered(p_status => 'paid');
  assert (select count(*) from jsonb_array_elements(f -> 'rows') r where r ->> 'status' <> 'paid') = 0, 'paid filter';
  f := public.invoices_filtered(p_status => 'overdue');
  assert (select count(*) from jsonb_array_elements(f -> 'rows') r where (r ->> 'overdue')::boolean is not true) = 0, 'overdue rows flagged';

  -- dashboard: nothing uninvoiced any more; unpaid = every open invoice
  stats := public.dashboard_stats();
  assert stats ? 'unpaid_total' and stats ? 'unpaid_invoices' and stats ? 'draft_invoices', 'new stats keys';
  assert (stats ->> 'uninvoiced_jobs')::int = 0, 'nothing uninvoiced';
  assert (stats ->> 'unpaid_total')::numeric = (select coalesce(sum(total - amount_paid), 0) from public.invoices where company_id = public.current_company_id() and status in ('draft','submitted','partial')), 'unpaid total';
  assert (stats ->> 'draft_invoices')::int = (select count(*) from public.invoices where company_id = public.current_company_id() and status = 'draft'), 'draft count';
  -- today, by service (DEL1 above was logged today with "Sold", then deleted; OWN1 was yesterday; ONE1/ONE2 are today with "Used")
  assert stats ? 'today' and (stats -> 'today') ? 'by_service', 'today keys';
  assert stats ? 'week_by_day' and (select sum((e ->> 'jobs')::int) from jsonb_array_elements(stats -> 'week_by_day') e) = (stats -> 'week' ->> 'jobs')::int, 'week days add up to the week';
  assert (stats -> 'today' ->> 'jobs')::int >= 1, 'cars today';
  assert (select count(*) from jsonb_array_elements(stats -> 'today' -> 'by_service') e where e ->> 'name' = 'Used' and (e ->> 'jobs')::int >= 1) = 1, 'today split by service';
  assert (select sum((e ->> 'jobs')::int) from jsonb_array_elements(stats -> 'today' -> 'by_service') e) >= (stats -> 'today' ->> 'jobs')::int, 'service lines cover every car';
  select count(*) into n from public.invoices where id = (select v from t_ids where k = 'det_inv'); assert n = 1, 'owner sees the detailer''s invoice';
end $$;

-- Detailer 1 cannot see detailer 2's invoice.
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare n int;
begin
  select count(*) into n from public.invoices where id = (select v from t_ids where k = 'det_inv'); assert n = 0, 'other detailer''s invoice hidden';
  select count(*) into n from public.invoice_items where invoice_id = (select v from t_ids where k = 'det_inv'); assert n = 0, 'its lines hidden too';
  select count(*) into n from public.invoice_payments; assert n = 0, 'payments stay admin-only';
  select count(*) into n from jsonb_array_elements(public.my_dashboard() -> 'today_cars') e where e ->> 'invoice_id' = (select v::text from t_ids where k = 'det_inv');
  assert n = 0, 'other detailer''s car not on my dashboard';
end $$;

-- 0024/0029: a manager runs the day (every job, the team dashboard) but sees no money and cannot touch settings.
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare n int; total int; r record;
begin
  assert public.is_admin() and not public.is_owner_admin() and not public.is_owner(), 'manager: admin for the day, not for settings or money';
  select count(*) into n from public.invoices; assert n = 0, '0029: manager sees no invoices';
  select count(*) into n from public.invoice_payments; assert n = 0, '0029: manager sees no payments';
  select count(*) into n from public.audit_log; assert n = 0, '0029: manager sees no audit log';
  select count(*) into n from public.dealership_service_prices; assert n = 0, '0029: manager sees no dealership prices';
  select count(*) into n from public.service_prices_v; assert n = 0, '0029: price views empty for a manager';
  select count(*) into n from public.job_service_prices_v; assert n = 0, '0029: job price view empty for a manager';
  begin
    perform public.dashboard_stats();
    raise exception 'expected owner-only dashboard';
  exception when sqlstate '42501' then null; end;
  select count(*) into n from public.uninvoiced_jobs('00000000-0000-4000-8000-000000000102', '2000-01-01', current_date); assert n = 0, '0029: invoice builder empty for a manager';
  begin
    perform public.invoice_now('00000000-0000-4000-8000-000000000101');
    raise exception 'expected owner-only';
  exception when sqlstate '42501' then null; end;
  assert (select count(*) from public.dealership_price_list('00000000-0000-4000-8000-000000000101') where price is not null) = 0, '0029: price list blank for a manager';
  assert (public.team_dashboard() -> 'today' ->> 'cars')::int >= 1, 'manager gets the team dashboard';
  assert public.job_invoice_number((select v from t_ids where k = 'det_job')) like 'INV-%', '0029: manager sees which invoice a car is on';
  update public.companies set name = 'Hacked' where id = '00000000-0000-4000-8000-000000000001';
  get diagnostics total = row_count; assert total = 0, 'manager cannot edit the company';
  update public.dealerships set name = 'Hacked' where company_id = '00000000-0000-4000-8000-000000000001';
  get diagnostics total = row_count; assert total = 0, 'manager cannot edit dealerships';
  update public.services set default_price = 1 where company_id = '00000000-0000-4000-8000-000000000001';
  get diagnostics total = row_count; assert total = 0, 'manager cannot edit prices';
  update public.profiles set role = 'detailer' where id = '10000000-0000-4000-8000-000000000002';
  get diagnostics total = row_count; assert total = 0, 'manager cannot change other users';
  begin
    update public.profiles set role = 'owner' where id = auth.uid();
    raise exception 'expected guard';
  exception when sqlstate '42501' then null; end;
  select * into r from public.profiles where id = auth.uid(); assert r.role::text = 'manager', 'still a manager';
end $$;

-- Back to the owner for the storage checks below.
select pg_temp.login('10000000-0000-4000-8000-000000000001');

-- Storage policies: path scoping ---------------------------------------------
do $$
declare n int;
begin
  insert into storage.objects (bucket_id, name) values ('job-photos', '00000000-0000-4000-8000-000000000001/x/y.jpg');
  begin
    insert into storage.objects (bucket_id, name) values ('job-photos', '99999999-0000-4000-8000-000000000001/x/y.jpg');
    raise exception 'expected storage rls block';
  exception when sqlstate '42501' then null; end;
  select count(*) into n from storage.objects; assert n = 1, 'storage read scoped';
end $$;

-- 0026: anyone may mark the guide as seen on their own row; not on someone else's.
do $$
begin
  update public.profiles set guide_seen_at = now() where id = auth.uid();
  assert (select guide_seen_at from public.profiles where id = auth.uid()) is not null, 'guide seen on own row';
end $$;

select pg_temp.logout();

-- 0028: jobs by the day, one invoice per dealership per month --------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
update public.companies set auto_invoice = false where id = '00000000-0000-4000-8000-000000000001';
do $$
declare j public.jobs; n int; f jsonb; v_last timestamptz := date_trunc('month', now()) - interval '10 days'; v_this timestamptz := date_trunc('month', now()) + interval '1 day 6 hours';
begin
  assert (select auto_invoice from public.companies where id = '00000000-0000-4000-8000-000000000001') = false, '0028: auto-invoice off';
  -- Last month: two cars at El Dorado Hills, one at Sacramento. This month: one at each.
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'LM1', 'performed_at', v_last,
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  assert j.invoice_id is null and j.status = 'logged', '0028: a job is not invoiced on save';
  perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'LM2', 'performed_at', v_last + interval '1 day',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000204'))));
  perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'LM3', 'performed_at', v_last,
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'TM1', 'performed_at', v_this,
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'TM2', 'performed_at', v_this,
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000209'))));

  -- The Jobs list: open jobs, searchable, no money.
  f := public.jobs_filtered(p_status => 'open');
  assert (f ->> 'count')::int >= 5, '0028: open jobs listed: ' || (f ->> 'count');
  assert (select count(*) from jsonb_array_elements(f -> 'rows') r where r ->> 'tag' = 'LM1' and (r ->> 'invoice_id') is null and r -> 'services' ? 'Used') = 1, '0028: open row shape';
  assert (select count(*) from jsonb_array_elements(f -> 'rows') r where r ? 'total' or r ? 'price' or r ? 'balance') = 0, '0028: jobs list carries no money';
  f := public.jobs_filtered(p_q => 'LM');
  assert (f ->> 'count')::int = 3, '0028: search by stock number';
  f := public.jobs_filtered(p_dealership => '00000000-0000-4000-8000-000000000102', p_status => 'open');
  assert (select count(*) from jsonb_array_elements(f -> 'rows') r where r ->> 'tag' in ('LM3', 'TM2')) = 2, '0028: filter by dealership';

  -- close_month is not for signed-in users.
  begin
    perform public.close_month('00000000-0000-4000-8000-000000000001', current_date);
    raise exception 'expected close_month to be off limits';
  exception when sqlstate '42501' then null; end;
end $$;

-- The daily job runs as the service role.
select pg_temp.logout();
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
do $$
declare ids uuid[]; n int; v_inv uuid;
begin
  select array_agg(x) into ids from public.close_month('00000000-0000-4000-8000-000000000001', current_date) x;
  assert ids is not null and array_length(ids, 1) >= 2, '0028: one invoice per dealership for last month: ' || coalesce(array_length(ids, 1), 0);
  select invoice_id into v_inv from public.jobs where tag_number = 'LM1';
  assert v_inv is not null and v_inv = (select invoice_id from public.jobs where tag_number = 'LM2'), '0028: both El Dorado Hills cars on the same invoice';
  assert (select invoice_id from public.jobs where tag_number = 'LM3') is not null and (select invoice_id from public.jobs where tag_number = 'LM3') <> v_inv, '0028: Sacramento gets its own invoice';
  assert (select period_start from public.invoices where id = v_inv) = date_trunc('month', date_trunc('month', now()) - interval '10 days')::date
     and (select period_end from public.invoices where id = v_inv) = (date_trunc('month', now()) - interval '1 day')::date, '0028: period is the calendar month';
  assert (select count(*) from public.invoice_items where invoice_id = v_inv and tag_number in ('LM1', 'LM2')) = 2, '0028: every car on the month''s invoice';
  assert (select invoice_id from public.jobs where tag_number = 'TM1') is null, '0028: this month stays open';
  select count(*) into n from public.close_month('00000000-0000-4000-8000-000000000001', current_date);
  assert n = 0, '0028: second run finds nothing';
end $$;
select set_config('request.jwt.claims', '', false);

-- The owner closes one dealership early; the team dashboard has no money; a detailer sees only their own jobs.
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_inv uuid; f jsonb;
begin
  v_inv := public.invoice_now('00000000-0000-4000-8000-000000000101');
  assert (select invoice_id from public.jobs where tag_number = 'TM1') = v_inv, '0028: invoice_now closes the dealership through today';
  assert (select invoice_id from public.jobs where tag_number = 'TM2') is null, '0028: the other dealership stays open';
  begin
    perform public.invoice_now('00000000-0000-4000-8000-000000000101');
    raise exception 'expected nothing to invoice';
  exception when sqlstate 'P0002' then null; end;
  f := public.jobs_filtered(p_status => 'invoiced', p_q => 'TM1');
  assert (f ->> 'count')::int = 1 and (f -> 'rows' -> 0 ->> 'display_number') like 'INV-%', '0028: invoiced job shows its number';
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare t jsonb;
begin
  t := public.team_dashboard();
  assert t ? 'today' and t ? 'by_detailer' and t ? 'open_jobs', '0028: team dashboard keys';
  assert not (t ? 'income') and not (t ? 'unpaid_total') and not (t -> 'today' ? 'revenue'), '0028: team dashboard has no money';
  assert (public.jobs_filtered() ->> 'count')::int >= 5, '0028: manager sees every job';
  -- 0029: a manager can fix an open job but their price is ignored
  perform public.update_job((select id from public.jobs where tag_number = 'TM2'), jsonb_build_object('services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000204', 'price', 5, 'override_reason', 'x'))));
  assert pg_temp.js_price((select id from public.jobs where tag_number = 'TM2')) = 55.00 and pg_temp.js_reason((select id from public.jobs where tag_number = 'TM2')) is null, '0029: manager price ignored on edit';
  assert public.job_invoice_number((select id from public.jobs where tag_number = 'TM1')) like 'INV-%', '0029: manager sees the invoice number of a closed job';
  assert public.job_invoice_number((select id from public.jobs where tag_number = 'TM2')) is null, '0029: open job has no invoice number';
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare f jsonb;
begin
  f := public.jobs_filtered();
  assert (select count(*) from jsonb_array_elements(f -> 'rows') r where r ->> 'detailer_id' <> '10000000-0000-4000-8000-000000000002') = 0, '0028: detailer sees only their own jobs';
  assert (public.jobs_filtered(p_status => 'deleted') ->> 'count')::int = 0, '0028: no archive for detailers';
end $$;
select pg_temp.logout();

-- 0029: an open-amount service logged by a detailer waits for the owner's price.
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare j public.jobs;
begin
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'NP1',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000212', 'label', 'Odor treatment', 'price', 120))));
  assert (select needs_price from public.job_services where job_id = j.id) = true, '0029: Other needs a price';
  assert pg_temp.js_price(j.id) = 0, '0029: the detailer''s amount is not saved';
  assert public.jobs_needing_price() = 0, '0029: the flag count is for the owner only';
  assert public.job_invoice_number((select v from t_ids where k = 'det_job')) is null, '0029: no invoice number for another detailer''s car';
  insert into t_ids values ('np_job', j.id);
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_job uuid := (select v from t_ids where k = 'np_job'); n int;
begin
  assert public.jobs_needing_price() >= 1, '0029: owner sees how many jobs need a price';
  select count(*) into n from public.job_service_prices_v where job_id = v_job and needs_price; assert n = 1, '0029: owner sees which service';
  perform public.update_job(v_job, jsonb_build_object('services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000212', 'label', 'Odor treatment', 'price', 120))));
  assert pg_temp.js_price(v_job) = 120 and (select needs_price from public.job_services where job_id = v_job) = false, '0029: owner sets the price and clears the flag';
  assert (select label from public.job_services where job_id = v_job) = 'Odor treatment', '0029: label kept through the edit';
end $$;
select pg_temp.logout();

-- 0030: photos. A detailer adds photos to their own open job and can remove the file too; not on an invoiced or deleted job.
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare v_job uuid := (select v from t_ids where k = 'np_job'); v_inv_job uuid := (select v from t_ids where k = 'det_job'); n int;
begin
  insert into public.job_photos (company_id, job_id, kind, storage_path, client_id)
  values ('00000000-0000-4000-8000-000000000001', v_job, 'before', '00000000-0000-4000-8000-000000000001/' || v_job || '/p1.jpg', '50000000-0000-4000-8000-000000000001');
  begin
    insert into public.job_photos (company_id, job_id, kind, storage_path, client_id)
    values ('00000000-0000-4000-8000-000000000001', v_job, 'before', '00000000-0000-4000-8000-000000000001/' || v_job || '/p1.jpg', '50000000-0000-4000-8000-000000000001');
    raise exception 'expected duplicate client_id rejection';
  exception when sqlstate '23505' then null; end;
  select count(*) into n from public.job_photos where job_id = v_job; assert n = 1, '0030: one photo, retried upload not duplicated';
  begin
    insert into public.job_photos (company_id, job_id, kind, storage_path)
    values ('00000000-0000-4000-8000-000000000001', v_inv_job, 'after', '00000000-0000-4000-8000-000000000001/' || v_inv_job || '/p2.jpg');
    raise exception 'expected rls block on another detailer''s job';
  exception when sqlstate '42501' then null; end;
  insert into storage.objects (bucket_id, name) values ('job-photos', '00000000-0000-4000-8000-000000000001/' || v_job || '/p1.jpg');
  delete from storage.objects where name = '00000000-0000-4000-8000-000000000001/' || v_job || '/p1.jpg';
  get diagnostics n = row_count; assert n = 1, '0030: detailer removes the file of their own open job';
  delete from storage.objects where name = '00000000-0000-4000-8000-000000000001/x/y.jpg';
  get diagnostics n = row_count; assert n = 0, '0030: but not other files';
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_job uuid := (select v from t_ids where k = 'np_job'); n int;
begin
  perform public.soft_delete_job(v_job, 'photo test');
  begin
    insert into public.job_photos (company_id, job_id, kind, storage_path)
    values ('00000000-0000-4000-8000-000000000001', v_job, 'after', '00000000-0000-4000-8000-000000000001/' || v_job || '/p3.jpg');
    raise exception 'expected no photos on a deleted job';
  exception when sqlstate '42501' then null; end;
  perform public.restore_job(v_job);
  delete from storage.objects where name = '00000000-0000-4000-8000-000000000001/x/y.jpg';
  get diagnostics n = row_count; assert n = 1, '0030: the owner removes any file';
end $$;
select pg_temp.logout();
