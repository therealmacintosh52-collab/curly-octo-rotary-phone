-- =============================================================================
-- 0055 — Finish the work, check it, invoice it, follow up on what was declined
--   * the tech writes CAUSE and CORRECTION per job and the MILEAGE OUT
--     (complete_ro_work); a second pair of eyes signs the QUALITY CHECK
--     (quality_check_ro); only then can the advisor Convert to invoice, and the
--     conversion is reviewed against what was approved (ro_invoice_review)
--   * parts_disposition: replaced parts offered / returned / declined
--   * companies.bar_license and retail_settings.warranty_text print on the invoice
--   * paying in full closes the RO (jobs.closed_at, event ro.closed when work was
--     declined); QC emits ro.ready; two rules + two templates ride on them
--   * _receipt_json carries everything the invoice document shows: jobs with
--     their lines, cause and correction, declined / recommended, category totals,
--     the authorization log, mileage in and out, advisor and tech initials
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

alter table public.estimate_jobs add column if not exists cause text;
alter table public.estimate_jobs add column if not exists correction text;
alter table public.estimate_jobs add column if not exists done_at timestamptz;
grant select (cause, correction, done_at) on public.estimate_jobs to authenticated;

alter table public.jobs add column if not exists odometer_out integer;
alter table public.jobs add column if not exists completed_at timestamptz;
alter table public.jobs add column if not exists qc_at timestamptz;
alter table public.jobs add column if not exists qc_by uuid references public.profiles (id);
alter table public.jobs add column if not exists qc_note text;
alter table public.jobs add column if not exists parts_disposition text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_parts_disposition_check') then
    alter table public.jobs add constraint jobs_parts_disposition_check check (parts_disposition is null or parts_disposition in ('offered', 'returned', 'declined'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_odometer_out_check') then
    alter table public.jobs add constraint jobs_odometer_out_check check (odometer_out is null or odometer_out between 0 and 2000000);
  end if;
end $$;

alter table public.companies add column if not exists bar_license text;
alter table public.retail_settings add column if not exists warranty_text text;

-- Retail repair orders already invoiced were finished by definition
do $$
begin
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs set completed_at = coalesce(completed_at, invoiced_at), qc_at = coalesce(qc_at, invoiced_at) where invoiced_at is not null and (completed_at is null or qc_at is null);
  perform set_config('app.bypass_lock', 'off', true);
end $$;

create or replace function public._initials(p_name text)
returns text language sql immutable as $$
  select nullif(upper(left(split_part(trim(coalesce(p_name, '')), ' ', 1), 1) || left(split_part(trim(coalesce(p_name, '')), ' ', 2), 1)), '')
$$;

-- ---------------------------------------------------------------------------
-- Complete the work (the tech on their own RO, or an admin / advisor / manager)
--   p: {odometer_out, parts_disposition?, jobs: [{id, cause, correction}]}
-- ---------------------------------------------------------------------------
create or replace function public.complete_ro_work(p_job uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  j        public.jobs;
  v_retail boolean;
  v_in     integer;
  v_out    integer := nullif(regexp_replace(coalesce(p ->> 'odometer_out', ''), '[^0-9]', '', 'g'), '')::integer;
  v_disp   text := nullif(p ->> 'parts_disposition', '');
  r        record;
  v_item   jsonb;
  v_cause  text;
  v_corr   text;
begin
  select * into j from public.jobs where id = p_job and company_id = public.current_company_id();
  if j.id is null or not (public.is_admin() or j.detailer_id = auth.uid()) then
    raise exception 'Repair order not found' using errcode = 'P0002';
  end if;
  select retail into v_retail from public.dealerships where id = j.dealership_id;
  if not coalesce(v_retail, false) then raise exception 'Not a retail repair order' using errcode = 'P0001'; end if;
  if j.deleted_at is not null or j.invoiced_at is not null then raise exception 'This repair order is closed to changes' using errcode = 'P0001'; end if;
  if public._ro_unauthorized_count(j.id) > 0 then
    raise exception 'Some work on this RO is not authorized yet; get the approval first' using errcode = 'P0001';
  end if;
  if v_out is null then raise exception 'Enter the mileage out' using errcode = '22023'; end if;
  select reading into v_in from public.odometer_readings where job_id = j.id order by read_at limit 1;
  if v_in is not null and v_out < v_in then raise exception 'Mileage out (%) cannot be lower than mileage in (%)', v_out, v_in using errcode = '22023'; end if;
  if v_disp is not null and v_disp not in ('offered', 'returned', 'declined') then raise exception 'Replaced parts: offered, returned or declined' using errcode = '22023'; end if;

  -- cause and correction for every job that is on this RO
  for r in select distinct ej.id, ej.title, ej.cause, ej.correction from public.job_services js join public.estimate_jobs ej on ej.id = js.estimate_job_id where js.job_id = j.id loop
    select x into v_item from jsonb_array_elements(coalesce(p -> 'jobs', '[]'::jsonb)) x where x ->> 'id' = r.id::text limit 1;
    v_cause := coalesce(nullif(trim(coalesce(v_item ->> 'cause', '')), ''), r.cause);
    v_corr := coalesce(nullif(trim(coalesce(v_item ->> 'correction', '')), ''), r.correction);
    if v_cause is null or v_corr is null then
      raise exception 'Say what caused it and what was done for "%"', r.title using errcode = '22023';
    end if;
    update public.estimate_jobs set cause = left(v_cause, 600), correction = left(v_corr, 600), status = 'done', done_at = now() where id = r.id;
  end loop;

  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs set odometer_out = v_out, parts_disposition = coalesce(v_disp, parts_disposition), completed_at = now(), qc_at = null, qc_by = null, qc_note = null, updated_at = now() where id = j.id returning * into j;
  perform set_config('app.bypass_lock', 'off', true);
  -- the car's own mileage moves on (no job on the reading: "mileage in" stays the reading taken at check-in)
  if j.vehicle_id is not null then
    insert into public.odometer_readings (company_id, vehicle_id, reading, read_at, job_id, created_by)
    select j.company_id, j.vehicle_id, v_out, clock_timestamp(), null, auth.uid()
    where not exists (select 1 from public.odometer_readings o where o.vehicle_id = j.vehicle_id and o.reading = v_out and o.job_id is null and o.read_at > now() - interval '1 day');
  end if;
  return jsonb_build_object('job_id', j.id, 'completed_at', j.completed_at, 'odometer_out', j.odometer_out);
end $$;
revoke execute on function public.complete_ro_work(uuid, jsonb) from public, anon;
grant execute on function public.complete_ro_work(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- The quality check: a second person (when there is one) signs off the finished work
-- ---------------------------------------------------------------------------
create or replace function public.quality_check_ro(p_job uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare j public.jobs; v_staff integer;
begin
  if not public.is_admin() then
    raise exception 'Only the owner, an admin, an advisor or a manager signs off the work' using errcode = '42501';
  end if;
  select * into j from public.jobs where id = p_job and company_id = public.current_company_id();
  if j.id is null then raise exception 'Repair order not found' using errcode = 'P0002'; end if;
  if j.completed_at is null then raise exception 'The tech finishes the work first' using errcode = 'P0001'; end if;
  if j.invoiced_at is not null or j.deleted_at is not null then raise exception 'This repair order is closed to changes' using errcode = 'P0001'; end if;
  select count(*) into v_staff from public.profiles where company_id = j.company_id and active and role::text in ('owner', 'admin', 'advisor', 'manager');
  if j.detailer_id = auth.uid() and v_staff > 1 then
    raise exception 'A second person checks the work; ask the advisor or the owner' using errcode = '42501';
  end if;
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs set qc_at = now(), qc_by = auth.uid(), qc_note = nullif(left(trim(coalesce(p_note, '')), 500), ''), updated_at = now() where id = j.id returning * into j;
  perform set_config('app.bypass_lock', 'off', true);
  perform public._emit(j.company_id, 'ro.ready', 'job', j.id, j.customer_id);
  return jsonb_build_object('job_id', j.id, 'qc_at', j.qc_at);
end $$;
revoke execute on function public.quality_check_ro(uuid, text) from public, anon;
grant execute on function public.quality_check_ro(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The review before an RO becomes an invoice: what was approved against what is on the RO
-- ---------------------------------------------------------------------------
create or replace function public.ro_invoice_review(p_job uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare j public.jobs; v_ro numeric; v_linked numeric; v_approved numeric; v_mismatch integer; v_undone integer; v_bad integer;
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor reviews an invoice' using errcode = '42501'; end if;
  select * into j from public.jobs where id = p_job and company_id = public.current_company_id();
  if j.id is null then raise exception 'Repair order not found' using errcode = 'P0002'; end if;
  select coalesce(sum(price), 0) into v_ro from public.job_services where job_id = j.id;
  select coalesce(sum(js.price), 0), coalesce(sum(el.line_total), 0), count(*) filter (where js.price is distinct from el.line_total)
    into v_linked, v_approved, v_mismatch
    from public.job_services js join public.estimate_lines el on el.id = js.estimate_line_id where js.job_id = j.id;
  select count(distinct ej.id) into v_undone from public.job_services js join public.estimate_jobs ej on ej.id = js.estimate_job_id where js.job_id = j.id and ej.status <> 'done';
  v_bad := public._ro_unauthorized_count(j.id);
  return jsonb_build_object(
    'lines', (select count(*) from public.job_services where job_id = j.id),
    'ro_total', v_ro, 'approved_total', v_approved, 'linked_total', v_linked,
    'matches', v_mismatch = 0,
    'unauthorized', v_bad, 'jobs_not_done', v_undone,
    'completed', j.completed_at is not null, 'qc', j.qc_at is not null, 'odometer_out', j.odometer_out,
    'ready', v_mismatch = 0 and v_bad = 0 and v_undone = 0 and j.completed_at is not null and j.qc_at is not null);
end $$;
revoke execute on function public.ro_invoice_review(uuid) from public, anon;
grant execute on function public.ro_invoice_review(uuid) to authenticated;

-- The conversion needs the finished, checked work
do $$
begin
  perform public._patch_function('convert_ro_to_invoice', 'Finish the work first',
    '  perform set_config(''app.bypass_lock'', ''on'', true);
  update public.jobs
     set retail_invoice_number',
    '  if j.completed_at is null then
    raise exception ''Finish the work first: mileage out and the cause and correction'' using errcode = ''P0001'';
  end if;
  if j.qc_at is null then
    raise exception ''The quality check comes before the invoice'' using errcode = ''P0001'';
  end if;
  if exists (select 1 from public.job_services js join public.estimate_lines el on el.id = js.estimate_line_id where js.job_id = j.id and js.price is distinct from el.line_total) then
    raise exception ''The RO no longer matches what was approved; review the lines'' using errcode = ''P0001'';
  end if;
  perform set_config(''app.bypass_lock'', ''on'', true);
  update public.jobs
     set retail_invoice_number');
  -- paying in full closes the RO; declined work is what the follow-up is about
  perform public._patch_function('record_retail_payment', 'closed_at = now()',
    'set paid_at = now(), paid_amount',
    'set paid_at = now(), closed_at = now(), paid_amount');
  perform public._patch_function('record_retail_payment', 'ro.closed',
    '  perform public._emit(j.company_id, ''job.paid'', ''job'',',
    '  if exists (select 1 from public.estimate_jobs ej join public.estimates es on es.id = ej.estimate_id where es.job_id = j.id and ej.status = ''declined'') then
    perform public._emit(j.company_id, ''ro.closed'', ''job'', j.id, j.customer_id);
  end if;
  perform public._emit(j.company_id, ''job.paid'', ''job'',');
end $$;

-- ---------------------------------------------------------------------------
-- Everything the invoice document shows (customer's page, the PDF, the staff page)
-- ---------------------------------------------------------------------------
do $$
begin
  perform public._patch_function('_receipt_json', '''categories''',
    '''signed_name'', j.receipt_signed_name,',
    '''jobs'', (select coalesce(jsonb_agg(jsonb_build_object(''id'', g.id, ''title'', g.title, ''kind'', g.kind, ''priority'', g.priority, ''status'', g.status, ''cause'', g.cause, ''correction'', g.correction, ''total'', g.total, ''lines'', g.lines) order by g.k, g.p, g.so), ''[]''::jsonb)
              from (select ej.id, ej.title, ej.kind, ej.priority, ej.status, ej.cause, ej.correction, ej.sort_order as so,
                           case ej.kind when ''diagnosis'' then 0 else 1 end as k, case ej.priority when ''safety'' then 0 when ''soon'' then 1 else 2 end as p,
                           sum(js.price) as total,
                           jsonb_agg(jsonb_build_object(''name'', coalesce(js.label, s.name), ''type'', coalesce(el.line_type, s.line_kind, ''service''), ''qty'', el.qty, ''hours'', el.hours, ''rate'', el.rate, ''part_number'', el.part_number, ''total'', js.price) order by el.sort_order nulls last, js.id) as lines
                    from public.job_services js join public.estimate_jobs ej on ej.id = js.estimate_job_id
                         left join public.estimate_lines el on el.id = js.estimate_line_id left join public.services s on s.id = js.service_id
                    where js.job_id = j.id group by ej.id) g),
    ''extras'', (select coalesce(jsonb_agg(jsonb_build_object(''name'', coalesce(js.label, s.name), ''type'', coalesce(s.line_kind, ''service''), ''total'', js.price) order by js.id), ''[]''::jsonb)
               from public.job_services js left join public.services s on s.id = js.service_id where js.job_id = j.id and js.estimate_job_id is null),
    ''declined'', (select coalesce(jsonb_agg(jsonb_build_object(''title'', ej.title, ''priority'', ej.priority, ''total'', (select sum(el.line_total) from public.estimate_lines el where el.estimate_job_id = ej.id)) order by case ej.priority when ''safety'' then 0 when ''soon'' then 1 else 2 end, ej.sort_order), ''[]''::jsonb)
                 from public.estimate_jobs ej join public.estimates es on es.id = ej.estimate_id where es.job_id = j.id and ej.status = ''declined''),
    ''recommended'', (select coalesce(jsonb_agg(jsonb_build_object(''title'', f.title, ''severity'', f.severity, ''recommendation'', f.recommendation) order by f.created_at), ''[]''::jsonb)
                    from public.job_findings f where f.job_id = j.id and f.kind = ''finding'' and f.status in (''open'', ''declined'') and f.customer_visible and f.estimate_line_id is null),
    ''categories'', (select jsonb_build_object(
                      ''labor'', coalesce(sum(c.price) filter (where c.t = ''labor''), 0), ''parts'', coalesce(sum(c.price) filter (where c.t = ''part''), 0),
                      ''fees'', coalesce(sum(c.price) filter (where c.t in (''fee'', ''shop_supplies'')), 0), ''sublets'', coalesce(sum(c.price) filter (where c.t = ''sublet''), 0),
                      ''services'', coalesce(sum(c.price) filter (where c.t = ''service''), 0))
                   from (select js.price, coalesce(el.line_type, s.line_kind, ''service'') as t from public.job_services js left join public.estimate_lines el on el.id = js.estimate_line_id left join public.services s on s.id = js.service_id where js.job_id = j.id) c),
    ''taxable_types'', (select coalesce(jsonb_agg(distinct el.line_type), ''[]''::jsonb) from public.job_services js join public.estimate_lines el on el.id = js.estimate_line_id where js.job_id = j.id and el.taxable),
    ''authorizations'', (select coalesce(jsonb_agg(jsonb_build_object(''kind'', a.kind, ''method'', a.method, ''authorized_at'', a.authorized_at, ''name'', a.name, ''amount'', a.amount) order by a.authorized_at), ''[]''::jsonb) from public.job_authorizations a where a.job_id = j.id),
    ''odometer_out'', j.odometer_out, ''parts_disposition'', j.parts_disposition, ''completed_at'', j.completed_at,
    ''advisor'', (select public._initials(pr.full_name) from public.profiles pr where pr.id = j.advisor_id),
    ''tech'', (select public._initials(pr.full_name) from public.profiles pr where pr.id = j.detailer_id),
    ''bar_license'', (select c.bar_license from public.companies c where c.id = j.company_id),
    ''warranty_text'', (select rs.warranty_text from public.retail_settings rs where rs.company_id = j.company_id),
    ''signed_name'', j.receipt_signed_name,');
  -- the car's VIN on the staff copy (the customer's public link never carries it, like the plate)
  perform public._patch_function('_receipt_json', '''vin'', case',
    '''plate'', case when p_public then null else (select v.plate from public.vehicles v where v.id = j.vehicle_id) end,',
    '''plate'', case when p_public then null else (select v.plate from public.vehicles v where v.id = j.vehicle_id) end,
    ''vin'', case when p_public then null else (select v.vin from public.vehicles v where v.id = j.vehicle_id) end,');
end $$;

-- ---------------------------------------------------------------------------
-- Rules: tell the customer when the car is ready; remind them about declined work
-- ---------------------------------------------------------------------------
create or replace function public._seed_ro_rules(p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.automation_rules (company_id, key, name, event_kind, delay_minutes, condition, action, system, sort_order)
  values
    (p_company, 'ro_ready', 'Tell them the car is ready', 'ro.ready', 0, '{"needs_email":true}'::jsonb, '{"kind":"both","template":"status_ready"}'::jsonb, true, 110),
    (p_company, 'declined_followup', 'Remind them about work they declined', 'ro.closed', 20160, '{"needs_email":true}'::jsonb, '{"kind":"both","template":"declined_work"}'::jsonb, true, 120)
  on conflict (company_id, key) do nothing;
end $$;
revoke execute on function public._seed_ro_rules(uuid) from public, anon, authenticated;
do $$
declare c record;
begin
  for c in select id from public.companies loop perform public._seed_ro_rules(c.id); end loop;
  perform public._patch_function('seed_automation_defaults', '_seed_ro_rules',
    '    on conflict (company_id, key) do nothing;
  end loop;
end',
    '    on conflict (company_id, key) do nothing;
  end loop;
  perform public._seed_ro_rules(p_company);
end');
end $$;

-- The job subject carries the declined work, in words
select public._patch_function('_run_subject', 'declined_list',
  '''receipt_token'', public._receipt_token(j.id),',
  '''receipt_token'', public._receipt_token(j.id),
                                                ''declined_list'', (select string_agg(ej.title || coalesce('' ($'' || (select to_char(sum(el.line_total), ''FM999990.00'') from public.estimate_lines el where el.estimate_job_id = ej.id) || '')'', ''''), E''\n'' order by ej.sort_order)
                                                                    from public.estimate_jobs ej join public.estimates es on es.id = ej.estimate_id where es.job_id = j.id and ej.status = ''declined''),');

drop function public._patch_function(text, text, text, text);
