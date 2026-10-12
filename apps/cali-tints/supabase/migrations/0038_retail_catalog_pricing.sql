-- =============================================================================
-- 0038 — Retail catalog, size-class pricing, booking settings
--   * services: duration, benefit text, retail/dealer menus (a service may be
--     on both), taxable (parts), placeholder (seeded price not yet confirmed),
--     resources and skill it needs, start window for long jobs.
--   * service_prices_by_size: the retail price per size class (compact /
--     sedan / SUV-truck / XL); the dealership price lists are untouched.
--   * price_modifiers: condition add-ons (heavy soil, pet hair…), percent or flat.
--   * retail_settings: deposit, hold, cancellation, slots, reminders, tax rule,
--     signatures, email templates. One row per company, defaults inserted.
--   * resources / business_hours / blackout_days / time_off: what the booking
--     engine (next migration) schedules against.
--   * A retail job is priced from the size matrix of the vehicle on it.
--   Everything is data the owner edits in Settings; nothing is hardcoded.
-- Re-runnable.
-- Reversal: drop the new tables and the services columns; re-run 0033 for
-- dealership_price_list, 0036 for _job_service_price, 0037 for create/update_job.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- services: the catalog carries everything a retail quote or booking needs
-- ---------------------------------------------------------------------------
alter table public.services add column if not exists duration_minutes integer not null default 60 check (duration_minutes > 0 and duration_minutes <= 1440);
alter table public.services add column if not exists benefit_text text;
alter table public.services add column if not exists retail boolean not null default false;
alter table public.services add column if not exists dealer boolean not null default true;
alter table public.services add column if not exists taxable boolean not null default false;
alter table public.services add column if not exists placeholder boolean not null default false;
alter table public.services add column if not exists required_resource_kinds text[] not null default '{bay}';
alter table public.services add column if not exists required_skill text;
alter table public.services add column if not exists start_window_from time;
alter table public.services add column if not exists start_window_to time;
alter table public.services drop constraint if exists services_category_check;
alter table public.services add constraint services_category_check check (category in ('new', 'used', 'service', 'addon', 'retail'));
-- The new columns carry no money: readable by every member like name/category.
grant select (duration_minutes, benefit_text, retail, dealer, taxable, placeholder, required_resource_kinds, required_skill, start_window_from, start_window_to) on public.services to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.service_prices_by_size (
  id          uuid not null unique default gen_random_uuid(),   -- for the audit log
  company_id  uuid not null references public.companies (id) on delete cascade,
  service_id  uuid not null references public.services (id) on delete cascade,
  size_class  public.vehicle_size not null,
  price       numeric(10,2) not null check (price >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (service_id, size_class)
);

create table if not exists public.price_modifiers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  code        text not null,
  label       text not null,
  description text,
  kind        text not null check (kind in ('percent', 'flat')),
  amount      numeric(10,2) not null check (amount >= 0),
  active      boolean not null default true,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists public.retail_settings (
  id                  uuid not null unique default gen_random_uuid(),   -- for the audit log
  company_id          uuid primary key references public.companies (id) on delete cascade,
  deposit_kind        text not null default 'percent' check (deposit_kind in ('percent', 'flat', 'none')),
  deposit_value       numeric(10,2) not null default 20 check (deposit_value >= 0),
  deposit_refundable  boolean not null default false,
  hold_minutes        integer not null default 30 check (hold_minutes between 5 and 1440),
  cancel_hours        integer not null default 24 check (cancel_hours between 0 and 720),
  slot_step_minutes   integer not null default 30 check (slot_step_minutes in (15, 30, 60)),
  lead_time_hours     integer not null default 2 check (lead_time_hours between 0 and 336),
  max_days_ahead      integer not null default 60 check (max_days_ahead between 1 and 365),
  reminder_hours      integer[] not null default '{24,2}',
  online_booking_enabled boolean not null default true,
  estimate_valid_days integer not null default 14 check (estimate_valid_days between 1 and 365),
  tax_all_lines       boolean not null default false,
  signature_required_estimate boolean not null default true,
  signature_required_receipt  boolean not null default true,
  policy_text         text,
  email_templates     jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now()
);

create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  kind        text not null check (kind in ('bay', 'lift', 'tech')),
  name        text not null,
  profile_id  uuid references public.profiles (id),
  skills      text[] not null default '{}',
  active      boolean not null default true,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists resources_company_kind_idx on public.resources (company_id, kind, active);

create table if not exists public.business_hours (
  id          uuid not null unique default gen_random_uuid(),   -- for the audit log
  company_id  uuid not null references public.companies (id) on delete cascade,
  dow         integer not null check (dow between 0 and 6),   -- 0 = Sunday
  opens       time not null default '08:00',
  closes      time not null default '17:00',
  closed      boolean not null default false,
  primary key (company_id, dow),
  check (closed or opens < closes)
);

create table if not exists public.blackout_days (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  day         date not null,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (company_id, day)
);

create table if not exists public.time_off (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists time_off_resource_idx on public.time_off (resource_id, starts_at);

do $$
declare t text;
begin
  foreach t in array array['service_prices_by_size', 'price_modifiers', 'retail_settings', 'resources'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.tg_set_updated_at()', t);
  end loop;
  foreach t in array array['service_prices_by_size', 'price_modifiers', 'retail_settings', 'resources', 'business_hours', 'blackout_days', 'time_off'] loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: prices are the owner's; policy, hours and resources are owner/admin to
-- write and every member to read (the calendar needs them).
-- ---------------------------------------------------------------------------
alter table public.service_prices_by_size enable row level security;
alter table public.price_modifiers        enable row level security;
alter table public.retail_settings        enable row level security;
alter table public.resources              enable row level security;
alter table public.business_hours         enable row level security;
alter table public.blackout_days          enable row level security;
alter table public.time_off               enable row level security;

drop policy if exists spbs_owner on public.service_prices_by_size;
create policy spbs_owner on public.service_prices_by_size for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

drop policy if exists modifiers_select on public.price_modifiers;
create policy modifiers_select on public.price_modifiers for select to authenticated
  using (company_id = public.current_company_id());
drop policy if exists modifiers_owner on public.price_modifiers;
create policy modifiers_owner on public.price_modifiers for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

drop policy if exists retail_settings_select on public.retail_settings;
create policy retail_settings_select on public.retail_settings for select to authenticated
  using (company_id = public.current_company_id());
drop policy if exists retail_settings_write on public.retail_settings;
create policy retail_settings_write on public.retail_settings for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner_admin())
  with check (company_id = public.current_company_id() and public.is_owner_admin());

do $$
declare t text;
begin
  foreach t in array array['resources', 'business_hours', 'blackout_days', 'time_off'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (company_id = public.current_company_id())', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (company_id = public.current_company_id() and public.is_owner_admin()) with check (company_id = public.current_company_id() and public.is_owner_admin())', t, t);
  end loop;
end $$;

grant select, insert, update, delete on public.service_prices_by_size, public.price_modifiers, public.retail_settings, public.resources, public.business_hours, public.blackout_days, public.time_off to authenticated;

-- ---------------------------------------------------------------------------
-- Defaults for every company (idempotent): settings, hours, bays/lifts, a tech
-- per active detailer, the retail menu with placeholder prices, modifiers.
-- ---------------------------------------------------------------------------
create or replace function public.seed_retail_defaults(p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_sort integer := 300;
begin
  insert into public.retail_settings (company_id, email_templates) values (p_company, jsonb_build_object(
    'estimate_sent',     jsonb_build_object('subject', 'Your estimate from {{company}}',               'body', E'Hi {{first_name}},\n\nHere is your estimate for the {{vehicle}}: {{estimate_url}}\n\nPick the option you want and approve it there. It is good until {{expires}}.\n\n{{company}}'),
    'hold_created',      jsonb_build_object('subject', 'Holding your spot for {{hold_minutes}} minutes', 'body', E'Hi {{first_name}},\n\nWe are holding {{starts_at}} for the {{vehicle}}. Finish here within {{hold_minutes}} minutes to keep it: {{booking_url}}\n\n{{company}}'),
    'hold_expiring',     jsonb_build_object('subject', 'Still holding your spot for 10 more minutes',  'body', E'Hi {{first_name}},\n\nYour {{starts_at}} spot for the {{vehicle}} is held for 10 more minutes: {{booking_url}}\n\n{{company}}'),
    'booking_confirmed', jsonb_build_object('subject', 'You are booked: {{starts_at}}',                 'body', E'Hi {{first_name}},\n\nThe {{vehicle}} is booked for {{starts_at}} at {{company}}, {{address}}.\n\nNeed to change it? {{manage_url}}\n\n{{company}}'),
    'reminder',          jsonb_build_object('subject', 'Reminder: {{starts_at}}',                       'body', E'Hi {{first_name}},\n\nSee you {{starts_at}} with the {{vehicle}}. Change or cancel here: {{manage_url}}\n\n{{company}}'),
    'receipt',           jsonb_build_object('subject', 'Your receipt from {{company}}',                 'body', E'Hi {{first_name}},\n\nThanks for coming in. Your receipt for the {{vehicle}}: {{receipt_url}}\n\n{{company}}'),
    'abandoned',         jsonb_build_object('subject', 'Still want that spot?',                         'body', E'Hi {{first_name}},\n\nYou started booking the {{vehicle}} for {{services}}. Pick it back up here: {{booking_url}}\n\n{{company}}'),
    'cancelled',         jsonb_build_object('subject', 'Cancelled: {{starts_at}}',                      'body', E'Hi {{first_name}},\n\nYour {{starts_at}} appointment is cancelled. Book again any time: {{book_url}}\n\n{{company}}')
  ))
  on conflict (company_id) do nothing;

  insert into public.business_hours (company_id, dow, opens, closes, closed)
  select p_company, d, '08:00', '17:00', d = 0 from generate_series(0, 6) d
  on conflict (company_id, dow) do nothing;

  if not exists (select 1 from public.resources where company_id = p_company) then
    insert into public.resources (company_id, kind, name, sort_order)
    select p_company, 'bay', 'Bay ' || n, n from generate_series(1, 6) n;
    insert into public.resources (company_id, kind, name, sort_order)
    select p_company, 'lift', 'Lift ' || n, 10 + n from generate_series(1, 2) n;
  end if;
  -- Every active detailer (and manager) is a tech, added once; the owner can deactivate or rename.
  insert into public.resources (company_id, kind, name, profile_id, skills, sort_order)
  select p_company, 'tech', p.full_name, p.id, array['detail'], 20 + row_number() over (order by p.full_name)
  from public.profiles p
  where p.company_id = p_company and p.active and p.role in ('detailer', 'manager')
    and not exists (select 1 from public.resources res where res.profile_id = p.id);

  -- The retail menu. Placeholder prices until the owner edits them (placeholder = true).
  for r in
    select * from (values
      ('Full detail',                 'Inside and out, done properly',                           240, '{bay}'::text[],      null::text,   null::time, null::time, false, 180, 200, 240, 290),
      ('Paint correction (1-stage)',  'Single-stage machine polish: swirls and light scratches',  360, '{bay}',             'correction', '08:00',    '10:00',    false, 350, 400, 475, 550),
      ('Paint correction (2-stage)',  'Compound then polish: deeper defects, maximum gloss',       540, '{bay}',             'correction', '08:00',    '09:00',    false, 550, 600, 700, 800),
      ('Clay bar',                    'Decontaminate the paint so it feels like glass',             60, '{bay}',             null,         null,       null,       false,  60,  70,  85, 100),
      ('Water spot removal',          'Mineral etching lifted from paint and glass',                60, '{bay}',             null,         null,       null,       false,  80,  90, 110, 130),
      ('Headlight restoration',       'Yellowed lenses brought back to clear',                      45, '{bay}',             null,         null,       null,       false,  60,  60,  60,  60),
      ('Trim restore',                'Faded plastic trim back to black',                           45, '{bay}',             null,         null,       null,       false,  50,  60,  70,  85),
      ('Tire shine',                  'Dressed tires, no sling',                                    15, '{bay}',             null,         null,       null,       false,  15,  15,  15,  15),
      ('Odor bomb',                   'Odor treatment for smoke, pets and spills',                  30, '{bay}',             null,         null,       null,       false,  35,  35,  35,  35),
      ('Oil change',                  'Oil and filter with a fluid check',                          45, '{bay,lift}',        'mechanic',   null,       null,       true,   55,  60,  75,  90),
      ('Brakes (per axle)',           'Pads and rotors on one axle',                                90, '{bay,lift}',        'mechanic',   null,       null,       true,  180, 190, 220, 260),
      ('Brake / noise inspection',    'We find the squeak and tell you what it needs',              30, '{bay,lift}',        'mechanic',   null,       null,       false,  40,  40,  40,  40)
    ) as v(name, benefit, minutes, kinds, skill, win_from, win_to, taxable, p_compact, p_sedan, p_suv, p_xl)
  loop
    v_sort := v_sort + 10;
    insert into public.services (company_id, name, description, benefit_text, category, default_price, price_min, price_max, sort_order,
                                 duration_minutes, retail, dealer, taxable, placeholder, required_resource_kinds, required_skill, start_window_from, start_window_to)
    values (p_company, r.name, r.benefit, r.benefit, 'retail', r.p_sedan, null, null, v_sort,
            r.minutes, true, false, r.taxable, true, r.kinds, r.skill, r.win_from, r.win_to)
    on conflict (company_id, name) do nothing;
    insert into public.service_prices_by_size (company_id, service_id, size_class, price)
    select p_company, s.id, x.size, x.price
    from public.services s
    cross join (values ('compact'::public.vehicle_size, r.p_compact), ('sedan', r.p_sedan), ('suv_truck', r.p_suv), ('xl', r.p_xl)) as x(size, price)
    where s.company_id = p_company and s.name = r.name
    on conflict (service_id, size_class) do nothing;
  end loop;

  -- "Other" (the open-amount line) serves the shop too.
  update public.services set retail = true where company_id = p_company and default_price = 0 and price_min = 0 and price_max >= 10000 and not retail;

  insert into public.price_modifiers (company_id, code, label, description, kind, amount, sort_order) values
    (p_company, 'soil_heavy', 'Heavy soil',   'Mud, sand, heavy grime: extra time on the interior', 'percent', 25, 10),
    (p_company, 'pet_hair',   'Pet hair',     'Embedded pet hair in carpet and seats',               'flat',    40, 20),
    (p_company, 'biohazard',  'Biohazard',    'Vomit, mold, spills needing extraction',              'flat',    75, 30)
  on conflict (company_id, code) do nothing;
end $$;
revoke execute on function public.seed_retail_defaults(uuid) from public, anon, authenticated;

do $$
declare c record;
begin
  for c in select id from public.companies loop
    perform public.seed_retail_defaults(c.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Pricing
-- ---------------------------------------------------------------------------

-- The retail price of a service for a size class: the matrix, else the default.
create or replace function public.resolve_retail_price(p_service uuid, p_size public.vehicle_size default 'sedan')
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select price from public.service_prices_by_size where service_id = p_service and size_class = coalesce(p_size, 'sedan')),
                  (select default_price from public.services where id = p_service))
$$;
revoke execute on function public.resolve_retail_price(uuid, public.vehicle_size) from public, anon, authenticated;

-- A retail quote: lines priced by size, modifiers applied per line, tax on
-- taxable lines (or on every line when the company says so).
-- p_lines: [{service_id, qty?, label?, price? (open-amount lines only), modifiers?: [code, …]}]
create or replace function public.quote_total(p_size public.vehicle_size, p_lines jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company  uuid := public.current_company_id();
  v_rate     numeric;
  v_tax_all  boolean;
  v_line     jsonb;
  v_svc      public.services;
  v_unit     numeric;
  v_qty      numeric;
  v_mods     jsonb;
  v_mod      public.price_modifiers;
  v_code     text;
  v_applied  jsonb;
  v_amount   numeric;
  v_line_total numeric;
  v_taxable  boolean;
  v_lines    jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_taxable_sum numeric := 0;
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  select tax_rate into v_rate from public.companies where id = v_company;
  select coalesce(tax_all_lines, false) into v_tax_all from public.retail_settings where company_id = v_company;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    select * into v_svc from public.services where id = (v_line ->> 'service_id')::uuid and company_id = v_company and active;
    if not found then
      raise exception 'Unknown service %', v_line ->> 'service_id' using errcode = '22023';
    end if;
    v_qty := greatest(coalesce(nullif(v_line ->> 'qty', '')::numeric, 1), 0);
    if v_svc.default_price = 0 and v_svc.price_min = 0 and v_svc.price_max >= 10000 then
      v_unit := greatest(coalesce(nullif(v_line ->> 'price', '')::numeric, 0), 0);   -- "Other": the amount typed
    else
      v_unit := public.resolve_retail_price(v_svc.id, p_size);
    end if;
    v_applied := '[]'::jsonb;
    v_line_total := round(v_unit * v_qty, 2);
    for v_code in select * from jsonb_array_elements_text(coalesce(v_line -> 'modifiers', '[]'::jsonb)) loop
      select * into v_mod from public.price_modifiers where company_id = v_company and code = v_code and active;
      if found then
        v_amount := case when v_mod.kind = 'percent' then round(v_unit * v_qty * v_mod.amount / 100, 2) else round(v_mod.amount * v_qty, 2) end;
        v_line_total := v_line_total + v_amount;
        v_applied := v_applied || jsonb_build_object('code', v_mod.code, 'label', v_mod.label, 'kind', v_mod.kind, 'amount', v_amount);
      end if;
    end loop;
    v_taxable := v_tax_all or v_svc.taxable;
    v_subtotal := v_subtotal + v_line_total;
    if v_taxable then v_taxable_sum := v_taxable_sum + v_line_total; end if;
    v_lines := v_lines || jsonb_build_object(
      'service_id', v_svc.id, 'name', coalesce(nullif(v_line ->> 'label', ''), v_svc.name), 'benefit_text', v_svc.benefit_text,
      'unit_price', v_unit, 'qty', v_qty, 'modifiers', v_applied, 'line_total', v_line_total, 'taxable', v_taxable,
      'duration_minutes', v_svc.duration_minutes, 'placeholder', v_svc.placeholder);
  end loop;

  return jsonb_build_object(
    'size_class', coalesce(p_size, 'sedan'),
    'lines', v_lines,
    'subtotal', v_subtotal,
    'tax_rate', coalesce(v_rate, 0),
    'tax', round(v_taxable_sum * coalesce(v_rate, 0), 2),
    'total', v_subtotal + round(v_taxable_sum * coalesce(v_rate, 0), 2),
    'duration_minutes', (select coalesce(sum((l ->> 'duration_minutes')::int * greatest((l ->> 'qty')::numeric, 1)), 0) from jsonb_array_elements(v_lines) l),
    'placeholder', (select bool_or((l ->> 'placeholder')::boolean) from jsonb_array_elements(v_lines) l)
  );
end $$;
grant execute on function public.quote_total(public.vehicle_size, jsonb) to authenticated;

-- The retail catalog for Settings and the quote builder: services on the shop
-- menu with their size prices (owner/admin), modifiers, the dealer-only
-- services (so the owner can add one to the shop), settings, resources.
create or replace function public.retail_catalog()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_money   boolean := public.can_price_jobs();
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'services', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'description', s.description, 'benefit_text', s.benefit_text, 'category', s.category,
        'duration_minutes', s.duration_minutes, 'retail', s.retail, 'dealer', s.dealer, 'taxable', s.taxable, 'placeholder', s.placeholder,
        'required_resource_kinds', to_jsonb(s.required_resource_kinds), 'required_skill', s.required_skill,
        'start_window_from', s.start_window_from, 'start_window_to', s.start_window_to, 'active', s.active, 'sort_order', s.sort_order,
        'open_amount', s.default_price = 0 and s.price_min = 0 and s.price_max >= 10000,
        'prices', case when v_money then (select coalesce(jsonb_object_agg(p.size_class, p.price), '{}'::jsonb) from public.service_prices_by_size p where p.service_id = s.id) end,
        'default_price', case when v_money then s.default_price end
      ) order by s.sort_order, s.name), '[]'::jsonb)
      from public.services s where s.company_id = v_company),
    'modifiers', (select coalesce(jsonb_agg(to_jsonb(m) order by m.sort_order, m.label), '[]'::jsonb) from public.price_modifiers m where m.company_id = v_company),
    'settings', (select to_jsonb(rs) from public.retail_settings rs where rs.company_id = v_company),
    'resources', (select coalesce(jsonb_agg(to_jsonb(r) order by r.kind, r.sort_order, r.name), '[]'::jsonb) from public.resources r where r.company_id = v_company),
    'hours', (select coalesce(jsonb_agg(to_jsonb(h) order by h.dow), '[]'::jsonb) from public.business_hours h where h.company_id = v_company),
    'blackouts', (select coalesce(jsonb_agg(to_jsonb(b) order by b.day), '[]'::jsonb) from public.blackout_days b where b.company_id = v_company and b.day >= current_date - 30),
    'time_off', (select coalesce(jsonb_agg(to_jsonb(t) order by t.starts_at), '[]'::jsonb) from public.time_off t where t.company_id = v_company and t.ends_at >= now() - interval '30 days'),
    'tax_rate', (select tax_rate from public.companies where id = v_company)
  );
