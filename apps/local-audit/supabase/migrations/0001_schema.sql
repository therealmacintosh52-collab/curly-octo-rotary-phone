-- =============================================================================
-- 0001_schema.sql — Local Audit data model
--
-- Single-tenant agency: one admin (or a few), optional client logins, and
-- anonymous report viewers who arrive through a share-link token. Every
-- audit-scoped table cascades from audits. The data model follows
-- docs/MASTER_PLAN.md §3 exactly, plus the additions recorded in
-- docs/DECISIONS.md (citations, social_profiles, backlink_metrics,
-- brand_mentions, agency_settings, raw_snapshots.cache_key).
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role         as enum ('admin', 'client');
create type public.audit_status      as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type public.evidence_type     as enum ('screenshot', 'html', 'api_field', 'serp_result', 'llm_answer');
create type public.finding_severity  as enum ('critical', 'high', 'medium', 'low');
create type public.fix_difficulty    as enum ('easy', 'medium', 'hard');
create type public.finding_status    as enum ('open', 'in_progress', 'fixed', 'dismissed');
create type public.social_network    as enum ('facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x', 'nextdoor', 'pinterest', 'yelp', 'other');
create type public.mention_source    as enum ('press', 'reddit', 'forum', 'directory', 'social', 'other');
create type public.mention_sentiment as enum ('pos', 'neu', 'neg');
create type public.backlink_subject  as enum ('business', 'competitor');

-- ---------------------------------------------------------------------------
-- Auth helpers. STABLE + SECURITY DEFINER so RLS policies and triggers can
-- call them without recursing into the profiles policies.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.user_role not null default 'client',
  full_name  text,
  email      text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid() and active), false)
$$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

