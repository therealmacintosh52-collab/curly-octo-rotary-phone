-- ============================================================================
-- Steadhaul Dispatch — database schema
-- Paste this whole file into Supabase → SQL Editor → Run. It is idempotent.
--
-- Security model:
--   anon          -> may INSERT into submissions. Nothing else. No reads, ever.
--   authenticated -> full read/write on everything (single operator today).
-- Every table has RLS enabled and denies by default.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type carrier_status as enum ('New','Onboarding','Active','Paused','Left');
exception when duplicate_object then null; end $$;
do $$ begin
  create type broker_status  as enum ('Unchecked','Approved','Watch','Blocked');
exception when duplicate_object then null; end $$;
do $$ begin
  create type claim_type     as enum ('Detention','Layover','TONU','Lumper','Other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type claim_status   as enum ('Submitted','Approved','Paid','Denied','Dropped');
exception when duplicate_object then null; end $$;
do $$ begin
  create type plan_tier      as enum ('Core','Pro','Full Desk');
exception when duplicate_object then null; end $$;

-- ── raw submissions ─────────────────────────────────────────────────────────
-- Kept verbatim and forever. If a field mapping is ever wrong, the original
-- is still here. This is the only table the public can write to.
create table if not exists submissions (
  id           uuid primary key default gen_random_uuid(),
  received_at  timestamptz not null default now(),
  source       text not null default 'onboarding',
  payload      jsonb not null,
  processed_at timestamptz,
  carrier_id   uuid
);
create index if not exists submissions_received_idx on submissions (received_at desc);

-- ── carriers ────────────────────────────────────────────────────────────────
create table if not exists carriers (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  status          carrier_status not null default 'New',
  dispatcher      text,                      -- initials; multi-user later
  legal_name      text not null,
  dba             text,
  mc              text,
  dot             text,
  address         text,
  authority_since text,
  contact_name    text,
  phone           text,
  email           text,
  contact_pref    text,
  best_hours      text,
  equipment       text,
  trailer_length  text,
  trucks          text,
  solo_team       text,
  max_payload     text,
  equipment_notes text,
  hazmat          text,
  twic            text,
  eld             text,
  factoring       text,
  noa             text,
  home_zip        text,
  max_deadhead    text,
  lanes           text,
  avoid           text,
  home_time       text,
  min_rpm         text,
  revenue_goal    text,
  weekends        text,
  notes           text,
  plan            plan_tier,
  start_date      date,
  free_week_ends  date generated always as (start_date + 7) stored
);
create index if not exists carriers_status_idx on carriers (status);
create unique index if not exists carriers_mc_idx on carriers (mc) where mc is not null;

-- ── insurance ───────────────────────────────────────────────────────────────
create table if not exists insurance (
  carrier_id         uuid primary key references carriers(id) on delete cascade,
  agent              text,
  agency             text,
  agent_phone        text,
  agent_email        text,
  auto_liability     text,
  cargo_limit        text,
  policy_expiry      date,
  reefer_breakdown   text,
  trailer_interchange text,
  coi_on_file        boolean not null default false,
  updated_at         timestamptz not null default now()
);

-- ── documents (the onboarding checklist) ────────────────────────────────────
create table if not exists documents (
  carrier_id        uuid primary key references carriers(id) on delete cascade,
  agreement_signed  date,
  authority_letter  boolean not null default false,
  w9_received       date,
  w9_deleted        date,          -- Civ. Code 1798.81 disposal evidence
  coi               boolean not null default false,
  noa               boolean not null default false,
  cdl               boolean not null default false,
  packet_url        text           -- pointer to the signed packet, not the file
);

-- ── brokers ─────────────────────────────────────────────────────────────────
create table if not exists brokers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  mc_ff            text,
  authority_active boolean,
  bond_verified_at date,
  bond_amount      numeric,
  credit_score     int,
  days_to_pay      int,
  last_checked     date,
  status           broker_status not null default 'Unchecked',
  notes            text
);

create table if not exists broker_setups (
  id          uuid primary key default gen_random_uuid(),
  carrier_id  uuid not null references carriers(id) on delete cascade,
  broker_id   uuid references brokers(id) on delete set null,
  broker_name text,
  portal      text,
  submitted   date,
  status      text,
  setup_ref   text,
  notes       text
);
create index if not exists broker_setups_carrier_idx on broker_setups (carrier_id);

