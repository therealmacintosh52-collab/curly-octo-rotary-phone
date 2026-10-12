-- =============================================================================
-- 0039 — Estimates: options (Good / Better / Best), add-ons, a public
--   approval page by unguessable link, e-signature, authorizations.
--   * Prices are resolved server-side from the size matrix (quote_total);
--     the client never sets a price except the amount of an "Other" line.
--   * Money (option and line totals) is owner/admin only: the columns are
--     unreadable by app users; estimate_detail()/estimates_filtered() null
--     them for everyone else. The public page sees its own estimate only,
--     through the token.
--   * Accepting writes an append-only authorization (who, when, how, what,
--     the signature file) and locks the estimate.
-- Re-runnable. Reversal: drop the four tables, the bucket row and the
-- functions; drop companies.next_estimate_number.
-- =============================================================================

alter table public.companies add column if not exists next_estimate_number integer not null default 1;

create table if not exists public.estimates (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  number             integer not null,
  display_number     text not null,
  customer_id        uuid not null references public.customers (id),
  vehicle_id         uuid references public.vehicles (id),
  size_class         public.vehicle_size not null default 'sedan',
  status             text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  token              text not null unique default translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_'),
  expires_at         timestamptz,
  po_number          text,
  internal_notes     text,
  customer_notes     text,
  selected_option_id uuid,
  subtotal           numeric(12,2) not null default 0,
  tax_rate           numeric(6,4) not null default 0,
  tax                numeric(12,2) not null default 0,
  total              numeric(12,2) not null default 0,
  deposit_required   numeric(12,2) not null default 0,
  sent_at            timestamptz,
  first_viewed_at    timestamptz,
  last_viewed_at     timestamptz,
  view_count         integer not null default 0,
  accepted_at        timestamptz,
  declined_at        timestamptz,
  decline_reason     text,
  job_id             uuid references public.jobs (id),
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (company_id, number)
);
create index if not exists estimates_company_status_idx on public.estimates (company_id, status, created_at desc);
create index if not exists estimates_customer_idx on public.estimates (customer_id);

create table if not exists public.estimate_options (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  estimate_id      uuid not null references public.estimates (id) on delete cascade,
  tier             text not null default 'single' check (tier in ('good', 'better', 'best', 'single')),
  name             text not null,
  description      text,
  recommended      boolean not null default false,
  sort_order       integer not null default 0,
  subtotal         numeric(12,2) not null default 0,
  tax              numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  duration_minutes integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists estimate_options_estimate_idx on public.estimate_options (estimate_id, sort_order);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'estimates_selected_option_fk') then
    alter table public.estimates add constraint estimates_selected_option_fk foreign key (selected_option_id) references public.estimate_options (id) on delete set null;
  end if;
end $$;

