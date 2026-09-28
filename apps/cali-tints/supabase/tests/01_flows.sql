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
  assert (select price from public.job_services where job_id = j.id and service_id = '00000000-0000-4000-8000-000000000201') = 200.00, 'default price applied';
  assert (select override_reason from public.job_services where job_id = j.id and service_id = '00000000-0000-4000-8000-000000000204') = 'Manager approved', 'override reason kept';

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

  -- price override without reason is rejected
  begin
    perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'B1',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201', 'price', 10))));
    raise exception 'expected override rejection';
  exception when sqlstate '22023' then null; end;

  -- price range: inside the range no reason needed; outside it is required
  begin
    j2 := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'TU1',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000210', 'price', 35))));
    assert (select price from public.job_services where job_id = j2.id) = 35.00 and (select override_reason from public.job_services where job_id = j2.id) is null, 'in-range price accepted without reason';
    raise exception 'rollback fixture' using errcode = 'P0999';   -- keep later counts unchanged
  exception when sqlstate 'P0999' then null; end;
  begin
    perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'TU2',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000210', 'price', 55))));
    raise exception 'expected out-of-range rejection';
  exception when sqlstate '22023' then null; end;
  assert (select price_max from public.dealership_price_list('00000000-0000-4000-8000-000000000101') where name = 'Touch Up Detail') = 40.00, 'price list range';

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
  assert (select price from public.job_services where job_id = j2.id) = 215.00, 'dealership price used';

  -- detailer cannot read invoices / audit / edit services
  select count(*) into n from public.invoices; assert n = 0, 'invoices hidden (rls)';
  select count(*) into n from public.audit_log; assert n = 0, 'audit hidden (rls)';
  update public.services set default_price = 1 where id = '00000000-0000-4000-8000-000000000201';
  assert (select default_price from public.services where id = '00000000-0000-4000-8000-000000000201') = 200.00, 'detailer cannot change prices';
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

  -- batch invoice for El Dorado Hills (2 jobs: A123 @ 230 (200 + 30 override), C9 @ 125)
  v_inv := public.generate_invoice('00000000-0000-4000-8000-000000000101', (current_date - 30), current_date + 1, 'September batch');
  select * into inv from public.invoices where id = v_inv;
  assert inv.display_number = 'INV-000001', 'first number: ' || inv.display_number;
  assert inv.subtotal = 355.00, 'subtotal ' || inv.subtotal;
  assert inv.tax = 0 and inv.total = 355.00, 'tax 0 by default';
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
  perform public.record_payment(v_inv, 255, current_date, 'ach');
  select * into inv from public.invoices where id = v_inv;
  assert inv.status = 'paid' and inv.paid_at is not null and inv.amount_paid = 355, 'paid';
  -- removing a payment reverts status
  delete from public.invoice_payments where id = v_pay;
  select * into inv from public.invoices where id = v_inv;
  assert inv.status = 'partial' and inv.amount_paid = 255, 'payment removal recomputes';

  -- per-job mode for Sacramento: two jobs on RO-77, one on RO-88, one with none → 3 invoices
  perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'D1', 'ro_po_number', 'RO-77',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000204'))));
  perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'D2', 'ro_po_number', 'RO-88',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000204'))));
  select array_agg(x) into v_ids from public.generate_per_job_invoices('00000000-0000-4000-8000-000000000102') x;
  assert array_length(v_ids, 1) = 2, 'two per-job invoices, got ' || coalesce(array_length(v_ids,1),0);
  select * into inv from public.invoices where ro_po_number = 'RO-77';
  assert inv.subtotal = 270.00, 'RO-77 groups two jobs: ' || inv.subtotal;   -- 215 + 55
  assert inv.payment_terms = 'Net 45', 'dealership terms override';
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
  assert (public.jobs_filter_summary() ->> 'jobs')::int >= 3, 'filter summary counts';
  assert (public.jobs_filter_summary(null, '00000000-0000-4000-8000-000000000201') ->> 'jobs')::int >= 1, 'filter summary by service';
  assert (public.jobs_filter_summary(null, null, null, null, null, null, 'invoiced') ->> 'revenue')::numeric > 0, 'filter summary invoiced revenue';

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

