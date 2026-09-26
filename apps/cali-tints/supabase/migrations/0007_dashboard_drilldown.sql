-- =============================================================================
-- 0007 — dashboard drill-down support
--   * dashboard_stats(): by_service / by_detailer rows carry ids so tiles and
--     bars can link to the filtered job list.
--   * jobs_filter_summary(): count + revenue for the same filters the job list
--     uses, so a drilled-down list shows its totals across all pages.
-- =============================================================================

create or replace function public.dashboard_stats(p_start date default null, p_end date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_tz      text;
  v_days    integer;
  v_today   date;
  v_week0   date;
  v_month0  date;
  v_start   date;
  v_end     date;
  v_out     jsonb;
begin
  perform public.assert_admin();
  select timezone, reminder_days into v_tz, v_days from public.companies where id = v_company;
  v_today  := (now() at time zone v_tz)::date;
  v_week0  := date_trunc('week', v_today)::date;          -- Monday
  v_month0 := date_trunc('month', v_today)::date;
  v_start  := coalesce(p_start, v_month0);
  v_end    := coalesce(p_end, v_today);

  with j as (
    select j.id, j.detailer_id, (j.performed_at at time zone v_tz)::date as d, j.invoice_id,
           coalesce((select sum(price) from public.job_services js where js.job_id = j.id), 0) as amount
    from public.jobs j
    where j.company_id = v_company and j.deleted_at is null
  )
  select jsonb_build_object(
    'range', jsonb_build_object('start', v_start, 'end', v_end),
    'week', (select jsonb_build_object('jobs', count(*), 'revenue', coalesce(sum(amount),0))
             from j where d >= v_week0 and d <= v_today),
    'month', (select jsonb_build_object('jobs', count(*), 'revenue', coalesce(sum(amount),0))
              from j where d >= v_month0 and d <= v_today),
    'uninvoiced_total', (select coalesce(sum(amount),0) from j where invoice_id is null),
    'uninvoiced_jobs',  (select count(*) from j where invoice_id is null),
    'outstanding_total', (select coalesce(sum(total - amount_paid),0) from public.invoices
                          where company_id = v_company and status in ('submitted','partial')),
    'outstanding_invoices', (select count(*) from public.invoices
                             where company_id = v_company and status in ('submitted','partial')),
    'draft_total', (select coalesce(sum(total),0) from public.invoices where company_id = v_company and status = 'draft'),
    'avg_days_to_pay', (select round(avg(extract(epoch from (paid_at - submitted_at)) / 86400)::numeric, 1)
                        from public.invoices
                        where company_id = v_company and status = 'paid' and submitted_at is not null and paid_at is not null),
    'paid_last_90', (select coalesce(sum(amount),0) from public.invoice_payments
                     where company_id = v_company and paid_at >= v_today - 90),
    'by_service', (select coalesce(jsonb_agg(row_to_json(x) order by x.revenue desc), '[]'::jsonb) from (
                     select s.id as service_id, s.name, count(*) as jobs, sum(js.price) as revenue
                     from public.job_services js
                     join public.services s on s.id = js.service_id
                     join j on j.id = js.job_id
                     where j.d between v_start and v_end
                     group by s.id, s.name) x),
    'by_detailer', (select coalesce(jsonb_agg(row_to_json(x) order by x.jobs desc), '[]'::jsonb) from (
                      select p.id as detailer_id, p.full_name as name, count(*) as jobs, sum(j.amount) as revenue
                      from j join public.profiles p on p.id = j.detailer_id
                      where j.d between v_start and v_end
                      group by p.id, p.full_name) x),
    'by_day', (select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb) from (
                 select d as day, count(*) as jobs, sum(amount) as revenue
                 from j where d between v_start and v_end group by d) x),
    'overdue', (select coalesce(jsonb_agg(row_to_json(x) order by x.submitted_at), '[]'::jsonb) from (
                  select i.id, i.display_number, d.name as dealership, i.total, i.amount_paid, i.submitted_at,
                         (v_today - (i.submitted_at at time zone v_tz)::date) as days_outstanding
                  from public.invoices i join public.dealerships d on d.id = i.dealership_id
                  where i.company_id = v_company and i.status in ('submitted','partial')
                    and i.submitted_at < now() - make_interval(days => v_days)) x),
    'reminder_days', v_days
  ) into v_out;

  return v_out;
end $$;

-- Count and revenue for a filtered job list (same semantics as the /jobs page).
create or replace function public.jobs_filter_summary(
  p_q text default null, p_service uuid default null, p_detailer uuid default null, p_dealership uuid default null,
  p_from timestamptz default null, p_to timestamptz default null, p_status text default 'all')
returns jsonb language sql stable security definer set search_path = public as $$
  with j as (
    select j.id, coalesce((select sum(price) from public.job_services js where js.job_id = j.id), 0) as amount
    from public.jobs j
    where j.company_id = public.current_company_id()
      and (public.is_admin() or j.detailer_id = auth.uid())
      and (case when p_status = 'deleted' then j.deleted_at is not null else j.deleted_at is null end)
      and (p_status <> 'uninvoiced' or j.invoice_id is null)
      and (p_status <> 'invoiced' or j.invoice_id is not null)
      and (p_service is null or exists (select 1 from public.job_services js where js.job_id = j.id and js.service_id = p_service))
      and (p_detailer is null or j.detailer_id = p_detailer)
      and (p_dealership is null or j.dealership_id = p_dealership)
      and (p_from is null or j.performed_at >= p_from)
      and (p_to is null or j.performed_at <= p_to)
      and (p_q is null or p_q = '' or j.tag_number ilike '%' || p_q || '%' or j.vin ilike '%' || p_q || '%'
           or j.model ilike '%' || p_q || '%' or j.ro_po_number ilike '%' || p_q || '%')
  )
  select jsonb_build_object('jobs', count(*), 'revenue', coalesce(sum(amount), 0)) from j
$$;
grant execute on function public.jobs_filter_summary(text, uuid, uuid, uuid, timestamptz, timestamptz, text) to authenticated, service_role;
