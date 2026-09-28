-- =============================================================================
-- 0020 — "Other" says what it was
--   job_services.label: free text typed with an open-amount service such as
--   "Other" ("Headlight restoration"). The invoice line shows the label in
--   place of the service name. create_job / update_job accept `label` per
--   service; the two snapshot functions use it. Re-runnable.
-- =============================================================================

alter table public.job_services add column if not exists label text;

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
         p.full_name, coalesce(nullif(js.label, ''), s.name), js.price
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

    insert into public.job_services (company_id, job_id, service_id, price, override_reason, label)
    values (v_company, v_job.id, (v_svc ->> 'service_id')::uuid, v_price, v_reason, nullif(left(trim(v_svc ->> 'label'), 120), ''));
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
      if not public.price_within_policy((v_svc ->> 'service_id')::uuid, v_list_price, v_price) and v_reason is null then
        raise exception 'A reason is required when overriding the price' using errcode = '22023';
      end if;
      if v_price = v_list_price then v_reason := null; end if;
      insert into public.job_services (company_id, job_id, service_id, price, override_reason, label)
      values (v_company, p_id, (v_svc ->> 'service_id')::uuid, v_price, v_reason, nullif(left(trim(v_svc ->> 'label'), 120), ''));
    end loop;
  end if;

  return v_job;
end $$;

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
         p.full_name, coalesce(nullif(js.label, ''), s.name), js.price
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