-- One-tap billing: invoice_job ------------------------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare j public.jobs; k public.jobs; v_inv uuid; n int;
begin
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'ONE1',
        'performed_at', now(), 'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  k := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'ONE2',
        'performed_at', now(), 'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  v_inv := public.invoice_job(j.id, 'charged at the till');
  select count(*) into n from public.invoice_items where invoice_id = v_inv; assert n = 1, 'one-job invoice has one line';
  assert (select invoice_id from public.jobs where id = j.id) = v_inv, 'job linked to its invoice';
  assert (select invoice_id from public.jobs where id = k.id) is null, 'other job of the same day left alone';
  assert (select total from public.invoices where id = v_inv) = (select sum(price) from public.job_services where job_id = j.id), 'total = job services';
  assert (select notes from public.invoices where id = v_inv) = 'charged at the till', 'notes stored';
  begin
    perform public.invoice_job(j.id);
    raise exception 'expected already-invoiced rejection';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.invoice_job(gen_random_uuid());
    raise exception 'expected missing-job rejection';
  exception when sqlstate 'P0002' then null; end;
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000003');
do $$
begin
  begin
    perform public.invoice_job(gen_random_uuid());
    raise exception 'expected detailer rejection';
  exception when sqlstate '42501' then null; end;
end $$;

-- Clover payments ------------------------------------------------------------
-- Uses the draft invoice for El Dorado Hills created in the double-billing block.
select pg_temp.logout();
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
do $$
declare v_inv uuid; v_total numeric; v_pay uuid; v_pay2 uuid; n int;
begin
  select id, total into v_inv, v_total from public.invoices
   where company_id = '00000000-0000-4000-8000-000000000001' and dealership_id = '00000000-0000-4000-8000-000000000101' and status = 'draft'
   order by created_at desc limit 1;
  assert v_inv is not null and v_total > 120, 'draft invoice for the clover test';

  -- The sync (service role) queues two Clover payments: 120 now, the rest later.
  insert into public.clover_payments (company_id, clover_payment_id, clover_order_id, amount, paid_at, card_brand, last4, reference)
  values ('00000000-0000-4000-8000-000000000001', 'CLV-PAY-1', 'ORD-1', 120.00, now(), 'VISA', '4242', null),
         ('00000000-0000-4000-8000-000000000001', 'CLV-PAY-2', null, v_total - 120, now(), 'MC', '1111', 'INV ref');

  -- Service role applies the first: invoice goes partial, queue row matched.
  v_pay := public.apply_clover_payment('00000000-0000-4000-8000-000000000001', 'CLV-PAY-1', v_inv, 'order');
  assert (select status from public.invoices where id = v_inv) = 'partial', 'partial after first clover payment';
  assert (select amount_paid from public.invoices where id = v_inv) = 120, 'amount_paid 120';
  assert (select status from public.clover_payments where clover_payment_id = 'CLV-PAY-1') = 'matched', 'queue row matched';
  assert (select source from public.invoice_payments where id = v_pay) = 'clover_pos', 'payment source recorded';

  -- Applying the same Clover payment again is a no-op returning the same id.
  v_pay2 := public.apply_clover_payment('00000000-0000-4000-8000-000000000001', 'CLV-PAY-1', v_inv, 'order');
  assert v_pay2 = v_pay, 'idempotent apply';
  select count(*) into n from public.invoice_payments where invoice_id = v_inv; assert n = 1, 'no duplicate payment rows';

  -- Second payment settles it.
  perform public.apply_clover_payment('00000000-0000-4000-8000-000000000001', 'CLV-PAY-2', v_inv, 'amount');
  assert (select status from public.invoices where id = v_inv) = 'paid', 'paid after second clover payment';

  -- Deleting the invoice payment sends the Clover payment back to the queue.
  delete from public.invoice_payments where id = v_pay;
  assert (select status from public.invoices where id = v_inv) = 'partial', 'partial again after unlink';
  assert (select status from public.clover_payments where clover_payment_id = 'CLV-PAY-1') = 'unmatched', 'queue row back to unmatched';

  -- Ignore / un-ignore.
  perform public.ignore_clover_payment('00000000-0000-4000-8000-000000000001', 'CLV-PAY-1', true);
  assert (select status from public.clover_payments where clover_payment_id = 'CLV-PAY-1') = 'ignored', 'ignored';
  perform public.ignore_clover_payment('00000000-0000-4000-8000-000000000001', 'CLV-PAY-1', false);
  assert (select status from public.clover_payments where clover_payment_id = 'CLV-PAY-1') = 'unmatched', 'un-ignored';
