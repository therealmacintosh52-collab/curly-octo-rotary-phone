-- 0040: booking. One slot engine in Postgres for the staff calendar, the public
-- /book page and the "pick a time" link after an estimate is approved.
--
-- An appointment needs a free resource of every kind its services require
-- (bay, lift) and one qualified tech for the whole block, inside business
-- hours, off blackout days and time off, honouring each service's start
-- window, the lead time and how far ahead the shop books. A customer who
-- books online gets a hold (hold_minutes) that becomes a Lead when they
-- finish; staff confirm it (or the deposit does, in the next slice). All
-- writes go through RPCs under an advisory lock so two people cannot take
-- the same bay. Re-runnable; nothing destructive.
--
-- Reversal: drop appointment_resources, appointment_services, appointments,
-- jobs.appointment_id, price_modifiers.ask_customer/question,
-- companies.next_appointment_number and the functions below.

alter table public.companies add column if not exists next_appointment_number integer not null default 1;
alter table public.price_modifiers add column if not exists ask_customer boolean not null default false;
alter table public.price_modifiers add column if not exists question text;
alter table public.jobs add column if not exists appointment_id uuid;

create table if not exists public.appointments (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  number           integer not null,
  display_number   text not null,
  customer_id      uuid references public.customers (id),
  vehicle_id       uuid references public.vehicles (id),
  estimate_id      uuid references public.estimates (id),
  job_id           uuid references public.jobs (id),
  status           text not null default 'hold' check (status in ('hold', 'lead', 'booked', 'confirmed', 'in_progress', 'done', 'cancelled', 'no_show')),
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  duration_minutes integer not null,
  hold_expires_at  timestamptz,
  token            text not null unique default translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_'),
  source           text not null default 'staff' check (source in ('public', 'staff', 'estimate')),
  size_class       public.vehicle_size not null default 'sedan',
  -- the car and the person as typed on the public form, before they are records
  contact          jsonb not null default '{}'::jsonb,
  vehicle_draft    jsonb not null default '{}'::jsonb,
  intake           jsonb not null default '{}'::jsonb,
  pay_choice       text check (pay_choice is null or pay_choice in ('deposit', 'at_shop')),
  notes            text,
  customer_notes   text,
  subtotal         numeric(12,2) not null default 0,
  tax              numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  deposit_required numeric(12,2) not null default 0,
  reminders_sent   timestamptz[] not null default '{}',
  confirmed_at     timestamptz,
  checked_in_at    timestamptz,
  done_at          timestamptz,
  cancelled_at     timestamptz,
  cancel_reason    text,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (company_id, number)
);
create index if not exists appointments_company_starts_idx on public.appointments (company_id, starts_at);
create index if not exists appointments_status_idx on public.appointments (company_id, status);
create index if not exists appointments_customer_idx on public.appointments (customer_id);

create table if not exists public.appointment_services (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  appointment_id   uuid not null references public.appointments (id) on delete cascade,
  service_id       uuid references public.services (id),
  name             text not null,
  qty              numeric(6,2) not null default 1,
  unit_price       numeric(12,2) not null default 0,
  modifiers        jsonb not null default '[]'::jsonb,
  line_total       numeric(12,2) not null default 0,
  taxable          boolean not null default false,
  duration_minutes integer not null default 60,
  sort_order       integer not null default 0
);
create index if not exists appointment_services_appt_idx on public.appointment_services (appointment_id, sort_order);

create table if not exists public.appointment_resources (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  resource_id    uuid not null references public.resources (id),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null
);
create index if not exists appointment_resources_resource_idx on public.appointment_resources (resource_id, starts_at, ends_at);
create index if not exists appointment_resources_appt_idx on public.appointment_resources (appointment_id);

do $$
declare t text;
begin
  execute 'drop trigger if exists set_updated_at on public.appointments';
  execute 'create trigger set_updated_at before update on public.appointments for each row execute function public.tg_set_updated_at()';
  foreach t in array array['appointments', 'appointment_services', 'appointment_resources'] loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

