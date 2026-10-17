-- =============================================================================
-- 0074 — Canned jobs, past services, and a tech on a labor line
--   * canned_jobs: a saved job (brakes, A/C, oil change…) with its labor, parts,
--     fees and sublets, a priority, an optional checklist and which cars it
--     applies to. One tap in "Add a Service" drops the whole job on an estimate;
--     the server prices every line again, so the saved prices are suggestions.
--   * past_services(vehicle | customer): what was approved on earlier visits, in
--     the same line shape, so a repeat job is one tap too.
--   * estimate_lines.tech_id: who does a labor line (initials only). Set while
--     writing the estimate, or afterwards with set_line_tech.
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

create table if not exists public.canned_jobs (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies (id) on delete cascade,
  name                   text not null check (length(name) between 1 and 80),
  category               text check (category is null or length(category) <= 40),
  makes                  text[] not null default '{}',
  year_from              integer check (year_from is null or year_from between 1900 and 2100),
  year_to                integer check (year_to is null or year_to between 1900 and 2100),
  priority               text not null default 'soon' check (priority in ('safety', 'soon', 'optional')),
  lines                  jsonb not null default '[]'::jsonb,
  inspection_template_id uuid references public.inspection_templates (id) on delete set null,
  notes                  text,
  active                 boolean not null default true,
  sort_order             integer not null default 0,
  created_by             uuid references public.profiles (id),
  created_at             timestamptz not null default now()
);
create unique index if not exists canned_jobs_name_idx on public.canned_jobs (company_id, lower(name));
alter table public.canned_jobs enable row level security;
-- the saved lines carry the shop's cost: no direct read, only through the RPCs below
revoke all on public.canned_jobs from public, anon, authenticated;
drop trigger if exists audit on public.canned_jobs;
create trigger audit after insert or update or delete on public.canned_jobs for each row execute function public.tg_audit();

alter table public.estimate_lines add column if not exists tech_id uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- A tech on a line: in, through the estimate payload, and out, in the JSON
-- ---------------------------------------------------------------------------
select public._patch_function('_estimate_price_line', 'tech_id',
  $a$'part_condition', public._part_condition(p_line),$a$,
  $a$'part_condition', public._part_condition(p_line),
    'tech_id', nullif(p_line ->> 'tech_id', ''),$a$);
select public._patch_function('_estimate_apply', 'tech_id',
  'part_number, vendor, part_condition, cost,', 'part_number, vendor, part_condition, cost, tech_id,');
select public._patch_function('_estimate_apply', 'v_ql ->> ''tech_id''',
  $a$v_ql ->> 'vendor', coalesce(nullif(v_ql ->> 'part_condition', ''), 'new'), nullif(v_ql ->> 'cost', '')::numeric$a$,
  $a$v_ql ->> 'vendor', coalesce(nullif(v_ql ->> 'part_condition', ''), 'new'), nullif(v_ql ->> 'cost', '')::numeric,
              (select pr.id from public.profiles pr where pr.id = nullif(v_ql ->> 'tech_id', '')::uuid and pr.company_id = e.company_id and pr.active and pr.role::text = 'detailer')$a$);
select public._patch_function('_estimate_json', '''tech_id''',
  $a$'part_number', l.part_number, 'part_condition', l.part_condition,$a$,
  $a$'part_number', l.part_number, 'part_condition', l.part_condition, 'tech_id', l.tech_id, 'tech', public._initials((select pr.full_name from public.profiles pr where pr.id = l.tech_id)),$a$);

-- A tech on a labor line after the estimate is written or approved (the advisor assigns the work)
create or replace function public.set_line_tech(p_line uuid, p_tech uuid)
returns void language plpgsql security definer set search_path = public as $$
declare l public.estimate_lines;
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor assigns a tech to a line' using errcode = '42501'; end if;
  select * into l from public.estimate_lines where id = p_line and company_id = public.current_company_id();
  if l.id is null then raise exception 'Line not found' using errcode = 'P0002'; end if;
  if l.line_type <> 'labor' then raise exception 'Only labor is assigned to a tech' using errcode = '22023'; end if;
  if p_tech is not null and not exists (select 1 from public.profiles p where p.id = p_tech and p.company_id = l.company_id and p.active and p.role::text = 'detailer') then
    raise exception 'Pick one of the shop''s techs' using errcode = '22023';
  end if;
  update public.estimate_lines set tech_id = p_tech where id = l.id;
