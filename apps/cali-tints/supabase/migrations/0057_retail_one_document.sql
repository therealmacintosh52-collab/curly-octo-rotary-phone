-- =============================================================================
-- 0057 — Retail is estimates, not jobs: one document per visit
--   * every retail visit has exactly ONE primary estimate (kind quote) that hosts
--     the whole life of the visit: estimate -> approved -> work -> invoice -> paid
--     -> closed. A check-in with no estimate, and every older retail visit, gets a
--     "shell" estimate that mirrors what is on the repair order, so each one has a
--     page. The jobs row stays as plumbing (payments, invoice number); retail
--     screens address it through the estimate and never show "job" or "RO".
--   * job_primary_estimate(job)  get-or-create the primary estimate of a visit
--   * _estimate_stage(estimate)  the stage, derived: draft, sent, in_progress,
--     ready (checked, not invoiced), unpaid, paid (waiting for pickup), closed,
--     declined, expired
--   * estimates_filtered: quotes only (supplements live inside their visit), a
--     stage filter, the stage and money on each row, counts per stage
-- Re-runnable.
-- =============================================================================

create or replace function public._patch_function(p_name text, p_marker text, p_from text, p_to text)
returns void language plpgsql as $$
declare src text;
begin
  select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = p_name;
  if src is null then raise exception 'patch: % missing', p_name; end if;
  if position(p_marker in src) > 0 then return; end if;
  if position(p_from in src) = 0 then raise exception 'patch: % anchor not found (%)', p_name, left(p_from, 60); end if;
  execute replace(src, p_from, p_to);
end $$;