-- Access: members read (money gated through the RPCs), nobody writes directly, anon touches nothing.
alter table public.appointments          enable row level security;
alter table public.appointment_services  enable row level security;
alter table public.appointment_resources enable row level security;
do $$
declare t text;
begin
  foreach t in array array['appointments', 'appointment_services', 'appointment_resources'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (company_id = public.current_company_id())', t, t);
  end loop;
end $$;
revoke all on public.appointments, public.appointment_services, public.appointment_resources from authenticated, anon;
grant select (id, company_id, number, display_number, customer_id, vehicle_id, estimate_id, job_id, status, starts_at, ends_at, duration_minutes, hold_expires_at, source, size_class,
              intake, pay_choice, notes, customer_notes, reminders_sent, confirmed_at, checked_in_at, done_at, cancelled_at, cancel_reason, created_by, created_at, updated_at)
  on public.appointments to authenticated;
grant select (id, company_id, appointment_id, service_id, name, qty, modifiers, taxable, duration_minutes, sort_order) on public.appointment_services to authenticated;
grant select on public.appointment_resources to authenticated;

-- ---------------------------------------------------------------------------
-- The shop as the public sees it. One company for now: the public pages
-- resolve it without a session.
-- ---------------------------------------------------------------------------
create or replace function public.public_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.companies order by created_at limit 1
$$;
revoke execute on function public.public_company_id() from public, anon, authenticated;

-- quote_total, parameterised by company so the public pages and the holds can price without a session.
create or replace function public._quote_total(p_company uuid, p_size public.vehicle_size, p_lines jsonb, p_public boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_rate     numeric;
  v_tax_all  boolean;
  v_line     jsonb;
  v_svc      public.services;
  v_unit     numeric;
  v_qty      numeric;
  v_mod      public.price_modifiers;
  v_code     text;
  v_applied  jsonb;
  v_amount   numeric;
  v_line_total numeric;
  v_taxable  boolean;
  v_lines    jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_taxable_sum numeric := 0;
  v_open     boolean;
begin
  if p_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  select tax_rate into v_rate from public.companies where id = p_company;
  select coalesce(tax_all_lines, false) into v_tax_all from public.retail_settings where company_id = p_company;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    select * into v_svc from public.services where id = (v_line ->> 'service_id')::uuid and company_id = p_company and active;
    if not found then
      raise exception 'Unknown service %', v_line ->> 'service_id' using errcode = '22023';
    end if;
    v_open := v_svc.default_price = 0 and v_svc.price_min = 0 and v_svc.price_max >= 10000;
    if p_public and (v_open or not v_svc.retail) then
      raise exception 'That service is not offered online' using errcode = '22023';
    end if;
    v_qty := greatest(coalesce(nullif(v_line ->> 'qty', '')::numeric, 1), 0);
    if v_open then
      v_unit := greatest(coalesce(nullif(v_line ->> 'price', '')::numeric, 0), 0);
    else
      v_unit := public.resolve_retail_price(v_svc.id, p_size);
    end if;
    v_applied := '[]'::jsonb;
    v_line_total := round(v_unit * v_qty, 2);
    for v_code in select * from jsonb_array_elements_text(coalesce(v_line -> 'modifiers', '[]'::jsonb)) loop
      select * into v_mod from public.price_modifiers where company_id = p_company and code = v_code and active;
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
    'placeholder', (select coalesce(bool_or((l ->> 'placeholder')::boolean), false) from jsonb_array_elements(v_lines) l)
  );
end $$;
revoke execute on function public._quote_total(uuid, public.vehicle_size, jsonb, boolean) from public, anon, authenticated;

create or replace function public.quote_total(p_size public.vehicle_size, p_lines jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select public._quote_total(public.current_company_id(), p_size, p_lines, false)
$$;
grant execute on function public.quote_total(public.vehicle_size, jsonb) to authenticated;

create or replace function public.public_quote(p_size public.vehicle_size, p_lines jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select public._quote_total(public.public_company_id(), p_size, p_lines, true)
$$;
grant execute on function public.public_quote(public.vehicle_size, jsonb) to anon, authenticated;

-- What the booking page needs: the services it may sell, their prices by size,
-- the questions that feed modifiers, the policy, hours, the shop's name.
create or replace function public.public_catalog()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := public.public_company_id();
begin
  return jsonb_build_object(
    'company', (select jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email, 'address_line1', c.address_line1, 'city', c.city, 'state', c.state, 'postal_code', c.postal_code, 'timezone', c.timezone) from public.companies c where c.id = v_company),
    'services', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'benefit_text', s.benefit_text, 'duration_minutes', s.duration_minutes, 'taxable', s.taxable, 'sort_order', s.sort_order,
        'start_window_from', s.start_window_from, 'start_window_to', s.start_window_to,
        'prices', (select coalesce(jsonb_object_agg(p.size_class, p.price), '{}'::jsonb) from public.service_prices_by_size p where p.service_id = s.id),
        'default_price', s.default_price
      ) order by s.sort_order, s.name), '[]'::jsonb)
      from public.services s where s.company_id = v_company and s.active and s.retail and not (s.default_price = 0 and s.price_min = 0 and s.price_max >= 10000)),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('code', m.code, 'label', m.label, 'question', coalesce(m.question, m.label || '?'), 'kind', m.kind, 'amount', m.amount) order by m.sort_order), '[]'::jsonb)
                  from public.price_modifiers m where m.company_id = v_company and m.active and m.ask_customer),
    'settings', (select jsonb_build_object('slot_step_minutes', rs.slot_step_minutes, 'lead_time_hours', rs.lead_time_hours, 'max_days_ahead', rs.max_days_ahead, 'hold_minutes', rs.hold_minutes,
                                           'cancel_hours', rs.cancel_hours, 'deposit_kind', rs.deposit_kind, 'deposit_value', rs.deposit_value, 'deposit_refundable', rs.deposit_refundable,
                                           'online_booking_enabled', rs.online_booking_enabled, 'policy_text', rs.policy_text)
                 from public.retail_settings rs where rs.company_id = v_company),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('dow', h.dow, 'opens', h.opens, 'closes', h.closes, 'closed', h.closed) order by h.dow), '[]'::jsonb) from public.business_hours h where h.company_id = v_company),
    'tax_rate', (select tax_rate from public.companies where id = v_company)
  );
end $$;
grant execute on function public.public_catalog() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The engine
-- ---------------------------------------------------------------------------

-- What a set of lines needs: total minutes, the resource kinds, the skills, the tightest start window.
create or replace function public._booking_needs(p_company uuid, p_lines jsonb)
returns table (duration_minutes integer, kinds text[], skills text[], win_from time, win_to time)
language sql stable security definer set search_path = public as $$
  with l as (
    select s.*, greatest(coalesce(nullif(x ->> 'qty', '')::numeric, 1), 1) as qty
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) x
    join public.services s on s.id = (x ->> 'service_id')::uuid and s.company_id = p_company and s.active
  )
  select coalesce(sum(l.duration_minutes * l.qty), 0)::integer,
         coalesce((select array_agg(distinct k) from l, unnest(l.required_resource_kinds) k where k <> 'tech'), '{}'::text[]),
         coalesce((select array_agg(distinct l.required_skill) from l where l.required_skill is not null), '{}'::text[]),
         max(l.start_window_from),
         min(l.start_window_to)
  from l
$$;
revoke execute on function public._booking_needs(uuid, jsonb) from public, anon, authenticated;

create or replace function public._release_expired_holds()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Hold expired'
  where status = 'hold' and hold_expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public._release_expired_holds() from public, anon, authenticated;

create or replace function public.release_expired_holds()
returns integer language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') then
    raise exception 'service role only' using errcode = '42501';
  end if;
  return public._release_expired_holds();
end $$;
revoke execute on function public.release_expired_holds() from public, anon, authenticated;
grant execute on function public.release_expired_holds() to service_role;

-- Is this resource taken (a live hold or booking) or off during the block?
create or replace function public._resource_busy(p_resource uuid, p_from timestamptz, p_to timestamptz, p_ignore uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.appointment_resources ar
    join public.appointments a on a.id = ar.appointment_id
    where ar.resource_id = p_resource and ar.starts_at < p_to and ar.ends_at > p_from
      and a.status in ('hold', 'lead', 'booked', 'confirmed', 'in_progress')
      and (a.status <> 'hold' or a.hold_expires_at > now())
      and (p_ignore is null or a.id <> p_ignore)
  ) or exists (
    select 1 from public.time_off t where t.resource_id = p_resource and t.starts_at < p_to and t.ends_at > p_from
  )