end $$;
grant execute on function public.retail_catalog() to authenticated;

-- The dealership chips show the dealer menu; the shop's chips show the retail menu.
drop function if exists public.dealership_price_list(uuid);
create function public.dealership_price_list(p_dealership_id uuid)
returns table (service_id uuid, name text, description text, category text, price numeric, price_min numeric, price_max numeric, is_override boolean, sort_order integer, open_amount boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.category,
         case when public.can_price_jobs() then coalesce(dsp.price, s.default_price) end as price,
         case when public.can_price_jobs() then s.price_min end as price_min,
         case when public.can_price_jobs() then s.price_max end as price_max,
         public.can_price_jobs() and dsp.price is not null as is_override,
         s.sort_order,
         s.default_price = 0 and s.price_min = 0 and s.price_max >= 10000 as open_amount
  from public.services s
  join public.dealerships d on d.id = p_dealership_id and d.company_id = s.company_id
  left join public.dealership_service_prices dsp on dsp.service_id = s.id and dsp.dealership_id = d.id
  where s.company_id = public.current_company_id() and s.active
    and (case when coalesce(d.retail, false) then s.retail else s.dealer end)
  order by s.sort_order, s.name;
$$;
grant execute on function public.dealership_price_list(uuid) to authenticated, service_role;

-- A retail job takes the size-class price of the vehicle on it. Dealership
-- jobs: unchanged (0036). "Other" as before.
drop function if exists public._job_service_price(uuid, uuid, numeric, text);
create or replace function public._job_service_price(
  p_dealership uuid, p_service uuid, p_sent_price numeric, p_sent_reason text, p_size public.vehicle_size default null,
  out o_price numeric, out o_reason text, out o_needs_price boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_list numeric; v_min numeric; v_max numeric; v_open boolean; v_retail boolean;
begin
  select coalesce(retail, false) into v_retail from public.dealerships where id = p_dealership;
  if v_retail then
    v_list := public.resolve_retail_price(p_service, coalesce(p_size, 'sedan'));
  else
    v_list := public.resolve_service_price(p_dealership, p_service);
  end if;
  if v_list is null then
    raise exception 'Unknown service %', p_service using errcode = '22023';
  end if;
  select price_min, price_max into v_min, v_max from public.services where id = p_service;
  v_open := v_list = 0 and v_min is not null and v_max is not null and v_min = 0 and v_max >= 10000;
  o_reason := null;
  if v_open and public.can_price_jobs() and coalesce(p_sent_price, 0) > 0 then
    o_price := p_sent_price;
    o_needs_price := false;
  else
    o_price := v_list;
    o_needs_price := v_open;
  end if;
end $$;

-- create_job / update_job hand the vehicle's size to the pricer (0037 bodies, patched in place).
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'create_job';
  if v_src is not null and position('v_size' in v_src) = 0 then
    v_src := replace(v_src, '  cv            record;', '  cv            record;
  v_size        public.vehicle_size;');
    v_src := replace(v_src, '  select * into cv from public._job_customer_vehicle(v_company, v_dealer, p);', '  select * into cv from public._job_customer_vehicle(v_company, v_dealer, p);
  v_size := (cv.o_vehicle_row).size_class;');
    v_src := replace(v_src, 'nullif(v_svc ->> ''price'', '''')::numeric, v_svc ->> ''override_reason'');', 'nullif(v_svc ->> ''price'', '''')::numeric, v_svc ->> ''override_reason'', v_size);');
    execute v_src;
  end if;
  select pg_get_functiondef(p.oid) into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'update_job';
  if v_src is not null and position('v_size' in v_src) = 0 then
    v_src := replace(v_src, '  cv           record;', '  cv           record;
  v_size       public.vehicle_size;');
    v_src := replace(v_src, '  if p ? ''services'' then', '  select size_class into v_size from public.vehicles where id = v_job.vehicle_id;
  if p ? ''services'' then');
    v_src := replace(v_src, 'nullif(v_svc ->> ''price'', '''')::numeric, v_svc ->> ''override_reason'');', 'nullif(v_svc ->> ''price'', '''')::numeric, v_svc ->> ''override_reason'', v_size);');
    execute v_src;
  end if;
end $$;
