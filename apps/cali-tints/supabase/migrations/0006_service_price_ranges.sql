-- =============================================================================
-- 0006 — services can carry a price range
--
-- Some work is quoted as a range ("touch-up detail $20–40"). Inside the
-- range the detailer just picks the price; only a price OUTSIDE the range
-- (or off the list price when there is no range) needs a written reason.
-- =============================================================================

alter table public.services
  add column if not exists price_min numeric(10,2) check (price_min is null or price_min >= 0),
  add column if not exists price_max numeric(10,2) check (price_max is null or price_max >= 0);
alter table public.services
  add constraint services_price_range_chk check (price_min is null or price_max is null or price_min <= price_max);

-- Price list carries the range (return type change → drop first).
drop function if exists public.dealership_price_list(uuid);
create function public.dealership_price_list(p_dealership_id uuid)
returns table (service_id uuid, name text, description text, category text, price numeric, price_min numeric, price_max numeric, is_override boolean, sort_order integer)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.category,
         coalesce(dsp.price, s.default_price) as price,
         s.price_min, s.price_max,
         dsp.price is not null as is_override,
         s.sort_order
  from public.services s
  left join public.dealership_service_prices dsp
    on dsp.service_id = s.id and dsp.dealership_id = p_dealership_id
  join public.dealerships d on d.id = p_dealership_id
  where s.company_id = public.current_company_id()
    and d.company_id = public.current_company_id()
    and s.active
  order by case s.category when 'new' then 1 when 'used' then 2 when 'service' then 3 else 4 end, s.sort_order, s.name
$$;
grant execute on function public.dealership_price_list(uuid) to authenticated, service_role;

-- True when a price needs no written reason: equal to the list price, or
-- inside the service's declared range.
create or replace function public.price_within_policy(p_service_id uuid, p_list_price numeric, p_price numeric)
returns boolean language sql stable security definer set search_path = public as $$
  select p_price = p_list_price
      or exists (
           select 1 from public.services s
            where s.id = p_service_id
              and s.price_min is not null and s.price_max is not null
              and p_price between s.price_min and s.price_max)
$$;
grant execute on function public.price_within_policy(uuid, numeric, numeric) to authenticated, service_role;

-- create_job / update_job: same signatures, override rule now uses the policy.
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