$$;
revoke execute on function public._resource_busy(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- One free resource of every required kind plus one qualified tech, or null.
create or replace function public._find_free(p_company uuid, p_kinds text[], p_skills text[], p_from timestamptz, p_to timestamptz, p_ignore uuid default null)
returns uuid[] language plpgsql stable security definer set search_path = public as $$
declare
  v_kind  text;
  v_kinds text[];
  v_id    uuid;
  v_out   uuid[] := '{}';
begin
  select coalesce(array_agg(distinct k), '{}') into v_kinds from unnest(coalesce(p_kinds, '{}') || array['tech']) k;
  foreach v_kind in array v_kinds loop
    select r.id into v_id
    from public.resources r
    where r.company_id = p_company and r.active and r.kind = v_kind
      and (v_kind <> 'tech' or r.skills @> coalesce(p_skills, '{}'))
      and not public._resource_busy(r.id, p_from, p_to, p_ignore)
    order by r.sort_order, r.name
    limit 1;
    if v_id is null then return null; end if;
    v_out := v_out || v_id;
  end loop;
  return v_out;
end $$;
revoke execute on function public._find_free(uuid, text[], text[], timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- The slots for a set of lines between two days (at most 14 days a call).
-- Honours hours, blackout days, lead time, how far ahead, start windows, the
-- whole block before closing, one free resource per kind and a qualified tech.
create or replace function public._find_slots(p_company uuid, p_lines jsonb, p_from date, p_to date, p_ignore uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tz     text;
  v_set    public.retail_settings;
  v_need   record;
  v_day    date;
  v_hours  public.business_hours;
  v_t      time;
  v_last   time;
  v_start  timestamptz;
  v_end    timestamptz;
  v_min    timestamptz;
  v_max    date;
  v_out    jsonb := '[]'::jsonb;
begin
  perform public._release_expired_holds();
  select timezone into v_tz from public.companies where id = p_company;
  select * into v_set from public.retail_settings where company_id = p_company;
  if v_set.company_id is null then return v_out; end if;
  select * into v_need from public._booking_needs(p_company, p_lines);
  if coalesce(v_need.duration_minutes, 0) <= 0 then return v_out; end if;
  v_min := now() + make_interval(hours => v_set.lead_time_hours);
  v_max := (now() at time zone v_tz)::date + v_set.max_days_ahead;
  for v_day in select d::date from generate_series(greatest(p_from, (now() at time zone v_tz)::date), least(p_to, p_from + 13, v_max), interval '1 day') d loop
    select * into v_hours from public.business_hours where company_id = p_company and dow = extract(dow from v_day)::int;
    if v_hours.company_id is null or v_hours.closed then continue; end if;
    if exists (select 1 from public.blackout_days where company_id = p_company and day = v_day) then continue; end if;
    v_t := greatest(v_hours.opens, coalesce(v_need.win_from, v_hours.opens));
    v_last := least(v_hours.closes - make_interval(mins => v_need.duration_minutes), coalesce(v_need.win_to, v_hours.closes));
    while v_t <= v_last loop
      v_start := (v_day + v_t) at time zone v_tz;
      v_end := v_start + make_interval(mins => v_need.duration_minutes);
      if v_start >= v_min and public._find_free(p_company, v_need.kinds, v_need.skills, v_start, v_end, p_ignore) is not null then
        v_out := v_out || jsonb_build_object('starts_at', v_start, 'ends_at', v_end);
      end if;
      v_t := v_t + make_interval(mins => v_set.slot_step_minutes);
    end loop;
  end loop;
  return v_out;
end $$;
revoke execute on function public._find_slots(uuid, jsonb, date, date, uuid) from public, anon, authenticated;

-- Public: the shop's open slots. Staff: the same engine with a session.
create or replace function public.find_slots(p_lines jsonb, p_from date, p_to date)
returns jsonb language sql security definer set search_path = public as $$
  select public._find_slots(coalesce(public.current_company_id(), public.public_company_id()), p_lines, p_from, p_to)
$$;
grant execute on function public.find_slots(jsonb, date, date) to anon, authenticated;

-- Price + take the resources for an appointment row. Raises when the block is not free.
create or replace function public._appointment_fill(p_id uuid, p_lines jsonb, p_starts_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  a      public.appointments;
  v_need record;
  v_q    jsonb;
  v_res  uuid[];
  v_end  timestamptz;
  v_set  public.retail_settings;
  l      jsonb;
  i      integer := 0;
  r      uuid;
  v_sub  numeric; v_tax numeric; v_tot numeric; v_dep numeric;
begin
  select * into a from public.appointments where id = p_id;
  perform pg_advisory_xact_lock(hashtext(a.company_id::text));
  perform public._release_expired_holds();
  select * into v_need from public._booking_needs(a.company_id, p_lines);
  if coalesce(v_need.duration_minutes, 0) <= 0 then
    raise exception 'Pick at least one service' using errcode = '22023';
  end if;
  v_end := p_starts_at + make_interval(mins => v_need.duration_minutes);
  v_res := public._find_free(a.company_id, v_need.kinds, v_need.skills, p_starts_at, v_end, a.id);
  if v_res is null then
    raise exception 'That time is no longer free; pick another' using errcode = 'P0001';
  end if;
  v_q := public._quote_total(a.company_id, a.size_class, p_lines, a.source = 'public');
  select * into v_set from public.retail_settings where company_id = a.company_id;

  delete from public.appointment_services where appointment_id = a.id;
  for l in select * from jsonb_array_elements(v_q -> 'lines') loop
    i := i + 1;
    insert into public.appointment_services (company_id, appointment_id, service_id, name, qty, unit_price, modifiers, line_total, taxable, duration_minutes, sort_order)
    values (a.company_id, a.id, (l ->> 'service_id')::uuid, l ->> 'name', (l ->> 'qty')::numeric, (l ->> 'unit_price')::numeric, l -> 'modifiers', (l ->> 'line_total')::numeric, (l ->> 'taxable')::boolean, (l ->> 'duration_minutes')::int, i);
  end loop;
  delete from public.appointment_resources where appointment_id = a.id;
  foreach r in array v_res loop
    insert into public.appointment_resources (company_id, appointment_id, resource_id, starts_at, ends_at) values (a.company_id, a.id, r, p_starts_at, v_end);
  end loop;
  v_sub := (v_q ->> 'subtotal')::numeric; v_tax := (v_q ->> 'tax')::numeric; v_tot := (v_q ->> 'total')::numeric;
  v_dep := case v_set.deposit_kind when 'none' then 0 when 'flat' then least(v_set.deposit_value, v_tot) else round(v_tot * v_set.deposit_value / 100, 2) end;
  -- Booked from an approved estimate: the customer approved those numbers, so they stay.
  if a.estimate_id is not null then
    update public.appointment_services s set unit_price = el.unit_price, line_total = el.line_total, taxable = el.taxable
    from public.estimate_lines el join public.estimates e on e.id = el.estimate_id
    where s.appointment_id = a.id and el.estimate_id = a.estimate_id and el.service_id = s.service_id and el.name = s.name
      and (el.option_id = e.selected_option_id or (el.option_id is null and el.customer_approved is true));
    select e.subtotal, e.tax, e.total, e.deposit_required into v_sub, v_tax, v_tot, v_dep from public.estimates e where e.id = a.estimate_id;
  end if;
  update public.appointments set
    starts_at = p_starts_at, ends_at = v_end, duration_minutes = v_need.duration_minutes,
    subtotal = v_sub, tax = v_tax, total = v_tot, deposit_required = v_dep
  where id = a.id;
end $$;
revoke execute on function public._appointment_fill(uuid, jsonb, timestamptz) from public, anon, authenticated;

create or replace function public._next_appointment_number(p_company uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.companies set next_appointment_number = next_appointment_number + 1 where id = p_company returning next_appointment_number - 1 into n;
  return n;
end $$;
revoke execute on function public._next_appointment_number(uuid) from public, anon, authenticated;

-- The lines an accepted estimate books: its chosen option plus the add-ons the customer ticked.
create or replace function public._estimate_booking_lines(p_estimate uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('service_id', el.service_id, 'qty', el.qty, 'label', el.name, 'price', el.unit_price,
                                               'modifiers', (select coalesce(jsonb_agg(m ->> 'code'), '[]'::jsonb) from jsonb_array_elements(el.modifiers) m))
                            order by el.option_id nulls last, el.sort_order), '[]'::jsonb)
  from public.estimates e
  join public.estimate_lines el on el.estimate_id = e.id and el.service_id is not null
   and (el.option_id = e.selected_option_id or (el.option_id is null and el.customer_approved is true))
  where e.id = p_estimate
$$;
revoke execute on function public._estimate_booking_lines(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public: hold → confirm → manage by token
-- ---------------------------------------------------------------------------

-- p = {size_class, lines[{service_id, qty?, modifiers?}], starts_at, intake{}, estimate_token?}
-- With an estimate token the lines, customer and car come from the approved estimate.
create or replace function public.create_hold(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.public_company_id();
  v_set     public.retail_settings;
  e         public.estimates;
  a         public.appointments;
  v_lines   jsonb := coalesce(p -> 'lines', '[]'::jsonb);
  v_size    public.vehicle_size := coalesce(nullif(p ->> 'size_class', '')::public.vehicle_size, 'sedan');
  v_n       integer;
begin
  select * into v_set from public.retail_settings where company_id = v_company;
  if v_set.company_id is null or not v_set.online_booking_enabled then
    raise exception 'Online booking is off; please call the shop' using errcode = 'P0001';
  end if;
  if nullif(p ->> 'estimate_token', '') is not null then
    select * into e from public.estimates where token = p ->> 'estimate_token' and company_id = v_company;
    if e.id is null or e.status <> 'accepted' then
      raise exception 'That estimate is not approved' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.appointments where estimate_id = e.id and status in ('hold', 'lead', 'booked', 'confirmed', 'in_progress') and (status <> 'hold' or hold_expires_at > now())) then
      raise exception 'That estimate already has an appointment' using errcode = 'P0001';
    end if;
    v_lines := public._estimate_booking_lines(e.id);
    v_size := e.size_class;
  end if;
  if nullif(p ->> 'starts_at', '') is null then
    raise exception 'Pick a time' using errcode = '22023';
  end if;
  v_n := public._next_appointment_number(v_company);
  insert into public.appointments (company_id, number, display_number, customer_id, vehicle_id, estimate_id, status, starts_at, ends_at, duration_minutes, hold_expires_at, source, size_class, intake, customer_notes)
  values (v_company, v_n, 'APT-' || lpad(v_n::text, 6, '0'), e.customer_id, e.vehicle_id, e.id, 'hold',
          (p ->> 'starts_at')::timestamptz, (p ->> 'starts_at')::timestamptz + interval '1 minute', 1,
          now() + make_interval(mins => v_set.hold_minutes), case when e.id is null then 'public' else 'estimate' end, v_size,
          coalesce(p -> 'intake', '{}'::jsonb), nullif(left(trim(coalesce(p ->> 'customer_notes', '')), 1000), ''))
  returning * into a;
  perform public._appointment_fill(a.id, v_lines, (p ->> 'starts_at')::timestamptz);
  select * into a from public.appointments where id = a.id;
  return jsonb_build_object('token', a.token, 'display_number', a.display_number, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'hold_expires_at', a.hold_expires_at,
                            'total', a.total, 'deposit_required', a.deposit_required, 'has_customer', a.customer_id is not null);
end $$;
grant execute on function public.create_hold(jsonb) to anon, authenticated;

create or replace function public._appointment_for_token(p_token text)
returns public.appointments language sql stable security definer set search_path = public as $$
  select * from public.appointments where token = p_token and length(p_token) >= 20
$$;
revoke execute on function public._appointment_for_token(text) from public, anon, authenticated;

-- Find the customer by phone (or email), else create them; the car likewise under them.
create or replace function public._public_customer(p_company uuid, p jsonb, p_vehicle jsonb, p_size public.vehicle_size, out o_customer uuid, out o_vehicle uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(trim(coalesce(p ->> 'phone', '')), '');
  v_email text := nullif(lower(trim(coalesce(p ->> 'email', ''))), '');
  v_first text := nullif(left(trim(coalesce(p ->> 'first_name', '')), 60), '');
  v_last  text := nullif(left(trim(coalesce(p ->> 'last_name', '')), 60), '');
  v_sms   boolean := coalesce((p ->> 'sms_opt_in')::boolean, false);
  v_mkt   boolean := coalesce((p ->> 'marketing_opt_in')::boolean, false);
  v_vin   text := nullif(upper(trim(coalesce(p_vehicle ->> 'vin', ''))), '');
  v_year  integer := nullif(p_vehicle ->> 'year', '')::integer;
  v_make  text := nullif(left(trim(coalesce(p_vehicle ->> 'make', '')), 60), '');
  v_model text := nullif(left(trim(coalesce(p_vehicle ->> 'model', '')), 60), '');
  v_color text := nullif(left(trim(coalesce(p_vehicle ->> 'color', '')), 40), '');
begin
  if v_first is null or v_phone is null or public.phone_digits(v_phone) is null or length(public.phone_digits(v_phone)) < 7 then
    raise exception 'Your name and a phone number are needed' using errcode = '22023';
  end if;
  select id into o_customer from public.customers
   where company_id = p_company and archived_at is null and merged_into_id is null
     and (phone_digits = public.phone_digits(v_phone) or (v_email is not null and email_lc = v_email))
   order by (phone_digits = public.phone_digits(v_phone)) desc, created_at limit 1;
  if o_customer is null then
    insert into public.customers (company_id, first_name, last_name, phone, email, source, sms_opt_in, sms_opt_in_at, marketing_opt_in, marketing_opt_in_at, consent_source)
    values (p_company, v_first, coalesce(v_last, ''), v_phone, v_email, 'online_booking', v_sms, case when v_sms then now() end, v_mkt, case when v_mkt then now() end, case when v_sms or v_mkt then 'online booking' end)
    returning id into o_customer;
  else
    update public.customers set
      email = coalesce(email, v_email),
      sms_opt_in = sms_opt_in or v_sms, sms_opt_in_at = case when v_sms and not sms_opt_in then now() else sms_opt_in_at end,
      marketing_opt_in = marketing_opt_in or v_mkt, marketing_opt_in_at = case when v_mkt and not marketing_opt_in then now() else marketing_opt_in_at end,
      consent_source = coalesce(consent_source, case when v_sms or v_mkt then 'online booking' end)
    where id = o_customer;
  end if;
  if v_vin is not null or v_model is not null then
    select id into o_vehicle from public.vehicles
     where customer_id = o_customer and archived_at is null
       and ((v_vin is not null and vin = v_vin) or (v_vin is null and coalesce(year, 0) = coalesce(v_year, 0) and lower(coalesce(make, '')) = lower(coalesce(v_make, '')) and lower(coalesce(model, '')) = lower(coalesce(v_model, ''))))
     order by created_at limit 1;
    if o_vehicle is null then
      insert into public.vehicles (company_id, customer_id, vin, year, make, model, color, size_class, size_class_source)
      values (p_company, o_customer, case when v_vin ~ '^[A-HJ-NPR-Z0-9]{17}$' then v_vin end, v_year, v_make, v_model, v_color, p_size, 'manual')
      returning id into o_vehicle;
    end if;
  end if;
end $$;
revoke execute on function public._public_customer(uuid, jsonb, jsonb, public.vehicle_size) from public, anon, authenticated;

-- p = {contact{first_name,last_name,phone,email,sms_opt_in,marketing_opt_in}, vehicle{year,make,model,color,vin}, pay_choice, customer_notes}
create or replace function public.confirm_hold(p_token text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a    public.appointments;
  v_c  uuid;
  v_v  uuid;
begin
  a := public._appointment_for_token(p_token);
  if a.id is null then
    raise exception 'That booking link is not valid' using errcode = 'P0002';
  end if;
  if a.status <> 'hold' then
    return jsonb_build_object('token', a.token, 'status', a.status, 'display_number', a.display_number, 'starts_at', a.starts_at);
  end if;
  if a.hold_expires_at < now() then
    perform public._release_expired_holds();
    raise exception 'Your hold ran out; pick a time again' using errcode = 'P0001';
  end if;
  if a.customer_id is null then
    select * into v_c, v_v from public._public_customer(a.company_id, coalesce(p -> 'contact', '{}'::jsonb), coalesce(p -> 'vehicle', '{}'::jsonb), a.size_class);
  else
    v_c := a.customer_id; v_v := a.vehicle_id;
  end if;
  update public.appointments set
    status = 'lead', customer_id = v_c, vehicle_id = coalesce(v_v, vehicle_id), hold_expires_at = null,
    contact = coalesce(p -> 'contact', contact), vehicle_draft = coalesce(p -> 'vehicle', vehicle_draft),
    pay_choice = case when p ->> 'pay_choice' in ('deposit', 'at_shop') then p ->> 'pay_choice' else 'at_shop' end,
    customer_notes = coalesce(nullif(left(trim(coalesce(p ->> 'customer_notes', '')), 1000), ''), customer_notes)
  where id = a.id;
  select * into a from public.appointments where id = a.id;
  return jsonb_build_object('token', a.token, 'status', a.status, 'display_number', a.display_number, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'total', a.total, 'deposit_required', a.deposit_required, 'pay_choice', a.pay_choice);
end $$;
grant execute on function public.confirm_hold(text, jsonb) to anon, authenticated;

-- The appointment as its customer sees it.
create or replace function public._appointment_json(p_id uuid, p_money boolean, p_public boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'display_number', a.display_number, 'status', a.status, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'duration_minutes', a.duration_minutes,
    'hold_expires_at', a.hold_expires_at, 'source', a.source, 'size_class', a.size_class, 'pay_choice', a.pay_choice, 'intake', a.intake,
    'notes', case when p_public then null else a.notes end, 'customer_notes', a.customer_notes,
    'estimate_id', a.estimate_id, 'job_id', a.job_id, 'confirmed_at', a.confirmed_at, 'checked_in_at', a.checked_in_at, 'done_at', a.done_at, 'cancelled_at', a.cancelled_at, 'cancel_reason', a.cancel_reason,
    'created_at', a.created_at, 'updated_at', a.updated_at, 'token', case when p_public then a.token else null end,
    'subtotal', case when p_money then a.subtotal end, 'tax', case when p_money then a.tax end, 'total', case when p_money then a.total end, 'deposit_required', case when p_money then a.deposit_required end,
    'customer', (select jsonb_build_object('id', c.id, 'display_name', case when p_public then nullif(trim(c.first_name), '') else c.display_name end, 'first_name', c.first_name,
                                           'phone', case when p_public then null else c.phone end, 'email', case when p_public then null else c.email end)
                 from public.customers c where c.id = a.customer_id),
    'vehicle', (select jsonb_build_object('id', v.id, 'name', nullif(concat_ws(' ', v.year::text, v.make, v.model), ''), 'color', v.color, 'plate', case when p_public then null else v.plate end, 'size_class', v.size_class)
                from public.vehicles v where v.id = a.vehicle_id),
    'services', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'service_id', s.service_id, 'name', s.name, 'qty', s.qty, 'duration_minutes', s.duration_minutes,
                                                              'unit_price', case when p_money then s.unit_price end, 'line_total', case when p_money then s.line_total end,
                                                              'modifiers', (select coalesce(jsonb_agg(jsonb_build_object('code', m ->> 'code', 'label', m ->> 'label')), '[]'::jsonb) from jsonb_array_elements(s.modifiers) m))
                                           order by s.sort_order), '[]'::jsonb) from public.appointment_services s where s.appointment_id = a.id),
    'resources', case when p_public then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'name', r.name) order by r.kind, r.sort_order), '[]'::jsonb)
                                                           from public.appointment_resources ar join public.resources r on r.id = ar.resource_id where ar.appointment_id = a.id) end,
    'estimate', (select jsonb_build_object('id', e.id, 'display_number', e.display_number, 'status', e.status) from public.estimates e where e.id = a.estimate_id),
    'company', (select jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email, 'address_line1', c.address_line1, 'city', c.city, 'state', c.state, 'postal_code', c.postal_code, 'timezone', c.timezone) from public.companies c where c.id = a.company_id),
    'policy', (select jsonb_build_object('cancel_hours', rs.cancel_hours, 'hold_minutes', rs.hold_minutes, 'deposit_kind', rs.deposit_kind, 'deposit_value', rs.deposit_value, 'deposit_refundable', rs.deposit_refundable, 'policy_text', rs.policy_text)
               from public.retail_settings rs where rs.company_id = a.company_id),
    'can_change', a.status in ('lead', 'booked', 'confirmed') and a.starts_at > now() + make_interval(hours => (select cancel_hours from public.retail_settings where company_id = a.company_id))
  )
  from public.appointments a where a.id = p_id
