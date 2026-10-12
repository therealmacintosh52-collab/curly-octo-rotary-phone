-- =============================================================================
-- 0037 — Retail customers and vehicles
--   The everyday-customer side of the shop. A retail job (one logged on the
--   dealership row flagged `retail`) can now belong to a customer and one of
--   their vehicles; dealership jobs keep both null and change in no way.
--   * customers: contact, consents, tags, notes; duplicate match by phone or
--     email; merge; archive.
--   * vehicles: one per car a customer brings in; size class (for retail
--     pricing, next migration) auto-assigned from the NHTSA body class.
--   * odometer_readings: mileage per visit.
--   * jobs.customer_id / vehicle_id; jobs_filtered shows the customer.
-- Re-runnable.
-- Reversal: drop tables odometer_readings, vehicles, customers; drop the two
-- jobs columns; type vehicle_size; the functions below (create_job/update_job
-- revert to 0036 bodies by re-running 0029 + 0036).
-- =============================================================================

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'vehicle_size') then
    create type public.vehicle_size as enum ('compact', 'sedan', 'suv_truck', 'xl');
  end if;
end $$;

-- Digits only; a leading US country code is dropped so (916) 555-0100 and +1 916 555 0100 match.
create or replace function public.phone_digits(p text)
returns text language sql immutable as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) = 11 and left(regexp_replace(p, '\D', '', 'g'), 1) = '1'
      then substr(regexp_replace(p, '\D', '', 'g'), 2)
    else nullif(regexp_replace(p, '\D', '', 'g'), '')
  end
$$;

-- NHTSA vPIC "Body Class" → pricing size class. Mirrors src/lib/retail/size-class.ts.
create or replace function public.size_class_for_body(p_body text)
returns public.vehicle_size language sql immutable as $$
  select case
    when p_body is null then 'sedan'::public.vehicle_size
    when p_body ~* '(bus|motorhome|cargo|step van|cutaway|chassis|incomplete|heavy|limousine)' then 'xl'
    when p_body ~* '(^van|\mvan\M|minivan)' then 'xl'
    when p_body ~* '(sport utility|suv|crossover|cuv|pickup|truck|off-road)' then 'suv_truck'
    when p_body ~* '(hatchback|liftback|coupe|convertible|cabriolet|roadster|targa)' then 'compact'
    else 'sedan'
  end
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id),
  first_name       text not null default '',
  last_name        text not null default '',
  display_name     text generated always as (nullif(trim(first_name || ' ' || last_name), '')) stored,
  phone            text,
  phone_digits     text generated always as (public.phone_digits(phone)) stored,
  email            text,
  email_lc         text generated always as (nullif(lower(trim(coalesce(email, ''))), '')) stored,
  address_line1    text,
  address_line2    text,
  city             text,
  state            text,
  postal_code      text,
  source           text not null default 'walk_in' check (source in ('walk_in', 'online_booking', 'referral', 'phone', 'social', 'other')),
  tags             text[] not null default '{}',
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  sms_opt_in       boolean not null default false,
  sms_opt_in_at    timestamptz,
  consent_source   text,
  notes            text,
  archived_at      timestamptz,
  merged_into_id   uuid references public.customers (id),
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint customers_identity check (nullif(trim(first_name || last_name), '') is not null or phone is not null or email is not null)
);
create index if not exists customers_company_phone_idx on public.customers (company_id, phone_digits) where phone_digits is not null;
create index if not exists customers_company_email_idx on public.customers (company_id, email_lc) where email_lc is not null;
create index if not exists customers_company_name_idx  on public.customers (company_id, lower(display_name));
create index if not exists customers_tags_idx          on public.customers using gin (tags);