-- ---------------------------------------------------------------------------
-- The stage of an estimate (and so of the whole visit)
-- ---------------------------------------------------------------------------
create or replace function public._estimate_stage(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
           when e.status = 'draft' then 'draft'
           when e.status in ('sent', 'viewed') then 'sent'
           when e.status = 'declined' then 'declined'
           when e.status = 'expired' then 'expired'
           when j.id is null then 'in_progress'
           when j.picked_up_at is not null then 'closed'
           when j.paid_at is not null then 'paid'
           when j.invoiced_at is not null then 'unpaid'
           when j.qc_at is not null then 'ready'
           else 'in_progress'
         end
    from public.estimates e left join public.jobs j on j.id = e.job_id
   where e.id = p_id
$$;
revoke execute on function public._estimate_stage(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A shell estimate for a retail visit that has none
-- ---------------------------------------------------------------------------
create or replace function public._estimate_shell_for_job(p_job uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  j public.jobs; v_retail boolean; v_num integer; v_est uuid; v_opt uuid; v_size public.vehicle_size; v_sub numeric; l record; v_line uuid; v_n integer := 0;
begin
  select * into j from public.jobs where id = p_job;
  if j.id is null or j.deleted_at is not null or j.customer_id is null then return null; end if;
  select retail into v_retail from public.dealerships where id = j.dealership_id;
  if not coalesce(v_retail, false) then return null; end if;
  select id into v_est from public.estimates where job_id = j.id and kind = 'quote' order by created_at limit 1;
  if v_est is not null then return v_est; end if;

  select coalesce(sum(price), 0) into v_sub from public.job_services where job_id = j.id;
  select size_class into v_size from public.vehicles where id = j.vehicle_id;
  update public.companies set next_estimate_number = next_estimate_number + 1 where id = j.company_id returning next_estimate_number - 1 into v_num;
  insert into public.estimates (company_id, number, display_number, customer_id, vehicle_id, size_class, status, expires_at, created_by, job_id, kind, accepted_at, applied_at, customer_concern, ro_number, subtotal, total)
  values (j.company_id, v_num, 'EST-' || lpad(v_num::text, 6, '0'), j.customer_id, j.vehicle_id, coalesce(v_size, 'sedan'), 'accepted', null, j.created_by, j.id, 'quote', coalesce(j.created_at, now()), coalesce(j.created_at, now()), j.customer_concern, j.ro_number, v_sub, v_sub)
  returning id into v_est;
  insert into public.estimate_options (company_id, estimate_id, tier, name, recommended, sort_order, subtotal, total)
  values (j.company_id, v_est, 'single', 'Quote', true, 0, v_sub, v_sub) returning id into v_opt;
  update public.estimates set selected_option_id = v_opt where id = v_est;

  perform set_config('app.bypass_lock', 'on', true);
  for l in select js.id, js.service_id, coalesce(js.label, s.name) as name, js.price from public.job_services js join public.services s on s.id = js.service_id where js.job_id = j.id order by js.created_at, js.id loop
    insert into public.estimate_lines (company_id, estimate_id, option_id, service_id, name, qty, unit_price, line_total, taxable, line_type, section, customer_approved, default_on, sort_order)
    values (j.company_id, v_est, v_opt, l.service_id, left(l.name, 120), 1, coalesce(l.price, 0), coalesce(l.price, 0), false, 'service', 'repair', true, true, v_n)
    returning id into v_line;
    update public.job_services set estimate_line_id = v_line where id = l.id and estimate_line_id is null;
    v_n := v_n + 1;
  end loop;
  perform set_config('app.bypass_lock', 'off', true);
  return v_est;
end $$;
revoke execute on function public._estimate_shell_for_job(uuid) from public, anon, authenticated;

-- The primary estimate of a retail visit (created on the spot for an older one).
create or replace function public.job_primary_estimate(p_job uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = p_job and company_id = public.current_company_id();
  if j.id is null or not (public.is_admin() or j.detailer_id = auth.uid()) then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  return public._estimate_shell_for_job(j.id);
end $$;
revoke execute on function public.job_primary_estimate(uuid) from public, anon;
grant execute on function public.job_primary_estimate(uuid) to authenticated;

-- One quote per visit (skipped, with a notice, if old data already breaks it)
do $$
begin
  if exists (select 1 from public.estimates where job_id is not null and kind = 'quote' group by job_id having count(*) > 1) then
    raise notice '0057: some job has more than one quote estimate; the uniqueness rule was not added';
  else
    create unique index if not exists estimates_one_quote_per_job on public.estimates (job_id) where kind = 'quote' and job_id is not null;
  end if;
end $$;

-- Older retail visits each get their page
do $$
declare r record;
begin
  for r in select j.id from public.jobs j join public.dealerships d on d.id = j.dealership_id
            where d.retail and j.deleted_at is null and j.customer_id is not null
              and not exists (select 1 from public.estimates e where e.job_id = j.id and e.kind = 'quote') loop
    perform public._estimate_shell_for_job(r.id);
  end loop;
end $$;

-- A car checked in with no estimate gets one at once
select public._patch_function('_appointment_create_job', '_estimate_shell_for_job',
  '  return j.id;',
  '  perform public._estimate_shell_for_job(j.id);
  return j.id;');

-- ---------------------------------------------------------------------------
-- The estimates list: quotes only, stage filter, stage and money per row, counts
-- ---------------------------------------------------------------------------
drop function if exists public.estimates_filtered(text, text, uuid, integer, integer);
create or replace function public.estimates_filtered(p_q text default null, p_status text default 'all', p_customer uuid default null, p_limit integer default 50, p_offset integer default 0, p_stage text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_money   boolean := public.can_price_jobs();
  v_q       text := nullif(trim(coalesce(p_q, '')), '');
  v_stage   text := nullif(trim(coalesce(p_stage, '')), '');
  v_out     jsonb;
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  with all_q as (
    select e.id, public._estimate_stage(e.id) as stage from public.estimates e where e.company_id = v_company and e.kind = 'quote'
  ),
  base as (
    select e.*, a.stage, c.display_name as customer_name, c.phone as customer_phone,
           (select nullif(concat_ws(' ', v.year::text, v.make, v.model), '') from public.vehicles v where v.id = e.vehicle_id) as vehicle_name
    from public.estimates e
    join all_q a on a.id = e.id
    join public.customers c on c.id = e.customer_id
    where (case coalesce(p_status, 'all')
             when 'all' then true
             when 'open' then e.status in ('draft', 'sent', 'viewed')
             else e.status = p_status end)
      and (v_stage is null
           or (v_stage = 'open' and a.stage not in ('closed', 'declined', 'expired'))
           or a.stage = v_stage)
      and (p_customer is null or e.customer_id = p_customer)
      and (v_q is null
           or e.display_number ilike '%' || v_q || '%'
           or c.display_name ilike '%' || v_q || '%'
           or (public.phone_digits(v_q) is not null and length(public.phone_digits(v_q)) >= 3 and c.phone_digits like '%' || public.phone_digits(v_q) || '%')
           or exists (select 1 from public.vehicles v where v.id = e.vehicle_id and concat_ws(' ', v.year::text, v.make, v.model) ilike '%' || v_q || '%'))
  ),
  pagen as (
    select * from base order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'count', (select count(*) from base),
    'counts', (select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb) from (select stage, count(*) as n from all_q group by stage) s),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
               'id', b.id, 'display_number', b.display_number, 'status', b.status, 'stage', b.stage, 'created_at', b.created_at, 'expires_at', b.expires_at,
               'sent_at', b.sent_at, 'last_viewed_at', b.last_viewed_at, 'accepted_at', b.accepted_at, 'job_id', b.job_id,
               'customer_id', b.customer_id, 'vehicle_id', b.vehicle_id, 'customer', b.customer_name, 'vehicle', b.vehicle_name, 'size_class', b.size_class,
               'concern', b.customer_concern,
               'invoice_number', (select j.retail_invoice_number from public.jobs j where j.id = b.job_id),
               'invoiced_at', (select j.invoiced_at from public.jobs j where j.id = b.job_id),
               'paid_at', (select j.paid_at from public.jobs j where j.id = b.job_id),
               'picked_up_at', (select j.picked_up_at from public.jobs j where j.id = b.job_id),
               'waiting_supplement', exists (select 1 from public.estimates s where s.job_id = b.job_id and b.job_id is not null and s.kind = 'supplement' and s.status in ('sent', 'viewed')),
               'advisor', public._initials((select p.full_name from public.profiles p where p.id = b.created_by)),
               'tech', public._initials((select p.full_name from public.profiles p join public.jobs j on j.detailer_id = p.id where j.id = b.job_id)),
               'options', (select count(*) from public.estimate_options o where o.estimate_id = b.id),
               'total', case when v_money then b.total end,
               'balance', case when v_money and b.job_id is not null then (select m.balance from public._job_money(b.job_id) m) end
             ) order by b.created_at desc), '[]'::jsonb) from pagen b)
  ) into v_out;
  return v_out;
end $$;
revoke execute on function public.estimates_filtered(text, text, uuid, integer, integer, text) from public, anon;
grant execute on function public.estimates_filtered(text, text, uuid, integer, integer, text) to authenticated;

-- The estimate screen reads where the visit stands, and a supplement finds its parent
select public._patch_function('_estimate_json', 'primary_estimate_id',
  '''invoiced_at'', j.invoiced_at,',
  '''invoiced_at'', j.invoiced_at, ''picked_up_at'', j.picked_up_at, ''completed_at'', j.completed_at, ''qc_at'', j.qc_at,
                                      ''primary_estimate_id'', (select q.id from public.estimates q where q.job_id = j.id and q.kind = ''quote'' order by q.created_at limit 1),');

-- The customer page lists their estimates by stage (the visit's quote, never its extra-work supplements)
select public._patch_function('customer_timeline', 'invoice_number',
  '''total'', case when v_money then es.total end, ''job_id'', es.job_id',
  '''total'', case when v_money then es.total end, ''job_id'', es.job_id, ''stage'', public._estimate_stage(es.id),
               ''invoice_number'', (select j2.retail_invoice_number from public.jobs j2 where j2.id = es.job_id)');
select public._patch_function('customer_timeline', 'es.kind = ''quote''',
  'from public.estimates es where es.customer_id = v_c.id)',
  'from public.estimates es where es.customer_id = v_c.id and es.kind = ''quote'')');

-- The invoice document names the estimate it grew from (small, beside the invoice number)
select public._patch_function('_receipt_json', 'estimate_number',
  '''ro_number'', j.ro_number,',
  '''ro_number'', j.ro_number, ''estimate_number'', (select q.display_number from public.estimates q where q.job_id = j.id and q.kind = ''quote'' order by q.created_at limit 1),');

-- Retail speaks of estimates and invoices, never repair orders or jobs: the messages a screen can show
select public._patch_function('_convert_estimate_core', 'That estimate is closed to changes', 'That repair order is closed', 'That estimate is closed to changes');
select public._patch_function('add_finding_lines', 'There is no open estimate for this finding', 'There is no open estimate or repair order for this finding', 'There is no open estimate for this finding');
select public._patch_function('check_in_appointment', 'The estimate was not opened', 'The repair order was not opened', 'The estimate was not opened');
select public._patch_function('close_ro', 'This estimate is already closed', 'This job is already closed', 'This estimate is already closed');
select public._patch_function('close_ro', 'Not a retail estimate', 'Not a retail repair order', 'Not a retail estimate');
select public._patch_function('close_ro', 'This estimate is deleted', 'This job is deleted', 'This estimate is deleted');
select public._patch_function('complete_ro_work', 'Some items are not approved yet; get the approval first', 'Some work on this RO is not authorized yet; get the approval first', 'Some items are not approved yet; get the approval first');
select public._patch_function('complete_ro_work', 'Not a retail estimate', 'Not a retail repair order', 'Not a retail estimate');
select public._patch_function('complete_ro_work', 'This estimate is closed to changes', 'This repair order is closed to changes', 'This estimate is closed to changes');
select public._patch_function('convert_ro_to_invoice', 'Only the owner, an admin or an advisor makes the invoice', 'Only the owner, an admin or an advisor converts a repair order to an invoice', 'Only the owner, an admin or an advisor makes the invoice');
select public._patch_function('convert_ro_to_invoice', 'The estimate no longer matches what was approved; review the lines', 'The RO no longer matches what was approved; review the lines', 'The estimate no longer matches what was approved; review the lines');
select public._patch_function('convert_ro_to_invoice', 'There is nothing approved on this estimate', 'There is no approved work on this repair order', 'There is nothing approved on this estimate');
select public._patch_function('convert_ro_to_invoice', 'That estimate was deleted', 'That repair order was deleted', 'That estimate was deleted');
select public._patch_function('convert_ro_to_invoice', 'Not a retail estimate', 'Not a retail repair order', 'Not a retail estimate');
select public._patch_function('job_receipt', 'Not found', 'Job not found', 'Not found');
select public._patch_function('quality_check_ro', 'This estimate is closed to changes', 'This repair order is closed to changes', 'This estimate is closed to changes');
select public._patch_function('record_retail_payment', 'Not found', 'Job not found', 'Not found');
select public._patch_function('record_retail_payment', 'Make the invoice first', 'Convert the repair order to an invoice first', 'Make the invoice first');
select public._patch_function('retail_charge', 'This estimate is deleted', 'This job is deleted', 'This estimate is deleted');
select public._patch_function('retail_charge', 'Not found', 'Job not found', 'Not found');
select public._patch_function('sign_receipt', 'Not found', 'Job not found', 'Not found');

-- The seeded rule names too (only the shipped ones that still carry the old wording)
update public.automation_rules set name = 'Receipt after an invoice is paid' where key = 'payment_receipt' and name = 'Receipt after a paid job';

drop function public._patch_function(text, text, text, text);
