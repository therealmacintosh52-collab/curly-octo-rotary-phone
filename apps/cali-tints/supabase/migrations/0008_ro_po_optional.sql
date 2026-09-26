-- =============================================================================
-- 0008 — RO/PO is optional everywhere
--   The log form no longer asks for an RO/PO number. create_job / update_job
--   stop requiring it for per-job dealerships; generate_per_job_invoices
--   already gives each job without an RO/PO its own invoice.
-- =============================================================================

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
      insert into public.job_services (company_id, job_id, service_id, price, override_reason)
      values (v_company, p_id, (v_svc ->> 'service_id')::uuid, v_price, v_reason);
    end loop;
  end if;

  return v_job;
end $$;
