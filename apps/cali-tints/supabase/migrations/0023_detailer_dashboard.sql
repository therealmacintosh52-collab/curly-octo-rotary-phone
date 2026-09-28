-- =============================================================================
-- 0023 — A detailer's own dashboard
--   my_dashboard(): the signed-in person's cars only (today by service, this
--   week, this month, the last 30 days by day, and today's cars). No money,
--   no other detailers, no invoices they did not log. Any signed-in user may
--   call it; it only ever reports their own jobs.
-- Re-runnable.
-- =============================================================================

create or replace function public.my_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_uid     uuid := auth.uid();
  v_tz      text;
  v_today   date;
  v_week0   date;
  v_month0  date;
  v_out     jsonb;
begin
  if v_company is null or v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select timezone into v_tz from public.companies where id = v_company;
  v_today  := (now() at time zone v_tz)::date;
  v_week0  := date_trunc('week', v_today)::date;          -- Monday
  v_month0 := date_trunc('month', v_today)::date;

  with j as (
    select j.id, j.invoice_id, j.tag_number, j.year, j.make, j.model, j.dealership_id,
           (j.performed_at at time zone v_tz)::date as d, j.performed_at
    from public.jobs j
    where j.company_id = v_company and j.detailer_id = v_uid and j.deleted_at is null
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
    'week_by_day', (select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb) from (
                      select d as day, count(*) as cars from j where d >= v_week0 and d < v_week0 + 7 group by d) x),
    'by_day', (select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb) from (
                 select d as day, count(*) as cars from j where d > v_today - 30 and d <= v_today group by d) x),
    'today_cars', (select coalesce(jsonb_agg(row_to_json(x) order by x.performed_at desc), '[]'::jsonb) from (
                     select j.id, j.invoice_id, i.display_number, j.tag_number as tag,
                            nullif(concat_ws(' ', j.year::text, j.make, j.model), '') as vehicle,
                            d.name as dealership, j.performed_at,
                            (select coalesce(jsonb_agg(coalesce(nullif(js.label, ''), s.name) order by s.sort_order), '[]'::jsonb)
                               from public.job_services js join public.services s on s.id = js.service_id
                               where js.job_id = j.id) as services
                     from j
                     left join public.invoices i on i.id = j.invoice_id
                     left join public.dealerships d on d.id = j.dealership_id
                     where j.d = v_today) x),
    'range', jsonb_build_object('start', v_today - 29, 'end', v_today)
  ) into v_out;

  return v_out;
end $$;

grant execute on function public.my_dashboard() to authenticated;
