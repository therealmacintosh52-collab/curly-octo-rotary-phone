-- =============================================================================
-- 0028 — Jobs by the day, one invoice per dealership per month
--   A job is logged on its own (no invoice on save). On the 1st, close_month()
--   bundles every uninvoiced job of the previous month per dealership into
--   one invoice; the owner can also close a dealership early with
--   invoice_now(). The Jobs list is jobs_filtered(); admins and managers get
--   a company-wide, money-free team_dashboard(). Re-runnable.
-- =============================================================================

-- Jobs no longer invoice themselves on save.
alter table public.companies alter column auto_invoice set default false;
update public.companies set auto_invoice = false where auto_invoice;

-- Email each month's invoice to the dealership as soon as it is made.
alter table public.companies add column if not exists auto_send_monthly boolean not null default true;

-- ---------------------------------------------------------------------------
-- jobs_filtered: the Jobs list. No money. Detailers see their own jobs.
-- ---------------------------------------------------------------------------
create or replace function public.jobs_filtered(
  p_q text default null, p_service uuid default null, p_dealership uuid default null, p_detailer uuid default null,
  p_from date default null, p_to date default null, p_status text default 'all',
  p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_uid     uuid := auth.uid();
  v_admin   boolean := public.is_admin();
  v_tz      text;
  v_q       text := nullif(trim(coalesce(p_q, '')), '');
  v_out     jsonb;
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  select timezone into v_tz from public.companies where id = v_company;

  with base as (
    select j.*,
           (j.performed_at at time zone v_tz)::date as day,
           d.name as dealership_name,
           p.full_name as detailer_name,
           i.display_number,
           i.status as invoice_status
    from public.jobs j
    join public.dealerships d on d.id = j.dealership_id
    join public.profiles p on p.id = j.detailer_id
    left join public.invoices i on i.id = j.invoice_id
    where j.company_id = v_company
      and (v_admin or j.detailer_id = v_uid)
      and (case coalesce(p_status, 'all')
             when 'all'      then j.deleted_at is null
             when 'open'     then j.deleted_at is null and j.invoice_id is null
             when 'invoiced' then j.deleted_at is null and j.invoice_id is not null
             when 'deleted'  then j.deleted_at is not null and v_admin
             else j.deleted_at is null end)
      and (p_dealership is null or j.dealership_id = p_dealership)
      and (p_detailer is null or j.detailer_id = p_detailer)
      and (p_from is null or (j.performed_at at time zone v_tz)::date >= p_from)
      and (p_to is null or (j.performed_at at time zone v_tz)::date <= p_to)
      and (p_service is null or exists (select 1 from public.job_services js where js.job_id = j.id and js.service_id = p_service))
      and (v_q is null
           or j.tag_number ilike '%' || v_q || '%'
           or j.vin ilike '%' || v_q || '%'
           or j.model ilike '%' || v_q || '%'
           or j.make ilike '%' || v_q || '%'
           or j.ro_po_number ilike '%' || v_q || '%'
           or d.name ilike '%' || v_q || '%'
           or i.display_number ilike '%' || v_q || '%'
           or exists (select 1 from public.job_services js join public.services s on s.id = js.service_id
                      where js.job_id = j.id and (s.name ilike '%' || v_q || '%' or js.label ilike '%' || v_q || '%')))
  ),
  pagen as (
    select * from base order by performed_at desc, tag_number
    limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'count', (select count(*) from base),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
               'id', b.id,
               'performed_at', b.performed_at,
               'day', b.day,
               'tag', b.tag_number,
               'vin', b.vin,
               'vehicle', nullif(concat_ws(' ', b.year::text, b.make, b.model), ''),
               'color', b.color,
               'dealership_id', b.dealership_id,
               'dealership', b.dealership_name,
               'detailer_id', b.detailer_id,
               'detailer', b.detailer_name,
               'services', (select coalesce(jsonb_agg(coalesce(nullif(js.label, ''), s.name) order by s.sort_order, s.name), '[]'::jsonb)
                              from public.job_services js join public.services s on s.id = js.service_id where js.job_id = b.id),
               'invoice_id', b.invoice_id,
               'display_number', b.display_number,
               'invoice_status', b.invoice_status,
               'photo_count', (select count(*) from public.job_photos ph where ph.job_id = b.id),
               'deleted', b.deleted_at is not null
             ) order by b.performed_at desc, b.tag_number), '[]'::jsonb) from pagen b)
  ) into v_out;

  return v_out;
