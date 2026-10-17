-- =============================================================================
-- 0072 — What QuickBooks already billed, so a car is not charged twice
--   The owner imports the dealerships' past invoices from QuickBooks. Each invoice
--   line is kept as a row (stock number and VIN read from its description) in a
--   lookup table of its own: it is NOT a job and never becomes an invoice, so it
--   cannot be billed or pushed to QuickBooks again. New job warns when the stock
--   number or VIN is already on a past QuickBooks invoice.
--   * quickbooks_billed_lines: one row per invoice line, idempotent by
--     (company, QuickBooks invoice, line); owner and service role only
--   * find_quickbooks_billed(tag, vin, dealership): any member, no money for
--     roles that cannot see prices
--   * quickbooks_history_stats(): the owner's "last import" summary
-- Re-runnable.
-- =============================================================================

create table if not exists public.quickbooks_billed_lines (
  id            bigint generated always as identity primary key,
  company_id    uuid not null references public.companies (id),
  dealership_id uuid references public.dealerships (id),
  qbo_invoice_id text not null,
  doc_number    text,
  line_key      text not null,
  txn_date      date,
  service_date  date,
  stock_number  text,
  vin           text,
  description   text,
  amount        numeric(12, 2),
  parsed_ok     boolean not null default false,
  -- 'app' = a line this app pushed itself (never matched against); 'history' = an older invoice
  source        text not null default 'history' check (source in ('history', 'app')),
  imported_at   timestamptz not null default now(),
  unique (company_id, qbo_invoice_id, line_key)
);
create index if not exists qbl_stock_idx on public.quickbooks_billed_lines (company_id, stock_number) where stock_number is not null;
create index if not exists qbl_vin_idx on public.quickbooks_billed_lines (company_id, vin) where vin is not null;
create index if not exists qbl_dealership_idx on public.quickbooks_billed_lines (company_id, dealership_id);

alter table public.quickbooks_billed_lines enable row level security;
revoke all on public.quickbooks_billed_lines from anon, authenticated;

-- Entry time: is this stock number (at this dealership) or VIN already on a past QuickBooks invoice?
create or replace function public.find_quickbooks_billed(p_tag_number text, p_vin text default null, p_dealership_id uuid default null)
returns table (id bigint, doc_number text, billed_on date, stock_number text, vin text, description text, amount numeric)
language sql stable security definer set search_path = public as $$
  select b.id, b.doc_number, coalesce(b.service_date, b.txn_date), b.stock_number, b.vin, b.description,
         case when public.can_price_jobs() then b.amount else null end
    from public.quickbooks_billed_lines b
   where public.is_member() and b.company_id = public.current_company_id() and b.source = 'history'
     and ((nullif(trim(p_tag_number), '') is not null and b.stock_number = upper(trim(p_tag_number))
           and (p_dealership_id is null or b.dealership_id is null or b.dealership_id = p_dealership_id))
          or (nullif(trim(p_vin), '') is not null and b.vin = upper(trim(p_vin))))
   order by coalesce(b.service_date, b.txn_date) desc nulls last
   limit 5
$$;

-- The owner's summary of the last import
create or replace function public.quickbooks_history_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_owner() then
    (select jsonb_build_object('lines', count(*), 'unread', count(*) filter (where not parsed_ok), 'invoices', count(distinct qbo_invoice_id), 'last_import', max(imported_at))
       from public.quickbooks_billed_lines where company_id = public.current_company_id() and source = 'history')
    else null end
$$;

revoke all on function public.find_quickbooks_billed(text, text, uuid), public.quickbooks_history_stats() from public, anon;
grant execute on function public.find_quickbooks_billed(text, text, uuid), public.quickbooks_history_stats() to authenticated;