end $$;

-- Admin can see the queue and apply; detailer cannot see it at all.
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare n int; v_inv uuid;
begin
  assert public.clover_unmatched_count() = 1, 'one unmatched for the owner';
  select invoice_id into v_inv from public.clover_payments where clover_payment_id = 'CLV-PAY-2';
  perform public.apply_clover_payment('00000000-0000-4000-8000-000000000001', 'CLV-PAY-1', v_inv, 'manual');
  assert (select status from public.invoices where id = v_inv) = 'paid', 'owner matched it by hand';
  assert public.clover_unmatched_count() = 0, 'queue empty';
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000003');
do $$
declare n int;
begin
  select count(*) into n from public.clover_payments; assert n = 0, 'detailer cannot see clover payments';
  begin
    perform public.apply_clover_payment('00000000-0000-4000-8000-000000000001', 'CLV-PAY-2', gen_random_uuid(), 'manual');
    raise exception 'expected clover apply rejection';
  exception when sqlstate '42501' then null; end;
end $$;
-- Batch payments: one amount across several invoices, oldest first --------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare j public.jobs; a uuid; b uuid; c uuid; n int; v_sum numeric; v_first uuid; v_sale uuid; g uuid := gen_random_uuid();
begin
  -- three one-job invoices for Sacramento (per_job dealership), oldest first = a, b, c
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'BAT1', 'performed_at', now(),
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  a := public.invoice_job(j.id);
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'BAT2', 'performed_at', now(),
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  b := public.invoice_job(j.id);
  j := public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'BAT3', 'performed_at', now(),
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  c := public.invoice_job(j.id);
  select sum(total) into v_sum from public.invoices where id in (a, b, c);

  -- over-pay rejected
  begin
    perform * from public.record_batch_payment(array[a, b, c], v_sum + 1, 'check', '9001', 'batch');
    raise exception 'expected over-pay rejection';
  exception when sqlstate '22023' then null; end;

  -- partial: pays a in full, half of b, nothing on c
  select count(*) into n from public.record_batch_payment(array[a, b, c], (select total from public.invoices where id = a) + (select total / 2 from public.invoices where id = b), 'check', '9001', 'batch');
  assert n = 2, 'two payment rows for a partial batch, got ' || n;
  assert (select status from public.invoices where id = a) = 'paid', 'oldest paid first';
  assert (select status from public.invoices where id = b) = 'partial', 'second partial';
  assert (select status from public.invoices where id = c) = 'draft', 'third untouched';
  assert (select amount_paid from public.invoices where id = b) = (select total / 2 from public.invoices where id = b), 'half of b';

  -- the rest, tagged as a card batch; every row carries the source
  select count(*) into n from public.record_batch_payment(array[b, c], (select sum(total - amount_paid) from public.invoices where id in (b, c)), 'card', 'charge_X', 'batch', 'clover_card');
  assert n = 2, 'two rows for the remainder';
  assert (select status from public.invoices where id = b) = 'paid' and (select status from public.invoices where id = c) = 'paid', 'all paid after the second batch';
  assert (select count(*) from public.invoice_payments where invoice_id in (b, c) and source = 'clover_card') = 2, 'batch rows carry the source';

  -- nothing open → rejected
  begin
    perform * from public.record_batch_payment(array[a], 1, 'cash');
    raise exception 'expected closed-invoice rejection';
  exception when sqlstate 'P0002' then null; end;

  -- ledger rows for a group, and refunding one of them still works per invoice
  select id into v_first from public.invoice_payments where invoice_id = c order by created_at desc limit 1;
  insert into public.terminal_sales (company_id, amount, method, source, invoice_id, payment_id, group_id, clover_charge_id)
  values (public.current_company_id(), (select amount from public.invoice_payments where id = v_first), 'card', 'clover_card', c, v_first, g, 'X') returning id into v_sale;
  perform public.refund_terminal_sale(v_sale, null, (select amount from public.invoice_payments where id = v_first));
  assert (select status from public.invoices where id = c) = 'submitted' or (select status from public.invoices where id = c) = 'draft', 'c reopened after refunding its share: ' || (select status from public.invoices where id = c);
  assert (select status from public.invoices where id = b) = 'paid', 'b untouched by c refund';
  assert jsonb_array_length(public.terminal_transactions(current_date - 1, current_date + 1)) >= 2, 'group rows listed';
  assert (select count(*) from jsonb_array_elements(public.terminal_transactions(current_date - 1, current_date + 1)) e where e ->> 'group_id' = g::text) = 2, 'group id on both rows (sale + refund)';
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000003');
do $$
begin
  begin
    perform * from public.record_batch_payment(array[gen_random_uuid()], 1, 'cash');
    raise exception 'expected detailer rejection';
  exception when sqlstate '42501' then null; end;
