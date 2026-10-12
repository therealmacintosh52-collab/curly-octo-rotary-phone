-- BayIntel core schema. Postgres 15+ / Supabase.
-- Every data row that reaches the UI carries a source label:
--   NHTSA | COMMUNITY (community-verified) | OWNER (owner-reported) | LICENSED | SAMPLE

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- enums
create type public.user_role as enum ('diy', 'technician', 'shop_owner', 'admin');
create type public.source_label as enum ('NHTSA', 'COMMUNITY', 'OWNER', 'LICENSED', 'SAMPLE');
create type public.fix_status as enum ('pending', 'approved', 'rejected', 'flagged');
create type public.confirmation_verdict as enum ('fixed', 'not_fixed');
create type public.moderation_status as enum ('open', 'resolved', 'dismissed');
create type public.moderation_kind as enum ('new_fix', 'report', 'edit');
create type public.ro_status as enum ('open', 'in_progress', 'completed', 'invoiced');
create type public.estimate_status as enum ('draft', 'sent', 'approved', 'declined');
create type public.estimate_line_kind as enum ('part', 'labor', 'fee');
create type public.subscription_tier as enum ('free', 'pro_tech', 'shop');
create type public.ai_role as enum ('user', 'assistant');

-- ---------------------------------------------------------------- shops & profiles
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  labor_rate numeric(8, 2) not null default 120,
  tax_rate numeric(5, 4) not null default 0.0825,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Tech',
  role public.user_role not null default 'diy',
  shop_id uuid references public.shops (id) on delete set null,
  reputation integer not null default 0,
  free_months_earned integer not null default 0,
  free_months_redeemed integer not null default 0,
  ai_queries_used integer not null default 0,
  ai_queries_period_start date not null default date_trunc('month', now())::date,
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- vehicles (garage)
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid references public.shops (id) on delete set null,
  vin text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  year integer not null check (year between 1949 and 2100),
  make text not null,
  model text not null,
  trim text,
  engine text,
  displacement_l numeric(4, 1),
  cylinders integer,
  fuel_type text,
  drive_type text,
  body_class text,
  transmission text,
  plant text,
  specs jsonb not null default '{}'::jsonb,
  specs_source public.source_label not null default 'NHTSA',
  nickname text,
  plate text,
  mileage integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vehicles_owner_idx on public.vehicles (owner_id);
create index vehicles_shop_idx on public.vehicles (shop_id);
create index vehicles_vin_idx on public.vehicles (vin);

-- ---------------------------------------------------------------- DTC definitions
create table public.dtc_codes (
  code text primary key check (code ~ '^[PBCU][0-9A-F]{4}$'),
  description text not null,
  system text not null, -- fuel_air | ignition_misfire | emissions | transmission | speed_idle | computer | hybrid_ev | body | chassis | network
  category text not null, -- powertrain | body | chassis | network
  is_generic boolean not null default true,
  common_causes text[] not null default '{}',
  safety_flag text, -- brakes | srs | steering | ev_high_voltage
  source public.source_label not null default 'COMMUNITY'
);