-- ── loads ───────────────────────────────────────────────────────────────────
create table if not exists loads (
  id               uuid primary key default gen_random_uuid(),
  load_date        date not null default current_date,
  carrier_id       uuid not null references carriers(id) on delete cascade,
  broker_id        uuid references brokers(id) on delete set null,
  broker_name      text,
  origin           text,
  destination      text,
  equipment        text,
  loaded_miles     numeric,
  deadhead_miles   numeric default 0,
  linehaul         numeric,
  -- computed, so it can never disagree with the inputs
  rpm numeric generated always as (
    case when loaded_miles is null or loaded_miles = 0 then null
         else round(linehaul / loaded_miles, 2) end
  ) stored,
  carrier_approved boolean not null default false,
  approved_via     text,
  rate_con_sent    boolean not null default false,
  pod_in           boolean not null default false,
  invoiced         boolean not null default false,
  paid             boolean not null default false,
  notes            text
);
create index if not exists loads_carrier_date_idx on loads (carrier_id, load_date desc);

-- ── claims ──────────────────────────────────────────────────────────────────
create table if not exists claims (
  id               uuid primary key default gen_random_uuid(),
  claim_date       date not null default current_date,
  carrier_id       uuid not null references carriers(id) on delete cascade,
  load_id          uuid references loads(id) on delete set null,
  broker_name      text,
  type             claim_type not null,
  detail           text,
  amount_claimed   numeric,
  submitted        date,
  status           claim_status not null default 'Submitted',
  amount_recovered numeric,
  notes            text
);

-- ── billing ─────────────────────────────────────────────────────────────────
create table if not exists billing (
  id            uuid primary key default gen_random_uuid(),
  week_ending   date not null,
  carrier_id    uuid not null references carriers(id) on delete cascade,
  plan          plan_tier not null,
  loads_booked  int not null default 0,
  free_week     boolean not null default false,
  truck_down    boolean not null default false,
  waiver_reason text,
  invoiced      boolean not null default false,
  paid          boolean not null default false,
  standard_fee numeric generated always as (
    case plan when 'Core' then 300 when 'Pro' then 425 when 'Full Desk' then 550 end
  ) stored,
  -- Every promise the site makes about money, enforced by the database
  -- rather than by remembering: free week, truck down, or a week with no
  -- loads booked, all bill zero.
  fee_due numeric generated always as (
    case when free_week or truck_down or loads_booked = 0 then 0
         else case plan when 'Core' then 300 when 'Pro' then 425
                        when 'Full Desk' then 550 end end
  ) stored,
  unique (carrier_id, week_ending)
);

-- ── retention log (append-only) ─────────────────────────────────────────────
create table if not exists retention_log (
  id         uuid primary key default gen_random_uuid(),
  logged_at  timestamptz not null default now(),
  carrier_id uuid references carriers(id) on delete set null,
  document   text not null,
  action     text not null,          -- Received / Forwarded / Deleted
  location   text,
  actor      text
);

-- keepalive: the free tier pauses after 7 idle days, so the cron writes here
create table if not exists heartbeat (
  id integer primary key default 1,
  last_ping timestamptz not null default now(),
  constraint heartbeat_singleton check (id = 1)
);
insert into heartbeat (id) values (1) on conflict (id) do nothing;

-- ============================================================================
-- Map a raw submission into carriers + insurance + a blank checklist.
-- Runs on insert, so the public form never touches those tables directly.
-- ============================================================================
create or replace function handle_submission() returns trigger
language plpgsql security definer set search_path = public as $$
declare p jsonb := new.payload; cid uuid;
begin
  insert into carriers (
    legal_name, dba, mc, dot, address, authority_since,
    contact_name, phone, email, contact_pref, best_hours,
    equipment, trailer_length, trucks, solo_team, max_payload, equipment_notes,
    hazmat, twic, eld, factoring, noa,
    home_zip, max_deadhead, lanes, avoid, home_time,
    min_rpm, revenue_goal, weekends, notes, status
  ) values (
    coalesce(nullif(p->>'legal_name',''),'(no name given)'),
    p->>'dba', nullif(p->>'mc',''), p->>'dot', p->>'address', p->>'authority_since',
    p->>'name', p->>'phone', p->>'email', p->>'contact_pref', p->>'best_hours',
    p->>'equipment', p->>'trailer_length', p->>'trucks', p->>'solo_team',
    p->>'max_payload', p->>'equipment_notes',
    p->>'hazmat', p->>'twic', p->>'eld', p->>'factoring', p->>'noa',
    p->>'home_zip', p->>'max_deadhead', p->>'lanes', p->>'avoid', p->>'home_time',
    p->>'min_rpm', p->>'revenue_goal', p->>'weekends', p->>'notes', 'New'
  )
  -- the unique index on mc is partial (mc is not null), so the conflict
  -- target has to carry the same predicate or Postgres will not match it
  on conflict (mc) where mc is not null do update set
    phone = excluded.phone, email = excluded.email, lanes = excluded.lanes
  returning id into cid;

  insert into insurance (
    carrier_id, agent, agency, agent_phone, agent_email,
    auto_liability, cargo_limit, policy_expiry, reefer_breakdown, trailer_interchange
  ) values (
    cid, p->>'ins_agent', p->>'ins_agency', p->>'ins_agent_phone', p->>'ins_agent_email',
    p->>'auto_liability', p->>'cargo_limit',
    -- a blank or malformed date must not lose the whole submission
    case when p->>'policy_expiry' ~ '^\d{4}-\d{2}-\d{2}$'
         then (p->>'policy_expiry')::date else null end,
    p->>'reefer_breakdown', p->>'trailer_interchange'
  )
  on conflict (carrier_id) do update set
    agent = excluded.agent, agent_phone = excluded.agent_phone,
    policy_expiry = excluded.policy_expiry, updated_at = now();

  insert into documents (carrier_id) values (cid) on conflict do nothing;

  new.carrier_id := cid;
  new.processed_at := now();
  return new;
