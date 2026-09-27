-- =============================================================================
-- 0010 — Clover device (pay on the terminal) + income over time
--   * companies: the Clover device serial and POS name used by REST Pay Display
--   * clover_payments.matched_by gains 'device'
--   * dashboard_stats(): income for the selected range (revenue logged, cash
--     collected, cars, average per car) and collected-per-day series
-- =============================================================================

alter table public.companies
  add column if not exists clover_device_id text,
  add column if not exists clover_pos_id    text not null default 'Cali Tints app';

alter table public.clover_payments drop constraint if exists clover_payments_matched_by_check;
alter table public.clover_payments
  add constraint clover_payments_matched_by_check check (matched_by in ('order', 'reference', 'amount', 'manual', 'checkout', 'card', 'device'));

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
  ),
  pay as (
    select p.paid_at as d, p.amount
    from public.invoice_payments p
    where p.company_id = v_company
  )
  select jsonb_build_object(
    'range', jsonb_build_object('start', v_start, 'end', v_end),
    'week', (select jsonb_build_object('jobs', count(*), 'revenue', coalesce(sum(amount),0))
             from j where d >= v_week0 and d <= v_today),
    'month', (select jsonb_build_object('jobs', count(*), 'revenue', coalesce(sum(amount),0))
              from j where d >= v_month0 and d <= v_today),
    'income', (select jsonb_build_object(
                 'jobs', (select count(*) from j where d between v_start and v_end),
                 'revenue', (select coalesce(sum(amount),0) from j where d between v_start and v_end),
                 'collected', (select coalesce(sum(amount),0) from pay where d between v_start and v_end),
                 'payments', (select count(*) from pay where d between v_start and v_end),
                 'avg_per_car', (select case when count(*) = 0 then 0 else round(sum(amount) / count(*), 2) end from j where d between v_start and v_end))),
    'collected_by_day', (select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb) from (
                           select d as day, count(*) as payments, sum(amount) as amount
                           from pay where d between v_start and v_end group by d) x),
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
    'paid_last_90', (select coalesce(sum(amount),0) from pay where d >= v_today - 90),
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
