-- =============================================================================
-- 0015 — One car, one invoice
--   Jobs and invoices were two ideas; the owner sees one. From here on every
--   car logged becomes its own invoice on the spot:
--   * companies.auto_invoice (default on): create_job() invoices the car it
--     just saved, for detailers and offline syncs alike (security definer).
--   * edit_invoice_car(): fix a typo on a draft, unpaid, one-car invoice
--     (re-snapshots the lines, keeps the number). Owner or the car's detailer.
--   * delete_invoice_car(): void the invoice and soft-delete the car.
--   * invoices_filtered(): the one list — search, dealership, service,
--     detailer, dates, status — with the cars and services on each row.
--     Detailers see the invoices that hold their cars.
--   * RLS: detailers may read invoices / invoice_items for their own cars.
--   * dashboard_stats(): unpaid_total / unpaid_invoices / draft_invoices.
--   * Backfill: every uninvoiced car already logged gets its own invoice.
-- Re-runnable: every statement is guarded or create-or-replace.
-- =============================================================================

alter table public.companies add column if not exists auto_invoice boolean not null default true;

-- ---------------------------------------------------------------------------
-- create_job: same validation as 0008, then the invoice.
-- ---------------------------------------------------------------------------
create or replace function public.create_job(p jsonb)
returns public.jobs language plpgsql security definer set search_path = public as $$
declare
  v_company     uuid := public.current_company_id();
  v_uid         uuid := auth.uid();
  v_job         public.jobs;
  v_detailer    uuid;
  v_dealer      public.dealerships;
  v_client_id   uuid;
  v_svc         jsonb;
  v_list_price  numeric;
  v_price       numeric;
  v_reason      text;
  v_vin         text;
  v_auto        boolean;
  v_tz          text;
  v_day         date;
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;

  v_client_id := coalesce(nullif(p ->> 'client_id', '')::uuid, gen_random_uuid());

  select * into v_job from public.jobs where client_id = v_client_id;
  if found then
    if v_job.company_id <> v_company then
      raise exception 'client_id collision' using errcode = '23505';
    end if;
    return v_job;
  end if;

  select * into v_dealer from public.dealerships
   where id = (p ->> 'dealership_id')::uuid and company_id = v_company and active;
  if not found then
    raise exception 'Unknown or inactive dealership' using errcode = '22023';
  end if;

  v_detailer := v_uid;
  if public.is_admin() and nullif(p ->> 'detailer_id', '') is not null then
    v_detailer := (p ->> 'detailer_id')::uuid;
    if not exists (select 1 from public.profiles where id = v_detailer and company_id = v_company) then
      raise exception 'Detailer not in company' using errcode = '22023';
    end if;
  end if;

  if coalesce(trim(p ->> 'tag_number'), '') = '' then
    raise exception 'Tag number is required' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p -> 'services', '[]'::jsonb)) = 0 then
    raise exception 'At least one service is required' using errcode = '22023';
  end if;

  v_vin := nullif(upper(trim(p ->> 'vin')), '');

  insert into public.jobs (company_id, dealership_id, detailer_id, client_id, tag_number, vin, year, make, model,
                           color, performed_at, ro_po_number, notes, created_by, updated_by)
  values (v_company, v_dealer.id, v_detailer, v_client_id,
          upper(trim(p ->> 'tag_number')), v_vin,
          nullif(p ->> 'year', '')::integer,
          nullif(trim(p ->> 'make'), ''), nullif(trim(p ->> 'model'), ''), nullif(trim(p ->> 'color'), ''),
          coalesce(nullif(p ->> 'performed_at', '')::timestamptz, now()),
          nullif(trim(p ->> 'ro_po_number'), ''), nullif(trim(p ->> 'notes'), ''),
          v_uid, v_uid)
  returning * into v_job;

  for v_svc in select * from jsonb_array_elements(p -> 'services') loop
    v_list_price := public.resolve_service_price(v_dealer.id, (v_svc ->> 'service_id')::uuid);
    if v_list_price is null then
      raise exception 'Unknown service %', v_svc ->> 'service_id' using errcode = '22023';
    end if;
    v_price  := coalesce(nullif(v_svc ->> 'price', '')::numeric, v_list_price);
    v_reason := nullif(trim(v_svc ->> 'override_reason'), '');
    if not public.price_within_policy((v_svc ->> 'service_id')::uuid, v_list_price, v_price) and v_reason is null then
      raise exception 'A reason is required when overriding the price' using errcode = '22023';
    end if;
    if v_price = v_list_price then v_reason := null; end if;

    insert into public.job_services (company_id, job_id, service_id, price, override_reason)
    values (v_company, v_job.id, (v_svc ->> 'service_id')::uuid, v_price, v_reason);
  end loop;

  -- The car is its own invoice. Period = the day it was detailed (company tz).
  select auto_invoice, timezone into v_auto, v_tz from public.companies where id = v_company;
  if coalesce(v_auto, true) then
    v_day := (v_job.performed_at at time zone v_tz)::date;
    perform public._create_invoice_from_jobs(v_company, v_dealer.id, array[v_job.id], v_day, v_day, v_job.ro_po_number, null);
    select * into v_job from public.jobs where id = v_job.id;
  end if;

  return v_job;
