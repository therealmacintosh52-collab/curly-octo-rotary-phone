-- =============================================================================
-- 0031 — QuickBooks Online
--   The owner connects the company's QuickBooks Online once (OAuth). Every
--   monthly invoice is then created in QuickBooks as an Invoice (one line per
--   car and service), and payments recorded in QuickBooks flow back as
--   payments here. Tokens live encrypted in quickbooks_connections, which
--   only the service role can read.
-- Re-runnable.
-- =============================================================================

create table if not exists public.quickbooks_connections (
  company_id         uuid primary key references public.companies (id) on delete cascade,
  realm_id           text not null,
  env                text not null default 'production' check (env in ('sandbox', 'production')),
  access_token_enc   text not null,
  refresh_token_enc  text not null,
  access_expires_at  timestamptz,
  refresh_expires_at timestamptz,
  company_name       text,
  status             text not null default 'ok' check (status in ('ok', 'needs_reconnect')),
  last_error         text,
  last_ok_at         timestamptz,
  connected_by       uuid references public.profiles (id),
  connected_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.quickbooks_connections enable row level security;
revoke all on public.quickbooks_connections from authenticated, anon;
grant select, insert, update, delete on public.quickbooks_connections to service_role;

-- What everyone in Settings may know (no secrets): connected or not, to which QuickBooks company.
alter table public.companies add column if not exists quickbooks_realm_id text;
alter table public.companies add column if not exists quickbooks_company_name text;
alter table public.companies add column if not exists quickbooks_env text not null default 'production';
alter table public.companies add column if not exists quickbooks_connected_at timestamptz;
alter table public.companies add column if not exists quickbooks_item_id text;
alter table public.companies add column if not exists quickbooks_item_name text not null default 'Auto detailing';
alter table public.companies add column if not exists quickbooks_auto_push boolean not null default true;
alter table public.companies add column if not exists quickbooks_last_sync_at timestamptz;
alter table public.companies add column if not exists quickbooks_last_error text;

alter table public.dealerships add column if not exists quickbooks_customer_id text;

alter table public.invoices add column if not exists quickbooks_invoice_id text;
alter table public.invoices add column if not exists quickbooks_doc_number text;
alter table public.invoices add column if not exists quickbooks_sync_token text;
alter table public.invoices add column if not exists quickbooks_synced_at timestamptz;
alter table public.invoices add column if not exists quickbooks_error text;
alter table public.invoices add column if not exists quickbooks_balance numeric(12,2);
alter table public.invoices add column if not exists quickbooks_balance_at timestamptz;
create index if not exists invoices_quickbooks_open_idx on public.invoices (company_id) where quickbooks_invoice_id is not null and status in ('draft', 'submitted', 'partial');

-- The invoice list says which invoices are in QuickBooks (and which failed).
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'invoices_filtered';
  if v_src is not null and position('''quickbooks_invoice_id''' in v_src) = 0 then
    execute replace(v_src, '''created_at'', b.created_at,',
      '''created_at'', b.created_at, ''quickbooks_invoice_id'', b.quickbooks_invoice_id, ''quickbooks_error'', b.quickbooks_error,');
  end if;
end $$;

-- The daily job records a payment QuickBooks saw (no signed-in owner): service role only.
create or replace function public.record_payment_system(
  p_company_id uuid, p_invoice_id uuid, p_amount numeric, p_paid_at date default current_date,
  p_method public.payment_method default 'other', p_reference text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_inv public.invoices;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role only' using errcode = '42501';
  end if;
  select * into v_inv from public.invoices where id = p_invoice_id and company_id = p_company_id;
  if v_inv.id is null then
    raise exception 'Unknown invoice' using errcode = '22023';
  end if;
  if v_inv.status = 'void' then
    raise exception 'Invoice is void' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = '22023';
  end if;
  insert into public.invoice_payments (company_id, invoice_id, amount, paid_at, method, reference, note, created_by)
  values (p_company_id, p_invoice_id, round(p_amount, 2), p_paid_at, p_method, p_reference, p_note, null)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.record_payment_system(uuid, uuid, numeric, date, public.payment_method, text, text) from public, anon, authenticated;
grant execute on function public.record_payment_system(uuid, uuid, numeric, date, public.payment_method, text, text) to service_role;
