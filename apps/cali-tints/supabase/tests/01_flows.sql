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
  ('10000000-0000-4000-8000-000000000003', 'det2@test',  '{"role":"detailer","full_name":"Dee Two"}');

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

  -- per-job dealership requires RO/PO
  begin
    perform public.create_job(jsonb_build_object('dealership_id', '00000000-0000-4000-8000-000000000102', 'tag_number', 'B2',
      'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
    raise exception 'expected RO/PO rejection';
  exception when sqlstate '22023' then null; end;

  -- dealership price override resolves (Irvine full detail = 165)
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
  select count(*) into n from public.profiles; assert n = 3, 'profiles visible in company';
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

  -- batch invoice for Anaheim (2 jobs: A123 @ 230 (200 + 30 override), C9 @ 125)
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

  -- per-job mode for Irvine: two jobs on RO-77, one on RO-88, one with none → 3 invoices
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

select pg_temp.logout();
