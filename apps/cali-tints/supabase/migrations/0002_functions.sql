-- =============================================================================
-- 0002_functions.sql — auth helpers and business RPCs
--
-- All RPCs are SECURITY DEFINER and scope themselves to the caller's company
-- via current_company_id(). They are the only code path that links jobs to
-- invoices (behind the lock trigger's bypass), so invariants live in one
-- place instead of being re-implemented in the app.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Auth helpers. STABLE + SECURITY DEFINER so RLS policies can call them
-- without recursing into the profiles policies.
-- ---------------------------------------------------------------------------
create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid() and active
$$;

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner','admin') from public.profiles where id = auth.uid() and active), false)
$$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

-- Raise unless the caller is an active admin of a company.
create or replace function public.assert_admin()
returns void language plpgsql stable as $$
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Pricing
-- ---------------------------------------------------------------------------
-- Dealership-specific price if set, otherwise the service default.
create or replace function public.resolve_service_price(p_dealership_id uuid, p_service_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(
    (select price from public.dealership_service_prices
      where dealership_id = p_dealership_id and service_id = p_service_id),
    (select default_price from public.services where id = p_service_id)
  )
$$;

-- Price list for a dealership: every active service with its effective price.
create or replace function public.dealership_price_list(p_dealership_id uuid)
returns table (service_id uuid, name text, description text, price numeric, is_override boolean, sort_order integer)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description,
         coalesce(dsp.price, s.default_price) as price,
         dsp.price is not null as is_override,
         s.sort_order
  from public.services s
  left join public.dealership_service_prices dsp
    on dsp.service_id = s.id and dsp.dealership_id = p_dealership_id
  join public.dealerships d on d.id = p_dealership_id
  where s.company_id = public.current_company_id()
    and d.company_id = public.current_company_id()
    and s.active
  order by s.sort_order, s.name
$$;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

-- Duplicate check: same tag or VIN at this dealership in the last 7 days.
create or replace function public.find_duplicate_jobs(p_tag_number text, p_vin text default null, p_dealership_id uuid default null)
returns table (id uuid, tag_number text, vin text, year integer, make text, model text,
               performed_at timestamptz, detailer_name text, services text)
language sql stable security definer set search_path = public as $$
  select j.id, j.tag_number, j.vin, j.year, j.make, j.model, j.performed_at, p.full_name,
         (select string_agg(s.name, ', ' order by s.name)
            from public.job_services js join public.services s on s.id = js.service_id
           where js.job_id = j.id)
  from public.jobs j
  join public.profiles p on p.id = j.detailer_id
  where j.company_id = public.current_company_id()
    and j.deleted_at is null
    and j.performed_at >= now() - interval '7 days'
    and (p_dealership_id is null or j.dealership_id = p_dealership_id)
    and (upper(j.tag_number) = upper(p_tag_number)
         or (p_vin is not null and j.vin = upper(p_vin)))
  order by j.performed_at desc
  limit 5
$$;

-- Create a job with its services in one transaction.
-- payload:
-- {
--   client_id, dealership_id, tag_number, vin?, year?, make?, model?, color?,
--   performed_at?, ro_po_number?, notes?, detailer_id? (admin only),
--   services: [{ service_id, price?, override_reason? }]
-- }
-- Idempotent on client_id: a retry after a dropped connection returns the
-- existing row instead of creating a duplicate.
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
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;

  v_client_id := coalesce(nullif(p ->> 'client_id', '')::uuid, gen_random_uuid());

  -- Idempotent retry
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

  -- Detailers always log as themselves; admins may log on behalf of someone.
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

  if v_dealer.invoice_mode = 'per_job' and coalesce(trim(p ->> 'ro_po_number'), '') = '' then
    raise exception 'RO/PO number is required for % (per-job invoicing)', v_dealer.name using errcode = '22023';
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
    if v_price <> v_list_price and v_reason is null then
      raise exception 'A reason is required when overriding the price' using errcode = '22023';
    end if;
    if v_price = v_list_price then v_reason := null; end if;

    insert into public.job_services (company_id, job_id, service_id, price, override_reason)
    values (v_company, v_job.id, (v_svc ->> 'service_id')::uuid, v_price, v_reason);
  end loop;

  return v_job;
end $$;

-- Update an uninvoiced job. Admins can edit any job in the company; a
-- detailer only their own. Services are replaced wholesale.
create or replace function public.update_job(p_id uuid, p jsonb)
returns public.jobs language plpgsql security definer set search_path = public as $$
declare
  v_company    uuid := public.current_company_id();
  v_uid        uuid := auth.uid();
  v_job        public.jobs;
  v_dealer     public.dealerships;
  v_svc        jsonb;
  v_list_price numeric;
  v_price      numeric;
  v_reason     text;
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

  if v_dealer.invoice_mode = 'per_job'
     and coalesce(nullif(trim(p ->> 'ro_po_number'), ''), v_job.ro_po_number) is null then
    raise exception 'RO/PO number is required for % (per-job invoicing)', v_dealer.name using errcode = '22023';
  end if;

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
      v_list_price := public.resolve_service_price(v_job.dealership_id, (v_svc ->> 'service_id')::uuid);
      if v_list_price is null then
        raise exception 'Unknown service %', v_svc ->> 'service_id' using errcode = '22023';
      end if;
      v_price  := coalesce(nullif(v_svc ->> 'price', '')::numeric, v_list_price);
      v_reason := nullif(trim(v_svc ->> 'override_reason'), '');
      if v_price <> v_list_price and v_reason is null then
        raise exception 'A reason is required when overriding the price' using errcode = '22023';
      end if;
      if v_price = v_list_price then v_reason := null; end if;
      insert into public.job_services (company_id, job_id, service_id, price, override_reason)
      values (v_company, p_id, (v_svc ->> 'service_id')::uuid, v_price, v_reason);
    end loop;
  end if;

  return v_job;
end $$;

-- Soft delete (admin only). Invoiced jobs stay locked.
create or replace function public.soft_delete_job(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.jobs set deleted_at = now(), deleted_by = auth.uid(), delete_reason = p_reason
  where id = p_id and company_id = public.current_company_id() and deleted_at is null;
  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;
end $$;

create or replace function public.restore_job(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.jobs set deleted_at = null, deleted_by = null, delete_reason = null
  where id = p_id and company_id = public.current_company_id() and deleted_at is not null;
end $$;

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

-- Internal: build one invoice from a set of job ids. Caller must hold the
-- company row lock (for the invoice counter) and have validated the jobs.
create or replace function public._create_invoice_from_jobs(
  p_company uuid, p_dealership uuid, p_job_ids uuid[], p_period_start date, p_period_end date,
  p_ro_po text, p_notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company  public.companies;
  v_dealer   public.dealerships;
  v_number   integer;
  v_id       uuid;
  v_subtotal numeric(12,2);
  v_rate     numeric(6,4);
  v_tax      numeric(12,2);
begin
  select * into v_company from public.companies where id = p_company for update;
  select * into v_dealer from public.dealerships where id = p_dealership;

  v_number := v_company.next_invoice_number;
  update public.companies set next_invoice_number = v_number + 1 where id = p_company;

  v_rate := coalesce(v_dealer.tax_rate, v_company.tax_rate);

  insert into public.invoices (company_id, dealership_id, number, display_number, period_start, period_end,
                               ro_po_number, tax_rate, payment_terms, notes, created_by)
  values (p_company, p_dealership, v_number, v_company.invoice_prefix || lpad(v_number::text, 6, '0'),
          p_period_start, p_period_end, p_ro_po, v_rate,
          coalesce(v_dealer.payment_terms, v_company.payment_terms), p_notes, auth.uid())
  returning id into v_id;

  -- Snapshot every service line so the invoice is immutable.
  insert into public.invoice_items (company_id, invoice_id, job_id, job_service_id, sort_order, performed_at,
                                    tag_number, vin, year, make, model, color, ro_po_number, detailer_name,
                                    service_name, price)
  select p_company, v_id, j.id, js.id,
         row_number() over (order by j.performed_at, j.tag_number, s.sort_order, s.name),
         j.performed_at, j.tag_number, j.vin, j.year, j.make, j.model, j.color, j.ro_po_number,
         p.full_name, s.name, js.price
  from public.jobs j
  join public.job_services js on js.job_id = j.id
  join public.services s on s.id = js.service_id
  join public.profiles p on p.id = j.detailer_id
  where j.id = any (p_job_ids);

  select coalesce(sum(price), 0) into v_subtotal from public.invoice_items where invoice_id = v_id;
  v_tax := round(v_subtotal * v_rate, 2);

  update public.invoices set subtotal = v_subtotal, tax = v_tax, total = v_subtotal + v_tax where id = v_id;

  -- Link + lock the jobs (bypass the lock trigger for this statement only).
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs set invoice_id = v_id, status = 'invoiced', updated_by = auth.uid()
  where id = any (p_job_ids);
  perform set_config('app.bypass_lock', 'off', true);

  return v_id;
end $$;

-- Uninvoiced jobs for a dealership in a date range (inclusive, company tz).
create or replace function public.uninvoiced_jobs(p_dealership_id uuid, p_start date, p_end date)
returns setof public.jobs language sql stable security definer set search_path = public as $$
  select j.*
  from public.jobs j
  join public.companies c on c.id = j.company_id
  where j.company_id = public.current_company_id()
    and public.is_admin()
    and j.dealership_id = p_dealership_id
    and j.deleted_at is null
    and j.invoice_id is null
    and (j.performed_at at time zone c.timezone)::date between p_start and p_end
  order by j.performed_at, j.tag_number
$$;

-- Batch mode: one invoice for every uninvoiced job in the period.
create or replace function public.generate_invoice(p_dealership_id uuid, p_start date, p_end date, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_ids     uuid[];
begin
  perform public.assert_admin();
  if not exists (select 1 from public.dealerships where id = p_dealership_id and company_id = v_company) then
    raise exception 'Unknown dealership' using errcode = '22023';
  end if;

  select array_agg(id) into v_ids from public.uninvoiced_jobs(p_dealership_id, p_start, p_end);
  if v_ids is null then
    raise exception 'No uninvoiced jobs between % and %', p_start, p_end using errcode = 'P0002';
  end if;

  return public._create_invoice_from_jobs(v_company, p_dealership_id, v_ids, p_start, p_end, null, p_notes);
end $$;

-- Per-job mode: one invoice per distinct RO/PO among all pending jobs.
-- Jobs sharing an RO/PO land on the same invoice; jobs with no RO/PO each
-- get their own. Returns the created invoice ids.
create or replace function public.generate_per_job_invoices(p_dealership_id uuid, p_notes text default null)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_tz      text;
  r         record;
begin
  perform public.assert_admin();
  select timezone into v_tz from public.companies where id = v_company;
  if not exists (select 1 from public.dealerships where id = p_dealership_id and company_id = v_company) then
    raise exception 'Unknown dealership' using errcode = '22023';
  end if;

  for r in
    select coalesce(j.ro_po_number, j.id::text) as grp,
           j.ro_po_number,
           array_agg(j.id) as ids,
           min((j.performed_at at time zone v_tz)::date) as d0,
           max((j.performed_at at time zone v_tz)::date) as d1
    from public.jobs j
    where j.company_id = v_company and j.dealership_id = p_dealership_id
      and j.deleted_at is null and j.invoice_id is null
    group by 1, 2
    order by min(j.performed_at)
  loop
    return next public._create_invoice_from_jobs(v_company, p_dealership_id, r.ids, r.d0, r.d1, r.ro_po_number, p_notes);
  end loop;
  return;
end $$;

-- Void a draft/submitted invoice with no payments; jobs go back to uninvoiced.
create or replace function public.void_invoice(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_inv public.invoices;
begin
  perform public.assert_admin();
  select * into v_inv from public.invoices where id = p_id and company_id = public.current_company_id() for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if v_inv.status = 'void' then return; end if;
  if v_inv.amount_paid > 0 then
    raise exception 'Cannot void an invoice with payments recorded' using errcode = 'P0001';
  end if;

  update public.invoices set status = 'void', voided_at = now(), void_reason = p_reason where id = p_id;

  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs set invoice_id = null, status = 'logged', updated_by = auth.uid() where invoice_id = p_id;
  perform set_config('app.bypass_lock', 'off', true);
end $$;

-- Record a (possibly partial) payment. Status/amount roll-up is by trigger.
create or replace function public.record_payment(
  p_invoice_id uuid, p_amount numeric, p_paid_at date default current_date,
  p_method public.payment_method default 'check', p_reference text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_company uuid := public.current_company_id(); v_id uuid;
begin
  perform public.assert_admin();
  if not exists (select 1 from public.invoices where id = p_invoice_id and company_id = v_company and status <> 'void') then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  insert into public.invoice_payments (company_id, invoice_id, amount, paid_at, method, reference, note, created_by)
  values (v_company, p_invoice_id, p_amount, p_paid_at, p_method, p_reference, p_note, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Manually mark an invoice as submitted via portal / paper.
create or replace function public.mark_invoice_submitted(
  p_invoice_id uuid, p_method public.submission_method, p_note text default null, p_confirmation_path text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_company uuid := public.current_company_id(); v_id uuid;
begin
  perform public.assert_admin();
  if not exists (select 1 from public.invoices where id = p_invoice_id and company_id = v_company and status <> 'void') then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  insert into public.invoice_submissions (company_id, invoice_id, method, status, provider, note, confirmation_path, created_by)
  values (v_company, p_invoice_id, p_method, 'sent', 'manual', p_note, p_confirmation_path, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------------
-- One round trip for the owner dashboard. Breakdowns cover [p_start, p_end]
-- (defaults: month to date). All dates are in the company timezone.
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
                     select s.name, count(*) as jobs, sum(js.price) as revenue
                     from public.job_services js
                     join public.services s on s.id = js.service_id
                     join j on j.id = js.job_id
                     where j.d between v_start and v_end
                     group by s.name) x),
    'by_detailer', (select coalesce(jsonb_agg(row_to_json(x) order by x.jobs desc), '[]'::jsonb) from (
                      select p.full_name as name, count(*) as jobs, sum(j.amount) as revenue
                      from j join public.profiles p on p.id = j.detailer_id
                      where j.d between v_start and v_end
                      group by p.full_name) x),
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

-- ---------------------------------------------------------------------------
-- Grants: PostgREST needs execute on RPCs for the authenticated role.
-- ---------------------------------------------------------------------------
revoke execute on function public._create_invoice_from_jobs(uuid, uuid, uuid[], date, date, text, text) from public, anon, authenticated;
grant execute on function
  public.current_company_id(), public.current_user_role(), public.is_admin(), public.is_member(),
  public.resolve_service_price(uuid, uuid), public.dealership_price_list(uuid),
  public.find_duplicate_jobs(text, text, uuid), public.create_job(jsonb), public.update_job(uuid, jsonb),
  public.soft_delete_job(uuid, text), public.restore_job(uuid),
  public.uninvoiced_jobs(uuid, date, date), public.generate_invoice(uuid, date, date, text),
  public.generate_per_job_invoices(uuid, text), public.void_invoice(uuid, text),
  public.record_payment(uuid, numeric, date, public.payment_method, text, text),
  public.mark_invoice_submitted(uuid, public.submission_method, text, text),
  public.dashboard_stats(date, date)
to authenticated, service_role;
