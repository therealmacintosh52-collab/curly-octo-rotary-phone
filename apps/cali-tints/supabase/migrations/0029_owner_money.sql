-- =============================================================================
-- 0029 — Only the owner sees money
--   Prices, totals, payments, income: the owner's alone. Admins, managers and
--   detailers log and see jobs with service names and nothing about money,
--   and cannot read it from the database either:
--   * invoices, invoice_items, invoice_payments, invoice_submissions,
--     dealership_service_prices and audit_log are owner-only at RLS.
--   * services.default_price / price_min / price_max and
--     job_services.price / override_reason are not readable by app users at
--     all (column privileges). The owner reads them through two views that
--     check is_owner(): service_prices_v and job_service_prices_v.
--   * dealership_price_list() returns null prices unless the caller is the
--     owner; resolve_service_price() is internal only.
--   * create_job / update_job take the price from the client only when the
--     owner sent it; anyone else gets the list price. An open-amount service
--     ("Other") logged by a non-owner is marked needs_price for the owner.
--   * The money RPCs (dashboard_stats, invoices_filtered, record_payment,
--     void_invoice, …) require the owner.
-- Re-runnable.
-- =============================================================================

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text = 'owner' from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.is_owner() to authenticated, service_role;

create or replace function public.assert_owner()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Owner only' using errcode = '42501';
  end if;
end $$;
grant execute on function public.assert_owner() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: money tables are the owner's.
-- ---------------------------------------------------------------------------
drop policy if exists invoices_admin on public.invoices;
create policy invoices_admin on public.invoices for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());
drop policy if exists invoices_detailer_select on public.invoices;

drop policy if exists invoice_items_admin on public.invoice_items;
create policy invoice_items_admin on public.invoice_items for select to authenticated
  using (company_id = public.current_company_id() and public.is_owner());
drop policy if exists invoice_items_detailer_select on public.invoice_items;

drop policy if exists invoice_payments_admin on public.invoice_payments;
create policy invoice_payments_admin on public.invoice_payments for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

drop policy if exists invoice_submissions_admin on public.invoice_submissions;
create policy invoice_submissions_admin on public.invoice_submissions for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

drop policy if exists dsp_select on public.dealership_service_prices;
drop policy if exists dsp_admin on public.dealership_service_prices;
create policy dsp_owner on public.dealership_service_prices for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- The audit log carries full row copies (prices included).
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using (company_id = public.current_company_id() and public.is_owner());

-- Prices on the menu: owner only (admins keep users, dealerships, company).
drop policy if exists services_admin on public.services;
create policy services_admin on public.services for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- ---------------------------------------------------------------------------
-- Column privileges: price columns are never readable by app users.
-- Security-definer functions (owned by postgres) are unaffected.
-- ---------------------------------------------------------------------------
revoke select on public.services from authenticated, anon;
grant select (id, company_id, name, description, category, active, sort_order, created_at, updated_at) on public.services to authenticated;

alter table public.job_services add column if not exists needs_price boolean not null default false;
revoke select on public.job_services from authenticated, anon;
grant select (id, company_id, job_id, service_id, label, needs_price, created_at) on public.job_services to authenticated;

-- ---------------------------------------------------------------------------
-- The owner's windows onto prices.
-- ---------------------------------------------------------------------------
drop view if exists public.service_prices_v;
create view public.service_prices_v with (security_barrier = true) as
  select s.id as service_id, s.company_id, s.default_price, s.price_min, s.price_max
  from public.services s
  where s.company_id = public.current_company_id() and public.is_owner();
grant select on public.service_prices_v to authenticated, service_role;

drop view if exists public.job_service_prices_v;
create view public.job_service_prices_v with (security_barrier = true) as
  select js.id as job_service_id, js.job_id, js.service_id, js.company_id, j.dealership_id, j.invoice_id, j.deleted_at,
         js.price, js.override_reason, js.needs_price
  from public.job_services js
  join public.jobs j on j.id = js.job_id
  where js.company_id = public.current_company_id() and public.is_owner();
