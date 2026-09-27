-- =============================================================================
-- 0009 — Clover (Fiserv) integration
--   * companies: merchant id, environment and feature toggles (no secrets)
--   * invoices: the Clover order and hosted-checkout session behind an invoice
--   * invoice_payments: provenance of a payment (manual vs Clover) + Clover ids
--   * clover_payments: every payment pulled from Clover, matched or waiting
--   * apply_clover_payment(): the one way a Clover payment becomes an invoice
--     payment, usable by the service role (cron / webhook) and by admins
-- =============================================================================

alter table public.companies
  add column if not exists clover_enabled          boolean not null default false,
  add column if not exists clover_env              text    not null default 'sandbox' check (clover_env in ('sandbox', 'production')),
  add column if not exists clover_merchant_id      text,
  add column if not exists clover_push_orders      boolean not null default true,
  add column if not exists clover_hosted_checkout  boolean not null default true,
  add column if not exists clover_last_sync_at     timestamptz;

alter table public.invoices
  add column if not exists clover_order_id             text,
  add column if not exists clover_pushed_at            timestamptz,
  add column if not exists clover_checkout_session_id  text,
  add column if not exists clover_checkout_url         text,
  add column if not exists clover_checkout_expires_at  timestamptz;
create index if not exists invoices_clover_order_idx on public.invoices (clover_order_id) where clover_order_id is not null;
create index if not exists invoices_clover_checkout_idx on public.invoices (clover_checkout_session_id) where clover_checkout_session_id is not null;

alter table public.invoice_payments
  add column if not exists source            text not null default 'manual' check (source in ('manual', 'clover_pos', 'clover_checkout', 'clover_card')),
  add column if not exists clover_payment_id text,
  add column if not exists clover_charge_id  text;
create unique index if not exists invoice_payments_clover_payment_uq on public.invoice_payments (clover_payment_id) where clover_payment_id is not null;
create unique index if not exists invoice_payments_clover_charge_uq on public.invoice_payments (clover_charge_id) where clover_charge_id is not null;

-- Reconciliation queue: everything Clover reports, whether or not we know the invoice yet.
create table if not exists public.clover_payments (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  clover_payment_id  text not null,
  clover_order_id    text,
  source             text not null default 'clover_pos' check (source in ('clover_pos', 'clover_checkout', 'clover_card')),
  amount             numeric(12,2) not null,
  tip                numeric(12,2) not null default 0,
  paid_at            timestamptz not null,
  card_brand         text,
  last4              text,
  reference          text,                      -- externalReferenceId / note from Clover
  raw                jsonb,
  invoice_id         uuid references public.invoices (id) on delete set null,
  status             text not null default 'unmatched' check (status in ('unmatched', 'matched', 'ignored')),
  matched_by         text check (matched_by in ('order', 'reference', 'amount', 'manual', 'checkout', 'card')),
  created_at         timestamptz not null default now(),
  unique (company_id, clover_payment_id)
);
create index if not exists clover_payments_company_status_idx on public.clover_payments (company_id, status);

grant select, insert, update, delete on public.clover_payments to authenticated, service_role;
alter table public.clover_payments enable row level security;
create policy clover_payments_admin on public.clover_payments for all to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());
create trigger audit after insert or update or delete on public.clover_payments for each row execute function public.tg_audit();

-- Callable by the service role (cron / webhook) or by an admin of that company.
create or replace function public._clover_allowed(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.role() = 'service_role' or (public.is_admin() and public.current_company_id() = p_company_id)
$$;

-- Turn a queued Clover payment into an invoice payment. Idempotent: applying
-- the same Clover payment twice returns the existing invoice_payments id.
-- The existing recompute trigger rolls amount_paid / status up on the invoice.
create or replace function public.apply_clover_payment(
  p_company_id uuid, p_clover_payment_id text, p_invoice_id uuid, p_matched_by text default 'manual')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_q public.clover_payments; v_id uuid;
begin
  if not public._clover_allowed(p_company_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_q from public.clover_payments where company_id = p_company_id and clover_payment_id = p_clover_payment_id;
  if not found then
    raise exception 'Clover payment not found' using errcode = 'P0002';
  end if;
  select id into v_id from public.invoice_payments where clover_payment_id = p_clover_payment_id;
  if v_id is not null then
    return v_id; -- already applied
  end if;
  if not exists (select 1 from public.invoices where id = p_invoice_id and company_id = p_company_id and status <> 'void') then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_q.amount <= 0 then
    raise exception 'Refunds are reconciled in Clover; nothing to apply' using errcode = '22023';
  end if;
  insert into public.invoice_payments (company_id, invoice_id, amount, paid_at, method, reference, note, created_by, source, clover_payment_id)
  values (p_company_id, p_invoice_id, v_q.amount, (v_q.paid_at at time zone 'UTC')::date, 'card',
          coalesce(v_q.reference, v_q.clover_payment_id),
          'Clover' || case when v_q.card_brand is not null then ' · ' || v_q.card_brand else '' end || case when v_q.last4 is not null then ' ' || v_q.last4 else '' end,
          auth.uid(), v_q.source, v_q.clover_payment_id)
  returning id into v_id;
  update public.clover_payments set invoice_id = p_invoice_id, status = 'matched', matched_by = p_matched_by
   where id = v_q.id;
  return v_id;
end $$;

-- Mark a queued payment as not ours / handled elsewhere.
create or replace function public.ignore_clover_payment(p_company_id uuid, p_clover_payment_id text, p_ignore boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._clover_allowed(p_company_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.clover_payments set status = case when p_ignore then 'ignored' else 'unmatched' end, matched_by = null
   where company_id = p_company_id and clover_payment_id = p_clover_payment_id and status <> 'matched';
end $$;

-- Removing an invoice payment that came from Clover puts it back in the queue.
create or replace function public.tg_clover_payment_unlinked()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.clover_payment_id is not null then
    update public.clover_payments set invoice_id = null, status = 'unmatched', matched_by = null
     where company_id = old.company_id and clover_payment_id = old.clover_payment_id;
  end if;
  return old;
end $$;
drop trigger if exists clover_unlink on public.invoice_payments;
create trigger clover_unlink after delete on public.invoice_payments for each row execute function public.tg_clover_payment_unlinked();

-- Count of payments waiting to be matched, for the dashboard and invoices list.
create or replace function public.clover_unmatched_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.clover_payments
   where company_id = public.current_company_id() and status = 'unmatched' and public.is_admin()
$$;

grant execute on function public._clover_allowed(uuid) to authenticated, service_role;
grant execute on function public.apply_clover_payment(uuid, text, uuid, text) to authenticated, service_role;
grant execute on function public.ignore_clover_payment(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.clover_unmatched_count() to authenticated, service_role;