$$;
revoke execute on function public._appointment_json(uuid, boolean, boolean) from public, anon, authenticated;

create or replace function public.appointment_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a public.appointments;
begin
  a := public._appointment_for_token(p_token);
  if a.id is null then
    raise exception 'That booking link is not valid' using errcode = 'P0002';
  end if;
  return public._appointment_json(a.id, true, true);
end $$;
grant execute on function public.appointment_by_token(text) to anon, authenticated;

create or replace function public.cancel_by_token(p_token text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.appointments; v_hours integer;
begin
  a := public._appointment_for_token(p_token);
  if a.id is null then
    raise exception 'That booking link is not valid' using errcode = 'P0002';
  end if;
  if a.status not in ('hold', 'lead', 'booked', 'confirmed') then
    raise exception 'This appointment cannot be cancelled online; please call the shop' using errcode = 'P0001';
  end if;
  select cancel_hours into v_hours from public.retail_settings where company_id = a.company_id;
  if a.status <> 'hold' and a.starts_at <= now() + make_interval(hours => coalesce(v_hours, 24)) then
    raise exception 'Inside the % hour notice window; please call the shop to cancel', coalesce(v_hours, 24) using errcode = 'P0001';
  end if;
  update public.appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = coalesce(nullif(left(trim(coalesce(p_reason, '')), 300), ''), 'Cancelled by the customer') where id = a.id;
  return public._appointment_json(a.id, true, true);
end $$;
grant execute on function public.cancel_by_token(text, text) to anon, authenticated;

create or replace function public.reschedule_by_token(p_token text, p_starts_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.appointments; v_hours integer; v_lines jsonb;
begin
  a := public._appointment_for_token(p_token);
  if a.id is null then
    raise exception 'That booking link is not valid' using errcode = 'P0002';
  end if;
  if a.status not in ('lead', 'booked', 'confirmed') then
    raise exception 'This appointment cannot be moved online; please call the shop' using errcode = 'P0001';
  end if;
  select cancel_hours into v_hours from public.retail_settings where company_id = a.company_id;
  if a.starts_at <= now() + make_interval(hours => coalesce(v_hours, 24)) then
    raise exception 'Inside the % hour notice window; please call the shop to move it', coalesce(v_hours, 24) using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('service_id', s.service_id, 'qty', s.qty, 'label', s.name, 'price', s.unit_price, 'modifiers', (select coalesce(jsonb_agg(m ->> 'code'), '[]'::jsonb) from jsonb_array_elements(s.modifiers) m)) order by s.sort_order), '[]'::jsonb)
    into v_lines from public.appointment_services s where s.appointment_id = a.id;
  perform public._appointment_fill(a.id, v_lines, p_starts_at);
  update public.appointments set reminders_sent = '{}' where id = a.id;
  return public._appointment_json(a.id, true, true);