grant select on public.job_service_prices_v to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The price list hides its prices from everyone but the owner.
-- ---------------------------------------------------------------------------
drop function if exists public.dealership_price_list(uuid);
create function public.dealership_price_list(p_dealership_id uuid)
returns table (service_id uuid, name text, description text, category text, price numeric, price_min numeric, price_max numeric, is_override boolean, sort_order integer, open_amount boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.category,
         case when public.is_owner() then coalesce(dsp.price, s.default_price) end as price,
         case when public.is_owner() then s.price_min end as price_min,
         case when public.is_owner() then s.price_max end as price_max,
         public.is_owner() and dsp.price is not null as is_override,
         s.sort_order,
         -- "Other": no list price, any amount. Not money, so everyone may know which service that is.
         s.default_price = 0 and s.price_min = 0 and s.price_max >= 10000 as open_amount
  from public.services s
  join public.dealerships d on d.id = p_dealership_id and d.company_id = s.company_id
  left join public.dealership_service_prices dsp on dsp.service_id = s.id and dsp.dealership_id = d.id
  where s.company_id = public.current_company_id() and s.active
  order by s.sort_order, s.name;
$$;
grant execute on function public.dealership_price_list(uuid) to authenticated, service_role;

revoke execute on function public.resolve_service_price(uuid, uuid) from public, anon, authenticated;
drop function if exists public.jobs_filter_summary(text, uuid, uuid, uuid, timestamptz, timestamptz, text);

-- ---------------------------------------------------------------------------
-- The month's invoice number for a job, for people who cannot read invoices.
-- ---------------------------------------------------------------------------
create or replace function public.job_invoice_number(p_job_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select i.display_number
  from public.jobs j join public.invoices i on i.id = j.invoice_id
  where j.id = p_job_id and j.company_id = public.current_company_id()
    and (public.is_admin() or j.detailer_id = auth.uid());
$$;
grant execute on function public.job_invoice_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_job / update_job: the price comes from the client only for the
-- owner. Everyone else gets the list price; an open-amount service gets
-- needs_price so the owner can set it before the month closes.
-- ---------------------------------------------------------------------------
create or replace function public._job_service_price(
  p_dealership uuid, p_service uuid, p_sent_price numeric, p_sent_reason text,
  out o_price numeric, out o_reason text, out o_needs_price boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_list numeric; v_min numeric; v_max numeric;
begin
  v_list := public.resolve_service_price(p_dealership, p_service);
  if v_list is null then
    raise exception 'Unknown service %', p_service using errcode = '22023';
  end if;
  select price_min, price_max into v_min, v_max from public.services where id = p_service;
  if public.is_owner() then
    o_price  := coalesce(p_sent_price, v_list);
    o_reason := nullif(trim(p_sent_reason), '');
    if not public.price_within_policy(p_service, v_list, o_price) and o_reason is null then
      raise exception 'A reason is required when overriding the price' using errcode = '22023';
    end if;
    if o_price = v_list then o_reason := null; end if;
    o_needs_price := false;
  else
    o_price  := v_list;
    o_reason := null;
    -- "Other": no list price and an open range → the owner fills in the amount.
    o_needs_price := v_list = 0 and v_min is not null and v_max is not null and v_min = 0 and v_max >= 10000;
  end if;
end $$;

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
  v_vin         text;
  v_auto        boolean;
  v_tz          text;
  v_day         date;
  r             record;
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
    raise exception 'Stock number is required' using errcode = '22023';
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
    select * into r from public._job_service_price(v_dealer.id, (v_svc ->> 'service_id')::uuid,
                                                   nullif(v_svc ->> 'price', '')::numeric, v_svc ->> 'override_reason');
    insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price)
    values (v_company, v_job.id, (v_svc ->> 'service_id')::uuid, r.o_price, r.o_reason, nullif(left(trim(v_svc ->> 'label'), 120), ''), r.o_needs_price);
  end loop;

  -- Legacy: a company that still invoices every car on save.
  select auto_invoice, timezone into v_auto, v_tz from public.companies where id = v_company;
  if coalesce(v_auto, false) then
    v_day := (v_job.performed_at at time zone v_tz)::date;
    perform public._create_invoice_from_jobs(v_company, v_dealer.id, array[v_job.id], v_day, v_day, v_job.ro_po_number, null);
    select * into v_job from public.jobs where id = v_job.id;
  end if;

  return v_job;
end $$;

create or replace function public.update_job(p_id uuid, p jsonb)
returns public.jobs language plpgsql security definer set search_path = public as $$
declare
  v_company    uuid := public.current_company_id();
  v_uid        uuid := auth.uid();
  v_job        public.jobs;
  v_dealer     public.dealerships;
  v_svc        jsonb;
  r            record;
begin
  select * into v_job from public.jobs where id = p_id and company_id = v_company and deleted_at is null;
  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;
  if not public.is_admin() and v_job.detailer_id <> v_uid then
    raise exception 'You can only edit your own jobs' using errcode = '42501';
  end if;
  if v_job.invoice_id is not null then
    raise exception 'Job is invoiced and locked' using errcode = 'P0001';
  end if;

  select * into v_dealer from public.dealerships
   where id = coalesce(nullif(p ->> 'dealership_id', '')::uuid, v_job.dealership_id) and company_id = v_company;

  update public.jobs set
    dealership_id = v_dealer.id,
    detailer_id   = case when public.is_admin() and nullif(p ->> 'detailer_id','') is not null
                         then (p ->> 'detailer_id')::uuid else detailer_id end,
    tag_number    = coalesce(nullif(upper(trim(p ->> 'tag_number')), ''), tag_number),
    vin           = case when p ? 'vin' then nullif(upper(trim(p ->> 'vin')), '') else vin end,
    year          = case when p ? 'year' then nullif(p ->> 'year', '')::integer else year end,
    make          = case when p ? 'make' then nullif(trim(p ->> 'make'), '') else make end,
    model         = case when p ? 'model' then nullif(trim(p ->> 'model'), '') else model end,
    color         = case when p ? 'color' then nullif(trim(p ->> 'color'), '') else color end,
    performed_at  = coalesce(nullif(p ->> 'performed_at', '')::timestamptz, performed_at),
    ro_po_number  = case when p ? 'ro_po_number' then nullif(trim(p ->> 'ro_po_number'), '') else ro_po_number end,
    notes         = case when p ? 'notes' then nullif(trim(p ->> 'notes'), '') else notes end,
    updated_by    = v_uid
  where id = p_id
  returning * into v_job;

  if p ? 'services' then
    if jsonb_array_length(p -> 'services') = 0 then
      raise exception 'At least one service is required' using errcode = '22023';
    end if;
    delete from public.job_services where job_id = p_id;
    for v_svc in select * from jsonb_array_elements(p -> 'services') loop
      select * into r from public._job_service_price(v_job.dealership_id, (v_svc ->> 'service_id')::uuid,
                                                     nullif(v_svc ->> 'price', '')::numeric, v_svc ->> 'override_reason');
      insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price)
      values (v_company, p_id, (v_svc ->> 'service_id')::uuid, r.o_price, r.o_reason, nullif(left(trim(v_svc ->> 'label'), 120), ''), r.o_needs_price);
    end loop;
  end if;

  return v_job;
end $$;

-- ---------------------------------------------------------------------------
-- The money RPCs require the owner. Their bodies are unchanged: the one
-- assert line is swapped in place so this stays re-runnable.
-- ---------------------------------------------------------------------------
do $$
declare r record; v_src text;
begin
  for r in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('record_payment', 'void_invoice', 'mark_invoice_submitted', 'generate_invoice', 'generate_per_job_invoices',
                        'uninvoiced_jobs', 'delete_invoice_car', 'restore_invoice_car', 'find_invoice_conflicts', 'review_job_duplicate',
                        'invoice_now', 'dashboard_stats')
  loop
    v_src := pg_get_functiondef(r.oid);
    if position('perform public.assert_admin();' in v_src) > 0 then
      execute replace(v_src, 'perform public.assert_admin();', 'perform public.assert_owner();');
    end if;
  end loop;
end $$;

-- uninvoiced_jobs feeds the owner's invoice builder.
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'uninvoiced_jobs';
  if v_src is not null and position('and public.is_admin()' in v_src) > 0 then
    execute replace(v_src, 'and public.is_admin()', 'and public.is_owner()');
  end if;
end $$;

-- edit_invoice_car changes an invoice's lines: owner only (it used to let a
-- detailer fix their own car's one-car invoice).
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'edit_invoice_car';
  if v_src is not null and position('if not public.is_admin() and v_job.detailer_id <> auth.uid() then' in v_src) > 0 then
    execute replace(v_src, 'if not public.is_admin() and v_job.detailer_id <> auth.uid() then', 'if not public.is_owner() then');
  end if;
end $$;

-- invoices_filtered: owner only (the detailer branch is gone).
create or replace function public.invoices_filtered(
  p_q text default null, p_service uuid default null, p_dealership uuid default null, p_detailer uuid default null,
  p_from date default null, p_to date default null, p_status text default 'all',
  p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_days    integer;
  v_q       text := nullif(trim(coalesce(p_q, '')), '');
  v_out     jsonb;
begin
  perform public.assert_owner();
  select reminder_days into v_days from public.companies where id = v_company;

  with base as (
    select i.*,
           d.name as dealership_name,
           (i.status = 'void' and exists (select 1 from public.invoice_items ii join public.jobs j on j.id = ii.job_id
                                          where ii.invoice_id = i.id and j.deleted_at is not null)) as deleted,
           coalesce(i.status in ('submitted','partial') and i.submitted_at < now() - make_interval(days => v_days), false) as overdue
    from public.invoices i
    join public.dealerships d on d.id = i.dealership_id
    where i.company_id = v_company
      and (case coalesce(p_status, 'all')
             when 'all'       then i.status <> 'void'
             when 'unpaid'    then i.status in ('draft','submitted','partial')
             when 'outstanding' then i.status in ('submitted','partial')
             when 'overdue'   then i.status in ('submitted','partial') and i.submitted_at < now() - make_interval(days => v_days)
             when 'draft'     then i.status = 'draft'
             when 'submitted' then i.status = 'submitted'
             when 'partial'   then i.status = 'partial'
             when 'paid'      then i.status = 'paid'
             when 'void'      then i.status = 'void' and not exists (select 1 from public.invoice_items ii join public.jobs j on j.id = ii.job_id
                                                                  where ii.invoice_id = i.id and j.deleted_at is not null)
             when 'deleted'   then i.status = 'void' and exists (select 1 from public.invoice_items ii join public.jobs j on j.id = ii.job_id
                                                              where ii.invoice_id = i.id and j.deleted_at is not null)
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
           or d.name ilike '%' || v_q || '%'
           or exists (select 1 from public.invoice_items ii where ii.invoice_id = i.id
                      and (ii.tag_number ilike '%' || v_q || '%' or ii.vin ilike '%' || v_q || '%'
                           or ii.model ilike '%' || v_q || '%' or ii.ro_po_number ilike '%' || v_q || '%'
                           or ii.service_name ilike '%' || v_q || '%')))
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
               'deleted', b.deleted,
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

-- jobs_filtered: say which jobs still need a price (owner only sees it as a flag, never an amount).
create or replace function public.jobs_needing_price()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.job_services js join public.jobs j on j.id = js.job_id
  where js.company_id = public.current_company_id() and public.is_owner() and js.needs_price and j.deleted_at is null and j.invoice_id is null;
$$;
grant execute on function public.jobs_needing_price() to authenticated;