end $$;
revoke execute on function public.set_line_tech(uuid, uuid) from public, anon;
grant execute on function public.set_line_tech(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Canned jobs
--   lines: [{line_type, name, service_id?, qty, hours?, rate?, price?, cost?, part_number?, vendor?, taxable?, part_condition?}]
-- ---------------------------------------------------------------------------
create or replace function public._canned_lines(p jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare x jsonb; out jsonb := '[]'::jsonb; t text;
begin
  if p is null or jsonb_typeof(p) <> 'array' then return '[]'::jsonb; end if;
  if jsonb_array_length(p) > 40 then raise exception 'At most 40 lines in a canned job' using errcode = '22023'; end if;
  for x in select * from jsonb_array_elements(p) loop
    t := coalesce(x ->> 'line_type', 'service');
    if t not in ('service', 'labor', 'part', 'fee', 'sublet') then raise exception 'Unknown line type' using errcode = '22023'; end if;
    if t <> 'service' and length(trim(coalesce(x ->> 'name', ''))) = 0 then raise exception 'Every line needs a name' using errcode = '22023'; end if;
    if t = 'labor' and coalesce((x ->> 'hours')::numeric, 0) < 0 then raise exception 'Hours cannot be negative' using errcode = '22023'; end if;
    out := out || jsonb_strip_nulls(jsonb_build_object(
      'line_type', t,
      'name', nullif(left(trim(coalesce(x ->> 'name', '')), 120), ''),
      'service_id', nullif(x ->> 'service_id', ''),
      'qty', greatest(coalesce(nullif(x ->> 'qty', '')::numeric, 1), 0),
      'hours', nullif(x ->> 'hours', '')::numeric,
      'rate', nullif(x ->> 'rate', '')::numeric,
      'price', nullif(x ->> 'price', '')::numeric,
      'cost', nullif(x ->> 'cost', '')::numeric,
      'part_number', nullif(left(trim(coalesce(x ->> 'part_number', '')), 60), ''),
      'vendor', nullif(left(trim(coalesce(x ->> 'vendor', '')), 60), ''),
      'taxable', case when x ? 'taxable' and jsonb_typeof(x -> 'taxable') = 'boolean' then x -> 'taxable' end,
      'part_condition', case when t = 'part' then coalesce(nullif(x ->> 'part_condition', ''), 'new') end));
  end loop;
  return out;
end $$;
revoke execute on function public._canned_lines(jsonb) from public, anon, authenticated;

create or replace function public.retail_canned_jobs()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_money boolean := public.can_price_jobs();
begin
  if not public.is_member() then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'category', c.category, 'makes', to_jsonb(c.makes), 'year_from', c.year_from, 'year_to', c.year_to,
      'priority', c.priority, 'notes', c.notes, 'active', c.active,
      'inspection_template_id', c.inspection_template_id,
      'inspection', (select t.name from public.inspection_templates t where t.id = c.inspection_template_id),
      'lines', case when v_money then c.lines else '[]'::jsonb end,
      'line_count', jsonb_array_length(c.lines))
      order by c.sort_order, c.name)
    from public.canned_jobs c
    where c.company_id = public.current_company_id() and (c.active or v_money)), '[]'::jsonb);
end $$;
revoke execute on function public.retail_canned_jobs() from public, anon;
grant execute on function public.retail_canned_jobs() to authenticated;

