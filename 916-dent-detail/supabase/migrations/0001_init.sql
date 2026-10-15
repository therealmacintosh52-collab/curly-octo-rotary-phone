-- 916 Dent & Detail: initial schema for ALL phases (booking, CRM/admin, concierge bot, dealer portal).
-- Conventions: uuid pks, timestamptz everywhere, money in whole US cents? NO: whole dollars (numeric(10,2)) to match
-- src/config/pricing.ts. Enums are text + CHECK so adding a value is a one-line migration.
-- Access model (RLS):
--   * owner/admin (profiles.role in owner|admin) : everything.
--   * tech                                       : own bookings/jobs/photos + the customers/vehicles on them.
--   * dealer                                     : own dealer rows only (dealers, dealer_users, dealer_vehicles, dealer_statements).
--   * customers (no login)                       : NO direct table access. The app verifies an HMAC-signed link token
--                                                  (/booking/[token]) server-side and then reads/writes with the service role.
--   * anon                                       : may read active services only.
-- The service-role key bypasses RLS and must stay server-side.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ------------------------------------------------------------------ identity
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('owner','admin','tech','dealer','customer')),
  full_name text,
  phone text,
  tech_id uuid,            -- set for role = tech (fk added after techs exists)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.techs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  phone text,
  email text,
  color text,
  home_zip text,
  calendar_id text,        -- optional Google Calendar id
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add constraint profiles_tech_fk foreign key (tech_id) references public.techs(id) on delete set null;