create table if not exists public.vehicles (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id),
  customer_id       uuid not null references public.customers (id),
  vin               text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  year              integer check (year is null or (year >= 1900 and year <= 2100)),
  make              text,
  model             text,
  trim              text,
  body_class        text,
  size_class        public.vehicle_size not null default 'sedan',
  size_class_source text not null default 'manual' check (size_class_source in ('nhtsa', 'manual')),
  color             text,
  plate             text,
  notes             text,
  archived_at       timestamptz,
  created_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists vehicles_company_customer_idx on public.vehicles (company_id, customer_id);
create index if not exists vehicles_company_vin_idx      on public.vehicles (company_id, vin) where vin is not null;
create index if not exists vehicles_company_plate_idx    on public.vehicles (company_id, upper(plate)) where plate is not null;

create table if not exists public.odometer_readings (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  vehicle_id uuid not null references public.vehicles (id),
  reading    integer not null check (reading > 0 and reading < 10000000),
  read_at    timestamptz not null default now(),
  job_id     uuid references public.jobs (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists odometer_vehicle_idx on public.odometer_readings (vehicle_id, read_at desc);

alter table public.jobs add column if not exists customer_id uuid references public.customers (id);
alter table public.jobs add column if not exists vehicle_id  uuid references public.vehicles (id);
create index if not exists jobs_customer_idx on public.jobs (customer_id) where customer_id is not null;
create index if not exists jobs_vehicle_idx  on public.jobs (vehicle_id)  where vehicle_id is not null;

-- Timestamps and the audit trail, same triggers as every other table.
do $$
declare t text;
begin
  foreach t in array array['customers', 'vehicles'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.tg_set_updated_at()', t);
  end loop;
  foreach t in array array['customers', 'vehicles', 'odometer_readings'] loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: every member reads and may add a walk-in; edits by admins or the creator.
-- ---------------------------------------------------------------------------
alter table public.customers         enable row level security;
alter table public.vehicles          enable row level security;
alter table public.odometer_readings enable row level security;

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated
  using (company_id = public.current_company_id());
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated
  with check (company_id = public.current_company_id());
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated
  using (company_id = public.current_company_id() and (public.is_admin() or created_by = auth.uid()))
  with check (company_id = public.current_company_id());

drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles for select to authenticated
  using (company_id = public.current_company_id());
drop policy if exists vehicles_insert on public.vehicles;
create policy vehicles_insert on public.vehicles for insert to authenticated
  with check (company_id = public.current_company_id());
drop policy if exists vehicles_update on public.vehicles;
create policy vehicles_update on public.vehicles for update to authenticated
  using (company_id = public.current_company_id() and (public.is_admin() or created_by = auth.uid()))
  with check (company_id = public.current_company_id());

drop policy if exists odometer_select on public.odometer_readings;
create policy odometer_select on public.odometer_readings for select to authenticated
  using (company_id = public.current_company_id());
drop policy if exists odometer_insert on public.odometer_readings;
create policy odometer_insert on public.odometer_readings for insert to authenticated
  with check (company_id = public.current_company_id());
drop policy if exists odometer_admin on public.odometer_readings;
create policy odometer_admin on public.odometer_readings for delete to authenticated
  using (company_id = public.current_company_id() and public.is_admin());

grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.vehicles to authenticated;
grant select, insert, delete on public.odometer_readings to authenticated;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

-- Same phone or email inside the company (live customers only).
create or replace function public.find_duplicate_customers(p_phone text default null, p_email text default null, p_exclude uuid default null)
returns setof public.customers language sql stable security definer set search_path = public as $$
  select c.*
  from public.customers c
  where c.company_id = public.current_company_id()
    and c.archived_at is null and c.merged_into_id is null
    and (p_exclude is null or c.id <> p_exclude)
    and ((public.phone_digits(p_phone) is not null and c.phone_digits = public.phone_digits(p_phone))
         or (nullif(lower(trim(coalesce(p_email, ''))), '') is not null and c.email_lc = lower(trim(p_email))))
  order by c.updated_at desc
$$;
grant execute on function public.find_duplicate_customers(text, text, uuid) to authenticated;

-- Create or update a customer. Consent timestamps are set when a consent flips on.
create or replace function public.save_customer(p jsonb)
returns public.customers language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_uid     uuid := auth.uid();
  v_id      uuid := nullif(p ->> 'id', '')::uuid;
  v_row     public.customers;
  v_first   text := nullif(left(trim(coalesce(p ->> 'first_name', '')), 80), '');
  v_last    text := nullif(left(trim(coalesce(p ->> 'last_name', '')), 80), '');
  v_phone   text := nullif(left(trim(coalesce(p ->> 'phone', '')), 40), '');
  v_email   text := nullif(left(trim(coalesce(p ->> 'email', '')), 160), '');
  v_tags    text[];
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  if v_first is null and v_last is null and v_phone is null and v_email is null then
    raise exception 'A name, phone or email is required' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email does not look right' using errcode = '22023';
  end if;
  if v_phone is not null and length(public.phone_digits(v_phone)) < 7 then
    raise exception 'That phone number does not look right' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct nullif(trim(x), '')) filter (where nullif(trim(x), '') is not null), '{}')
    into v_tags from jsonb_array_elements_text(coalesce(p -> 'tags', '[]'::jsonb)) x;

  if v_id is null then
    insert into public.customers (company_id, first_name, last_name, phone, email, address_line1, address_line2, city, state, postal_code,
                                  source, tags, marketing_opt_in, marketing_opt_in_at, sms_opt_in, sms_opt_in_at, consent_source, notes, created_by)
    values (v_company, coalesce(v_first, ''), coalesce(v_last, ''), v_phone, v_email,
            nullif(trim(p ->> 'address_line1'), ''), nullif(trim(p ->> 'address_line2'), ''), nullif(trim(p ->> 'city'), ''),
            nullif(trim(p ->> 'state'), ''), nullif(trim(p ->> 'postal_code'), ''),
            coalesce(nullif(p ->> 'source', ''), 'walk_in'), v_tags,
            coalesce((p ->> 'marketing_opt_in')::boolean, false), case when coalesce((p ->> 'marketing_opt_in')::boolean, false) then now() end,
            coalesce((p ->> 'sms_opt_in')::boolean, false), case when coalesce((p ->> 'sms_opt_in')::boolean, false) then now() end,
            nullif(trim(p ->> 'consent_source'), ''), nullif(trim(p ->> 'notes'), ''), v_uid)
    returning * into v_row;
  else
    select * into v_row from public.customers where id = v_id and company_id = v_company;
    if not found then
      raise exception 'Customer not found' using errcode = 'P0002';
    end if;
    if not public.is_admin() and v_row.created_by is distinct from v_uid then
      raise exception 'Only an admin can edit this customer' using errcode = '42501';
    end if;
    update public.customers set
      first_name = coalesce(v_first, ''),
      last_name  = coalesce(v_last, ''),
      phone      = v_phone,
      email      = v_email,
      address_line1 = case when p ? 'address_line1' then nullif(trim(p ->> 'address_line1'), '') else address_line1 end,
      address_line2 = case when p ? 'address_line2' then nullif(trim(p ->> 'address_line2'), '') else address_line2 end,
      city          = case when p ? 'city' then nullif(trim(p ->> 'city'), '') else city end,
      state         = case when p ? 'state' then nullif(trim(p ->> 'state'), '') else state end,
      postal_code   = case when p ? 'postal_code' then nullif(trim(p ->> 'postal_code'), '') else postal_code end,
      source        = coalesce(nullif(p ->> 'source', ''), source),
      tags          = case when p ? 'tags' then v_tags else tags end,
      marketing_opt_in    = coalesce((p ->> 'marketing_opt_in')::boolean, marketing_opt_in),
      marketing_opt_in_at = case when coalesce((p ->> 'marketing_opt_in')::boolean, marketing_opt_in) and not marketing_opt_in then now()
                                 when not coalesce((p ->> 'marketing_opt_in')::boolean, marketing_opt_in) then null else marketing_opt_in_at end,
      sms_opt_in    = coalesce((p ->> 'sms_opt_in')::boolean, sms_opt_in),
      sms_opt_in_at = case when coalesce((p ->> 'sms_opt_in')::boolean, sms_opt_in) and not sms_opt_in then now()
                           when not coalesce((p ->> 'sms_opt_in')::boolean, sms_opt_in) then null else sms_opt_in_at end,
      consent_source = case when p ? 'consent_source' then nullif(trim(p ->> 'consent_source'), '') else consent_source end,
      notes         = case when p ? 'notes' then nullif(trim(p ->> 'notes'), '') else notes end
    where id = v_id
    returning * into v_row;
  end if;
  return v_row;
end $$;
grant execute on function public.save_customer(jsonb) to authenticated;

create or replace function public.archive_customer(p_id uuid, p_on boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.customers set archived_at = case when p_on then coalesce(archived_at, now()) else null end
  where id = p_id and company_id = public.current_company_id();
  if not found then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
end $$;
grant execute on function public.archive_customer(uuid, boolean) to authenticated;

-- Fold one customer into another: vehicles and jobs move over, blanks on the
-- kept record are filled from the merged one, tags are unioned, the merged
-- record is archived and points at the survivor.
create or replace function public.merge_customers(p_keep uuid, p_merge uuid)
returns public.customers language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_keep    public.customers;
  v_merge   public.customers;
begin
  perform public.assert_admin();
  if p_keep = p_merge then
    raise exception 'Pick two different customers' using errcode = '22023';
  end if;
  select * into v_keep  from public.customers where id = p_keep  and company_id = v_company for update;
  select * into v_merge from public.customers where id = p_merge and company_id = v_company for update;
  if v_keep.id is null or v_merge.id is null then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  if v_merge.merged_into_id is not null then
    raise exception 'That customer was already merged' using errcode = 'P0001';
  end if;

  update public.vehicles set customer_id = p_keep where customer_id = p_merge;
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs set customer_id = p_keep where customer_id = p_merge;
  perform set_config('app.bypass_lock', 'off', true);

  update public.customers set
    first_name = case when first_name = '' then v_merge.first_name else first_name end,
    last_name  = case when last_name  = '' then v_merge.last_name  else last_name  end,
    phone      = coalesce(phone, v_merge.phone),
    email      = coalesce(email, v_merge.email),
    address_line1 = coalesce(address_line1, v_merge.address_line1),
    address_line2 = coalesce(address_line2, v_merge.address_line2),
    city        = coalesce(city, v_merge.city),
    state       = coalesce(state, v_merge.state),
    postal_code = coalesce(postal_code, v_merge.postal_code),
    tags        = (select coalesce(array_agg(distinct t), '{}') from unnest(tags || v_merge.tags) t),
    marketing_opt_in    = marketing_opt_in or v_merge.marketing_opt_in,
    marketing_opt_in_at = coalesce(marketing_opt_in_at, v_merge.marketing_opt_in_at),
    sms_opt_in    = sms_opt_in or v_merge.sms_opt_in,
    sms_opt_in_at = coalesce(sms_opt_in_at, v_merge.sms_opt_in_at),
    notes       = case when v_merge.notes is null then notes
                       when notes is null then v_merge.notes
                       else notes || E'\n' || v_merge.notes end
  where id = p_keep
  returning * into v_keep;

  update public.customers set merged_into_id = p_keep, archived_at = coalesce(archived_at, now()) where id = p_merge;
  return v_keep;
end $$;
grant execute on function public.merge_customers(uuid, uuid) to authenticated;

-- The Customers list: search by name, phone digits, email, plate or VIN; paged.
-- Money (lifetime spend) only for owner/admin.
create or replace function public.customers_filtered(p_q text default null, p_archived boolean default false, p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_q       text := nullif(trim(coalesce(p_q, '')), '');
  v_digits  text := public.phone_digits(p_q);
  v_money   boolean := public.can_price_jobs();
  v_out     jsonb;
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  with base as (
    select c.*
    from public.customers c
    where c.company_id = v_company
      and c.merged_into_id is null
      and (case when p_archived then c.archived_at is not null else c.archived_at is null end)
      and (v_q is null
           or c.display_name ilike '%' || v_q || '%'
           or c.email_lc like '%' || lower(v_q) || '%'
           or (v_digits is not null and length(v_digits) >= 3 and c.phone_digits like '%' || v_digits || '%')
           or exists (select 1 from public.vehicles v where v.customer_id = c.id
                      and (v.vin ilike '%' || v_q || '%' or v.plate ilike '%' || v_q || '%'
                           or concat_ws(' ', v.year::text, v.make, v.model) ilike '%' || v_q || '%')))
  ),
  pagen as (
    select * from base order by lower(display_name) nulls last, created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'count', (select count(*) from base),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
               'id', b.id,
               'display_name', b.display_name,
               'phone', b.phone,
               'email', b.email,
               'tags', to_jsonb(b.tags),
               'archived_at', b.archived_at,
               'vehicles', (select coalesce(jsonb_agg(nullif(concat_ws(' ', v.year::text, v.make, v.model), '') order by v.created_at), '[]'::jsonb)
                              from public.vehicles v where v.customer_id = b.id and v.archived_at is null),
               'visits', (select count(*) from public.jobs j where j.customer_id = b.id and j.deleted_at is null),
               'last_visit', (select max(j.performed_at) from public.jobs j where j.customer_id = b.id and j.deleted_at is null),
               'lifetime_spend', case when v_money then (select coalesce(sum(j.paid_amount), 0) from public.jobs j where j.customer_id = b.id and j.deleted_at is null) end
             ) order by lower(b.display_name) nulls last, b.created_at desc), '[]'::jsonb) from pagen b)
  ) into v_out;
  return v_out;