end $$;
grant execute on function public.reschedule_by_token(text, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------

-- p = {customer_id, vehicle_id?, estimate_id?, lines?, starts_at, notes?, customer_notes?, size_class?}
create or replace function public.book_appointment(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  e         public.estimates;
  a         public.appointments;
  v_lines   jsonb := coalesce(p -> 'lines', '[]'::jsonb);
  v_size    public.vehicle_size;
  v_cust    uuid := nullif(p ->> 'customer_id', '')::uuid;
  v_veh     uuid := nullif(p ->> 'vehicle_id', '')::uuid;
  v_n       integer;
begin
  if not public.is_admin() then
    raise exception 'Only the owner, an admin or a manager books appointments' using errcode = '42501';
  end if;
  if nullif(p ->> 'estimate_id', '') is not null then
    select * into e from public.estimates where id = (p ->> 'estimate_id')::uuid and company_id = v_company;
    if e.id is null or e.status <> 'accepted' then
      raise exception 'Only an approved estimate is booked from' using errcode = 'P0001';
    end if;
    v_lines := public._estimate_booking_lines(e.id);
    v_cust := e.customer_id; v_veh := e.vehicle_id; v_size := e.size_class;
  end if;
  if v_cust is null or not exists (select 1 from public.customers where id = v_cust and company_id = v_company) then
    raise exception 'Pick the customer' using errcode = '22023';
  end if;
  if v_veh is not null and not exists (select 1 from public.vehicles where id = v_veh and customer_id = v_cust) then
    raise exception 'That vehicle is not theirs' using errcode = '22023';
  end if;
  v_size := coalesce(v_size, nullif(p ->> 'size_class', '')::public.vehicle_size, (select size_class from public.vehicles where id = v_veh), 'sedan');
  if nullif(p ->> 'starts_at', '') is null then
    raise exception 'Pick a time' using errcode = '22023';
  end if;
  v_n := public._next_appointment_number(v_company);
  insert into public.appointments (company_id, number, display_number, customer_id, vehicle_id, estimate_id, status, starts_at, ends_at, duration_minutes, source, size_class, notes, customer_notes, confirmed_at, created_by)
  values (v_company, v_n, 'APT-' || lpad(v_n::text, 6, '0'), v_cust, v_veh, e.id, 'booked',
          (p ->> 'starts_at')::timestamptz, (p ->> 'starts_at')::timestamptz + interval '1 minute', 1,
          case when e.id is null then 'staff' else 'estimate' end, v_size,
          nullif(left(trim(coalesce(p ->> 'notes', '')), 2000), ''), coalesce(nullif(left(trim(coalesce(p ->> 'customer_notes', '')), 1000), ''), e.customer_notes), now(), auth.uid())
  returning * into a;
  perform public._appointment_fill(a.id, v_lines, (p ->> 'starts_at')::timestamptz);
  return public._appointment_json(a.id, public.can_price_jobs(), false);
end $$;
grant execute on function public.book_appointment(jsonb) to authenticated;

-- The retail job for a checked-in appointment: the car is in the shop.
create or replace function public._appointment_create_job(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a        public.appointments;
  v_dealer uuid;
  v_veh    public.vehicles;
  j        public.jobs;
  l        record;
  v_uid    uuid := auth.uid();
  v_job    uuid;
begin
  select * into a from public.appointments where id = p_id;
  if a.job_id is not null then return a.job_id; end if;
  if a.estimate_id is not null then
    select job_id into v_job from public.estimates where id = a.estimate_id;
    if v_job is not null then
      update public.appointments set job_id = v_job where id = a.id;
      update public.jobs set appointment_id = a.id where id = v_job and appointment_id is null;
      return v_job;
    end if;
  end if;
  select id into v_dealer from public.dealerships where company_id = a.company_id and active and retail order by name limit 1;
  if v_dealer is null then
    raise exception 'No retail location is set up (Settings → Dealerships → Retail)' using errcode = 'P0001';
  end if;
  if a.vehicle_id is not null then select * into v_veh from public.vehicles where id = a.vehicle_id; end if;
  insert into public.jobs (company_id, dealership_id, detailer_id, client_id, tag_number, vin, year, make, model, color, performed_at, notes, customer_id, vehicle_id, appointment_id, created_by, updated_by)
  values (a.company_id, v_dealer, coalesce((select r.profile_id from public.appointment_resources ar join public.resources r on r.id = ar.resource_id where ar.appointment_id = a.id and r.kind = 'tech' and r.profile_id is not null limit 1), v_uid),
          gen_random_uuid(), replace(a.display_number, 'APT-', 'A-'), v_veh.vin, v_veh.year, v_veh.make, v_veh.model, v_veh.color, now(),
          coalesce(a.customer_notes, a.notes), a.customer_id, a.vehicle_id, a.id, v_uid, v_uid)
  returning * into j;
  for l in select * from public.appointment_services where appointment_id = a.id order by sort_order loop
    if l.service_id is null then continue; end if;
    insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price)
    values (a.company_id, j.id, l.service_id, l.line_total, null, case when l.name <> (select name from public.services where id = l.service_id) then left(l.name, 120) end, false);
  end loop;
  update public.appointments set job_id = j.id where id = a.id;
  if a.estimate_id is not null then
    update public.estimates set job_id = j.id where id = a.estimate_id and job_id is null;
  end if;
  return j.id;
end $$;
revoke execute on function public._appointment_create_job(uuid) from public, anon, authenticated;

-- confirm (lead → booked), check_in (→ in_progress, creates the job), done, cancel, no_show
create or replace function public.set_appointment_status(p_id uuid, p_status text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  if not public.is_admin() then
    raise exception 'Only the owner, an admin or a manager changes appointments' using errcode = '42501';
  end if;
  select * into a from public.appointments where id = p_id and company_id = public.current_company_id();
  if a.id is null then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;
  case p_status
    when 'booked' then
      if a.status not in ('hold', 'lead') then raise exception 'Only a lead is confirmed' using errcode = 'P0001'; end if;
      if a.customer_id is null then raise exception 'This hold has no customer yet' using errcode = 'P0001'; end if;
      update public.appointments set status = 'booked', confirmed_at = now(), hold_expires_at = null where id = a.id;
    when 'confirmed' then
      if a.status not in ('booked') then raise exception 'Only a booked appointment is marked confirmed' using errcode = 'P0001'; end if;
      update public.appointments set status = 'confirmed' where id = a.id;
    when 'in_progress' then
      if a.status not in ('lead', 'booked', 'confirmed') then raise exception 'Cannot check in from %', a.status using errcode = 'P0001'; end if;
      update public.appointments set status = 'in_progress', checked_in_at = now(), confirmed_at = coalesce(confirmed_at, now()), hold_expires_at = null where id = a.id;
      perform public._appointment_create_job(a.id);
    when 'done' then
      if a.status not in ('in_progress', 'booked', 'confirmed') then raise exception 'Cannot finish from %', a.status using errcode = 'P0001'; end if;
      update public.appointments set status = 'done', done_at = now() where id = a.id;
    when 'cancelled' then
      if a.status in ('done') then raise exception 'A finished appointment is not cancelled' using errcode = 'P0001'; end if;
      update public.appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = nullif(left(trim(coalesce(p_reason, '')), 300), '') where id = a.id;
    when 'no_show' then
      if a.status not in ('lead', 'booked', 'confirmed') then raise exception 'Cannot mark no-show from %', a.status using errcode = 'P0001'; end if;
      update public.appointments set status = 'no_show', cancelled_at = now(), cancel_reason = coalesce(nullif(left(trim(coalesce(p_reason, '')), 300), ''), 'No show') where id = a.id;
    else
      raise exception 'Unknown status %', p_status using errcode = '22023';
  end case;
  return public._appointment_json(a.id, public.can_price_jobs(), false);
end $$;
grant execute on function public.set_appointment_status(uuid, text, text) to authenticated;

create or replace function public.reschedule_appointment(p_id uuid, p_starts_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.appointments; v_lines jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only the owner, an admin or a manager moves appointments' using errcode = '42501';
  end if;
  select * into a from public.appointments where id = p_id and company_id = public.current_company_id();
  if a.id is null then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;
  if a.status not in ('hold', 'lead', 'booked', 'confirmed') then
    raise exception 'Cannot move an appointment that is %', a.status using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('service_id', s.service_id, 'qty', s.qty, 'label', s.name, 'price', s.unit_price, 'modifiers', (select coalesce(jsonb_agg(m ->> 'code'), '[]'::jsonb) from jsonb_array_elements(s.modifiers) m)) order by s.sort_order), '[]'::jsonb)
    into v_lines from public.appointment_services s where s.appointment_id = a.id;
  perform public._appointment_fill(a.id, v_lines, p_starts_at);
  update public.appointments set reminders_sent = '{}' where id = a.id;
  return public._appointment_json(a.id, public.can_price_jobs(), false);
end $$;
grant execute on function public.reschedule_appointment(uuid, timestamptz) to authenticated;

-- The customer's manage link, for staff who may book (owner/admin/manager). The token column itself is unreadable.
create or replace function public.appointment_link(p_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_token text;
begin
  if not public.is_admin() then
    raise exception 'Only the owner, an admin or a manager shares the booking link' using errcode = '42501';
  end if;
  select token into v_token from public.appointments where id = p_id and company_id = public.current_company_id();
  if v_token is null then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;
  return v_token;
end $$;
grant execute on function public.appointment_link(uuid) to authenticated;

create or replace function public.appointment_detail(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.appointments where id = p_id and company_id = public.current_company_id()) then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;
  return public._appointment_json(p_id, public.can_price_jobs(), false);
end $$;
grant execute on function public.appointment_detail(uuid) to authenticated;

-- The calendar: every live appointment in the range, plus the lanes (bays, lifts, techs).
create or replace function public.calendar_range(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := public.current_company_id(); v_money boolean := public.can_price_jobs();
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'resources', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'name', r.name, 'profile_id', r.profile_id) order by r.kind, r.sort_order, r.name), '[]'::jsonb) from public.resources r where r.company_id = v_company and r.active),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('dow', h.dow, 'opens', h.opens, 'closes', h.closes, 'closed', h.closed) order by h.dow), '[]'::jsonb) from public.business_hours h where h.company_id = v_company),
    'blackouts', (select coalesce(jsonb_agg(jsonb_build_object('day', b.day, 'reason', b.reason) order by b.day), '[]'::jsonb) from public.blackout_days b where b.company_id = v_company and b.day between p_from::date - 1 and p_to::date + 1),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'display_number', a.display_number, 'status', a.status, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'duration_minutes', a.duration_minutes, 'hold_expires_at', a.hold_expires_at,
        'source', a.source, 'size_class', a.size_class, 'pay_choice', a.pay_choice, 'job_id', a.job_id, 'estimate_id', a.estimate_id,
        'customer', (select coalesce(c.display_name, c.phone) from public.customers c where c.id = a.customer_id),
        'customer_id', a.customer_id,
        'vehicle', (select nullif(concat_ws(' ', v.year::text, v.make, v.model), '') from public.vehicles v where v.id = a.vehicle_id),
        'services', (select coalesce(jsonb_agg(s.name order by s.sort_order), '[]'::jsonb) from public.appointment_services s where s.appointment_id = a.id),
        'resource_ids', (select coalesce(jsonb_agg(ar.resource_id), '[]'::jsonb) from public.appointment_resources ar where ar.appointment_id = a.id),
        'total', case when v_money then a.total end, 'deposit_required', case when v_money then a.deposit_required end
      ) order by a.starts_at), '[]'::jsonb)
      from public.appointments a
      where a.company_id = v_company and a.starts_at < p_to and a.ends_at > p_from
        and a.status in ('hold', 'lead', 'booked', 'confirmed', 'in_progress', 'done', 'no_show')
        and (a.status <> 'hold' or a.hold_expires_at > now()))
  );
