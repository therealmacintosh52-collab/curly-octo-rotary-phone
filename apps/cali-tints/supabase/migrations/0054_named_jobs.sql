-- =============================================================================
-- 0054 — Named jobs on an estimate
--   An estimate is a list of JOBS (brakes, A/C, oil change), each with its own
--   labor, parts and fees, a priority (safety → due soon → optional), and a
--   status (recommended → approved | declined → done). Diagnosis stays the
--   first job. The customer approves or declines a job; its lines follow.
--   Declined jobs stay on the record with their prices (and their findings stay
--   open on the car). The same job rides from the estimate onto the repair
--   order and the invoice (job_services.estimate_job_id).
--   * estimate_jobs; estimate_lines.estimate_job_id; job_services.estimate_job_id
--   * _estimate_apply takes options[].jobs [{key,title,kind,priority}] and
--     lines[].job (a key); a line with no job lands in a default Diagnosis /
--     Repairs job, so every older caller keeps working
--   * _estimate_json carries each option's jobs (customer order) and each line's job
--   * accepting / declining an estimate settles its jobs' statuses
--   * add_finding_lines makes one job per finding (priority from its severity)
--   * existing estimates are backfilled into a Diagnosis and a Repairs job
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

create table if not exists public.estimate_jobs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  option_id   uuid not null references public.estimate_options (id) on delete cascade,
  title       text not null check (length(title) between 1 and 80),
  kind        text not null default 'repair' check (kind in ('diagnosis', 'repair')),
  priority    text not null default 'soon' check (priority in ('safety', 'soon', 'optional')),
  status      text not null default 'recommended' check (status in ('recommended', 'approved', 'declined', 'done')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists estimate_jobs_estimate_idx on public.estimate_jobs (estimate_id, option_id, sort_order);

alter table public.estimate_lines add column if not exists estimate_job_id uuid references public.estimate_jobs (id) on delete set null;
create index if not exists estimate_lines_job_idx on public.estimate_lines (estimate_job_id) where estimate_job_id is not null;
alter table public.job_services add column if not exists estimate_job_id uuid references public.estimate_jobs (id) on delete set null;
grant select (estimate_job_id) on public.job_services to authenticated;

alter table public.estimate_jobs enable row level security;
drop policy if exists estimate_jobs_select on public.estimate_jobs;
create policy estimate_jobs_select on public.estimate_jobs for select to authenticated using (company_id = public.current_company_id());
revoke all on public.estimate_jobs from authenticated, anon;
grant select (id, company_id, estimate_id, option_id, title, kind, priority, status, sort_order, created_at) on public.estimate_jobs to authenticated;
grant select (estimate_job_id) on public.estimate_lines to authenticated;
drop trigger if exists audit on public.estimate_jobs;
create trigger audit after insert or update or delete on public.estimate_jobs for each row execute function public.tg_audit();

-- ---------------------------------------------------------------------------
-- Backfill: every option with lines gets a Diagnosis job (if it has diagnosis lines) and a Repairs job
-- ---------------------------------------------------------------------------
do $$
declare r record; v_job uuid;
begin
  for r in select distinct l.estimate_id, l.option_id, l.company_id, l.section from public.estimate_lines l
           where l.option_id is not null and l.estimate_job_id is null loop
    select id into v_job from public.estimate_jobs where option_id = r.option_id and kind = (case when r.section = 'diagnosis' then 'diagnosis' else 'repair' end) order by sort_order limit 1;
    if v_job is null then
      insert into public.estimate_jobs (company_id, estimate_id, option_id, title, kind, priority, sort_order)
      values (r.company_id, r.estimate_id, r.option_id, case when r.section = 'diagnosis' then 'Diagnosis' else 'Repairs' end, case when r.section = 'diagnosis' then 'diagnosis' else 'repair' end, 'soon', case when r.section = 'diagnosis' then 1 else 2 end)
      returning id into v_job;
    end if;
    update public.estimate_lines set estimate_job_id = v_job where option_id = r.option_id and estimate_job_id is null and (case when section = 'diagnosis' then 'diagnosis' else 'repair' end) = (case when r.section = 'diagnosis' then 'diagnosis' else 'repair' end);
  end loop;
  -- statuses from the answers already given
  update public.estimate_jobs j set status = 'approved'
   where j.status = 'recommended'
     and exists (select 1 from public.estimates e where e.id = j.estimate_id and e.status = 'accepted' and (e.selected_option_id = j.option_id or e.selected_option_id is null))
     and exists (select 1 from public.estimate_lines l where l.estimate_job_id = j.id and l.customer_approved is not false);
  update public.estimate_jobs j set status = 'declined'
   where j.status = 'recommended' and exists (select 1 from public.estimates e where e.id = j.estimate_id and e.status in ('declined', 'expired'));
end $$;

-- The statuses of an estimate's jobs, from the answer the customer (or staff) gave
create or replace function public._estimate_jobs_sync(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.estimates;
begin
  select * into e from public.estimates where id = p_id;
  if e.status = 'accepted' then
    update public.estimate_jobs j set status = case when exists (
        select 1 from public.estimate_lines l where l.estimate_job_id = j.id and ((l.option_id = e.selected_option_id and l.customer_approved is not false) or (l.option_id is null and l.customer_approved is true))
      ) then 'approved' else 'declined' end
     where j.estimate_id = p_id and j.status in ('recommended', 'approved', 'declined') and (j.option_id = e.selected_option_id or e.selected_option_id is null);
  elsif e.status in ('declined', 'expired') then
    update public.estimate_jobs set status = 'declined' where estimate_id = p_id and status = 'recommended';
  end if;
end $$;
revoke execute on function public._estimate_jobs_sync(uuid) from public, anon, authenticated;

create or replace function public.tg_estimate_jobs_sync() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._estimate_jobs_sync(new.id);
  return new;
end $$;
drop trigger if exists estimates_jobs_sync on public.estimates;
create trigger estimates_jobs_sync after update of status on public.estimates for each row when (new.status in ('accepted', 'declined', 'expired') and old.status is distinct from new.status) execute function public.tg_estimate_jobs_sync();

-- ---------------------------------------------------------------------------
-- _estimate_apply: lines belong to named jobs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._estimate_apply(p_id uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e        public.estimates;
  v_opt    jsonb;
  v_line   jsonb;
  v_optid  uuid;
  v_lineid uuid;
  v_ql     jsonb;
  v_t      jsonb;
  v_i      integer := 0;
  v_j      integer;
  v_jspec  jsonb;
  v_jobmap jsonb;
  v_jobid  uuid;
  v_key    text;
  v_k      integer;
begin
  select * into e from public.estimates where id = p_id;
  if jsonb_array_length(coalesce(p -> 'options', '[]'::jsonb)) = 0 then
    raise exception 'An estimate needs at least one option' using errcode = '22023';
  end if;
  update public.estimates set selected_option_id = null where id = p_id;
  delete from public.estimate_lines where estimate_id = p_id;
  delete from public.estimate_jobs where estimate_id = p_id;
  delete from public.estimate_options where estimate_id = p_id;

  for v_opt in select * from jsonb_array_elements(p -> 'options') loop
    v_i := v_i + 1;
    -- a blank draft is fine (nothing itemized yet); send_estimate refuses to send it
    insert into public.estimate_options (company_id, estimate_id, tier, name, description, recommended, sort_order)
    values (e.company_id, p_id, coalesce(nullif(v_opt ->> 'tier', ''), 'single'), coalesce(nullif(left(trim(v_opt ->> 'name'), 60), ''), 'Option ' || v_i),
            nullif(left(trim(coalesce(v_opt ->> 'description', '')), 300), ''), coalesce((v_opt ->> 'recommended')::boolean, false), v_i)
    returning id into v_optid;
    -- named jobs (0054): {key, title, kind, priority}; lines point at them by key; a line with no job lands in a default Diagnosis / Repairs job
    v_jobmap := '{}'::jsonb;
    v_k := 0;
    for v_jspec in select * from jsonb_array_elements(coalesce(v_opt -> 'jobs', '[]'::jsonb)) loop
      v_k := v_k + 1;
      insert into public.estimate_jobs (company_id, estimate_id, option_id, title, kind, priority, sort_order)
      values (e.company_id, p_id, v_optid, coalesce(nullif(left(trim(coalesce(v_jspec ->> 'title', '')), 80), ''), 'Job ' || v_k),
              case when v_jspec ->> 'kind' = 'diagnosis' then 'diagnosis' else 'repair' end,
              case when v_jspec ->> 'priority' in ('safety', 'soon', 'optional') then v_jspec ->> 'priority' else 'soon' end, v_k)
      returning id into v_jobid;
      v_jobmap := v_jobmap || jsonb_build_object(coalesce(nullif(v_jspec ->> 'key', ''), 'job' || v_k), v_jobid);
    end loop;
    v_j := 0;
    for v_line in select * from jsonb_array_elements(v_opt -> 'lines') loop
      v_j := v_j + 1;
      v_ql := public._estimate_price_line(e.company_id, e.size_class, v_line);
      v_key := coalesce(nullif(v_line ->> 'job', ''), case when v_line ->> 'section' = 'diagnosis' then '_diagnosis' else '_repairs' end);
      if not (v_jobmap ? v_key) then
        v_k := v_k + 1;
        insert into public.estimate_jobs (company_id, estimate_id, option_id, title, kind, priority, sort_order)
        values (e.company_id, p_id, v_optid, case when v_key = '_diagnosis' then 'Diagnosis' else 'Repairs' end, case when v_key = '_diagnosis' then 'diagnosis' else 'repair' end, 'soon', v_k)
        returning id into v_jobid;
        v_jobmap := v_jobmap || jsonb_build_object(v_key, v_jobid);
      end if;
      insert into public.estimate_lines (company_id, estimate_id, option_id, service_id, name, benefit_text, qty, unit_price, modifiers, taxable, line_total, duration_minutes, default_on, sort_order,
                                         line_type, hours, rate, part_number, vendor, cost, finding_id, section, estimate_job_id)
      values (e.company_id, p_id, v_optid, nullif(v_ql ->> 'service_id', '')::uuid, v_ql ->> 'name', v_ql ->> 'benefit_text', (v_ql ->> 'qty')::numeric, (v_ql ->> 'unit_price')::numeric,
              coalesce(v_ql -> 'modifiers', '[]'::jsonb), (v_ql ->> 'taxable')::boolean, (v_ql ->> 'line_total')::numeric, (v_ql ->> 'duration_minutes')::int, true, v_j,
              v_ql ->> 'line_type', nullif(v_ql ->> 'hours', '')::numeric, nullif(v_ql ->> 'rate', '')::numeric, v_ql ->> 'part_number', v_ql ->> 'vendor', nullif(v_ql ->> 'cost', '')::numeric, nullif(v_ql ->> 'finding_id', '')::uuid, case when v_line ->> 'section' = 'diagnosis' then 'diagnosis' else 'repair' end, (v_jobmap ->> v_key)::uuid)
      returning id into v_lineid;
      if nullif(v_ql ->> 'finding_id', '') is not null then
        update public.job_findings set estimate_line_id = v_lineid, status = case when status in ('open', 'declined', 'quoted') then 'quoted' else status end
        where id = (v_ql ->> 'finding_id')::uuid and company_id = e.company_id;
      end if;
    end loop;
    v_t := public._estimate_option_totals(p_id, v_optid, false);
    update public.estimate_options set subtotal = (v_t ->> 'subtotal')::numeric, labor_subtotal = (v_t ->> 'labor_subtotal')::numeric, shop_supplies = (v_t ->> 'shop_supplies')::numeric,
                                       tax = (v_t ->> 'tax')::numeric, total = (v_t ->> 'total')::numeric, duration_minutes = (v_t ->> 'duration_minutes')::int
     where id = v_optid;
  end loop;

  v_j := 0;
  for v_line in select * from jsonb_array_elements(coalesce(p -> 'addons', '[]'::jsonb)) loop
    v_j := v_j + 1;
    v_ql := public._estimate_price_line(e.company_id, e.size_class, v_line);
    insert into public.estimate_lines (company_id, estimate_id, option_id, service_id, name, benefit_text, qty, unit_price, modifiers, taxable, line_total, duration_minutes, default_on, sort_order,
                                       line_type, hours, rate, part_number, vendor, cost, finding_id, section)
    values (e.company_id, p_id, null, nullif(v_ql ->> 'service_id', '')::uuid, v_ql ->> 'name', v_ql ->> 'benefit_text', (v_ql ->> 'qty')::numeric, (v_ql ->> 'unit_price')::numeric,
            coalesce(v_ql -> 'modifiers', '[]'::jsonb), (v_ql ->> 'taxable')::boolean, (v_ql ->> 'line_total')::numeric, (v_ql ->> 'duration_minutes')::int, coalesce((v_line ->> 'default_on')::boolean, false), v_j,
            v_ql ->> 'line_type', nullif(v_ql ->> 'hours', '')::numeric, nullif(v_ql ->> 'rate', '')::numeric, v_ql ->> 'part_number', v_ql ->> 'vendor', nullif(v_ql ->> 'cost', '')::numeric, nullif(v_ql ->> 'finding_id', '')::uuid, case when v_line ->> 'section' = 'diagnosis' then 'diagnosis' else 'repair' end);
  end loop;

  perform public._estimate_recompute(p_id);
end $function$;

do $$
begin
  perform public._patch_function('_estimate_json', '''jobs'', (select',
    '''duration_minutes'', o.duration_minutes,',
    '''duration_minutes'', o.duration_minutes,
                  ''jobs'', (select coalesce(jsonb_agg(jsonb_build_object(''id'', j.id, ''title'', j.title, ''kind'', j.kind, ''priority'', j.priority, ''status'', j.status, ''sort_order'', j.sort_order)
                              order by case j.kind when ''diagnosis'' then 0 else 1 end, case j.priority when ''safety'' then 0 when ''soon'' then 1 else 2 end, j.sort_order), ''[]''::jsonb)
                             from public.estimate_jobs j where j.option_id = o.id),');
  perform public._patch_function('_estimate_json', '''estimate_job_id'', l.estimate_job_id',
    '''id'', l.id, ''service_id'', l.service_id, ''section'', l.section,',
    '''id'', l.id, ''service_id'', l.service_id, ''section'', l.section, ''estimate_job_id'', l.estimate_job_id,');
  -- the approved lines carry their job onto the repair order
  perform public._patch_function('_convert_estimate_core', 'estimate_job_id',
    'override_reason, label, needs_price, estimate_line_id, authorization_id)
    values (e.company_id, j.id, v_svc, l.line_total, null, v_label, false, l.id, v_auth);',
    'override_reason, label, needs_price, estimate_line_id, authorization_id, estimate_job_id)
    values (e.company_id, j.id, v_svc, l.line_total, null, v_label, false, l.id, v_auth, l.estimate_job_id);');
end $$;

-- ---------------------------------------------------------------------------
-- add_finding_lines: one named job per finding (priority from its severity)
-- ---------------------------------------------------------------------------
do $$
begin
  perform public._patch_function('add_finding_lines', 'v_jobid',
    '  v_sort   integer;
begin',
    '  v_sort   integer;
  v_jobid  uuid;
begin');
  perform public._patch_function('add_finding_lines', 'estimate_jobs',
    '  select coalesce(max(sort_order), 0) into v_sort from public.estimate_lines where option_id = v_opt;',
    '  select coalesce(max(sort_order), 0) into v_sort from public.estimate_lines where option_id = v_opt;
  select estimate_job_id into v_jobid from public.estimate_lines where estimate_id = e.id and finding_id = f.id and estimate_job_id is not null limit 1;
  if v_jobid is null then
    insert into public.estimate_jobs (company_id, estimate_id, option_id, title, kind, priority, sort_order)
    values (e.company_id, e.id, v_opt, left(f.title, 80), ''repair'', case f.severity when ''urgent'' then ''safety'' when ''soon'' then ''soon'' else ''optional'' end,
            coalesce((select max(sort_order) from public.estimate_jobs where option_id = v_opt), 0) + 1)
    returning id into v_jobid;
  end if;');
  perform public._patch_function('add_finding_lines', 'section, estimate_job_id',
    'line_type, hours, rate, part_number, vendor, cost, finding_id, section)
    values (e.company_id, e.id, v_opt, null,',
    'line_type, hours, rate, part_number, vendor, cost, finding_id, section, estimate_job_id)
    values (e.company_id, e.id, v_opt, null,');
  perform public._patch_function('add_finding_lines', 'else ''repair'' end, v_jobid',
    'case when v_line ->> ''section'' = ''diagnosis'' then ''diagnosis'' else ''repair'' end)
    returning id into v_id;',
    'case when v_line ->> ''section'' = ''diagnosis'' then ''diagnosis'' else ''repair'' end, v_jobid)
    returning id into v_id;');
end $$;

drop function public._patch_function(text, text, text, text);