end $$;

-- Terminal (counter sales and refunds) -------------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_before numeric; v_sale uuid; v_ref uuid; v_pay uuid; v_inv uuid; v_paid numeric; n int; tx jsonb;
begin
  select (public.dashboard_stats('2000-01-01', current_date) -> 'income' ->> 'collected')::numeric into v_before;

  -- Stand-alone cash sale counts as income; a partial refund nets it down.
  insert into public.terminal_sales (company_id, amount, method, source, description, customer_name)
  values (public.current_company_id(), 50, 'cash', 'manual', 'Counter sale', 'Walk-in') returning id into v_sale;
  assert (public.dashboard_stats('2000-01-01', current_date) -> 'income' ->> 'collected')::numeric = v_before + 50, 'counter sale adds to income';
  v_ref := public.refund_terminal_sale(v_sale, null, 20);
  assert (select status from public.terminal_sales where id = v_sale) = 'partially_refunded', 'partial refund status';
  assert (select refunded_amount from public.terminal_sales where id = v_sale) = 20, 'refunded amount';
  assert (select refund_of from public.terminal_sales where id = v_ref) = v_sale and (select kind from public.terminal_sales where id = v_ref) = 'refund', 'refund row';
  assert (public.dashboard_stats('2000-01-01', current_date) -> 'income' ->> 'collected')::numeric = v_before + 30, 'refund nets income';
  begin
    perform public.refund_terminal_sale(v_sale, null, 31);
    raise exception 'expected over-refund rejection';
  exception when sqlstate '22023' then null; end;
  perform public.refund_terminal_sale(v_sale, null, 30);
  assert (select status from public.terminal_sales where id = v_sale) = 'refunded', 'fully refunded';
  assert (public.dashboard_stats('2000-01-01', current_date) -> 'income' ->> 'collected')::numeric = v_before, 'full refund back to baseline';

  -- Refund a Clover payment that was recorded on the invoice page (no ledger row yet):
  -- partial shrinks the invoice payment, full removes it and parks the Clover row as ignored (not re-queued).
  select p.id, p.invoice_id into v_pay, v_inv from public.invoice_payments p where p.clover_payment_id = 'CLV-PAY-1';
  assert v_pay is not null, 'clover payment to refund';
  assert (select status from public.invoices where id = v_inv) = 'paid', 'invoice paid before refund';
  select amount_paid into v_paid from public.invoices where id = v_inv;
  v_ref := public.refund_terminal_sale(null, v_pay, 20);
  select id into v_sale from public.terminal_sales where payment_id = v_pay and kind = 'sale';
  assert v_sale is not null, 'ledger row backfilled for the invoice payment';
  assert (select amount from public.invoice_payments where id = v_pay) = 100, 'invoice payment shrunk by the partial refund';
  assert (select amount_paid from public.invoices where id = v_inv) = v_paid - 20, 'invoice amount_paid reduced';
  assert (select status from public.invoices where id = v_inv) = 'partial', 'invoice back to partial';
  perform public.refund_terminal_sale(v_sale, null, 100);
  select count(*) into n from public.invoice_payments where id = v_pay; assert n = 0, 'invoice payment removed on full refund';
  assert (select status from public.clover_payments where clover_payment_id = 'CLV-PAY-1') = 'ignored', 'refunded clover payment is ignored, not re-queued';
  assert public.clover_unmatched_count() = 0, 'queue still empty after refund';
  assert (select status from public.terminal_sales where id = v_sale) = 'refunded', 'linked sale fully refunded';
  -- linked sales never double count: income unchanged by the ledger rows themselves
  assert (public.dashboard_stats('2000-01-01', current_date) -> 'income' ->> 'collected')::numeric = v_before - 120, 'income reflects the refunded invoice payment once';

  -- The day list shows ledger rows and the remaining invoice payment (recorded elsewhere) together.
  tx := public.terminal_transactions(current_date - 1, current_date + 1);
  assert jsonb_array_length(tx) >= 4, 'transactions listed: ' || jsonb_array_length(tx);
  select count(*) into n from jsonb_array_elements(tx) e where e ->> 'clover_payment_id' = 'CLV-PAY-2' and e ->> 'kind' = 'sale' and (e ->> 'payment_id') is not null;
  assert n = 1, 'unlinked invoice payment appears once';
  select count(*) into n from jsonb_array_elements(tx) e where e ->> 'kind' = 'refund'; assert n >= 3, 'refund rows listed';
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000003');
do $$
declare n int;
begin
  select count(*) into n from public.terminal_sales; assert n = 0, 'detailer cannot see terminal sales';
  begin
    perform public.refund_terminal_sale(gen_random_uuid(), null, 1);
    raise exception 'expected terminal refund rejection';
  exception when sqlstate '42501' then null; end;