end $$;
grant execute on function public.customers_filtered(text, boolean, integer, integer) to authenticated;

-- One customer, everything about them, read top to bottom. Later migrations
-- add estimates, appointments and payments to the same shape.
create or replace function public.customer_timeline(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_money   boolean := public.can_price_jobs();
  v_c       public.customers;
  v_out     jsonb;
begin
  select * into v_c from public.customers where id = p_id and company_id = v_company;
  if not found then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  select jsonb_build_object(
    'customer', to_jsonb(v_c),
    'merged_into', case when v_c.merged_into_id is not null then (select jsonb_build_object('id', m.id, 'display_name', m.display_name) from public.customers m where m.id = v_c.merged_into_id) end,
    'vehicles', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', v.id, 'vin', v.vin, 'year', v.year, 'make', v.make, 'model', v.model, 'trim', v.trim,
                   'body_class', v.body_class, 'size_class', v.size_class, 'size_class_source', v.size_class_source,
                   'color', v.color, 'plate', v.plate, 'notes', v.notes, 'archived_at', v.archived_at,
                   'odometer', (select jsonb_build_object('reading', o.reading, 'read_at', o.read_at) from public.odometer_readings o where o.vehicle_id = v.id order by o.read_at desc, o.reading desc limit 1),
                   'visits', (select count(*) from public.jobs j where j.vehicle_id = v.id and j.deleted_at is null),
                   'last_visit', (select max(j.performed_at) from public.jobs j where j.vehicle_id = v.id and j.deleted_at is null)
                 ) order by v.archived_at nulls first, v.created_at desc), '[]'::jsonb) from public.vehicles v where v.customer_id = v_c.id),
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object(
               'id', j.id, 'performed_at', j.performed_at, 'tag', j.tag_number,
               'vehicle', nullif(concat_ws(' ', j.year::text, j.make, j.model), ''), 'vehicle_id', j.vehicle_id,
               'services', (select coalesce(jsonb_agg(coalesce(nullif(js.label, ''), s.name) order by s.sort_order, s.name), '[]'::jsonb)
                              from public.job_services js join public.services s on s.id = js.service_id where js.job_id = j.id),
               'paid_at', j.paid_at, 'payment_method', j.payment_method,
               'paid_amount', case when v_money then j.paid_amount end,
               'deleted_at', j.deleted_at
             ) order by j.performed_at desc), '[]'::jsonb) from public.jobs j where j.customer_id = v_c.id),
    'stats', jsonb_build_object(
      'visits', (select count(*) from public.jobs j where j.customer_id = v_c.id and j.deleted_at is null),
      'last_visit', (select max(j.performed_at) from public.jobs j where j.customer_id = v_c.id and j.deleted_at is null),
      'lifetime_spend', case when v_money then (select coalesce(sum(j.paid_amount), 0) from public.jobs j where j.customer_id = v_c.id and j.deleted_at is null) end
    )
  ) into v_out;
  return v_out;