create table if not exists public.estimate_lines (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  estimate_id       uuid not null references public.estimates (id) on delete cascade,
  option_id         uuid references public.estimate_options (id) on delete cascade,   -- null = add-on offered on every option
  service_id        uuid references public.services (id),
  name              text not null,
  benefit_text      text,
  qty               numeric(8,2) not null default 1 check (qty > 0),
  unit_price        numeric(12,2) not null default 0,
  modifiers         jsonb not null default '[]'::jsonb,
  taxable           boolean not null default false,
  line_total        numeric(12,2) not null default 0,
  duration_minutes  integer not null default 0,
  default_on        boolean not null default true,
  customer_approved boolean,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists estimate_lines_estimate_idx on public.estimate_lines (estimate_id, option_id, sort_order);

create table if not exists public.estimate_authorizations (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  estimate_id        uuid not null references public.estimates (id) on delete cascade,
  authorized_at      timestamptz not null default now(),
  name               text not null,
  method             text not null check (method in ('online', 'in_person', 'phone', 'email')),
  by_staff           uuid references public.profiles (id),
  selected_option_id uuid references public.estimate_options (id),
  approved_line_ids  uuid[] not null default '{}',
  signature_path     text,
  ip                 text,
  user_agent         text,
  pay_choice         text check (pay_choice is null or pay_choice in ('deposit', 'at_shop')),
  total              numeric(12,2) not null default 0
);
create index if not exists estimate_auth_estimate_idx on public.estimate_authorizations (estimate_id, authorized_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', false, 1048576, array['image/png'])
on conflict (id) do nothing;
-- Signatures are written and read server-side only (admin client); no policies for app users.

do $$
declare t text;
begin
  execute 'drop trigger if exists set_updated_at on public.estimates';
  execute 'create trigger set_updated_at before update on public.estimates for each row execute function public.tg_set_updated_at()';
  foreach t in array array['estimates', 'estimate_options', 'estimate_lines', 'estimate_authorizations'] loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Access: every member may read an estimate (minus money); only owner/admin
-- write, and only through the RPCs below. anon touches nothing directly.
-- ---------------------------------------------------------------------------
alter table public.estimates               enable row level security;
alter table public.estimate_options        enable row level security;
alter table public.estimate_lines          enable row level security;
alter table public.estimate_authorizations enable row level security;

do $$
declare t text;
begin
  foreach t in array array['estimates', 'estimate_options', 'estimate_lines', 'estimate_authorizations'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (company_id = public.current_company_id())', t, t);
  end loop;
end $$;

revoke all on public.estimates, public.estimate_options, public.estimate_lines, public.estimate_authorizations from authenticated, anon;
grant select (id, company_id, number, display_number, customer_id, vehicle_id, size_class, status, expires_at, po_number, internal_notes, customer_notes, selected_option_id,
              sent_at, first_viewed_at, last_viewed_at, view_count, accepted_at, declined_at, decline_reason, job_id, created_by, created_at, updated_at)
  on public.estimates to authenticated;
grant select (id, company_id, estimate_id, tier, name, description, recommended, sort_order, duration_minutes, created_at) on public.estimate_options to authenticated;
grant select (id, company_id, estimate_id, option_id, service_id, name, benefit_text, qty, taxable, duration_minutes, default_on, customer_approved, sort_order, created_at) on public.estimate_lines to authenticated;
grant select (id, company_id, estimate_id, authorized_at, name, method, by_staff, selected_option_id, approved_line_ids, signature_path, pay_choice) on public.estimate_authorizations to authenticated;

-- ---------------------------------------------------------------------------
-- Pricing an estimate: every option and add-on through quote_total(); the
-- headline total is the recommended (or first) option plus the add-ons that
-- are on by default; after acceptance it is what the customer chose.
-- ---------------------------------------------------------------------------
create or replace function public._estimate_recompute(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e        public.estimates;
  v_opt    uuid;
  v_sub    numeric := 0;
  v_tax    numeric := 0;
  v_rate   numeric;
  v_set    public.retail_settings;
  v_dep    numeric := 0;
begin
  select * into e from public.estimates where id = p_id;
  select tax_rate into v_rate from public.companies where id = e.company_id;
  select * into v_set from public.retail_settings where company_id = e.company_id;
  v_opt := e.selected_option_id;
  if v_opt is null then
    select id into v_opt from public.estimate_options where estimate_id = p_id order by recommended desc, sort_order limit 1;
  end if;
  -- the option's lines
  select coalesce(sum(line_total), 0), coalesce(sum(case when taxable then line_total else 0 end), 0) into v_sub, v_tax
  from public.estimate_lines where estimate_id = p_id and option_id = v_opt;
  -- the add-ons that count: approved ones once the customer answered, else the default-on ones
  select v_sub + coalesce(sum(line_total), 0), v_tax + coalesce(sum(case when taxable then line_total else 0 end), 0) into v_sub, v_tax
  from public.estimate_lines
  where estimate_id = p_id and option_id is null
    and (case when e.status in ('accepted') then customer_approved is true else default_on end);
  v_tax := round(v_tax * coalesce(v_rate, 0), 2);
  if v_set.deposit_kind = 'percent' then v_dep := round((v_sub + v_tax) * v_set.deposit_value / 100, 2);
  elsif v_set.deposit_kind = 'flat' then v_dep := least(v_set.deposit_value, v_sub + v_tax);
  else v_dep := 0; end if;
  update public.estimates set subtotal = v_sub, tax_rate = coalesce(v_rate, 0), tax = v_tax, total = v_sub + v_tax, deposit_required = v_dep where id = p_id;
end $$;

-- Replace an estimate's options and lines from the builder's payload, pricing every line.
-- p: {customer_id, vehicle_id, size_class?, expires_at?, po_number, internal_notes, customer_notes,
--     options: [{tier, name, description, recommended, lines: [{service_id, qty, label, price, modifiers[]}]}],
--     addons: [{service_id, qty, label, price, modifiers[], default_on}]}
create or replace function public._estimate_apply(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  e        public.estimates;
  v_opt    jsonb;
  v_line   jsonb;
  v_optid  uuid;
  v_q      jsonb;
  v_ql     jsonb;
  v_i      integer := 0;
  v_j      integer;
  v_rec    uuid;
begin
  select * into e from public.estimates where id = p_id;
  if jsonb_array_length(coalesce(p -> 'options', '[]'::jsonb)) = 0 then
    raise exception 'An estimate needs at least one option' using errcode = '22023';
  end if;
  update public.estimates set selected_option_id = null where id = p_id;
  delete from public.estimate_lines where estimate_id = p_id;
  delete from public.estimate_options where estimate_id = p_id;

  for v_opt in select * from jsonb_array_elements(p -> 'options') loop
    v_i := v_i + 1;
    if jsonb_array_length(coalesce(v_opt -> 'lines', '[]'::jsonb)) = 0 then
      raise exception 'Option "%" has no services', coalesce(v_opt ->> 'name', v_i::text) using errcode = '22023';
    end if;
    v_q := public.quote_total(e.size_class, v_opt -> 'lines');
    insert into public.estimate_options (company_id, estimate_id, tier, name, description, recommended, sort_order, subtotal, tax, total, duration_minutes)
    values (e.company_id, p_id, coalesce(nullif(v_opt ->> 'tier', ''), 'single'), coalesce(nullif(left(trim(v_opt ->> 'name'), 60), ''), 'Option ' || v_i),
            nullif(left(trim(coalesce(v_opt ->> 'description', '')), 300), ''), coalesce((v_opt ->> 'recommended')::boolean, false), v_i,
            (v_q ->> 'subtotal')::numeric, (v_q ->> 'tax')::numeric, (v_q ->> 'total')::numeric, (v_q ->> 'duration_minutes')::int)
    returning id into v_optid;
    if coalesce((v_opt ->> 'recommended')::boolean, false) and v_rec is null then v_rec := v_optid; end if;
    v_j := 0;
    for v_ql in select * from jsonb_array_elements(v_q -> 'lines') loop
      v_j := v_j + 1;
      insert into public.estimate_lines (company_id, estimate_id, option_id, service_id, name, benefit_text, qty, unit_price, modifiers, taxable, line_total, duration_minutes, default_on, sort_order)
      values (e.company_id, p_id, v_optid, (v_ql ->> 'service_id')::uuid, v_ql ->> 'name', v_ql ->> 'benefit_text', (v_ql ->> 'qty')::numeric, (v_ql ->> 'unit_price')::numeric,
              v_ql -> 'modifiers', (v_ql ->> 'taxable')::boolean, (v_ql ->> 'line_total')::numeric, (v_ql ->> 'duration_minutes')::int, true, v_j);
    end loop;
  end loop;

  v_j := 0;
  for v_line in select * from jsonb_array_elements(coalesce(p -> 'addons', '[]'::jsonb)) loop
    v_j := v_j + 1;
    v_q := public.quote_total(e.size_class, jsonb_build_array(v_line));
    v_ql := v_q -> 'lines' -> 0;
    insert into public.estimate_lines (company_id, estimate_id, option_id, service_id, name, benefit_text, qty, unit_price, modifiers, taxable, line_total, duration_minutes, default_on, sort_order)
    values (e.company_id, p_id, null, (v_ql ->> 'service_id')::uuid, v_ql ->> 'name', v_ql ->> 'benefit_text', (v_ql ->> 'qty')::numeric, (v_ql ->> 'unit_price')::numeric,
            v_ql -> 'modifiers', (v_ql ->> 'taxable')::boolean, (v_ql ->> 'line_total')::numeric, (v_ql ->> 'duration_minutes')::int, coalesce((v_line ->> 'default_on')::boolean, false), v_j);
  end loop;

  perform public._estimate_recompute(p_id);
end $$;

create or replace function public.create_estimate(p jsonb)
returns public.estimates language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_uid     uuid := auth.uid();
  v_num     integer;
  v_size    public.vehicle_size;
  v_days    integer;
  e         public.estimates;
begin
  if not public.is_owner_admin() then
    raise exception 'Only the owner or an admin writes estimates' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customers where id = (p ->> 'customer_id')::uuid and company_id = v_company) then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  if nullif(p ->> 'vehicle_id', '') is not null then
    select size_class into v_size from public.vehicles where id = (p ->> 'vehicle_id')::uuid and company_id = v_company and customer_id = (p ->> 'customer_id')::uuid;
    if v_size is null then
      raise exception 'Vehicle not found' using errcode = 'P0002';
    end if;
  end if;
  if nullif(p ->> 'size_class', '') is not null then v_size := (p ->> 'size_class')::public.vehicle_size; end if;
  select estimate_valid_days into v_days from public.retail_settings where company_id = v_company;

  update public.companies set next_estimate_number = next_estimate_number + 1 where id = v_company returning next_estimate_number - 1 into v_num;
  insert into public.estimates (company_id, number, display_number, customer_id, vehicle_id, size_class, expires_at, po_number, internal_notes, customer_notes, created_by)
  values (v_company, v_num, 'EST-' || lpad(v_num::text, 6, '0'), (p ->> 'customer_id')::uuid, nullif(p ->> 'vehicle_id', '')::uuid, coalesce(v_size, 'sedan'),
          coalesce(nullif(p ->> 'expires_at', '')::timestamptz, now() + make_interval(days => coalesce(v_days, 14))),
          nullif(left(trim(coalesce(p ->> 'po_number', '')), 40), ''), nullif(trim(coalesce(p ->> 'internal_notes', '')), ''), nullif(trim(coalesce(p ->> 'customer_notes', '')), ''), v_uid)
  returning * into e;
  perform public._estimate_apply(e.id, p);
  select * into e from public.estimates where id = e.id;
  return e;
end $$;
grant execute on function public.create_estimate(jsonb) to authenticated;

create or replace function public.update_estimate(p_id uuid, p jsonb)
returns public.estimates language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  e         public.estimates;
  v_size    public.vehicle_size;
begin
  if not public.is_owner_admin() then
    raise exception 'Only the owner or an admin writes estimates' using errcode = '42501';
  end if;
  select * into e from public.estimates where id = p_id and company_id = v_company;
  if not found then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  if e.status in ('accepted', 'declined') then
    raise exception 'This estimate was already answered; make a new one' using errcode = 'P0001';
  end if;
  if p ? 'vehicle_id' then
    if nullif(p ->> 'vehicle_id', '') is not null then
      select size_class into v_size from public.vehicles where id = (p ->> 'vehicle_id')::uuid and company_id = v_company and customer_id = e.customer_id;
      if v_size is null then
        raise exception 'Vehicle not found' using errcode = 'P0002';
      end if;
    end if;
  end if;
  if nullif(p ->> 'size_class', '') is not null then v_size := (p ->> 'size_class')::public.vehicle_size; end if;
  update public.estimates set
    vehicle_id     = case when p ? 'vehicle_id' then nullif(p ->> 'vehicle_id', '')::uuid else vehicle_id end,
    size_class     = coalesce(v_size, size_class),
    expires_at     = coalesce(nullif(p ->> 'expires_at', '')::timestamptz, expires_at),
    po_number      = case when p ? 'po_number' then nullif(left(trim(p ->> 'po_number'), 40), '') else po_number end,
    internal_notes = case when p ? 'internal_notes' then nullif(trim(p ->> 'internal_notes'), '') else internal_notes end,
    customer_notes = case when p ? 'customer_notes' then nullif(trim(p ->> 'customer_notes'), '') else customer_notes end,
    -- an edited estimate goes back to draft until it is sent again
    status         = case when p ? 'options' then 'draft' else status end
  where id = p_id;
  if p ? 'options' then
    perform public._estimate_apply(p_id, p);
  else
    perform public._estimate_recompute(p_id);
  end if;
  select * into e from public.estimates where id = p_id;
  return e;
end $$;
grant execute on function public.update_estimate(uuid, jsonb) to authenticated;

-- Mark sent (the app emails or texts the link); returns the token and expiry.
create or replace function public.send_estimate(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.estimates;
begin
  if not public.is_owner_admin() then
    raise exception 'Only the owner or an admin sends estimates' using errcode = '42501';
  end if;
  select * into e from public.estimates where id = p_id and company_id = public.current_company_id();
  if not found then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  if e.status in ('accepted', 'declined') then
    raise exception 'This estimate was already answered' using errcode = 'P0001';
  end if;
  if e.expires_at < now() then
    update public.estimates set expires_at = now() + interval '14 days' where id = p_id;
  end if;
  update public.estimates set status = case when status = 'viewed' then 'viewed' else 'sent' end, sent_at = coalesce(sent_at, now()) where id = p_id returning * into e;
  return jsonb_build_object('token', e.token, 'expires_at', e.expires_at, 'display_number', e.display_number);
end $$;
grant execute on function public.send_estimate(uuid) to authenticated;

-- Staff records the customer's yes (in person, on the phone, by email).
create or replace function public.mark_estimate_accepted(p_id uuid, p_option uuid, p_line_ids uuid[] default '{}', p_name text default null, p_method text default 'in_person')
returns public.estimates language plpgsql security definer set search_path = public as $$
declare e public.estimates;
begin
  if not public.is_owner_admin() then
    raise exception 'Only the owner or an admin records an approval' using errcode = '42501';
  end if;
  select * into e from public.estimates where id = p_id and company_id = public.current_company_id();
  if not found then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  if e.status in ('accepted', 'declined') then
    raise exception 'This estimate was already answered' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.estimate_options where id = p_option and estimate_id = p_id) then
    raise exception 'Pick one of the estimate''s options' using errcode = '22023';
  end if;
  update public.estimate_lines set customer_approved = (id = any (coalesce(p_line_ids, '{}'))) where estimate_id = p_id and option_id is null;
  update public.estimates set status = 'accepted', accepted_at = now(), selected_option_id = p_option where id = p_id;
  perform public._estimate_recompute(p_id);
  select * into e from public.estimates where id = p_id;
  insert into public.estimate_authorizations (company_id, estimate_id, name, method, by_staff, selected_option_id, approved_line_ids, total)
  values (e.company_id, p_id, coalesce(nullif(trim(p_name), ''), (select coalesce(display_name, 'Customer') from public.customers where id = e.customer_id)),
          coalesce(p_method, 'in_person'), auth.uid(), p_option, coalesce(p_line_ids, '{}'), e.total);
  return e;
end $$;
grant execute on function public.mark_estimate_accepted(uuid, uuid, uuid[], text, text) to authenticated;

create or replace function public.decline_estimate(p_id uuid, p_reason text default null)
returns public.estimates language plpgsql security definer set search_path = public as $$
declare e public.estimates;
begin
  if not public.is_owner_admin() then
    raise exception 'Only the owner or an admin declines an estimate' using errcode = '42501';
  end if;
  update public.estimates set status = 'declined', declined_at = now(), decline_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_id and company_id = public.current_company_id() and status not in ('accepted', 'declined')
  returning * into e;
  if not found then
    raise exception 'Estimate not found or already answered' using errcode = 'P0002';
  end if;
  return e;
end $$;
grant execute on function public.decline_estimate(uuid, text) to authenticated;

-- An accepted estimate becomes a retail job on the shop's row, at the snapshot prices.
-- p: {dealership_id?, tag_number?, performed_at?, detailer_id?, notes?}
create or replace function public.convert_estimate_to_job(p_id uuid, p jsonb default '{}'::jsonb)
returns public.jobs language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_uid     uuid := auth.uid();
  e         public.estimates;
  v_dealer  public.dealerships;
  v_veh     public.vehicles;
  v_detailer uuid := v_uid;
  j         public.jobs;
  l         record;
  v_other   boolean;
begin
  if not public.is_owner_admin() then
    raise exception 'Only the owner or an admin converts an estimate' using errcode = '42501';
  end if;
  select * into e from public.estimates where id = p_id and company_id = v_company;
  if not found then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  if e.status <> 'accepted' then
    raise exception 'Only an accepted estimate becomes a job' using errcode = 'P0001';
  end if;
  if e.job_id is not null then
    select * into j from public.jobs where id = e.job_id;
    return j;
  end if;
  select * into v_dealer from public.dealerships
   where company_id = v_company and active and retail and (nullif(p ->> 'dealership_id', '') is null or id = (p ->> 'dealership_id')::uuid)
   order by name limit 1;
  if v_dealer.id is null then
    raise exception 'No retail location is set up (Settings → Dealerships → Retail)' using errcode = 'P0001';
  end if;
  if nullif(p ->> 'detailer_id', '') is not null and exists (select 1 from public.profiles where id = (p ->> 'detailer_id')::uuid and company_id = v_company) then
    v_detailer := (p ->> 'detailer_id')::uuid;
  end if;
  if e.vehicle_id is not null then
    select * into v_veh from public.vehicles where id = e.vehicle_id;
  end if;

  insert into public.jobs (company_id, dealership_id, detailer_id, client_id, tag_number, vin, year, make, model, color, performed_at, notes, customer_id, vehicle_id, created_by, updated_by)
  values (v_company, v_dealer.id, v_detailer, gen_random_uuid(),
          coalesce(nullif(upper(trim(p ->> 'tag_number')), ''), replace(e.display_number, 'EST-', 'E-')),
          v_veh.vin, v_veh.year, v_veh.make, v_veh.model, v_veh.color,
          coalesce(nullif(p ->> 'performed_at', '')::timestamptz, now()),
          coalesce(nullif(trim(p ->> 'notes'), ''), e.customer_notes),
          e.customer_id, e.vehicle_id, v_uid, v_uid)
  returning * into j;

  for l in
    select el.*, s.default_price = 0 and s.price_min = 0 and s.price_max >= 10000 as open_amount
    from public.estimate_lines el left join public.services s on s.id = el.service_id
    where el.estimate_id = p_id and (el.option_id = e.selected_option_id or (el.option_id is null and el.customer_approved is true))
    order by el.option_id nulls last, el.sort_order
  loop
    if l.service_id is null then continue; end if;
    v_other := coalesce(l.open_amount, false);
    insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price)
    values (v_company, j.id, l.service_id, l.line_total, null, case when v_other or l.name <> (select name from public.services where id = l.service_id) then left(l.name, 120) end, false);
  end loop;

  update public.estimates set job_id = j.id where id = p_id;
  return j;
end $$;
grant execute on function public.convert_estimate_to_job(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Reads for staff: list and detail. Money only for owner/admin.
-- ---------------------------------------------------------------------------
create or replace function public._estimate_json(p_id uuid, p_money boolean, p_public boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', e.id, 'display_number', e.display_number, 'status', e.status, 'size_class', e.size_class,
    'expires_at', e.expires_at, 'po_number', e.po_number,
    'internal_notes', case when p_public then null else e.internal_notes end,
    'customer_notes', e.customer_notes,
    'selected_option_id', e.selected_option_id,
    'sent_at', e.sent_at, 'first_viewed_at', e.first_viewed_at, 'last_viewed_at', e.last_viewed_at, 'view_count', e.view_count,
    'accepted_at', e.accepted_at, 'declined_at', e.declined_at, 'decline_reason', e.decline_reason, 'job_id', e.job_id,
    'created_at', e.created_at, 'updated_at', e.updated_at,
    'token', case when p_public then e.token else null end,
    'subtotal', case when p_money then e.subtotal end, 'tax_rate', case when p_money then e.tax_rate end,
    'tax', case when p_money then e.tax end, 'total', case when p_money then e.total end,
    'deposit_required', case when p_money then e.deposit_required end,
    'customer', (select jsonb_build_object('id', c.id, 'display_name', case when p_public then nullif(trim(c.first_name), '') else c.display_name end,
                                           'first_name', c.first_name, 'phone', case when p_public then null else c.phone end, 'email', case when p_public then null else c.email end)
                 from public.customers c where c.id = e.customer_id),
    'vehicle', (select jsonb_build_object('id', v.id, 'name', nullif(concat_ws(' ', v.year::text, v.make, v.model), ''), 'color', v.color, 'plate', case when p_public then null else v.plate end, 'size_class', v.size_class)
                from public.vehicles v where v.id = e.vehicle_id),
    'options', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', o.id, 'tier', o.tier, 'name', o.name, 'description', o.description, 'recommended', o.recommended, 'sort_order', o.sort_order,
                  'duration_minutes', o.duration_minutes,
                  'subtotal', case when p_money then o.subtotal end, 'tax', case when p_money then o.tax end, 'total', case when p_money then o.total end,
                  'lines', (select coalesce(jsonb_agg(jsonb_build_object(
                              'id', l.id, 'service_id', l.service_id, 'name', l.name, 'benefit_text', l.benefit_text, 'qty', l.qty, 'taxable', l.taxable,
                              'duration_minutes', l.duration_minutes,
                              'unit_price', case when p_money then l.unit_price end, 'line_total', case when p_money then l.line_total end,
                              'modifiers', case when p_money then l.modifiers else (select coalesce(jsonb_agg(jsonb_build_object('code', m ->> 'code', 'label', m ->> 'label')), '[]'::jsonb) from jsonb_array_elements(l.modifiers) m) end
                            ) order by l.sort_order), '[]'::jsonb) from public.estimate_lines l where l.option_id = o.id)
                ) order by o.sort_order), '[]'::jsonb) from public.estimate_options o where o.estimate_id = e.id),
    'addons', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', l.id, 'service_id', l.service_id, 'name', l.name, 'benefit_text', l.benefit_text, 'qty', l.qty, 'taxable', l.taxable,
                 'duration_minutes', l.duration_minutes, 'default_on', l.default_on, 'customer_approved', l.customer_approved,
                 'unit_price', case when p_money then l.unit_price end, 'line_total', case when p_money then l.line_total end,
                 'modifiers', case when p_money then l.modifiers else (select coalesce(jsonb_agg(jsonb_build_object('code', m ->> 'code', 'label', m ->> 'label')), '[]'::jsonb) from jsonb_array_elements(l.modifiers) m) end
               ) order by l.sort_order), '[]'::jsonb) from public.estimate_lines l where l.estimate_id = e.id and l.option_id is null),
    'authorizations', (select coalesce(jsonb_agg(jsonb_build_object(
                         'id', a.id, 'authorized_at', a.authorized_at, 'name', a.name, 'method', a.method, 'by_staff', a.by_staff,
                         'selected_option_id', a.selected_option_id, 'approved_line_ids', to_jsonb(a.approved_line_ids), 'signature_path', a.signature_path,
                         'pay_choice', a.pay_choice, 'total', case when p_money then a.total end
                       ) order by a.authorized_at desc), '[]'::jsonb) from public.estimate_authorizations a where a.estimate_id = e.id),
    'company', (select jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email, 'address_line1', c.address_line1, 'address_line2', c.address_line2, 'city', c.city, 'state', c.state, 'postal_code', c.postal_code, 'logo_path', c.logo_path, 'timezone', c.timezone)
                from public.companies c where c.id = e.company_id),
    'policy', (select jsonb_build_object('policy_text', rs.policy_text, 'deposit_kind', rs.deposit_kind, 'deposit_value', rs.deposit_value, 'deposit_refundable', rs.deposit_refundable,
                                         'signature_required', rs.signature_required_estimate, 'cancel_hours', rs.cancel_hours)
               from public.retail_settings rs where rs.company_id = e.company_id),
    -- what the customer sees always carries money: it is their quote
    'public_money', p_public
  )
  from public.estimates e where e.id = p_id
