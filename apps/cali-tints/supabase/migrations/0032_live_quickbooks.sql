-- =============================================================================
-- 0032 — Jobs live in QuickBooks; photos without before/after
--   * Every saved job is sent to QuickBooks right away as a line on that
--     dealership's open invoice for the month. QuickBooks numbers and sends
--     the invoice; the app tracks it (quickbooks_month_invoices, plus the
--     QuickBooks number on each job). The month close keeps a mirror row in
--     invoices and links it to the QuickBooks invoice; it no longer emails
--     on its own by default (Mike sends from QuickBooks).
--   * Photos are just photos: photo_kind gains 'photo'.
-- Re-runnable.
-- =============================================================================

alter type public.photo_kind add value if not exists 'photo';

-- The open QuickBooks invoice per dealership per month, as the app last saw it.
create table if not exists public.quickbooks_month_invoices (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  dealership_id    uuid not null references public.dealerships (id) on delete cascade,
  month_start      date not null,
  qbo_invoice_id   text,
  doc_number       text,
  sync_token       text,
  total            numeric(12,2),
  balance          numeric(12,2),
  email_status     text,
  job_count        integer not null default 0,
  synced_at        timestamptz,
  error            text,
  -- Set when the month closed and the app's mirror invoice took over the tracking.
  invoice_id       uuid references public.invoices (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (dealership_id, month_start)
);
alter table public.quickbooks_month_invoices enable row level security;
drop policy if exists qbo_month_owner on public.quickbooks_month_invoices;
create policy qbo_month_owner on public.quickbooks_month_invoices for select to authenticated
  using (company_id = public.current_company_id() and public.is_owner());
grant select on public.quickbooks_month_invoices to authenticated;
grant select, insert, update, delete on public.quickbooks_month_invoices to service_role;

-- Which QuickBooks invoice a job sits on (its number is not money: everyone may see it).
alter table public.jobs add column if not exists quickbooks_invoice_id text;
alter table public.jobs add column if not exists quickbooks_doc_number text;
alter table public.jobs add column if not exists quickbooks_synced_at timestamptz;

-- The Jobs list shows the QuickBooks number.
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'jobs_filtered';
  if v_src is not null and position('''quickbooks_doc_number''' in v_src) = 0 then
    execute replace(v_src, '''display_number'', b.display_number,',
      '''display_number'', b.display_number, ''quickbooks_doc_number'', b.quickbooks_doc_number,');
  end if;
end $$;

do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'invoices_filtered';
  if v_src is not null and position('''quickbooks_doc_number''' in v_src) = 0 then
    execute replace(v_src, '''quickbooks_invoice_id'', b.quickbooks_invoice_id,',
      '''quickbooks_invoice_id'', b.quickbooks_invoice_id, ''quickbooks_doc_number'', b.quickbooks_doc_number,');
  end if;
end $$;

-- QuickBooks does the sending: the app's own monthly email is opt-in.
alter table public.companies alter column auto_send_monthly set default false;
update public.companies set auto_send_monthly = false where auto_send_monthly;