end $$;
grant execute on function public.customer_timeline(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------
create or replace function public.save_vehicle(p jsonb)
returns public.vehicles language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_uid     uuid := auth.uid();
  v_id      uuid := nullif(p ->> 'id', '')::uuid;
  v_row     public.vehicles;
  v_vin     text := nullif(upper(trim(coalesce(p ->> 'vin', ''))), '');
  v_size    public.vehicle_size;
  v_src     text;
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  if v_vin is not null and v_vin !~ '^[A-HJ-NPR-Z0-9]{17}$' then
    raise exception 'VIN must be 17 characters (no I, O or Q)' using errcode = '22023';
  end if;
  if nullif(p ->> 'size_class', '') is not null then
    v_size := (p ->> 'size_class')::public.vehicle_size;
    v_src := 'manual';
  elsif nullif(p ->> 'body_class', '') is not null then
    v_size := public.size_class_for_body(p ->> 'body_class');
    v_src := 'nhtsa';
  end if;

  if v_id is null then
    if not exists (select 1 from public.customers where id = (p ->> 'customer_id')::uuid and company_id = v_company) then
      raise exception 'Customer not found' using errcode = 'P0002';
    end if;
    if nullif(trim(coalesce(p ->> 'model', '')), '') is null and v_vin is null and nullif(trim(coalesce(p ->> 'plate', '')), '') is null then
      raise exception 'A model, VIN or plate is required' using errcode = '22023';
    end if;
    insert into public.vehicles (company_id, customer_id, vin, year, make, model, trim, body_class, size_class, size_class_source, color, plate, notes, created_by)
    values (v_company, (p ->> 'customer_id')::uuid, v_vin, nullif(p ->> 'year', '')::integer,
            nullif(trim(p ->> 'make'), ''), nullif(trim(p ->> 'model'), ''), nullif(trim(p ->> 'trim'), ''), nullif(trim(p ->> 'body_class'), ''),
            coalesce(v_size, 'sedan'), coalesce(v_src, 'manual'),
            nullif(trim(p ->> 'color'), ''), nullif(upper(trim(p ->> 'plate')), ''), nullif(trim(p ->> 'notes'), ''), v_uid)
    returning * into v_row;
  else
    select * into v_row from public.vehicles where id = v_id and company_id = v_company;
    if not found then
      raise exception 'Vehicle not found' using errcode = 'P0002';
    end if;
    if not public.is_admin() and v_row.created_by is distinct from v_uid then
      raise exception 'Only an admin can edit this vehicle' using errcode = '42501';
    end if;
    update public.vehicles set
      vin        = case when p ? 'vin' then v_vin else vin end,
      year       = case when p ? 'year' then nullif(p ->> 'year', '')::integer else year end,
      make       = case when p ? 'make' then nullif(trim(p ->> 'make'), '') else make end,
      model      = case when p ? 'model' then nullif(trim(p ->> 'model'), '') else model end,
      trim       = case when p ? 'trim' then nullif(trim(p ->> 'trim'), '') else trim end,
      body_class = case when p ? 'body_class' then nullif(trim(p ->> 'body_class'), '') else body_class end,
      size_class = coalesce(v_size, size_class),
      size_class_source = coalesce(v_src, size_class_source),
      color      = case when p ? 'color' then nullif(trim(p ->> 'color'), '') else color end,
      plate      = case when p ? 'plate' then nullif(upper(trim(p ->> 'plate')), '') else plate end,
      notes      = case when p ? 'notes' then nullif(trim(p ->> 'notes'), '') else notes end,
      archived_at = case when p ? 'archived' then (case when (p ->> 'archived')::boolean then coalesce(archived_at, now()) else null end) else archived_at end
    where id = v_id
    returning * into v_row;
  end if;

  if nullif(p ->> 'odometer', '') is not null then
    insert into public.odometer_readings (company_id, vehicle_id, reading, created_by)
    values (v_company, v_row.id, (p ->> 'odometer')::integer, v_uid);
  end if;
  return v_row;
end $$;
grant execute on function public.save_vehicle(jsonb) to authenticated;

create or replace function public.add_odometer(p_vehicle uuid, p_reading integer, p_read_at timestamptz default now(), p_job uuid default null)
returns public.odometer_readings language plpgsql security definer set search_path = public as $$
declare v_company uuid := public.current_company_id(); v_row public.odometer_readings;
begin
  if not exists (select 1 from public.vehicles where id = p_vehicle and company_id = v_company) then
    raise exception 'Vehicle not found' using errcode = 'P0002';
  end if;
  insert into public.odometer_readings (company_id, vehicle_id, reading, read_at, job_id, created_by)
  values (v_company, p_vehicle, p_reading, coalesce(p_read_at, now()), p_job, auth.uid())
  returning * into v_row;
  return v_row;
end $$;
grant execute on function public.add_odometer(uuid, integer, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Jobs: a retail job may carry a customer and a vehicle. The bodies are the
-- 0029 ones (prices resolved by _job_service_price as 0036 left it) plus the
-- two links and the odometer. Dealership jobs behave exactly as before.
-- ---------------------------------------------------------------------------
create or replace function public._job_customer_vehicle(p_company uuid, p_dealer public.dealerships, p jsonb,
                                                        out o_customer uuid, out o_vehicle uuid, out o_vehicle_row public.vehicles)
language plpgsql stable security definer set search_path = public as $$
begin
  o_customer := nullif(p ->> 'customer_id', '')::uuid;
  o_vehicle  := nullif(p ->> 'vehicle_id', '')::uuid;
  if o_customer is null and o_vehicle is null then
    return;
  end if;
  if not coalesce(p_dealer.retail, false) then
    raise exception 'Customers and vehicles belong to retail jobs only' using errcode = '22023';
  end if;
  if o_vehicle is not null then
    select * into o_vehicle_row from public.vehicles where id = o_vehicle and company_id = p_company;
    if not found then
      raise exception 'Vehicle not found' using errcode = 'P0002';
    end if;
    if o_customer is null then
      o_customer := o_vehicle_row.customer_id;
    elsif o_vehicle_row.customer_id <> o_customer then
      raise exception 'That vehicle belongs to another customer' using errcode = '22023';
    end if;
  end if;
  if not exists (select 1 from public.customers where id = o_customer and company_id = p_company) then
    raise exception 'Customer not found' using errcode = 'P0002';
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
  cv            record;
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

  select * into cv from public._job_customer_vehicle(v_company, v_dealer, p);

  -- The car's details come from the vehicle record when the form left them blank.
  v_vin := coalesce(nullif(upper(trim(p ->> 'vin')), ''), (cv.o_vehicle_row).vin);

  insert into public.jobs (company_id, dealership_id, detailer_id, client_id, tag_number, vin, year, make, model,
                           color, performed_at, ro_po_number, notes, customer_id, vehicle_id, created_by, updated_by)
  values (v_company, v_dealer.id, v_detailer, v_client_id,
          upper(trim(p ->> 'tag_number')), v_vin,
          coalesce(nullif(p ->> 'year', '')::integer, (cv.o_vehicle_row).year),
          coalesce(nullif(trim(p ->> 'make'), ''), (cv.o_vehicle_row).make),
          coalesce(nullif(trim(p ->> 'model'), ''), (cv.o_vehicle_row).model),
          coalesce(nullif(trim(p ->> 'color'), ''), (cv.o_vehicle_row).color),
          coalesce(nullif(p ->> 'performed_at', '')::timestamptz, now()),
          nullif(trim(p ->> 'ro_po_number'), ''), nullif(trim(p ->> 'notes'), ''),
          cv.o_customer, cv.o_vehicle,
          v_uid, v_uid)
  returning * into v_job;

  for v_svc in select * from jsonb_array_elements(p -> 'services') loop
    select * into r from public._job_service_price(v_dealer.id, (v_svc ->> 'service_id')::uuid,
                                                   nullif(v_svc ->> 'price', '')::numeric, v_svc ->> 'override_reason');
    insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price)
    values (v_company, v_job.id, (v_svc ->> 'service_id')::uuid, r.o_price, r.o_reason, nullif(left(trim(v_svc ->> 'label'), 120), ''), r.o_needs_price);
  end loop;

  if cv.o_vehicle is not null and nullif(p ->> 'odometer', '') is not null then
    insert into public.odometer_readings (company_id, vehicle_id, reading, read_at, job_id, created_by)
    values (v_company, cv.o_vehicle, (p ->> 'odometer')::integer, v_job.performed_at, v_job.id, v_uid);
  end if;

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
  cv           record;
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

  -- Links only change when the payload names them; a move to a dealership row drops them.
  if p ? 'customer_id' or p ? 'vehicle_id' then
    select * into cv from public._job_customer_vehicle(v_company, v_dealer, p);
  elsif coalesce(v_dealer.retail, false) then
    select v_job.customer_id as o_customer, v_job.vehicle_id as o_vehicle into cv;
  else
    select null::uuid as o_customer, null::uuid as o_vehicle into cv;
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
    customer_id   = cv.o_customer,
    vehicle_id    = cv.o_vehicle,
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

  if v_job.vehicle_id is not null and nullif(p ->> 'odometer', '') is not null then
    insert into public.odometer_readings (company_id, vehicle_id, reading, read_at, job_id, created_by)
    values (v_company, v_job.vehicle_id, (p ->> 'odometer')::integer, v_job.performed_at, v_job.id, v_uid);
  end if;

  return v_job;
end $$;

-- The Jobs list: the customer's name on retail rows, searchable by name and phone.
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'jobs_filtered';
  if v_src is not null and position('c.display_name as customer_name' in v_src) = 0 then
    v_src := replace(v_src, 'd.name as dealership_name, d.retail,', 'd.name as dealership_name, d.retail, c.display_name as customer_name, c.phone as customer_phone,');
    v_src := replace(v_src, 'join public.profiles p on p.id = j.detailer_id', 'join public.profiles p on p.id = j.detailer_id
    left join public.customers c on c.id = j.customer_id');
    v_src := replace(v_src, 'or d.name ilike ''%'' || v_q || ''%''', 'or d.name ilike ''%'' || v_q || ''%''
           or c.display_name ilike ''%'' || v_q || ''%''
           or (public.phone_digits(v_q) is not null and length(public.phone_digits(v_q)) >= 3 and c.phone_digits like ''%'' || public.phone_digits(v_q) || ''%'')');
    v_src := replace(v_src, '''retail'', b.retail,', '''retail'', b.retail, ''customer_id'', b.customer_id, ''customer'', b.customer_name, ''vehicle_id'', b.vehicle_id,');
    execute v_src;
  end if;
end $$;