end $$;

drop trigger if exists submissions_map on submissions;
create trigger submissions_map before insert on submissions
  for each row execute function handle_submission();

-- Log W-9 deletion automatically — the compliance record stops relying on memory
create or replace function log_w9_deletion() returns trigger
language plpgsql as $$
begin
  if new.w9_deleted is not null and old.w9_deleted is distinct from new.w9_deleted then
    insert into retention_log (carrier_id, document, action, location, actor)
    values (new.carrier_id, 'W-9', 'Deleted', 'e-sign envelope + local copy', 'dashboard');
  end if;
  return new;
end $$;
drop trigger if exists documents_w9_log on documents;
create trigger documents_w9_log after update on documents
  for each row execute function log_w9_deletion();

-- ============================================================================
-- Views (derived, never stored)
-- ============================================================================
create or replace view v_insurance_status as
select i.carrier_id, c.legal_name, c.status as carrier_status,
       i.agent, i.agency, i.agent_phone, i.agent_email,
       i.auto_liability, i.cargo_limit, i.policy_expiry, i.coi_on_file,
       (i.policy_expiry - current_date) as days_left
from insurance i join carriers c on c.id = i.carrier_id;

create or replace view v_broker_recheck as
select id, name, mc_ff, status, bond_amount, days_to_pay, last_checked,
       (current_date - last_checked) as days_since_check
from brokers;

-- Week runs Saturday..Friday, so week_ending is the Friday
create or replace view v_friday_report as
select c.id as carrier_id, c.legal_name,
       (l.load_date + (5 - extract(isodow from l.load_date)::int)) as week_ending,
       count(*)                                as loads,
       sum(l.linehaul)                         as gross,
       sum(l.loaded_miles)                     as loaded_miles,
       sum(coalesce(l.deadhead_miles,0))       as deadhead_miles,
       case when sum(l.loaded_miles) > 0
            then round(sum(l.linehaul)/sum(l.loaded_miles), 2) end as avg_rpm,
       case when (sum(l.loaded_miles)+sum(coalesce(l.deadhead_miles,0))) > 0
            then round(sum(coalesce(l.deadhead_miles,0))
                 / (sum(l.loaded_miles)+sum(coalesce(l.deadhead_miles,0))), 3) end as deadhead_pct
from loads l join carriers c on c.id = l.carrier_id
group by c.id, c.legal_name, 3;

create or replace view v_capacity as
select coalesce(dispatcher,'(unassigned)') as dispatcher,
       count(*) filter (where status = 'Active') as active_carriers,
       8 as cap,
       8 - count(*) filter (where status = 'Active') as seats_left
from carriers group by 1;

-- ============================================================================
-- Row Level Security — default deny everywhere
-- ============================================================================
alter table submissions   enable row level security;
alter table carriers      enable row level security;
alter table insurance     enable row level security;
alter table documents     enable row level security;
alter table brokers       enable row level security;
alter table broker_setups enable row level security;
alter table loads         enable row level security;
alter table claims        enable row level security;
alter table billing       enable row level security;
alter table retention_log enable row level security;
alter table heartbeat     enable row level security;

-- The public may drop a submission in the box. It may not look inside it,
-- change it, or reach any other table.
drop policy if exists anon_insert_submissions on submissions;
create policy anon_insert_submissions on submissions
  for insert to anon with check (true);

-- The operator, once signed in, works on everything.
do $$
declare t text;
begin
  foreach t in array array['submissions','carriers','insurance','documents','brokers',
                           'broker_setups','loads','claims','billing','retention_log','heartbeat']
  loop
    execute format('drop policy if exists auth_all on %I', t);
    execute format(
      'create policy auth_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