create table public.tech_availability (
  id uuid primary key default gen_random_uuid(),
  tech_id uuid not null references public.techs(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = Sunday, local (America/Los_Angeles)
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tech_availability (tech_id, weekday);

create table public.blackout_dates (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  tech_id uuid references public.techs(id) on delete cascade,  -- null = everyone
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.blackout_dates (date);

create table public.admin_blocks (
  id uuid primary key default gen_random_uuid(),
  tech_id uuid references public.techs(id) on delete cascade,  -- null = everyone
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.admin_blocks (starts_at, ends_at);

create table public.weather_flags (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  reason text,                                  -- rain | heat | wind | smoke | other
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ catalog
create table public.services (
  id text primary key,                          -- pdr, hail, paint-correction, ceramic, decon, interior
  plain_name text not null,
  term text not null,
  requires_photos boolean not null default false,
  exterior boolean not null default true,
  active boolean not null default true,
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ people
create table public.dealers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  address_zip text,
  net_terms_days smallint not null default 30,
  wholesale_pricing jsonb not null default '{}'::jsonb,   -- [OWNER] per-panel wholesale sheet
  stripe_customer_id text,
  status text not null default 'pending' check (status in ('pending','active','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dealer_users (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dealer_id, profile_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,                                   -- E.164
  sms_opt_in boolean not null default false,
  sms_opt_in_at timestamptz,
  sms_opt_in_text text,                         -- exact consent wording shown (TCPA evidence)
  sms_opt_out_at timestamptz,
  dealer_id uuid references public.dealers(id) on delete set null,
  referral_code_used text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.customers (phone);
create index on public.customers (lower(email));

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  dealer_id uuid references public.dealers(id) on delete set null,
  year smallint,
  make text,
  model text,
  size_class text check (size_class in ('compact','sedan','suv','truck','xl')),
  color text,
  vin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.vehicles (customer_id);

-- ------------------------------------------------------------------ funnel
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  name text,
  phone text,
  email text,
  zip text,
  stage text not null default 'new' check (stage in ('new','quoted','booked','in_progress','done','reviewed','lost')),
  source text not null default 'direct' check (source in ('google','gbp','meta_ads','instagram','tiktok','door_knock','referral','dealer','organic','direct','other')),
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  gclid text, fbclid text,
  referrer text,
  landing_page text,
  first_touch jsonb,
  notes text,
  area_status text,                             -- in_area | out_of_area | needs_review
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.leads (stage, created_at desc);
create index on public.leads (source);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  services jsonb not null default '[]'::jsonb,
  size_class text,
  low numeric(10,2),
  high numeric(10,2),
  confidence numeric(4,3),
  panels jsonb not null default '[]'::jsonb,
  notes text,
  photo_paths jsonb not null default '[]'::jsonb,
  model text,
  mock boolean not null default false,
  label text not null default 'Estimate — final price confirmed on inspection.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  tech_id uuid references public.techs(id) on delete set null,
  status text not null default 'pending_deposit'
    check (status in ('pending_deposit','confirmed','on_the_way','in_progress','completed','cancelled','no_show','expired')),
  services jsonb not null default '[]'::jsonb,
  addons jsonb not null default '[]'::jsonb,
  size_class text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_min integer not null,
  hold_expires_at timestamptz,
  zip text,
  address_line text,
  city text,
  area_status text,
  travel_fee numeric(10,2) not null default 0,
  price_low numeric(10,2),
  price_high numeric(10,2),
  needs_review boolean not null default false,
  deposit_amount numeric(10,2) not null default 0,
  deposit_status text not null default 'none' check (deposit_status in ('none','pending','paid','refunded','forfeited','credited')),
  payment_intent_id text,
  idempotency_key text unique,
  reschedule_count smallint not null default 0,
  cancelled_at timestamptz,
  cancel_reason text,
  customer_notes text,
  gcal_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.bookings (starts_at);
create index on public.bookings (tech_id, starts_at);
create index on public.bookings (customer_id);
-- Hard guarantee against double booking: a tech cannot hold two live bookings that overlap in time.
alter table public.bookings add constraint bookings_no_overlap exclude using gist (
  tech_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('pending_deposit','confirmed','on_the_way','in_progress') and tech_id is not null);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  tech_id uuid references public.techs(id) on delete set null,
  dealer_id uuid references public.dealers(id) on delete set null,
  stage text not null default 'booked' check (stage in ('new','quoted','booked','in_progress','done','reviewed')),
  started_at timestamptz,
  finished_at timestamptz,
  final_price numeric(10,2),
  review_requested_at timestamptz,
  reviewed_at timestamptz,
  signature_path text,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.jobs (tech_id, stage);

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  kind text not null default 'other' check (kind in ('quote','before','after','other')),
  storage_path text not null,
  marketing_consent boolean not null default false,   -- owner may publish only when true
  consent_at timestamptz,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text unique,
  job_id uuid references public.jobs(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  dealer_id uuid references public.dealers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','sent','paid','void','overdue')),
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0,
  deposit_applied numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  stripe_invoice_id text,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  kind text not null check (kind in ('deposit','balance','refund','membership','dealer')),
  amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  method text,
  stripe_payment_intent_id text unique,
  mock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('customer','vehicle','lead','booking','job','dealer')),
  entity_id uuid not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.notes (entity_type, entity_id);

-- ------------------------------------------------------------------ growth
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  tier text not null check (tier in ('maintain','protect','showroom')),
  status text not null default 'active' check (status in ('active','past_due','paused','cancelled')),
  stripe_subscription_id text unique,
  started_at timestamptz not null default now(),
  renews_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid references public.customers(id) on delete cascade,
  credit_amount numeric(10,2) not null default 0,       -- [OWNER] set in config
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.referral_credits (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete cascade,
  referred_customer_id uuid references public.customers(id) on delete set null,
  amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','available','redeemed','void')),
  redeemed_booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ concierge bot memory (Phase 4)
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('web','sms','instagram','facebook','voice')),
  external_id text,                                     -- phone number hash / thread id
  customer_id uuid references public.customers(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'open' check (status in ('open','escalated','closed')),
  cost_usd numeric(10,4) not null default 0,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, external_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);

-- ------------------------------------------------------------------ dealer portal (Phase 5)
create table public.dealer_vehicles (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  vin text,
  stock_number text,
  year smallint, make text, model text,
  size_class text check (size_class in ('compact','sedan','suv','truck','xl')),
  photo_paths jsonb not null default '[]'::jsonb,
  notes text,
  status text not null default 'submitted' check (status in ('submitted','quoted','approved','in_progress','done','invoiced')),
  job_id uuid references public.jobs(id) on delete set null,
  addon_approvals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.dealer_vehicles (dealer_id, status);

create table public.dealer_statements (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total numeric(10,2) not null default 0,
  status text not null default 'open' check (status in ('open','sent','paid','overdue')),
  stripe_invoice_id text,
  line_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ platform
create table public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null,                                   -- booking.created, notify.sent, ...
  entity_type text,
  entity_id text,
  actor text,                                           -- system | customer | owner id
  data jsonb not null default '{}'::jsonb,              -- never put PII here
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.events (entity_type, entity_id, created_at desc);

create table public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  kind text not null,                                   -- confirmation, reminder_24h, reminder_2h, on_the_way, review_request, rebook_6mo
  run_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','skipped','failed','cancelled')),
  attempts smallint not null default 0,
  dedupe_key text not null unique,                      -- makes scheduling idempotent
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.notification_queue (status, run_at);

create table public.stripe_events (
  id text primary key,                                  -- evt_... (webhook idempotency)
  type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  for t in select c.table_name from information_schema.columns c
           where c.table_schema = 'public' and c.column_name = 'updated_at'
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ RLS helpers
create or replace function public.current_role_name() returns text
  language sql stable security definer set search_path = public as
  $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as
  $$ select coalesce((select role in ('owner','admin') from public.profiles where id = auth.uid()), false) $$;

create or replace function public.my_tech_id() returns uuid
  language sql stable security definer set search_path = public as
  $$ select tech_id from public.profiles where id = auth.uid() and role = 'tech' $$;

create or replace function public.my_dealer_ids() returns setof uuid
  language sql stable security definer set search_path = public as
  $$ select dealer_id from public.dealer_users where profile_id = auth.uid() $$;

-- ------------------------------------------------------------------ RLS
do $$
declare t text;
begin
  for t in select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())$p$, t);
  end loop;
end $$;

-- anon: active services only
create policy services_public_read on public.services for select to anon, authenticated using (active);

-- own profile
create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid());

-- techs
create policy techs_self_read on public.techs for select to authenticated using (id = public.my_tech_id());
create policy tech_avail_self_read on public.tech_availability for select to authenticated using (tech_id = public.my_tech_id());
create policy bookings_tech_read on public.bookings for select to authenticated using (tech_id = public.my_tech_id());
create policy bookings_tech_update on public.bookings for update to authenticated
  using (tech_id = public.my_tech_id()) with check (tech_id = public.my_tech_id());
create policy jobs_tech_read on public.jobs for select to authenticated using (tech_id = public.my_tech_id());
create policy jobs_tech_update on public.jobs for update to authenticated
  using (tech_id = public.my_tech_id()) with check (tech_id = public.my_tech_id());
create policy job_photos_tech_rw on public.job_photos for all to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.tech_id = public.my_tech_id()))
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.tech_id = public.my_tech_id()));
create policy customers_tech_read on public.customers for select to authenticated
  using (exists (select 1 from public.bookings b where b.customer_id = customers.id and b.tech_id = public.my_tech_id()));
create policy vehicles_tech_read on public.vehicles for select to authenticated
  using (exists (select 1 from public.bookings b where b.vehicle_id = vehicles.id and b.tech_id = public.my_tech_id()));
create policy payments_tech_read on public.payments for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = payments.booking_id and b.tech_id = public.my_tech_id()));

-- dealers see their own rows
create policy dealers_member_read on public.dealers for select to authenticated using (id in (select public.my_dealer_ids()));
create policy dealer_users_self_read on public.dealer_users for select to authenticated using (profile_id = auth.uid());
create policy dealer_vehicles_member_rw on public.dealer_vehicles for all to authenticated
  using (dealer_id in (select public.my_dealer_ids())) with check (dealer_id in (select public.my_dealer_ids()));
create policy dealer_statements_member_read on public.dealer_statements for select to authenticated
  using (dealer_id in (select public.my_dealer_ids()));
create policy dealer_invoices_member_read on public.invoices for select to authenticated
  using (dealer_id is not null and dealer_id in (select public.my_dealer_ids()));

-- Storage (create the bucket in the dashboard or via the seed script): bucket "photos", PRIVATE.
-- All reads go through short-lived signed URLs minted server-side; no public policies are created.