end $$;
grant execute on function public.calendar_range(timestamptz, timestamptz) to authenticated;

create or replace function public._calendar_item(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'display_number', a.display_number, 'status', a.status, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'duration_minutes', a.duration_minutes, 'hold_expires_at', a.hold_expires_at,
    'source', a.source, 'size_class', a.size_class, 'pay_choice', a.pay_choice, 'job_id', a.job_id, 'estimate_id', a.estimate_id,
    'customer', (select coalesce(c.display_name, c.phone) from public.customers c where c.id = a.customer_id), 'customer_id', a.customer_id,
    'vehicle', (select nullif(concat_ws(' ', v.year::text, v.make, v.model), '') from public.vehicles v where v.id = a.vehicle_id),
    'services', (select coalesce(jsonb_agg(s.name order by s.sort_order), '[]'::jsonb) from public.appointment_services s where s.appointment_id = a.id),
    'resource_ids', (select coalesce(jsonb_agg(ar.resource_id), '[]'::jsonb) from public.appointment_resources ar where ar.appointment_id = a.id),
    'total', case when public.can_price_jobs() then a.total end, 'deposit_required', case when public.can_price_jobs() then a.deposit_required end
  ) from public.appointments a where a.id = p_id
$$;
revoke execute on function public._calendar_item(uuid) from public, anon, authenticated;

