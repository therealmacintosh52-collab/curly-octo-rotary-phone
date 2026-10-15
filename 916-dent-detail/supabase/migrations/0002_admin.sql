-- 916 Dent & Detail: Phase 3 (CRM + /admin) additions. Run AFTER 0001_init.sql. Additive only (0001 is never edited).
-- NOT executed against Postgres by the agent that wrote it (no database available): review before running, then run
-- tests/rls/rls-intent.md checks in the Supabase SQL editor. See DECISIONS.md P3-0xx.
--
-- Access model recap (unchanged): the Next.js server talks to Postgres with the SERVICE ROLE (bypasses RLS) after
-- checking the signed admin session (owner | admin | tech). RLS below is defence in depth for any direct client use
-- (e.g. a future supabase-js call from the browser) and for dashboard users.

-- ------------------------------------------------------------------ new tables
create table public.settings (
  id text primary key,                                  -- 'booking' = durations / buffers override
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  channel text not null check (channel in ('google','gbp','meta_ads','instagram','tiktok','door_knock','referral','dealer','organic','direct','other')),
  spend numeric(10,2) not null check (spend >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ad_spend (date, channel);

create table public.membership_visits (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  kind text not null check (kind in ('grant','use','adjust')),
  visits numeric(5,2) not null,                         -- grant/adjust: +n or -n ; use: -n stored as negative
  booking_id uuid references public.bookings(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.membership_visits (membership_id, created_at);

create table public.invoice_counters (
  year integer primary key,
  last integer not null default 0
);
alter table public.invoice_counters enable row level security;   -- no policies: service role only

-- ------------------------------------------------------------------ new columns
alter table public.customers add column if not exists stripe_customer_id text;
alter table public.leads add column if not exists source_auto text;
alter table public.leads add column if not exists source_overridden boolean not null default false;
alter table public.jobs add column if not exists line_items jsonb not null default '[]'::jsonb;
alter table public.jobs add column if not exists on_my_way_at timestamptz;
alter table public.jobs add column if not exists eta_minutes integer;
alter table public.jobs add column if not exists payment_link_url text;
alter table public.jobs add column if not exists payment_link_id text;
alter table public.payments add column if not exists recorded_by uuid references public.profiles(id) on delete set null;
alter table public.payments add column if not exists reference text;
alter table public.memberships add column if not exists stripe_customer_id text;
alter table public.memberships add column if not exists visits_per_period numeric(4,1);
create unique index if not exists referral_credits_one_per_referred on public.referral_credits (referral_code_id, referred_customer_id)
  where referred_customer_id is not null and status <> 'void';

-- updated_at triggers for the new tables
do $$
declare t text;
begin
  foreach t in array array['settings','ad_spend','membership_visits'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ functions (service role only)
create or replace function public.next_invoice_number(year integer) returns text
  language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.invoice_counters (year, last) values (year, 1)
    on conflict (year) do update set last = public.invoice_counters.last + 1
    returning last into n;
  return 'INV-' || year || '-' || lpad(n::text, 4, '0');
end $$;

-- Re-point every child row of drop_id to keep_id inside one transaction (a function call is atomic), fill gaps on
-- the kept record, delete the duplicate. Returns {table: rows_moved}. Keep the table list in sync with
-- src/lib/db/merge.ts (CUSTOMER_FKS).
create or replace function public.merge_customers(keep_id uuid, drop_id uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  moved jsonb := '{}'::jsonb;
  n integer;
  k public.customers;
  d public.customers;
  pair text[];
begin
  if keep_id = drop_id then raise exception 'cannot merge a customer into itself'; end if;
  select * into k from public.customers where id = keep_id for update;
  select * into d from public.customers where id = drop_id for update;
  if k.id is null or d.id is null then raise exception 'customer not found'; end if;

  foreach pair slice 1 in array array[
    array['vehicles','customer_id'], array['leads','customer_id'], array['quotes','customer_id'], array['bookings','customer_id'],
    array['jobs','customer_id'], array['invoices','customer_id'], array['payments','customer_id'], array['memberships','customer_id'],
    array['referral_codes','customer_id'], array['referral_credits','referred_customer_id'], array['conversations','customer_id']
  ] loop
    execute format('update public.%I set %I = $1 where %I = $2', pair[1], pair[2], pair[2]) using keep_id, drop_id;
    get diagnostics n = row_count;
    if n > 0 then moved := moved || jsonb_build_object(pair[1], n); end if;
  end loop;
  update public.notes set entity_id = keep_id where entity_type = 'customer' and entity_id = drop_id;
  get diagnostics n = row_count;
  if n > 0 then moved := moved || jsonb_build_object('notes', n); end if;
  update public.events set entity_id = keep_id::text where entity_type = 'customer' and entity_id = drop_id::text;

  update public.customers set
    email = coalesce(k.email, d.email),
    phone = coalesce(k.phone, d.phone),
    dealer_id = coalesce(k.dealer_id, d.dealer_id),
    referral_code_used = coalesce(k.referral_code_used, d.referral_code_used),
    stripe_customer_id = coalesce(k.stripe_customer_id, d.stripe_customer_id),
    sms_opt_in = k.sms_opt_in or d.sms_opt_in,
    sms_opt_in_at = case when k.sms_opt_in then k.sms_opt_in_at else d.sms_opt_in_at end,
    sms_opt_in_text = case when k.sms_opt_in then k.sms_opt_in_text else d.sms_opt_in_text end,
    sms_opt_out_at = coalesce(k.sms_opt_out_at, d.sms_opt_out_at)   -- an opt-out on either record stays an opt-out
  where id = keep_id;
  delete from public.customers where id = drop_id;
  return moved;
end $$;

revoke all on function public.next_invoice_number(integer) from public, anon, authenticated;
revoke all on function public.merge_customers(uuid, uuid) from public, anon, authenticated;
grant execute on function public.next_invoice_number(integer) to service_role;
grant execute on function public.merge_customers(uuid, uuid) to service_role;

-- ------------------------------------------------------------------ RLS for the new tables
alter table public.settings enable row level security;
alter table public.ad_spend enable row level security;
alter table public.membership_visits enable row level security;
create policy staff_all on public.settings for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.ad_spend for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.membership_visits for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- (a tech may read the booking settings to see buffers; nothing else on these tables)
create policy settings_tech_read on public.settings for select to authenticated using (public.current_role_name() = 'tech');

-- ------------------------------------------------------------------ tech hardening
-- 0001 lets a tech UPDATE any column of their own bookings/jobs (price, customer, tech). Restrict to the fields the
-- tech view legitimately writes. The service role (auth.uid() is null) and staff are unaffected.
create or replace function public.limit_tech_columns() returns trigger language plpgsql security definer set search_path = public as $$
declare allowed text[]; strip text[];
begin
  if auth.uid() is null or public.is_staff() then return new; end if;
  if tg_table_name = 'bookings' then
    allowed := array['status','updated_at'];
    if new.status is distinct from old.status and new.status not in ('on_the_way','in_progress','completed','no_show') then
      raise exception 'technicians may only move a booking to on_the_way, in_progress, completed or no_show';
    end if;
  elsif tg_table_name = 'jobs' then
    allowed := array['stage','started_at','finished_at','summary','signature_path','line_items','on_my_way_at','eta_minutes','updated_at'];
  else
    return new;
  end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'technicians cannot change fields outside the tech view on %', tg_table_name;
  end if;
  return new;
end $$;
create trigger limit_tech_columns before update on public.bookings for each row execute function public.limit_tech_columns();
create trigger limit_tech_columns_jobs before update on public.jobs for each row execute function public.limit_tech_columns();

-- techs add notes on their own jobs/bookings (read their own notes back); never edit/delete others'
create policy notes_tech_read on public.notes for select to authenticated using (
  (entity_type = 'job' and exists (select 1 from public.jobs j where j.id = entity_id and j.tech_id = public.my_tech_id()))
  or (entity_type = 'booking' and exists (select 1 from public.bookings b where b.id = entity_id and b.tech_id = public.my_tech_id()))
);
create policy notes_tech_insert on public.notes for insert to authenticated with check (
  author_id = auth.uid() and (
    (entity_type = 'job' and exists (select 1 from public.jobs j where j.id = entity_id and j.tech_id = public.my_tech_id()))
    or (entity_type = 'booking' and exists (select 1 from public.bookings b where b.id = entity_id and b.tech_id = public.my_tech_id()))
  )
);
-- a tech sees invoices only for their own jobs (to show the balance); cannot write them
create policy invoices_tech_read on public.invoices for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = invoices.job_id and j.tech_id = public.my_tech_id())
);