-- p: {id?, name, category?, makes?: text[], year_from?, year_to?, priority?, lines, inspection_template_id?, notes?, active?}
create or replace function public.save_canned_job(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid; v_name text := trim(coalesce(p ->> 'name', ''));
  v_makes text[]; v_lines jsonb; v_pri text := coalesce(nullif(p ->> 'priority', ''), 'soon'); v_tpl uuid := nullif(p ->> 'inspection_template_id', '')::uuid;
  v_from integer := nullif(p ->> 'year_from', '')::integer; v_to integer := nullif(p ->> 'year_to', '')::integer;
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor saves a canned job' using errcode = '42501'; end if;
  if v_name = '' or length(v_name) > 80 then raise exception 'Give the job a name' using errcode = '22023'; end if;
  if v_pri not in ('safety', 'soon', 'optional') then raise exception 'Unknown priority' using errcode = '22023'; end if;
  if v_from is not null and v_to is not null and v_from > v_to then raise exception 'The first year is after the last year' using errcode = '22023'; end if;
  if v_tpl is not null and not exists (select 1 from public.inspection_templates t where t.id = v_tpl and t.company_id = public.current_company_id()) then
    raise exception 'Unknown checklist' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct m), '{}') into v_makes from (select trim(x) as m from jsonb_array_elements_text(coalesce(p -> 'makes', '[]'::jsonb)) x) s where length(m) between 1 and 40;
  v_lines := public._canned_lines(p -> 'lines');
  if v_id is null then
    insert into public.canned_jobs (company_id, name, category, makes, year_from, year_to, priority, lines, inspection_template_id, notes, active, sort_order, created_by)
    values (public.current_company_id(), v_name, nullif(trim(coalesce(p ->> 'category', '')), ''), v_makes, v_from, v_to, v_pri, v_lines, v_tpl, nullif(trim(coalesce(p ->> 'notes', '')), ''),
            coalesce((p ->> 'active')::boolean, true), coalesce((select max(sort_order) + 10 from public.canned_jobs where company_id = public.current_company_id()), 10), auth.uid())
    returning id into v_id;
  else
    update public.canned_jobs set name = v_name, category = nullif(trim(coalesce(p ->> 'category', '')), ''), makes = v_makes, year_from = v_from, year_to = v_to, priority = v_pri, lines = v_lines,
           inspection_template_id = v_tpl, notes = nullif(trim(coalesce(p ->> 'notes', '')), ''), active = coalesce((p ->> 'active')::boolean, active)
     where id = v_id and company_id = public.current_company_id();
    if not found then raise exception 'Canned job not found' using errcode = 'P0002'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'A canned job with that name already exists' using errcode = '23505';
end $$;
revoke execute on function public.save_canned_job(jsonb) from public, anon;
grant execute on function public.save_canned_job(jsonb) to authenticated;

create or replace function public.delete_canned_job(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner_admin() then raise exception 'Only the owner or an admin removes a canned job' using errcode = '42501'; end if;
  delete from public.canned_jobs where id = p_id and company_id = public.current_company_id();
end $$;
revoke execute on function public.delete_canned_job(uuid) from public, anon;
grant execute on function public.delete_canned_job(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Past services: the jobs approved on earlier visits of this car (or this customer), as canned-line shapes
-- ---------------------------------------------------------------------------
create or replace function public.past_services(p_vehicle uuid default null, p_customer uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := public.current_company_id();
begin
  if not public.can_price_jobs() then return '[]'::jsonb; end if;
  if p_vehicle is null and p_customer is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(row order by (row ->> 'date') desc) from (
      select jsonb_build_object(
        'id', j.id, 'title', j.title, 'priority', j.priority, 'estimate_number', e.display_number, 'date', coalesce(e.accepted_at, e.created_at), 'status', j.status,
        'lines', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'line_type', l.line_type, 'name', l.name, 'service_id', l.service_id, 'qty', l.qty, 'hours', l.hours, 'rate', l.rate,
            'price', case when l.line_type in ('part', 'fee', 'sublet') then l.unit_price end, 'cost', l.cost,
            'part_number', l.part_number, 'vendor', l.vendor, 'taxable', l.taxable, 'part_condition', case when l.line_type = 'part' then l.part_condition end)) order by l.sort_order)
          from public.estimate_lines l where l.estimate_job_id = j.id and l.customer_approved is not false), '[]'::jsonb)) as row
      from public.estimate_jobs j
      join public.estimates e on e.id = j.estimate_id
      where e.company_id = v_company and e.status = 'accepted' and j.kind = 'repair' and j.status in ('approved', 'done')
        and ((p_vehicle is not null and e.vehicle_id = p_vehicle) or (p_vehicle is null and e.customer_id = p_customer))
      order by coalesce(e.accepted_at, e.created_at) desc
      limit 30) x), '[]'::jsonb);
end $$;
revoke execute on function public.past_services(uuid, uuid) from public, anon;
grant execute on function public.past_services(uuid, uuid) to authenticated;

drop function public._patch_function(text, text, text, text);
