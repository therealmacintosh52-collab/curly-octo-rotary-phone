-- =============================================================================
-- 0001_schema.sql — core tables, enums, indexes, generic triggers
--
-- Design notes (deviations from the original brief are called out inline):
--   * `profiles` replaces `users`: Supabase owns `auth.users`, so app-level
--     data (company, role, name) lives in a 1:1 `profiles` row.
--   * Every table carries `company_id` so RLS is a single predicate and a
--     second company is a config change, not a rewrite.
--   * `invoice_items` is an immutable snapshot of what was billed, so a job
--     edited or voided later can never silently change a sent invoice.
--   * `invoice_payments` + `invoice_submissions` give partial payments and a
--     full send history instead of single columns.
--   * `jobs.client_id` is the offline idempotency key: the phone generates it
--     before it has signal, and retries are safe.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role         as enum ('owner', 'admin', 'detailer');
create type public.job_status        as enum ('logged', 'invoiced');
create type public.invoice_status    as enum ('draft', 'submitted', 'partial', 'paid', 'void');
create type public.invoice_mode      as enum ('batch', 'per_job');
create type public.submission_method as enum ('email', 'portal', 'paper');
create type public.submission_status as enum ('sent', 'failed');
create type public.photo_kind        as enum ('before', 'after');
create type public.payment_method    as enum ('check', 'ach', 'card', 'cash', 'other');

-- ---------------------------------------------------------------------------
-- Companies (the detailing business; one per deployment today)
-- ---------------------------------------------------------------------------
create table public.companies (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  email               text,                       -- CC'd on every invoice email
  phone               text,
  address_line1       text,
  address_line2       text,
  city                text,
  state               text,
  postal_code         text,
  ein                 text,                       -- EIN / tax id shown on invoices
  payment_terms       text not null default 'Net 30',
  tax_rate            numeric(6,4) not null default 0 check (tax_rate >= 0 and tax_rate < 1),
  invoice_prefix      text not null default 'INV-',
  next_invoice_number integer not null default 1 check (next_invoice_number > 0),
  reminder_days       integer not null default 30 check (reminder_days > 0),
  timezone            text not null default 'America/Los_Angeles',
  logo_path           text,                       -- storage path in the `logos` bucket
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete restrict,
  role        public.user_role not null default 'detailer',
  full_name   text not null default '',
  email       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index profiles_company_idx on public.profiles (company_id);

-- ---------------------------------------------------------------------------
-- Dealerships (customers). Each job belongs to exactly one.
-- ---------------------------------------------------------------------------
create table public.dealerships (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  name               text not null,
  address_line1      text,
  address_line2      text,
  city               text,
  state              text,
  postal_code        text,
  contact_name       text,
  contact_phone      text,
  -- Accounts-payable / submission settings
  ap_contact_name    text,
  ap_emails          text[] not null default '{}',
  submission_method  public.submission_method not null default 'email',
  invoice_mode       public.invoice_mode not null default 'batch',
  payment_terms      text,                        -- overrides companies.payment_terms
  tax_rate           numeric(6,4) check (tax_rate is null or (tax_rate >= 0 and tax_rate < 1)),
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index dealerships_company_idx on public.dealerships (company_id);

-- ---------------------------------------------------------------------------
-- Services & per-dealership prices
-- ---------------------------------------------------------------------------
create table public.services (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  name          text not null,
  description   text,
  default_price numeric(10,2) not null default 0 check (default_price >= 0),
  active        boolean not null default true,
  sort_order    integer not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, name)
);

create table public.dealership_service_prices (
  id            uuid not null unique default gen_random_uuid(),   -- for the audit log
  company_id    uuid not null references public.companies (id) on delete cascade,
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  service_id    uuid not null references public.services (id) on delete cascade,
  price         numeric(10,2) not null check (price >= 0),
  updated_at    timestamptz not null default now(),
  primary key (dealership_id, service_id)
);

-- ---------------------------------------------------------------------------
-- Invoices (declared before jobs because jobs.invoice_id references it)
-- ---------------------------------------------------------------------------
create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  dealership_id  uuid not null references public.dealerships (id) on delete restrict,
  number         integer not null,
  display_number text not null,                    -- e.g. INV-000042
  period_start   date not null,
  period_end     date not null,
  ro_po_number   text,                             -- set in per-job mode
  subtotal       numeric(12,2) not null default 0,
  tax_rate       numeric(6,4) not null default 0,
  tax            numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  amount_paid    numeric(12,2) not null default 0,
  status         public.invoice_status not null default 'draft',
  payment_terms  text not null default 'Net 30',
  notes          text,
  submitted_at   timestamptz,
  paid_at        timestamptz,
  voided_at      timestamptz,
  void_reason    text,
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, number),
  check (period_end >= period_start)
);
create index invoices_company_status_idx on public.invoices (company_id, status);
create index invoices_dealership_idx on public.invoices (dealership_id);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  dealership_id uuid not null references public.dealerships (id) on delete restrict,
  detailer_id   uuid not null references public.profiles (id) on delete restrict,
  client_id     uuid not null unique,              -- generated on the device; makes offline retries idempotent
  tag_number    text not null check (length(tag_number) between 1 and 32),
  vin           text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  year          integer check (year is null or year between 1900 and 2100),
  make          text,
  model         text,
  color         text,
  performed_at  timestamptz not null default now(),
  ro_po_number  text,
  notes         text,
  status        public.job_status not null default 'logged',
  invoice_id    uuid references public.invoices (id) on delete set null,
  created_by    uuid references public.profiles (id),
  updated_by    uuid references public.profiles (id),
  deleted_at    timestamptz,
  deleted_by    uuid references public.profiles (id),
  delete_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index jobs_company_performed_idx on public.jobs (company_id, performed_at desc) where deleted_at is null;