$$;
revoke execute on function public._estimate_json(uuid, boolean, boolean) from public, anon, authenticated;

create or replace function public.estimate_detail(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := public.current_company_id();
begin
  if not exists (select 1 from public.estimates where id = p_id and company_id = v_company) then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  return public._estimate_json(p_id, public.can_price_jobs(), false);
end $$;
grant execute on function public.estimate_detail(uuid) to authenticated;

create or replace function public.estimates_filtered(p_q text default null, p_status text default 'all', p_customer uuid default null, p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_money   boolean := public.can_price_jobs();
  v_q       text := nullif(trim(coalesce(p_q, '')), '');
  v_out     jsonb;
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  with base as (
    select e.*, c.display_name as customer_name, c.phone as customer_phone,
           (select nullif(concat_ws(' ', v.year::text, v.make, v.model), '') from public.vehicles v where v.id = e.vehicle_id) as vehicle_name
    from public.estimates e
    join public.customers c on c.id = e.customer_id
    where e.company_id = v_company
      and (case coalesce(p_status, 'all')
             when 'all' then true
             when 'open' then e.status in ('draft', 'sent', 'viewed')
             else e.status = p_status end)
      and (p_customer is null or e.customer_id = p_customer)
      and (v_q is null
           or e.display_number ilike '%' || v_q || '%'
           or c.display_name ilike '%' || v_q || '%'
           or (public.phone_digits(v_q) is not null and length(public.phone_digits(v_q)) >= 3 and c.phone_digits like '%' || public.phone_digits(v_q) || '%')
           or exists (select 1 from public.vehicles v where v.id = e.vehicle_id and concat_ws(' ', v.year::text, v.make, v.model) ilike '%' || v_q || '%'))
  ),
  pagen as (
    select * from base order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'count', (select count(*) from base),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
               'id', b.id, 'display_number', b.display_number, 'status', b.status, 'created_at', b.created_at, 'expires_at', b.expires_at,
               'sent_at', b.sent_at, 'last_viewed_at', b.last_viewed_at, 'accepted_at', b.accepted_at, 'job_id', b.job_id,
               'customer_id', b.customer_id, 'customer', b.customer_name, 'vehicle', b.vehicle_name, 'size_class', b.size_class,
               'options', (select count(*) from public.estimate_options o where o.estimate_id = b.id),
               'total', case when v_money then b.total end
             ) order by b.created_at desc), '[]'::jsonb) from pagen b)
  ) into v_out;
  return v_out;
