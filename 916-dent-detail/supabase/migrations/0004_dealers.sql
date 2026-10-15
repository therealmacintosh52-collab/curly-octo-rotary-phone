-- 916 Dent & Detail: Phase 5 dealer portal. Additive only: never edits 0001. Run after 0001 (and 0002/0003).
-- Adds dealer signup fields, vehicle service/price/status fields, statement + invoice links, tighter dealer RLS.

-- ------------------------------------------------------------------ dealers
alter table public.dealers
  add column if not exists license_number text,
  add column if not exists lot_addresses jsonb not null default '[]'::jsonb,
  add column if not exists ap_email text,
  add column if not exists expected_monthly_volume integer,
  add column if not exists net_terms_requested boolean not null default false,
  add column if not exists net_terms_approved boolean not null default false,
  add column if not exists approved_at timestamptz,
  add column if not exists approval_note text;

alter table public.dealers drop constraint if exists dealers_status_check;
alter table public.dealers add constraint dealers_status_check check (status in ('pending','active','paused','rejected'));
alter table public.dealers drop constraint if exists dealers_net_terms_days_check;
alter table public.dealers add constraint dealers_net_terms_days_check check (net_terms_days between 0 and 90);

-- ------------------------------------------------------------------ dealer vehicles
alter table public.dealer_vehicles
  add column if not exists services jsonb not null default '[]'::jsonb,     -- [{id, panels?}] ids from src/config/pricing.ts dealerServiceIds
  add column if not exists panels smallint,
  add column if not exists color text,
  add column if not exists lot_address text,
  add column if not exists batch_id text,
  add column if not exists price numeric(10,2),                              -- owner-set (or rate-card) price of the base work
  add column if not exists price_source text check (price_source in ('rate_card','owner')),
  add column if not exists scheduled_at timestamptz,
  add column if not exists done_at timestamptz,
  add column if not exists statement_id uuid references public.dealer_statements(id) on delete set null,
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

alter table public.dealer_vehicles drop constraint if exists dealer_vehicles_status_check;
alter table public.dealer_vehicles add constraint dealer_vehicles_status_check
  check (status in ('submitted','quoted','approved','scheduled','in_progress','done','invoiced','cancelled'));

-- A VIN may be resubmitted later (returned car) but never twice while a submission for it is still open.
create unique index if not exists dealer_vehicles_open_vin_uq on public.dealer_vehicles (dealer_id, vin)
  where vin is not null and status in ('submitted','quoted','approved','scheduled','in_progress');
create index if not exists dealer_vehicles_stock_idx on public.dealer_vehicles (dealer_id, stock_number);
create index if not exists dealer_vehicles_billing_idx on public.dealer_vehicles (dealer_id, done_at) where statement_id is null;

-- ------------------------------------------------------------------ statements + invoices
alter table public.dealer_statements
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null,
  add column if not exists vehicle_count integer not null default 0,
  add column if not exists unpriced_count integer not null default 0;
alter table public.dealer_statements drop constraint if exists dealer_statements_status_check;
alter table public.dealer_statements add constraint dealer_statements_status_check check (status in ('open','sent','paid','overdue','void'));
-- one statement per dealer per month: the cron is idempotent because of this
create unique index if not exists dealer_statements_period_uq on public.dealer_statements (dealer_id, period_start);

alter table public.invoices
  add column if not exists statement_id uuid references public.dealer_statements(id) on delete set null,
  add column if not exists hosted_invoice_url text,
  add column if not exists invoice_pdf_url text,
  add column if not exists mock boolean not null default false,
  add column if not exists net_days smallint,
  add column if not exists memo text;
create index if not exists invoices_dealer_idx on public.invoices (dealer_id, status, due_at);

-- ------------------------------------------------------------------ RLS: dealers read + insert only; every change goes through the API
-- (0001 granted dealer members FOR ALL on dealer_vehicles, which would let a dealer edit status/price directly.)
drop policy if exists dealer_vehicles_member_rw on public.dealer_vehicles;
create policy dealer_vehicles_member_read on public.dealer_vehicles for select to authenticated
  using (dealer_id in (select public.my_dealer_ids()));
create policy dealer_vehicles_member_insert on public.dealer_vehicles for insert to authenticated
  with check (dealer_id in (select public.my_dealer_ids()) and status = 'submitted' and price is null and statement_id is null and invoice_id is null);

-- dealers see before/after photos of their own jobs
drop policy if exists job_photos_dealer_read on public.job_photos;
create policy job_photos_dealer_read on public.job_photos for select to authenticated
  using (kind in ('before','after') and job_id in (select job_id from public.dealer_vehicles where job_id is not null and dealer_id in (select public.my_dealer_ids())));
