-- 916 Dent & Detail: Phase 4 (916 Concierge bot) additions. Run AFTER 0001_init.sql (0002/0004 are independent).
-- Additive only (0001 is never edited). NOT executed against Postgres by the agent that wrote it (no database
-- available): review before running. See DECISIONS.md P4-0xx and src/lib/concierge/THREAT_MODEL.md.
--
-- Access model (unchanged): the Next.js server talks to Postgres with the SERVICE ROLE after verifying the channel
-- identity (Twilio signature / verified phone / signed token). Customers never touch these tables directly.

-- ------------------------------------------------------------------ conversations: session state + escalation
alter table public.conversations add column if not exists state jsonb not null default '{}'::jsonb;
  -- bot session state: offered slots (provenance), attached photo ids, verified phone, strikes, pending confirmations.
  -- Contains no card data. Contains the verified phone of the conversation (E.164) once verified.
alter table public.conversations add column if not exists needs_human boolean not null default false;
alter table public.conversations add column if not exists escalation_reason text;
alter table public.conversations add column if not exists escalated_at timestamptz;
alter table public.conversations add column if not exists tokens_in integer not null default 0;
alter table public.conversations add column if not exists tokens_out integer not null default 0;
alter table public.conversations add column if not exists last_message_at timestamptz;

-- The admin inbox (Phase 3) reads this: open escalations, oldest first.
create index if not exists conversations_needs_human on public.conversations (escalated_at) where needs_human;
create index if not exists conversations_customer on public.conversations (customer_id);

-- ------------------------------------------------------------------ leads: chat / sms sources
-- 0001 created the check inline, so Postgres named it leads_source_check.
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check check (source in
  ('google','gbp','meta_ads','instagram','tiktok','door_knock','referral','dealer','organic','direct','other','chat','sms'));

-- ------------------------------------------------------------------ shared memory per customer
-- One row per customer across channels (web chat + SMS + later IG/FB). Key = verified phone "p:+1916..." or email
-- "e:name@example.com". `summary` is derived from customer text, so the app treats it as UNTRUSTED data when it
-- feeds it back to the model, and only loads it for a verified identity of the same key.
create table public.customer_memory (
  id uuid primary key default gen_random_uuid(),
  customer_key text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  summary text not null default '',
  facts jsonb not null default '{}'::jsonb,       -- {name, vehicle, sizeClass, zip, services, lastBookingStatus}
  conversation_count integer not null default 0,
  last_channel text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.customer_memory (customer_id);
create trigger set_updated_at before update on public.customer_memory for each row execute function public.set_updated_at();
alter table public.customer_memory enable row level security;
create policy staff_all on public.customer_memory for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ------------------------------------------------------------------ webhook idempotency
-- Twilio retries webhooks: one inbound SMS (MessageSid) is processed once. Enforced by the database, not just code.
create unique index if not exists events_concierge_sms_in_once on public.events (entity_id) where type = 'concierge.sms_in';