create index jobs_company_tag_idx       on public.jobs (company_id, upper(tag_number));
create index jobs_company_vin_idx       on public.jobs (company_id, vin) where vin is not null;
create index jobs_detailer_idx          on public.jobs (detailer_id, performed_at desc);
create index jobs_invoice_idx           on public.jobs (invoice_id);
create index jobs_uninvoiced_idx        on public.jobs (company_id, dealership_id, performed_at)
  where deleted_at is null and invoice_id is null;

create table public.job_services (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  service_id      uuid not null references public.services (id) on delete restrict,
  price           numeric(10,2) not null check (price >= 0),
  override_reason text,                            -- required by create_job when price != list price
  created_at      timestamptz not null default now(),
  unique (job_id, service_id)
);
create index job_services_job_idx on public.job_services (job_id);
create index job_services_service_idx on public.job_services (service_id);

create table public.job_photos (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  job_id       uuid not null references public.jobs (id) on delete cascade,
  kind         public.photo_kind not null,
  storage_path text not null,                     -- path inside the `job-photos` bucket
  width        integer,
  height       integer,
  size_bytes   integer,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);
create index job_photos_job_idx on public.job_photos (job_id);

-- ---------------------------------------------------------------------------
-- Invoice line snapshot, payments, submissions
-- ---------------------------------------------------------------------------
create table public.invoice_items (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  invoice_id     uuid not null references public.invoices (id) on delete cascade,
  job_id         uuid references public.jobs (id) on delete set null,
  job_service_id uuid references public.job_services (id) on delete set null,
  sort_order     integer not null default 0,
  performed_at   timestamptz not null,
  tag_number     text not null,
  vin            text,
  year           integer,
  make           text,
  model          text,
  color          text,
  ro_po_number   text,
  detailer_name  text,
  service_name   text not null,
  price          numeric(10,2) not null
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id, sort_order);