end $$;

-- Clover connections (OAuth tokens): invisible to app users, even admins ----
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
begin
  begin
    perform count(*) from public.clover_connections;
    raise exception 'expected clover_connections to be off limits';
  exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
insert into public.clover_connections (company_id, env, merchant_id, merchant_name, access_token_enc)
values ('00000000-0000-4000-8000-000000000001', 'sandbox', '7G9V9DP834ZY2', 'Test merchant', 'v1.enc');
update public.clover_connections set status = 'needs_reconnect', last_error = 'expired' where company_id = '00000000-0000-4000-8000-000000000001';
delete from public.clover_connections where company_id = '00000000-0000-4000-8000-000000000001';

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

-- Detailer 2 logs a car: it is an invoice at once, visible and fixable by them.
select pg_temp.login('10000000-0000-4000-8000-000000000003');
do $$
declare j public.jobs; j2 public.jobs; inv public.invoices; n int; f jsonb; v_num text; v_mine int;
begin
  j := public.create_job(jsonb_build_object('client_id', '20000000-0000-4000-8000-000000000099',
        'dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'car1', 'model', 'GLE 450', 'performed_at', now(),
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  assert j.invoice_id is not null and j.status = 'invoiced', 'car is invoiced on save';
  select * into inv from public.invoices where id = j.invoice_id;
  assert inv.id is not null, 'detailer can read the invoice for their own car (rls)';
  assert inv.status = 'draft' and inv.period_start = inv.period_end, 'one-day draft';
  assert inv.total = (select sum(price) from public.job_services where job_id = j.id), 'invoice total = the car''s services';
  select count(*) into n from public.invoice_items where invoice_id = inv.id; assert n = 1, 'detailer sees the line (rls)';
  v_num := inv.display_number;

  -- retry with the same client_id (offline sync): same car, same invoice
  j2 := public.create_job(jsonb_build_object('client_id', '20000000-0000-4000-8000-000000000099',
        'dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'ZZZ',
        'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  assert j2.id = j.id and j2.invoice_id = inv.id, 'retry keeps one invoice';
  select count(*) into n from public.invoices where id = inv.id; assert n = 1, 'no duplicate invoice';

  -- fix a typo and add a service: lines re-snapshotted, number unchanged, car locked again
  inv := public.edit_invoice_car(inv.id, jsonb_build_object('tag_number', 'car1x',
           'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'),
                                         jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000209'))));
  assert inv.display_number = v_num, 'invoice number unchanged';
  select count(*) into n from public.invoice_items where invoice_id = inv.id; assert n = 2, 'two lines after the edit';
  assert (select count(*) from public.invoice_items where invoice_id = inv.id and tag_number = 'CAR1X') = 2, 're-snapshotted tag';
  assert inv.subtotal = (select sum(price) from public.job_services where job_id = j.id) and inv.total = inv.subtotal, 'totals recomputed: ' || inv.total;
  assert (select invoice_id from public.jobs where id = j.id) = inv.id and (select status from public.jobs where id = j.id) = 'invoiced', 'car relinked and locked';
  begin
    update public.jobs set notes = 'x' where id = j.id;
    raise exception 'expected lock';
  exception when sqlstate 'P0001' then null; end;

  -- the list shows only invoices carrying my cars
  f := public.invoices_filtered();
  select count(distinct invoice_id) into v_mine from public.jobs where detailer_id = auth.uid() and invoice_id is not null and deleted_at is null;
  assert (f ->> 'count')::int = v_mine and v_mine >= 2, 'detailer list = own invoices: ' || (f ->> 'count') || ' vs ' || v_mine;
  assert (select count(*) from jsonb_array_elements(f -> 'rows') r where r ->> 'id' = inv.id::text) = 1, 'own invoice listed';
  assert (select count(*) from public.invoices) = v_mine, 'rls: detailer sees exactly the invoices with their cars';
  assert (select (r ->> 'car_count')::int from jsonb_array_elements(f -> 'rows') r where r ->> 'id' = inv.id::text) = 1, 'new rows are one car each';
  assert (select count(*) from jsonb_array_elements(f -> 'rows') r where (r ->> 'car_count')::int = 2) = 1, 'the old two-car batch invoice (C9 + A123) still lists, with both cars';

  -- not theirs to delete, and not their car to edit
  begin
    perform public.delete_invoice_car(inv.id, 'x');
    raise exception 'expected admin-only';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.edit_invoice_car((select v from t_ids where k = 'other_draft'), '{"notes":"x"}'::jsonb);
    raise exception 'expected own-car-only';
  exception when sqlstate '42501' then null; end;
  insert into t_ids values ('det_inv', inv.id);

  -- 0023: my own dashboard shows this car (logged today) and nothing about money
  assert (public.my_dashboard() -> 'today' ->> 'cars')::int >= 1, 'my dashboard: cars today';
  assert (select count(*) from jsonb_array_elements(public.my_dashboard() -> 'today_cars') e where e ->> 'invoice_id' = inv.id::text and e ->> 'tag' = 'CAR1X') = 1, 'my dashboard: my car listed';
  assert (select count(*) from jsonb_array_elements(public.my_dashboard() -> 'today' -> 'by_service') e where e ->> 'name' = 'Sold') = 1, 'my dashboard: by service';
  assert not (public.my_dashboard() ? 'unpaid_total') and not (public.my_dashboard() -> 'today' ? 'revenue'), 'my dashboard: no money';
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
  assert inv.ro_po_number = 'RO-900' and inv.payment_terms = 'Net 45' and inv.subtotal = 55.00, 'invoice carries RO/PO, dealer terms and price: ' || inv.subtotal;
  v_num := inv.display_number;

  -- move the car to another dealership: terms follow, number stays; repricing happens when services are sent
  inv := public.edit_invoice_car(inv.id, jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000101'));
  assert inv.display_number = v_num and inv.dealership_id = '00000000-0000-4000-8000-000000000101' and inv.payment_terms = 'Net 30', 'dealership change follows through';
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
  -- today, by service (DEL1 above was logged today with "Sold", then deleted; OWN1 was yesterday; ONE1/ONE2/BAT* are today with "Used")
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

-- 0024: a manager runs the day (every invoice, payments, dashboard) but cannot touch settings.
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare n int; total int; r record;
begin
  assert public.is_admin() and not public.is_owner_admin(), 'manager: admin for the day, not for settings';
  select count(*) into n from public.invoices; assert n >= 3, 'manager sees every invoice';
  select count(*) into n from public.invoice_payments; assert n >= 1, 'manager sees payments';
  assert (public.dashboard_stats() ->> 'unpaid_invoices')::int >= 1, 'manager gets the owner dashboard';
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

-- 0022: automatic receipts are opt-in.
do $$
begin
  assert (select auto_receipt from public.companies where id = '00000000-0000-4000-8000-000000000001') = false, 'auto receipts off by default';
  update public.companies set auto_receipt = true where id = '00000000-0000-4000-8000-000000000001';
  assert (select auto_receipt from public.companies where id = '00000000-0000-4000-8000-000000000001'), 'owner can turn auto receipts on';
end $$;

select pg_temp.logout();