-- Today at the shop: what needs a hand (leads to confirm, live holds) and the day's appointments.
create or replace function public.retail_today_appointments()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := public.current_company_id(); v_tz text; v_day date;
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  select timezone into v_tz from public.companies where id = v_company;
  v_day := (now() at time zone v_tz)::date;
  return jsonb_build_object(
    'leads', (select coalesce(jsonb_agg(public._calendar_item(a.id) order by a.created_at desc), '[]'::jsonb) from public.appointments a where a.company_id = v_company and a.status = 'lead'),
    'holds', (select coalesce(jsonb_agg(public._calendar_item(a.id) order by a.hold_expires_at), '[]'::jsonb) from public.appointments a where a.company_id = v_company and a.status = 'hold' and a.hold_expires_at > now()),
    'today', (select coalesce(jsonb_agg(public._calendar_item(a.id) order by a.starts_at), '[]'::jsonb) from public.appointments a
              where a.company_id = v_company and (a.starts_at at time zone v_tz)::date = v_day and a.status in ('booked', 'confirmed', 'in_progress', 'done', 'no_show'))
  );
end $$;

grant execute on function public.retail_today_appointments() to authenticated;

-- The customer's timeline lists their appointments too.
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'customer_timeline';
  if v_src is not null and position('''appointments'',' in v_src) = 0 then
    v_src := replace(v_src, '    ''stats'', jsonb_build_object(', '    ''appointments'', (select coalesce(jsonb_agg(jsonb_build_object(
               ''id'', ap.id, ''display_number'', ap.display_number, ''status'', ap.status, ''starts_at'', ap.starts_at, ''ends_at'', ap.ends_at,
               ''vehicle'', (select nullif(concat_ws('' '', v.year::text, v.make, v.model), '''') from public.vehicles v where v.id = ap.vehicle_id),
               ''services'', (select coalesce(jsonb_agg(s.name order by s.sort_order), ''[]''::jsonb) from public.appointment_services s where s.appointment_id = ap.id),
               ''job_id'', ap.job_id
             ) order by ap.starts_at desc), ''[]''::jsonb) from public.appointments ap where ap.customer_id = v_c.id and ap.status <> ''hold''),
    ''stats'', jsonb_build_object(');
    execute v_src;
  end if;
end $$;