end $$;
grant execute on function public.estimates_filtered(text, text, uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- The customer's side: by token only. No login; the token is the key.
-- ---------------------------------------------------------------------------
create or replace function public._estimate_for_token(p_token text)
returns public.estimates language sql stable security definer set search_path = public as $$
  select * from public.estimates where token = p_token and length(p_token) >= 20
$$;
revoke execute on function public._estimate_for_token(text) from public, anon, authenticated;

create or replace function public.estimate_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.estimates;
begin
  e := public._estimate_for_token(p_token);
  if e.id is null then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  return public._estimate_json(e.id, true, true);
end $$;
grant execute on function public.estimate_by_token(text) to anon, authenticated;

create or replace function public.estimate_mark_viewed(p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.estimates;
begin
  e := public._estimate_for_token(p_token);
  if e.id is null then return; end if;
  update public.estimates set
    first_viewed_at = coalesce(first_viewed_at, now()),
    last_viewed_at = now(),
    view_count = view_count + 1,
    status = case when status = 'sent' then 'viewed' when status in ('draft', 'sent', 'viewed') and expires_at < now() then 'expired' else status end
  where id = e.id;
end $$;
grant execute on function public.estimate_mark_viewed(text) to anon, authenticated;

-- The customer answers: p = {decision accept|decline, option_id, approved_line_ids[], name, signature_path, pay_choice, ip, user_agent, reason}
create or replace function public.estimate_respond(p_token text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e        public.estimates;
  v_opt    uuid;
  v_ids    uuid[];
  v_name   text := nullif(left(trim(coalesce(p ->> 'name', '')), 120), '');
  v_sig    text := nullif(trim(coalesce(p ->> 'signature_path', '')), '');
  v_req    boolean;
begin
  e := public._estimate_for_token(p_token);
  if e.id is null then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  if e.status in ('accepted', 'declined') then
    raise exception 'This estimate was already answered' using errcode = 'P0001';
  end if;
  if e.expires_at < now() then
    update public.estimates set status = 'expired' where id = e.id;
    raise exception 'This estimate has expired; please ask the shop for a new one' using errcode = 'P0001';
  end if;

  if coalesce(p ->> 'decision', 'accept') = 'decline' then
    update public.estimates set status = 'declined', declined_at = now(), decline_reason = nullif(left(trim(coalesce(p ->> 'reason', '')), 300), '') where id = e.id;
    return jsonb_build_object('status', 'declined');
  end if;

  v_opt := nullif(p ->> 'option_id', '')::uuid;
  if v_opt is null or not exists (select 1 from public.estimate_options where id = v_opt and estimate_id = e.id) then
    raise exception 'Pick an option' using errcode = '22023';
  end if;
  if v_name is null then
    raise exception 'Please type your name' using errcode = '22023';
  end if;
  select signature_required_estimate into v_req from public.retail_settings where company_id = e.company_id;
  if coalesce(v_req, true) and v_sig is null then
    raise exception 'Please sign to approve' using errcode = '22023';
  end if;
  if v_sig is not null and v_sig not like e.company_id::text || '/estimates/' || e.id::text || '/%' then
    raise exception 'Bad signature file' using errcode = '22023';
  end if;
  select coalesce(array_agg(x::uuid), '{}') into v_ids from jsonb_array_elements_text(coalesce(p -> 'approved_line_ids', '[]'::jsonb)) x;

  update public.estimate_lines set customer_approved = (id = any (v_ids)) where estimate_id = e.id and option_id is null;
  update public.estimates set status = 'accepted', accepted_at = now(), selected_option_id = v_opt where id = e.id;
  perform public._estimate_recompute(e.id);
  select * into e from public.estimates where id = e.id;
  insert into public.estimate_authorizations (company_id, estimate_id, name, method, selected_option_id, approved_line_ids, signature_path, ip, user_agent, pay_choice, total)
  values (e.company_id, e.id, v_name, 'online', v_opt, v_ids, v_sig, nullif(left(coalesce(p ->> 'ip', ''), 64), ''), nullif(left(coalesce(p ->> 'user_agent', ''), 300), ''),
          case when p ->> 'pay_choice' in ('deposit', 'at_shop') then p ->> 'pay_choice' else 'at_shop' end, e.total);
  return jsonb_build_object('status', 'accepted', 'total', e.total, 'deposit_required', e.deposit_required, 'display_number', e.display_number);
end $$;
grant execute on function public.estimate_respond(text, jsonb) to anon, authenticated;

-- The public link for the staff who may send it (owner/admin). Nobody else can read the token.
create or replace function public.estimate_link(p_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_token text;
begin
  if not public.can_price_jobs() then
    raise exception 'Only the owner or an admin can share the estimate link' using errcode = '42501';
  end if;
  select token into v_token from public.estimates where id = p_id and company_id = public.current_company_id();
  if v_token is null then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  return v_token;
end $$;
grant execute on function public.estimate_link(uuid) to authenticated;

-- Daily: sent estimates past their date expire.
create or replace function public.expire_estimates()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') then
    raise exception 'service role only' using errcode = '42501';
  end if;
  update public.estimates set status = 'expired' where status in ('sent', 'viewed') and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.expire_estimates() from public, anon, authenticated;
grant execute on function public.expire_estimates() to service_role;

-- The customer's timeline shows their estimates too.
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'customer_timeline';
  if v_src is not null and position('''estimates'',' in v_src) = 0 then
    v_src := replace(v_src, '    ''stats'', jsonb_build_object(', '    ''estimates'', (select coalesce(jsonb_agg(jsonb_build_object(
               ''id'', es.id, ''display_number'', es.display_number, ''status'', es.status, ''created_at'', es.created_at, ''expires_at'', es.expires_at,
               ''vehicle'', (select nullif(concat_ws('' '', v.year::text, v.make, v.model), '''') from public.vehicles v where v.id = es.vehicle_id),
               ''total'', case when v_money then es.total end, ''job_id'', es.job_id
             ) order by es.created_at desc), ''[]''::jsonb) from public.estimates es where es.customer_id = v_c.id),
    ''stats'', jsonb_build_object(');
    execute v_src;
  end if;
end $$;