end $$;

-- ---------------------------------------------------------------------------
-- Backfill helper: invoice every uninvoiced, undeleted car of a company, one
-- invoice each, oldest first. Internal (called below and by tests).
-- ---------------------------------------------------------------------------
create or replace function public._invoice_pending_cars(p_company uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_tz text; r record; n integer := 0; v_day date;
begin
  select timezone into v_tz from public.companies where id = p_company;
  for r in
    select j.id, j.dealership_id, j.performed_at, j.ro_po_number
    from public.jobs j
    where j.company_id = p_company and j.deleted_at is null and j.invoice_id is null
    order by j.performed_at, j.created_at
  loop
    v_day := (r.performed_at at time zone v_tz)::date;
    perform public._create_invoice_from_jobs(p_company, r.dealership_id, array[r.id], v_day, v_day, r.ro_po_number, null);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public._invoice_pending_cars(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Which single car is on this invoice, if it is still editable.
-- ---------------------------------------------------------------------------
create or replace function public._editable_invoice_car(p_invoice_id uuid, out o_inv public.invoices, out o_job public.jobs)
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  select * into o_inv from public.invoices where id = p_invoice_id and company_id = public.current_company_id() for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if o_inv.status <> 'draft' then
    raise exception 'Only an invoice that has not been sent can be changed' using errcode = 'P0001';
  end if;
  if o_inv.amount_paid > 0 then
    raise exception 'A payment has been recorded on this invoice' using errcode = 'P0001';
  end if;
  select count(*) into n from public.jobs where invoice_id = p_invoice_id and deleted_at is null;
  if n <> 1 then
    raise exception 'This invoice covers % cars; void it to change them', n using errcode = 'P0001';
  end if;
  select * into o_job from public.jobs where invoice_id = p_invoice_id and deleted_at is null;
end $$;
revoke execute on function public._editable_invoice_car(uuid) from public, anon, authenticated;

-- Fix the car on a draft, unpaid, one-car invoice. Owner/admin or the car's
-- detailer. Re-snapshots the line items; the invoice number never changes.
create or replace function public.edit_invoice_car(p_invoice_id uuid, p jsonb)
returns public.invoices language plpgsql security definer set search_path = public as $$
declare
  v_inv      public.invoices;
  v_job      public.jobs;
  v_company  public.companies;
  v_dealer   public.dealerships;
  v_subtotal numeric(12,2);
  v_rate     numeric(6,4);
  v_tz       text;
  v_day      date;
  r          record;
begin
  select * into r from public._editable_invoice_car(p_invoice_id);
  v_inv := r.o_inv; v_job := r.o_job;
  if not public.is_admin() and v_job.detailer_id <> auth.uid() then
    raise exception 'You can only edit your own cars' using errcode = '42501';
  end if;

  -- Unlink, edit through update_job (same rules as a fresh car), relink.
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs set invoice_id = null, status = 'logged' where id = v_job.id;
  v_job := public.update_job(v_job.id, p);
  update public.jobs set invoice_id = v_inv.id, status = 'invoiced', updated_by = auth.uid() where id = v_job.id;
  perform set_config('app.bypass_lock', 'off', true);

  select * into v_company from public.companies where id = v_inv.company_id;
  select * into v_dealer from public.dealerships where id = v_job.dealership_id;
  v_tz  := v_company.timezone;
  v_day := (v_job.performed_at at time zone v_tz)::date;
  v_rate := coalesce(v_dealer.tax_rate, v_company.tax_rate);

  delete from public.invoice_items where invoice_id = v_inv.id;
  insert into public.invoice_items (company_id, invoice_id, job_id, job_service_id, sort_order, performed_at,
                                    tag_number, vin, year, make, model, color, ro_po_number, detailer_name,
                                    service_name, price)
  select v_inv.company_id, v_inv.id, j.id, js.id,
         row_number() over (order by s.sort_order, s.name),
         j.performed_at, j.tag_number, j.vin, j.year, j.make, j.model, j.color, j.ro_po_number,
         p.full_name, s.name, js.price
  from public.jobs j
  join public.job_services js on js.job_id = j.id
  join public.services s on s.id = js.service_id
  join public.profiles p on p.id = j.detailer_id
  where j.id = v_job.id;

  select coalesce(sum(price), 0) into v_subtotal from public.invoice_items where invoice_id = v_inv.id;

  update public.invoices set
    dealership_id = v_job.dealership_id,
    period_start  = v_day,
    period_end    = v_day,
    ro_po_number  = v_job.ro_po_number,
    tax_rate      = v_rate,
    payment_terms = coalesce(v_dealer.payment_terms, v_company.payment_terms),
    subtotal      = v_subtotal,
    tax           = round(v_subtotal * v_rate, 2),
    total         = v_subtotal + round(v_subtotal * v_rate, 2)
  where id = v_inv.id
  returning * into v_inv;

  return v_inv;
end $$;
grant execute on function public.edit_invoice_car(uuid, jsonb) to authenticated;

-- Remove a car that should never have been logged: void its invoice and
-- soft-delete the job (kept for audit; restore_job brings the car back
-- uninvoiced). Admin only, draft and unpaid.
create or replace function public.delete_invoice_car(p_invoice_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_inv public.invoices; v_job public.jobs; r record;
begin
  perform public.assert_admin();
  select * into r from public._editable_invoice_car(p_invoice_id);
  v_inv := r.o_inv; v_job := r.o_job;
  perform public.void_invoice(v_inv.id, coalesce(p_reason, 'Car removed'));
  perform public.soft_delete_job(v_job.id, p_reason);
end $$;
grant execute on function public.delete_invoice_car(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The one list. Returns {count, total, balance, rows}. Statuses:
--   all (not void) | unpaid (draft+submitted+partial) | outstanding
--   (submitted+partial) | draft | submitted | partial | overdue | paid | void
-- Detailers get only the invoices that carry their cars.
-- ---------------------------------------------------------------------------
create or replace function public.invoices_filtered(
  p_q text default null, p_service uuid default null, p_dealership uuid default null, p_detailer uuid default null,
  p_from date default null, p_to date default null, p_status text default 'all',
  p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_uid     uuid := auth.uid();
  v_admin   boolean := public.is_admin();
  v_days    integer;
  v_q       text := nullif(trim(coalesce(p_q, '')), '');
  v_out     jsonb;
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  select reminder_days into v_days from public.companies where id = v_company;

  with base as (
    select i.*,
           d.name as dealership_name,
           coalesce(i.status in ('submitted','partial') and i.submitted_at < now() - make_interval(days => v_days), false) as overdue
    from public.invoices i
    join public.dealerships d on d.id = i.dealership_id
    where i.company_id = v_company
      and (v_admin or exists (select 1 from public.jobs j where j.invoice_id = i.id and j.detailer_id = v_uid))
      and (case coalesce(p_status, 'all')
             when 'all'       then i.status <> 'void'
             when 'unpaid'    then i.status in ('draft','submitted','partial')
             when 'outstanding' then i.status in ('submitted','partial')
             when 'overdue'   then i.status in ('submitted','partial') and i.submitted_at < now() - make_interval(days => v_days)
             when 'draft'     then i.status = 'draft'
             when 'submitted' then i.status = 'submitted'
             when 'partial'   then i.status = 'partial'
             when 'paid'      then i.status = 'paid'
             when 'void'      then i.status = 'void'
             else true end)
      and (p_dealership is null or i.dealership_id = p_dealership)
      and (p_from is null or i.period_end >= p_from)
      and (p_to is null or i.period_start <= p_to)
      and (p_detailer is null or exists (select 1 from public.jobs j where j.invoice_id = i.id and j.detailer_id = p_detailer))
      and (p_service is null or exists (select 1 from public.invoice_items ii join public.job_services js on js.id = ii.job_service_id
                                        where ii.invoice_id = i.id and js.service_id = p_service))
      and (v_q is null
           or i.display_number ilike '%' || v_q || '%'
           or i.ro_po_number ilike '%' || v_q || '%'
           or exists (select 1 from public.invoice_items ii where ii.invoice_id = i.id
                      and (ii.tag_number ilike '%' || v_q || '%' or ii.vin ilike '%' || v_q || '%'
                           or ii.model ilike '%' || v_q || '%' or ii.ro_po_number ilike '%' || v_q || '%')))
  ),
  pagen as (
    select * from base order by number desc limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'count',   (select count(*) from base),
    'total',   (select coalesce(sum(total), 0) from base),
    'balance', (select coalesce(sum(total - amount_paid), 0) from base where status in ('draft','submitted','partial')),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
               'id', b.id,
               'display_number', b.display_number,
               'status', b.status,
               'overdue', b.overdue,
               'total', b.total,
               'amount_paid', b.amount_paid,
               'balance', b.total - b.amount_paid,
               'period_start', b.period_start,
               'period_end', b.period_end,
               'ro_po_number', b.ro_po_number,
               'submitted_at', b.submitted_at,
               'paid_at', b.paid_at,
               'created_at', b.created_at,
               'dealership_id', b.dealership_id,
               'dealership', b.dealership_name,
               'car_count', (select count(distinct ii.job_id) from public.invoice_items ii where ii.invoice_id = b.id),
               'cars', (select coalesce(jsonb_agg(jsonb_build_object('tag', c.tag_number, 'vin', c.vin,
                                 'vehicle', nullif(concat_ws(' ', c.year, c.make, c.model), ''), 'detailer', c.detailer_name)
                                 order by c.performed_at, c.tag_number), '[]'::jsonb)
                        from (select distinct on (ii.job_id) ii.job_id, ii.tag_number, ii.vin, ii.year, ii.make, ii.model, ii.detailer_name, ii.performed_at
                              from public.invoice_items ii where ii.invoice_id = b.id order by ii.job_id, ii.sort_order limit 4) c),
               'services', (select coalesce(jsonb_agg(distinct ii.service_name), '[]'::jsonb) from public.invoice_items ii where ii.invoice_id = b.id)
             ) order by b.number desc), '[]'::jsonb) from pagen b)
  ) into v_out;

  return v_out;
end $$;
grant execute on function public.invoices_filtered(text, uuid, uuid, uuid, date, date, text, integer, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: detailers read the invoices and lines that carry their own cars.
-- ---------------------------------------------------------------------------
drop policy if exists invoices_detailer_select on public.invoices;
create policy invoices_detailer_select on public.invoices for select to authenticated
  using (company_id = public.current_company_id()
         and exists (select 1 from public.jobs j where j.invoice_id = invoices.id and j.detailer_id = auth.uid()));

drop policy if exists invoice_items_detailer_select on public.invoice_items;
create policy invoice_items_detailer_select on public.invoice_items for select to authenticated
  using (company_id = public.current_company_id()
         and exists (select 1 from public.jobs j where j.id = invoice_items.job_id and j.detailer_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- dashboard_stats: what is unpaid (any open invoice), plus draft count.
-- ---------------------------------------------------------------------------
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
    union all
    select (s.created_at at time zone v_tz)::date, case when s.kind = 'sale' then s.amount else -s.amount end
    from public.terminal_sales s
    where s.company_id = v_company and s.invoice_id is null
  ),
  inv as (
    select * from public.invoices where company_id = v_company
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
                 'payments', (select count(*) filter (where amount > 0) from pay where d between v_start and v_end),
                 'avg_per_car', (select case when count(*) = 0 then 0 else round(sum(amount) / count(*), 2) end from j where d between v_start and v_end))),
    'collected_by_day', (select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb) from (
                           select d as day, count(*) filter (where amount > 0) as payments, sum(amount) as amount
                           from pay where d between v_start and v_end group by d) x),
    'uninvoiced_total', (select coalesce(sum(amount),0) from j where invoice_id is null),
    'uninvoiced_jobs',  (select count(*) from j where invoice_id is null),
    'unpaid_total', (select coalesce(sum(total - amount_paid),0) from inv where status in ('draft','submitted','partial')),
    'unpaid_invoices', (select count(*) from inv where status in ('draft','submitted','partial')),
    'outstanding_total', (select coalesce(sum(total - amount_paid),0) from inv where status in ('submitted','partial')),
    'outstanding_invoices', (select count(*) from inv where status in ('submitted','partial')),
    'draft_total', (select coalesce(sum(total),0) from inv where status = 'draft'),
    'draft_invoices', (select count(*) from inv where status = 'draft'),
    'avg_days_to_pay', (select round(avg(extract(epoch from (paid_at - submitted_at)) / 86400)::numeric, 1)
                        from inv
                        where status = 'paid' and submitted_at is not null and paid_at is not null),
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
                  from inv i join public.dealerships d on d.id = i.dealership_id
                  where i.status in ('submitted','partial')
                    and i.submitted_at < now() - make_interval(days => v_days)) x),
    'reminder_days', v_days
  ) into v_out;

  return v_out;
end $$;

-- ---------------------------------------------------------------------------
-- Backfill: nothing is left in limbo. Every uninvoiced car becomes an invoice.
-- ---------------------------------------------------------------------------
do $$
declare c record; n integer;
begin
  for c in select id, name from public.companies where auto_invoice loop
    n := public._invoice_pending_cars(c.id);
    if n > 0 then raise notice 'Invoiced % pending car(s) for %', n, c.name; end if;
  end loop;
end $$;