-- ---------------------------------------------------------------- confirmed fixes
create table public.fixes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete set null, -- null for SAMPLE rows
  vehicle_id uuid references public.vehicles (id) on delete set null,
  repair_order_id uuid, -- fk added below
  title text not null,
  year integer not null check (year between 1949 and 2100),
  make text not null,
  model text not null,
  engine text,
  mileage integer,
  symptoms text not null,
  freeze_frame_notes text,
  tests_performed jsonb not null default '[]'::jsonb, -- [{test, result}]
  root_cause text not null,
  fix_description text not null,
  labor_hours numeric(5, 2),
  status public.fix_status not null default 'approved',
  source_label public.source_label not null default 'COMMUNITY',
  seed_confirm_count integer not null default 0, -- SAMPLE rows only: synthetic votes shown as "sample"
  seed_deny_count integer not null default 0,
  confirm_count integer not null default 0,
  deny_count integer not null default 0,
  net_score integer not null default 0,
  verified_at timestamptz,
  version integer not null default 1,
  search_tsv tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(symptoms, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(root_cause, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(fix_description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fixes_vehicle_key_idx on public.fixes (lower(make), lower(model), year);
create index fixes_status_idx on public.fixes (status);
create index fixes_net_score_idx on public.fixes (net_score desc);
create index fixes_search_idx on public.fixes using gin (search_tsv);
create index fixes_author_idx on public.fixes (author_id);

create table public.fix_dtcs (
  fix_id uuid not null references public.fixes (id) on delete cascade,
  code text not null check (code ~ '^[PBCU][0-9A-F]{4}$'),
  primary key (fix_id, code)
);
create index fix_dtcs_code_idx on public.fix_dtcs (code);

create table public.fix_parts (
  id uuid primary key default gen_random_uuid(),
  fix_id uuid not null references public.fixes (id) on delete cascade,
  name text not null,
  part_number text,
  brand text,
  quantity numeric(8, 2) not null default 1,
  unit_price numeric(10, 2),
  sort integer not null default 0
);
create index fix_parts_fix_idx on public.fix_parts (fix_id);

create table public.fix_confirmations (
  id uuid primary key default gen_random_uuid(),
  fix_id uuid not null references public.fixes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  verdict public.confirmation_verdict not null,
  note text,
  created_at timestamptz not null default now(),
  unique (fix_id, user_id)
);
create index fix_confirmations_fix_idx on public.fix_confirmations (fix_id);

create table public.fix_media (
  id uuid primary key default gen_random_uuid(),
  fix_id uuid not null references public.fixes (id) on delete cascade,
  uploaded_by uuid references auth.users (id) on delete set null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);
create index fix_media_fix_idx on public.fix_media (fix_id);

create table public.fix_revisions (
  id uuid primary key default gen_random_uuid(),
  fix_id uuid not null references public.fixes (id) on delete cascade,
  version integer not null,
  editor_id uuid references public.profiles (id) on delete set null,
  snapshot jsonb not null,
  change_note text,
  created_at timestamptz not null default now(),
  unique (fix_id, version)
);

create table public.moderation_queue (
  id uuid primary key default gen_random_uuid(),
  kind public.moderation_kind not null,
  fix_id uuid references public.fixes (id) on delete cascade,
  reported_by uuid references public.profiles (id) on delete set null,
  reason text,
  status public.moderation_status not null default 'open',
  resolved_by uuid references auth.users (id) on delete set null,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index moderation_queue_status_idx on public.moderation_queue (status, created_at);

-- ---------------------------------------------------------------- repair orders
create table public.repair_orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops (id) on delete set null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  ro_number serial,
  status public.ro_status not null default 'open',
  mileage integer,
  customer_name text,
  concern text not null,
  cause text,
  correction text,
  dtc_codes text[] not null default '{}',
  tests_performed jsonb not null default '[]'::jsonb,
  parts jsonb not null default '[]'::jsonb, -- [{name, part_number, quantity, unit_price}]
  labor_hours numeric(5, 2),
  notes text,
  fix_id uuid references public.fixes (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index repair_orders_vehicle_idx on public.repair_orders (vehicle_id, created_at desc);
create index repair_orders_shop_idx on public.repair_orders (shop_id);
alter table public.fixes add constraint fixes_repair_order_fk foreign key (repair_order_id) references public.repair_orders (id) on delete set null;

create table public.repair_order_media (
  id uuid primary key default gen_random_uuid(),
  repair_order_id uuid not null references public.repair_orders (id) on delete cascade,
  uploaded_by uuid references auth.users (id) on delete set null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);
create index repair_order_media_ro_idx on public.repair_order_media (repair_order_id);

-- ---------------------------------------------------------------- estimates
create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops (id) on delete set null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  repair_order_id uuid references public.repair_orders (id) on delete set null,
  estimate_number serial,
  status public.estimate_status not null default 'draft',
  customer_name text,
  customer_email text,
  customer_phone text,
  labor_rate numeric(8, 2) not null default 120,
  tax_rate numeric(5, 4) not null default 0,
  tax_parts boolean not null default true,
  tax_labor boolean not null default false,
  notes text,
  share_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index estimates_shop_idx on public.estimates (shop_id, created_at desc);
create index estimates_author_idx on public.estimates (author_id, created_at desc);

create table public.estimate_lines (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  kind public.estimate_line_kind not null,
  description text not null,
  part_number text,
  quantity numeric(8, 2) not null default 1,
  unit_price numeric(10, 2) not null default 0, -- for labor lines: hours * labor_rate is computed in app; unit_price stores the rate snapshot
  hours numeric(5, 2),
  taxable boolean,
  sort integer not null default 0
);
create index estimate_lines_estimate_idx on public.estimate_lines (estimate_id, sort);

-- ---------------------------------------------------------------- AI
create table public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  title text not null default 'Diagnostic session',
  vehicle_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index ai_sessions_user_idx on public.ai_sessions (user_id, created_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_sessions (id) on delete cascade,
  role public.ai_role not null,
  content text not null,
  structured jsonb, -- assistant: {probable_causes, test_plan, safety_flags, citations}
  citations jsonb not null default '[]'::jsonb,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index ai_messages_session_idx on public.ai_messages (session_id, created_at);

-- ---------------------------------------------------------------- provider cache & billing
create table public.provider_cache (
  cache_key text primary key,
  provider text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index provider_cache_expires_idx on public.provider_cache (expires_at);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  shop_id uuid references public.shops (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  tier public.subscription_tier not null default 'free',
  status text not null default 'active', -- stripe status
  seats integer not null default 1,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or shop_id is not null)
);
create unique index subscriptions_user_idx on public.subscriptions (user_id) where user_id is not null;
create unique index subscriptions_shop_idx on public.subscriptions (shop_id) where shop_id is not null;

-- ---------------------------------------------------------------- helper functions
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['shops', 'profiles', 'vehicles', 'fixes', 'repair_orders', 'estimates', 'subscriptions'] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- Auto-create a profile for every new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'tech'), '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'diy')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.my_shop_id() returns uuid
language sql stable security definer set search_path = public as $$
  select shop_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- Fix score + reputation maintenance.
create or replace function public.recompute_fix_score(p_fix_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_confirm int;
  v_deny int;
  v_author uuid;
  v_verified timestamptz;
  v_status public.fix_status;
begin
  select count(*) filter (where verdict = 'fixed'), count(*) filter (where verdict = 'not_fixed')
    into v_confirm, v_deny
  from public.fix_confirmations where fix_id = p_fix_id;

  update public.fixes
     set confirm_count = v_confirm + seed_confirm_count,
         deny_count = v_deny + seed_deny_count,
         net_score = (v_confirm + seed_confirm_count) - (v_deny + seed_deny_count)
   where id = p_fix_id
   returning author_id, verified_at, status into v_author, v_verified, v_status;

  -- A fix becomes "verified" at 3 net confirmations. The contributor earns one free month.
  if v_verified is null and v_status = 'approved' and (v_confirm - v_deny) >= 3 then
    update public.fixes set verified_at = now() where id = p_fix_id;
    if v_author is not null then
      update public.profiles set free_months_earned = free_months_earned + 1 where id = v_author;
    end if;
  end if;

  if v_author is not null then
    perform public.recompute_reputation(v_author);
  end if;
end $$;

-- Reputation: +2 per "fixed", -1 per "didn't fix", +1 per confirmation given, +1 per approved fix submitted.
create or replace function public.recompute_reputation(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.profiles p
     set reputation = coalesce((select sum(f.confirm_count * 2 - f.deny_count + 1) from public.fixes f where f.author_id = p_user and f.status = 'approved'), 0)
                    + coalesce((select count(*) from public.fix_confirmations c where c.user_id = p_user), 0)
   where p.id = p_user;
$$;

create or replace function public.on_fix_confirmation_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_fix_score(coalesce(new.fix_id, old.fix_id));
  perform public.recompute_reputation(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end $$;
create trigger fix_confirmations_changed after insert or update or delete on public.fix_confirmations
  for each row execute function public.on_fix_confirmation_change();

-- Authors may not confirm their own fix.
create or replace function public.block_self_confirmation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.fixes where id = new.fix_id and author_id = new.user_id) then
    raise exception 'You cannot confirm your own fix';
  end if;
  return new;
end $$;
create trigger fix_confirmations_no_self before insert on public.fix_confirmations
  for each row execute function public.block_self_confirmation();

-- Edit history: snapshot the previous version whenever content changes.
create or replace function public.snapshot_fix_revision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (old.title, old.symptoms, old.root_cause, old.fix_description, old.freeze_frame_notes, old.tests_performed, old.labor_hours, old.mileage, old.engine)
     is distinct from
     (new.title, new.symptoms, new.root_cause, new.fix_description, new.freeze_frame_notes, new.tests_performed, new.labor_hours, new.mileage, new.engine) then
    insert into public.fix_revisions (fix_id, version, editor_id, snapshot)
    values (old.id, old.version, auth.uid(), to_jsonb(old) - 'search_tsv');
    new.version = old.version + 1;
  end if;
  return new;
end $$;
create trigger fixes_snapshot_revision before update on public.fixes
  for each row execute function public.snapshot_fix_revision();

-- Every new community fix lands in the moderation queue for review (it is visible immediately
-- unless the author has negative reputation, in which case it waits as 'pending').
create or replace function public.enqueue_new_fix() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_rep int;
begin
  if new.source_label = 'SAMPLE' then
    return new;
  end if;
  select reputation into v_rep from public.profiles where id = new.author_id;
  if coalesce(v_rep, 0) < 0 then
    new.status = 'pending';
  end if;
  return new;
end $$;
create trigger fixes_enqueue_before before insert on public.fixes for each row execute function public.enqueue_new_fix();

create or replace function public.enqueue_new_fix_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source_label <> 'SAMPLE' then
    insert into public.moderation_queue (kind, fix_id, reported_by, reason)
    values ('new_fix', new.id, new.author_id, 'New community fix awaiting review');
    if new.author_id is not null then
      perform public.recompute_reputation(new.author_id);
    end if;
  end if;
  return new;
end $$;
create trigger fixes_enqueue_after after insert on public.fixes for each row execute function public.enqueue_new_fix_after();

-- ---------------------------------------------------------------- ranking RPC
-- Ranks confirmed fixes for a vehicle (+/- 3 model years) and optional DTC list.
create or replace function public.rank_fixes(
  p_make text,
  p_model text,
  p_year integer,
  p_engine text default null,
  p_codes text[] default null,
  p_limit integer default 25
) returns table (
  fix_id uuid,
  rank_score numeric,
  match_level text,
  matched_codes text[]
)
language sql stable as $$
  with candidates as (
    select f.id,
           f.net_score,
           f.confirm_count,
           f.year,
           f.engine,
           (f.year = p_year) as exact_year,
           (p_engine is not null and f.engine is not null and lower(f.engine) like '%' || lower(split_part(p_engine, ' ', 1)) || '%') as engine_match,
           coalesce((select array_agg(d.code order by d.code) from public.fix_dtcs d where d.fix_id = f.id and (p_codes is null or d.code = any (p_codes))), '{}') as matched
      from public.fixes f
     where f.status = 'approved'
       and lower(f.make) = lower(p_make)
       and lower(f.model) = lower(p_model)
       and abs(f.year - p_year) <= 3
       and (p_codes is null or exists (select 1 from public.fix_dtcs d where d.fix_id = f.id and d.code = any (p_codes)))
  )
  select id,
         (net_score * 10 + confirm_count + (case when exact_year then 5 else 0 end) + (case when engine_match then 5 else 0 end)
          + (case when p_codes is null then 0 else cardinality(matched) * 3 end))::numeric as rank_score,
         case when exact_year and (p_engine is null or engine_match) then 'exact'
              when exact_year then 'same_year'
              else 'near_year' end as match_level,
         matched
    from candidates
   order by rank_score desc, confirm_count desc
   limit p_limit;
$$;

-- Full-text search over fixes for the AI retrieval layer and the fixes browser.
create or replace function public.search_fixes(p_query text, p_make text default null, p_model text default null, p_limit integer default 20)
returns table (fix_id uuid, rank real)
language sql stable as $$
  select f.id, ts_rank(f.search_tsv, websearch_to_tsquery('english', p_query)) as rank
    from public.fixes f
   where f.status = 'approved'
     and f.search_tsv @@ websearch_to_tsquery('english', p_query)
     and (p_make is null or lower(f.make) = lower(p_make))
     and (p_model is null or lower(f.model) = lower(p_model))
   order by rank desc
   limit p_limit;
$$;

-- AI quota: returns true and increments the counter when the caller is under p_limit for this month.
create or replace function public.consume_ai_query(p_limit integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_used int; v_start date;
begin
  select ai_queries_used, ai_queries_period_start into v_used, v_start from public.profiles where id = auth.uid() for update;
  if v_start is null then return false; end if;
  if v_start < date_trunc('month', now())::date then
    v_used := 0;
    update public.profiles set ai_queries_used = 0, ai_queries_period_start = date_trunc('month', now())::date where id = auth.uid();
  end if;
  if p_limit is not null and v_used >= p_limit then
    return false;
  end if;
  update public.profiles set ai_queries_used = v_used + 1 where id = auth.uid();
  return true;
end $$;

-- Group NHTSA-style complaint components for a vehicle key from the cache (used by the dashboard & AI).
create or replace function public.cleanup_provider_cache() returns integer
language sql security definer set search_path = public as $$
  with d as (delete from public.provider_cache where expires_at < now() returning 1)
  select count(*)::int from d;
$$;

-- Redeem a free month earned by contributing (called from the billing route).
create or replace function public.redeem_free_month() returns boolean
language plpgsql security definer set search_path = public as $$
declare v_avail int;
begin
  select free_months_earned - free_months_redeemed into v_avail from public.profiles where id = auth.uid() for update;
  if coalesce(v_avail, 0) <= 0 then return false; end if;
  update public.profiles set free_months_redeemed = free_months_redeemed + 1 where id = auth.uid();
  return true;
end $$;