create table public.invoice_payments (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount     numeric(12,2) not null check (amount > 0),
  paid_at    date not null default current_date,
  method     public.payment_method not null default 'check',
  reference  text,                                -- check number, ACH trace, etc.
  note       text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index invoice_payments_invoice_idx on public.invoice_payments (invoice_id);

create table public.invoice_submissions (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  invoice_id        uuid not null references public.invoices (id) on delete cascade,
  method            public.submission_method not null,
  status            public.submission_status not null default 'sent',
  recipients        text[] not null default '{}',
  cc                text[] not null default '{}',
  provider          text,                          -- 'resend' | 'manual'
  message_id        text,
  error             text,
  note              text,
  confirmation_path text,                          -- uploaded portal / paper confirmation
  created_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now()
);
create index invoice_submissions_invoice_idx on public.invoice_submissions (invoice_id, created_at desc);

-- ---------------------------------------------------------------------------
-- NHTSA decode cache (shared across companies; VINs are not secret)
-- ---------------------------------------------------------------------------
create table public.vin_cache (
  vin        text primary key check (vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  year       integer,
  make       text,
  model      text,
  trim       text,
  body_class text,
  decoded    jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit log (append-only; written by triggers)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  company_id uuid not null,
  actor_id   uuid,                                 -- auth.uid() at the time; null for system
  table_name text not null,
  row_id     uuid not null,
  action     text not null check (action in ('insert', 'update', 'delete')),
  old_data   jsonb,
  new_data   jsonb,
  changed    text[],                               -- column names that differ (update only)
  created_at timestamptz not null default now()
);
create index audit_log_row_idx on public.audit_log (table_name, row_id, created_at desc);
create index audit_log_company_idx on public.audit_log (company_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------------

-- updated_at maintenance
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['companies','profiles','dealerships','services','invoices','jobs']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;

-- Audit: records who/what/when for every change on business tables.
-- SECURITY DEFINER so a detailer's update still writes to audit_log even
-- though they have no insert policy on it.
create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_changed text[]; v_company uuid; v_row uuid;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new);
    select array_agg(key) into v_changed
    from jsonb_each(v_new) n
    where n.value is distinct from (v_old -> n.key) and n.key not in ('updated_at');
    if v_changed is null then return new; end if;     -- no-op update, nothing to log
  else
    v_old := to_jsonb(old);
  end if;

  v_row     := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  -- companies has no company_id column: the row is the company.
  v_company := case when tg_table_name = 'companies' then v_row
               else coalesce((v_new ->> 'company_id')::uuid, (v_old ->> 'company_id')::uuid) end;

  insert into public.audit_log (company_id, actor_id, table_name, row_id, action, old_data, new_data, changed)
  values (v_company, auth.uid(), tg_table_name, v_row, lower(tg_op), v_old, v_new, v_changed);

  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['jobs','job_services','job_photos','invoices','invoice_payments','invoice_submissions',
                           'services','dealership_service_prices','dealerships','companies','profiles']
  loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

-- Lock: invoiced jobs cannot be changed or soft-deleted unless the invoice is
-- void. RPCs that legitimately link/unlink jobs set `app.bypass_lock`.
create or replace function public.tg_lock_invoiced_job()
returns trigger language plpgsql as $$
declare v_status public.invoice_status;
begin
  if current_setting('app.bypass_lock', true) = 'on' then
    return coalesce(new, old);
  end if;
  if old.invoice_id is not null then
    select status into v_status from public.invoices where id = old.invoice_id;
    if v_status is distinct from 'void' then
      raise exception 'Job % is on invoice and is locked', old.id using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Jobs are never hard-deleted; use soft_delete_job()' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger lock_invoiced before update or delete on public.jobs
  for each row execute function public.tg_lock_invoiced_job();

create or replace function public.tg_lock_invoiced_job_service()
returns trigger language plpgsql as $$
declare v_job_id uuid; v_inv uuid; v_status public.invoice_status;
begin
  if current_setting('app.bypass_lock', true) = 'on' then
    return coalesce(new, old);
  end if;
  v_job_id := coalesce(new.job_id, old.job_id);
  select invoice_id into v_inv from public.jobs where id = v_job_id;
  if v_inv is not null then
    select status into v_status from public.invoices where id = v_inv;
    if v_status is distinct from 'void' then
      raise exception 'Job % is invoiced; its services are locked', v_job_id using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger lock_invoiced before insert or update or delete on public.job_services
  for each row execute function public.tg_lock_invoiced_job_service();

-- Payments roll up into the invoice: amount_paid, paid_at and status.
create or replace function public.tg_recompute_invoice_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_invoice uuid; v_paid numeric(12,2); v_total numeric(12,2); v_last date; v_status public.invoice_status;
begin
  v_invoice := coalesce(new.invoice_id, old.invoice_id);
  select coalesce(sum(amount), 0), max(paid_at) into v_paid, v_last
  from public.invoice_payments where invoice_id = v_invoice;
  select total, status into v_total, v_status from public.invoices where id = v_invoice;

  if v_status = 'void' then
    raise exception 'Cannot record a payment on a void invoice' using errcode = 'P0001';
  end if;

  update public.invoices set
    amount_paid = v_paid,
    paid_at = case when v_paid >= v_total and v_total > 0 then v_last::timestamptz else null end,
    status = case
      when v_paid >= v_total and v_total > 0 then 'paid'::public.invoice_status
      when v_paid > 0 then 'partial'::public.invoice_status
      when status in ('paid','partial') then 'submitted'::public.invoice_status   -- payment removed
      else status end
  where id = v_invoice;
  return coalesce(new, old);
end $$;
create trigger recompute_payment after insert or update or delete on public.invoice_payments
  for each row execute function public.tg_recompute_invoice_payment();

-- A successful submission stamps the invoice the first time.
create or replace function public.tg_invoice_submitted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'sent' then
    update public.invoices set
      submitted_at = coalesce(submitted_at, new.created_at),
      status = case when status = 'draft' then 'submitted'::public.invoice_status else status end
    where id = new.invoice_id;
  end if;
  return new;
end $$;
create trigger mark_submitted after insert on public.invoice_submissions
  for each row execute function public.tg_invoice_submitted();

-- Non-admins may only edit their own name; role/company/active are admin-only.
create or replace function public.tg_guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role public.user_role;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if auth.uid() is null or v_role in ('owner','admin') then
    return new;
  end if;
  if new.role <> old.role or new.company_id <> old.company_id or new.active <> old.active then
    raise exception 'Only admins can change role, company or active status' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_profile_update before update on public.profiles
  for each row execute function public.tg_guard_profile_update();

-- Create a profile for every new auth user. The inviting admin passes
-- company_id / role / full_name in user metadata. The very first user of a
-- fresh install (no profiles yet, one company) becomes its owner.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_role    public.user_role;
  v_name    text;
begin
  v_company := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;
  v_role    := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'detailer')::public.user_role;
  v_name    := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1));

  if v_company is null then
    if (select count(*) from public.companies) = 1 then
      select id into v_company from public.companies limit 1;
      if not exists (select 1 from public.profiles) then
        v_role := 'owner';                         -- bootstrap: first user owns the company
      end if;
    else
      raise exception 'New user % has no company_id in metadata', new.email;
    end if;
  end if;

  insert into public.profiles (id, company_id, role, full_name, email)
  values (new.id, v_company, v_role, v_name, new.email)
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