-- Raise unless the caller is an active admin.
create or replace function public.assert_admin()
returns void language plpgsql stable as $$
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Core entities (master plan §3)
-- ---------------------------------------------------------------------------
create table public.businesses (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  canonical_domain text,
  phone            text,
  address          text,
  lat              double precision,
  lng              double precision,
  place_id         text,
  yelp_alias       text,
  primary_category text,
  service_area     jsonb not null default '{}'::jsonb,
  avg_ticket       numeric(12,2),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index businesses_place_id_idx on public.businesses (place_id);
create index businesses_canonical_domain_idx on public.businesses (canonical_domain);

create table public.audits (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  status         public.audit_status not null default 'queued',
  progress_pct   smallint not null default 0 check (progress_pct between 0 and 100),
  current_step   text,
  started_at     timestamptz,
  finished_at    timestamptz,
  total_cost_usd numeric(10,4) not null default 0,
  inputs         jsonb not null default '{}'::jsonb,
  scores         jsonb not null default '{}'::jsonb,
  revenue_model  jsonb not null default '{}'::jsonb,
  version        integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index audits_business_idx on public.audits (business_id, started_at desc);
create index audits_status_idx on public.audits (status);

-- Every external call, verbatim. cost_usd is the per-call price the adapter
-- logged; cache_key lets a repeat call within expires_at reuse the response.
create table public.raw_snapshots (
  id         uuid primary key default gen_random_uuid(),
  audit_id   uuid references public.audits (id) on delete cascade,
  provider   text not null,
  endpoint   text not null,
  cache_key  text,
  request    jsonb not null default '{}'::jsonb,
  response   jsonb,
  fetched_at timestamptz not null default now(),
  cost_usd   numeric(10,6) not null default 0,
  expires_at timestamptz
);
create index raw_snapshots_audit_idx on public.raw_snapshots (audit_id);
create index raw_snapshots_cache_key_idx on public.raw_snapshots (cache_key, fetched_at desc);

create table public.evidence (
  id           uuid primary key default gen_random_uuid(),
  audit_id     uuid not null references public.audits (id) on delete cascade,
  type         public.evidence_type not null,
  storage_path text,
  excerpt      text,
  source_url   text,
  captured_at  timestamptz not null default now()
);
create index evidence_audit_idx on public.evidence (audit_id);

create table public.findings (
  id                    uuid primary key default gen_random_uuid(),
  audit_id              uuid not null references public.audits (id) on delete cascade,
  category              text not null,
  check_id              text not null,
  title                 text not null,
  plain_english         text not null default '',
  severity              public.finding_severity not null,
  impact_score          numeric(5,2),
  fix_difficulty        public.fix_difficulty,
  est_monthly_loss_low  numeric(12,2),
  est_monthly_loss_mid  numeric(12,2),
  est_monthly_loss_high numeric(12,2),
  evidence_ids          uuid[] not null default '{}',
  status                public.finding_status not null default 'open',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index findings_audit_idx on public.findings (audit_id, severity);

-- The Solution Vault. is_revealed is the ONLY thing that lets a solution reach
-- a client view; see 0002 get_client_report() and 0003 for the enforcement.
create table public.solutions (
  id                uuid primary key default gen_random_uuid(),
  finding_id        uuid not null references public.findings (id) on delete cascade,
  audit_id          uuid not null references public.audits (id) on delete cascade,
  steps             jsonb not null default '[]'::jsonb,
  assets            jsonb not null default '{}'::jsonb,
  code_snippets     jsonb not null default '[]'::jsonb,
  time_estimate_hrs numeric(6,2),
  suggested_price   numeric(12,2),
  priority_rank     integer,
  roadmap_phase     smallint check (roadmap_phase in (30, 60, 90)),
  is_revealed       boolean not null default false,
  revealed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index solutions_audit_idx on public.solutions (audit_id);
create index solutions_finding_idx on public.solutions (finding_id);
create index solutions_revealed_idx on public.solutions (audit_id) where is_revealed;

create table public.competitors (
  id               uuid primary key default gen_random_uuid(),
  audit_id         uuid not null references public.audits (id) on delete cascade,
  place_id         text,
  name             text not null,
  rating           numeric(3,2),
  review_count     integer,
  categories       text[] not null default '{}',
  map_rank_avg     numeric(6,2),
  ai_mention_count integer,
  domain           text,
  metrics          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index competitors_audit_idx on public.competitors (audit_id);

create table public.ai_visibility (
  id                    uuid primary key default gen_random_uuid(),
  audit_id              uuid not null references public.audits (id) on delete cascade,
  engine                text not null,
  prompt                text not null,
  location              text,
  business_mentioned    boolean,
  position              integer,
  cited_urls            text[] not null default '{}',
  competitors_mentioned text[] not null default '{}',
  answer_excerpt        text,
  evidence_id           uuid references public.evidence (id) on delete set null,
  captured_at           timestamptz not null default now()
);
create index ai_visibility_audit_idx on public.ai_visibility (audit_id);

create table public.rank_grid (
  id            uuid primary key default gen_random_uuid(),
  audit_id      uuid not null references public.audits (id) on delete cascade,
  keyword       text not null,
  grid_size     smallint not null,
  points        jsonb not null default '[]'::jsonb,
  avg_rank      numeric(6,2),
  share_of_top3 numeric(5,4),
  created_at    timestamptz not null default now()
);
create index rank_grid_audit_idx on public.rank_grid (audit_id, keyword);

create table public.share_links (
  id             uuid primary key default gen_random_uuid(),
  audit_id       uuid not null references public.audits (id) on delete cascade,
  token          text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at     timestamptz,
  view_count     integer not null default 0,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now()
);
create index share_links_audit_idx on public.share_links (audit_id);

create table public.report_views (
  id            uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  viewed_at     timestamptz not null default now(),
  section       text,
  duration_sec  integer
);
create index report_views_link_idx on public.report_views (share_link_id, viewed_at desc);

-- ---------------------------------------------------------------------------
-- Off-site modules (added; see DECISIONS.md)
-- ---------------------------------------------------------------------------
create table public.citations (
  id          uuid primary key default gen_random_uuid(),
  audit_id    uuid not null references public.audits (id) on delete cascade,
  directory   text not null,
  listing_url text,
  listed      boolean,
  nap_match   jsonb not null default '{}'::jsonb,
  evidence_id uuid references public.evidence (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index citations_audit_idx on public.citations (audit_id);

create table public.social_profiles (
  id               uuid primary key default gen_random_uuid(),
  audit_id         uuid not null references public.audits (id) on delete cascade,
  network          public.social_network not null,
  url              text,
  exists           boolean,
  linked_from_site boolean,
  last_activity_at timestamptz,
  followers        integer,
  evidence_id      uuid references public.evidence (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index social_profiles_audit_idx on public.social_profiles (audit_id);

create table public.backlink_metrics (
  id                      uuid primary key default gen_random_uuid(),
  audit_id                uuid not null references public.audits (id) on delete cascade,
  subject                 public.backlink_subject not null default 'business',
  domain                  text not null,
  backlinks               integer,
  referring_domains       integer,
  local_referring_domains integer,
  domain_rank             integer,
  top_referrers           jsonb not null default '[]'::jsonb,
  evidence_id             uuid references public.evidence (id) on delete set null,
  created_at              timestamptz not null default now()
);
create index backlink_metrics_audit_idx on public.backlink_metrics (audit_id);

create table public.brand_mentions (
  id          uuid primary key default gen_random_uuid(),
  audit_id    uuid not null references public.audits (id) on delete cascade,
  source_url  text not null,
  source_type public.mention_source not null default 'other',
  linked      boolean,
  excerpt     text,
  sentiment   public.mention_sentiment,
  captured_at timestamptz not null default now(),
  evidence_id uuid references public.evidence (id) on delete set null
);
create index brand_mentions_audit_idx on public.brand_mentions (audit_id);

-- White-label settings for the agency (single row, id fixed by seed).
create table public.agency_settings (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'Agency',
  logo_path     text,
  colors        jsonb not null default '{}'::jsonb,
  contact_cta   jsonb not null default '{}'::jsonb,
  report_domain text,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'businesses', 'audits', 'findings', 'solutions', 'agency_settings']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;

-- Non-admins cannot promote themselves or reactivate their account.
create or replace function public.tg_guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role public.user_role;
begin
  select role into v_role from public.profiles where id = auth.uid() and active;
  if auth.uid() is null or v_role = 'admin' then
    return new;
  end if;
  if new.role <> old.role or new.active <> old.active then
    raise exception 'Only admins can change role or active status' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_profile_update before update on public.profiles
  for each row execute function public.tg_guard_profile_update();

-- Create a profile for every new auth user. The inviting admin passes
-- role / full_name in user metadata. The very first user of a fresh install
-- (no profiles yet) becomes the admin; that bootstrap fires exactly once.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role;
  v_name text;
begin
  v_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'client')::public.user_role;
  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1));
  if not exists (select 1 from public.profiles) then
    v_role := 'admin';
  end if;
  insert into public.profiles (id, role, full_name, email)
  values (new.id, v_role, v_name, new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync if the auth email changes.
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Only admins flip is_revealed; revealed_at follows the flag. Service-role /
-- superuser sessions (auth.uid() is null) are trusted server code.
create or replace function public.tg_guard_solution_reveal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_revealed is distinct from old.is_revealed then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Only admins can reveal solutions' using errcode = '42501';
    end if;
    new.revealed_at := case when new.is_revealed then coalesce(old.revealed_at, now()) else null end;
  end if;
  return new;
end $$;
create trigger guard_solution_reveal before update on public.solutions
  for each row execute function public.tg_guard_solution_reveal();

-- audits.total_cost_usd is always the running sum of the audit's snapshots.
create or replace function public.tg_bump_audit_cost()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.audit_id is not null and new.cost_usd <> 0 then
    update public.audits set total_cost_usd = total_cost_usd + new.cost_usd where id = new.audit_id;
  end if;
  return new;
end $$;
create trigger bump_audit_cost after insert on public.raw_snapshots
  for each row execute function public.tg_bump_audit_cost();