end $$;
grant execute on function public.jobs_filtered(text, uuid, uuid, uuid, date, date, text, integer, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- close_month: one invoice per dealership for every month that has ended.
-- Called by the daily job with the service role; nothing for a signed-in
-- user to run. Returns the invoices it made (none when nothing is pending).
-- ---------------------------------------------------------------------------
create or replace function public.close_month(p_company uuid, p_through date default null)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  v_tz     text;
  v_cutoff date;
  r        record;
begin
  select timezone into v_tz from public.companies where id = p_company;
  if v_tz is null then
    raise exception 'Unknown company' using errcode = '22023';
  end if;
  -- Everything before the first day of the month that contains p_through (today by default).
  v_cutoff := date_trunc('month', coalesce(p_through, (now() at time zone v_tz)::date))::date;

  for r in
    select j.dealership_id,
           date_trunc('month', (j.performed_at at time zone v_tz)::date)::date as m0,
           array_agg(j.id order by j.performed_at, j.tag_number) as ids
    from public.jobs j
    join public.dealerships d on d.id = j.dealership_id
    where j.company_id = p_company and j.deleted_at is null and j.invoice_id is null
      and (j.performed_at at time zone v_tz)::date < v_cutoff
    group by j.dealership_id, 2, d.name
    order by 2, d.name
  loop
    return next public._create_invoice_from_jobs(p_company, r.dealership_id, r.ids, r.m0, (r.m0 + interval '1 month - 1 day')::date, null, null);
  end loop;
  return;
end $$;
revoke all on function public.close_month(uuid, date) from public, anon, authenticated;
grant execute on function public.close_month(uuid, date) to service_role;

-- ---------------------------------------------------------------------------
-- invoice_now: the owner closes one dealership early (through today).
-- ---------------------------------------------------------------------------
create or replace function public.invoice_now(p_dealership_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_tz      text;
  v_today   date;
  v_ids     uuid[];
  v_start   date;
begin
  perform public.assert_admin();
  if not exists (select 1 from public.dealerships where id = p_dealership_id and company_id = v_company) then
    raise exception 'Unknown dealership' using errcode = '22023';
  end if;
  select timezone into v_tz from public.companies where id = v_company;
  v_today := (now() at time zone v_tz)::date;

  select array_agg(j.id order by j.performed_at, j.tag_number), min((j.performed_at at time zone v_tz)::date)
    into v_ids, v_start
  from public.jobs j
  where j.company_id = v_company and j.dealership_id = p_dealership_id
    and j.deleted_at is null and j.invoice_id is null
    and (j.performed_at at time zone v_tz)::date <= v_today;
  if v_ids is null then
    raise exception 'Nothing to invoice for this dealership yet' using errcode = 'P0002';
  end if;

  return public._create_invoice_from_jobs(v_company, p_dealership_id, v_ids, v_start, v_today, null, null);
end $$;
grant execute on function public.invoice_now(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- team_dashboard: the whole company's day, counts only. Admin and manager.
-- ---------------------------------------------------------------------------
create or replace function public.team_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_tz      text;
  v_today   date;
  v_week0   date;
  v_month0  date;
  v_out     jsonb;
begin
  perform public.assert_admin();
  select timezone into v_tz from public.companies where id = v_company;
  v_today  := (now() at time zone v_tz)::date;
  v_week0  := date_trunc('week', v_today)::date;          -- Monday
  v_month0 := date_trunc('month', v_today)::date;

  with j as (
    select j.id, j.invoice_id, j.tag_number, j.year, j.make, j.model, j.dealership_id, j.detailer_id,
           (j.performed_at at time zone v_tz)::date as d, j.performed_at
    from public.jobs j
    where j.company_id = v_company and j.deleted_at is null
  )
  select jsonb_build_object(
    'today', jsonb_build_object(
      'cars', (select count(*) from j where d = v_today),
      'by_service', (select coalesce(jsonb_agg(row_to_json(x) order by x.sort_order, x.name), '[]'::jsonb) from (
                       select s.id as service_id, s.name, s.sort_order, count(*) as cars
                       from public.job_services js
                       join public.services s on s.id = js.service_id
                       join j on j.id = js.job_id
                       where j.d = v_today
                       group by s.id, s.name, s.sort_order) x)),
    'week',  jsonb_build_object('cars', (select count(*) from j where d >= v_week0 and d <= v_today)),
    'month', jsonb_build_object('cars', (select count(*) from j where d >= v_month0 and d <= v_today)),
    'open_jobs', (select count(*) from j where invoice_id is null),
    'week_by_day', (select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb) from (
                      select d as day, count(*) as cars from j where d >= v_week0 and d < v_week0 + 7 group by d) x),
    'by_day', (select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb) from (
                 select d as day, count(*) as cars from j where d > v_today - 30 and d <= v_today group by d) x),
    'by_detailer', (select coalesce(jsonb_agg(row_to_json(x) order by x.cars desc, x.name), '[]'::jsonb) from (
                      select p.id as detailer_id, p.full_name as name,
                             count(*) filter (where j.d = v_today) as today,
                             count(*) filter (where j.d >= v_month0) as cars
                      from j join public.profiles p on p.id = j.detailer_id
                      where j.d >= v_month0
                      group by p.id, p.full_name) x),
    'today_cars', (select coalesce(jsonb_agg(row_to_json(x) order by x.performed_at desc), '[]'::jsonb) from (
                     select j.id, j.invoice_id, i.display_number, j.tag_number as tag,
                            nullif(concat_ws(' ', j.year::text, j.make, j.model), '') as vehicle,
                            d.name as dealership, p.full_name as detailer, j.performed_at,
                            (select coalesce(jsonb_agg(coalesce(nullif(js.label, ''), s.name) order by s.sort_order), '[]'::jsonb)
                               from public.job_services js join public.services s on s.id = js.service_id
                               where js.job_id = j.id) as services
                     from j
                     left join public.invoices i on i.id = j.invoice_id
                     left join public.dealerships d on d.id = j.dealership_id
                     left join public.profiles p on p.id = j.detailer_id
                     where j.d = v_today) x),
    'range', jsonb_build_object('start', v_today - 29, 'end', v_today)
  ) into v_out;

  return v_out;
end $$;
grant execute on function public.team_dashboard() to authenticated;
