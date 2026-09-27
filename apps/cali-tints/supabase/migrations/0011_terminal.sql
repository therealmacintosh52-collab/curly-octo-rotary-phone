-- =============================================================================
-- 0011 — Terminal: the app does what the Clover terminal does
--   * terminal_sales: ledger of sales and refunds taken from the Terminal tab
--     (card in app, card on the device, cash, check, ACH/other), either against
--     an invoice (payment_id → invoice_payments) or stand-alone counter sales
--   * refund_terminal_sale(): full/partial refunds with the invoice bookkeeping
--   * terminal_transactions(): one list for a day range, including payments
--     recorded elsewhere (invoice page, hosted checkout, Clover sync)
--   * dashboard_stats(): income includes stand-alone counter sales net of refunds
-- Re-runnable: every statement is guarded.
-- =============================================================================

create table if not exists public.terminal_sales (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  kind               text not null default 'sale' check (kind in ('sale', 'refund')),
  status             text not null default 'captured' check (status in ('captured', 'partially_refunded', 'refunded')),
  amount             numeric(12,2) not null check (amount > 0),
  refunded_amount    numeric(12,2) not null default 0 check (refunded_amount >= 0),
  method             public.payment_method not null,
  source             text not null default 'manual' check (source in ('manual', 'clover_card', 'clover_pos', 'clover_checkout')),
  invoice_id         uuid references public.invoices (id) on delete set null,
  payment_id         uuid references public.invoice_payments (id) on delete set null,
  refund_of          uuid references public.terminal_sales (id) on delete cascade,
  description        text,
  customer_name      text,
  customer_email     text,
  reference          text,
  card_brand         text,
  last4              text,
  clover_payment_id  text,
  clover_charge_id   text,
  clover_refund_id   text,
  receipt_sent_at    timestamptz,
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now()
);
create index if not exists terminal_sales_company_created_idx on public.terminal_sales (company_id, created_at desc);
create index if not exists terminal_sales_payment_idx on public.terminal_sales (payment_id) where payment_id is not null;

grant select, insert, update on public.terminal_sales to authenticated, service_role;
alter table public.terminal_sales enable row level security;
drop policy if exists terminal_sales_admin on public.terminal_sales;
create policy terminal_sales_admin on public.terminal_sales for all to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());
drop trigger if exists audit on public.terminal_sales;
create trigger audit after insert or update or delete on public.terminal_sales for each row execute function public.tg_audit();

-- Refund part or all of a sale. Pass the ledger row id, or the invoice_payments
-- id for a payment that was recorded outside the Terminal (a ledger row is
-- created for it first). For invoice-linked sales the invoice payment shrinks
-- (partial) or is removed (full); the existing recompute trigger rolls the
-- invoice status back. A removed Clover payment is marked ignored AFTER the
-- delete, because the unlink trigger would otherwise re-queue it for matching.
-- The Clover-side refund (if any) is made by the caller before this runs.
create or replace function public.refund_terminal_sale(
  p_sale_id uuid, p_payment_id uuid, p_amount numeric, p_clover_refund_id text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company   uuid := public.current_company_id();
  v_sale      public.terminal_sales;
  v_pay       public.invoice_payments;
  v_remaining numeric;
  v_id        uuid;
begin
  perform public.assert_admin();

  if p_sale_id is null then
    if p_payment_id is null then
      raise exception 'Nothing to refund' using errcode = '22023';
    end if;
    select * into v_sale from public.terminal_sales
     where company_id = v_company and payment_id = p_payment_id and kind = 'sale';
    if not found then
      select * into v_pay from public.invoice_payments where id = p_payment_id and company_id = v_company;
      if not found then
        raise exception 'Payment not found' using errcode = 'P0002';
      end if;
      insert into public.terminal_sales (company_id, kind, amount, method, source, invoice_id, payment_id, reference,
                                         description, clover_payment_id, clover_charge_id, created_by, created_at)
      values (v_company, 'sale', v_pay.amount, v_pay.method, v_pay.source, v_pay.invoice_id, v_pay.id, v_pay.reference,
              v_pay.note, v_pay.clover_payment_id, v_pay.clover_charge_id, v_pay.created_by, v_pay.created_at)
      returning * into v_sale;
    end if;
    p_sale_id := v_sale.id;
  end if;

  select * into v_sale from public.terminal_sales
   where id = p_sale_id and company_id = v_company and kind = 'sale' for update;
  if not found then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;

  v_remaining := v_sale.amount - v_sale.refunded_amount;
  if p_amount is null or p_amount <= 0 or p_amount > v_remaining + 0.005 then
    raise exception 'Refund must be between 0.01 and %', v_remaining using errcode = '22023';
  end if;
  p_amount := least(round(p_amount, 2), v_remaining);

  insert into public.terminal_sales (company_id, kind, status, amount, method, source, invoice_id, payment_id, refund_of,
                                     description, customer_name, customer_email, reference, card_brand, last4,
                                     clover_payment_id, clover_charge_id, clover_refund_id, created_by)
  values (v_company, 'refund', 'captured', p_amount, v_sale.method, v_sale.source, v_sale.invoice_id, v_sale.payment_id, v_sale.id,
          v_sale.description, v_sale.customer_name, v_sale.customer_email, v_sale.reference, v_sale.card_brand, v_sale.last4,
          v_sale.clover_payment_id, v_sale.clover_charge_id, p_clover_refund_id, auth.uid())
  returning id into v_id;

  update public.terminal_sales
     set refunded_amount = refunded_amount + p_amount,
         status = case when refunded_amount + p_amount >= amount then 'refunded' else 'partially_refunded' end
   where id = v_sale.id;

  if v_sale.payment_id is not null then
    if p_amount >= v_remaining then
      delete from public.invoice_payments where id = v_sale.payment_id;      -- recompute + unlink triggers fire
      if v_sale.clover_payment_id is not null then
        update public.clover_payments set status = 'ignored', invoice_id = null, matched_by = null
         where company_id = v_company and clover_payment_id = v_sale.clover_payment_id;
      end if;
    else
      update public.invoice_payments set amount = amount - p_amount where id = v_sale.payment_id;
    end if;
  end if;

  return v_id;
end $$;
grant execute on function public.refund_terminal_sale(uuid, uuid, numeric, text) to authenticated;

-- Everything that happened at the till for a day range: terminal ledger rows
-- plus invoice payments recorded elsewhere (no ledger row yet). Newest first.
create or replace function public.terminal_transactions(p_start date default null, p_end date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_tz      text;
  v_start   date;
  v_end     date;
begin
  perform public.assert_admin();
  select timezone into v_tz from public.companies where id = v_company;
  v_start := coalesce(p_start, (now() at time zone v_tz)::date);
  v_end   := coalesce(p_end, v_start);
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.at desc)
    from (
      select s.id, s.kind, s.status, s.amount, s.refunded_amount, s.method::text as method, s.source,
             s.invoice_id, i.display_number as invoice_number, d.name as dealership,
             s.payment_id, s.refund_of, s.description, s.customer_name, s.customer_email, s.reference,
             s.card_brand, s.last4, s.clover_payment_id, s.receipt_sent_at, s.created_at as at
      from public.terminal_sales s
      left join public.invoices i on i.id = s.invoice_id
      left join public.dealerships d on d.id = i.dealership_id
      where s.company_id = v_company
        and (s.created_at at time zone v_tz)::date between v_start and v_end
      union all
      select p.id, 'sale', 'captured', p.amount, 0::numeric, p.method::text, p.source,
             p.invoice_id, i.display_number, d.name,
             p.id, null::uuid, p.note, null::text, null::text, p.reference,
             null::text, null::text, p.clover_payment_id, null::timestamptz, p.created_at
      from public.invoice_payments p
      join public.invoices i on i.id = p.invoice_id
      join public.dealerships d on d.id = i.dealership_id
      where p.company_id = v_company
        and p.paid_at between v_start and v_end
        and not exists (select 1 from public.terminal_sales t where t.payment_id = p.id)
    ) x
  ), '[]'::jsonb);
end $$;
grant execute on function public.terminal_transactions(date, date) to authenticated;

-- dashboard_stats: cash in now includes stand-alone counter sales (net of
-- refunds). Invoice-linked terminal sales are already invoice_payments rows.
create or replace function public.dashboard_stats(p_start date default null, p_end date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_tz      text;
  v_days    integer;
  v_today   date;
  v_week0   date;
  v_month0  date;
  v_start   date;
  v_end     date;
  v_out     jsonb;
begin
  perform public.assert_admin();
  select timezone, reminder_days into v_tz, v_days from public.companies where id = v_company;
  v_today  := (now() at time zone v_tz)::date;
  v_week0  := date_trunc('week', v_today)::date;          -- Monday
  v_month0 := date_trunc('month', v_today)::date;
  v_start  := coalesce(p_start, v_month0);
  v_end    := coalesce(p_end, v_today);

  with j as (
    select j.id, j.detailer_id, (j.performed_at at time zone v_tz)::date as d, j.invoice_id,
           coalesce((select sum(price) from public.job_services js where js.job_id = j.id), 0) as amount
    from public.jobs j
    where j.company_id = v_company and j.deleted_at is null
  ),
  pay as (
    select p.paid_at as d, p.amount
    from public.invoice_payments p
    where p.company_id = v_company
    union all
    select (s.created_at at time zone v_tz)::date, case when s.kind = 'sale' then s.amount else -s.amount end
    from public.terminal_sales s
    where s.company_id = v_company and s.invoice_id is null
  )
  select jsonb_build_object(
    'range', jsonb_build_object('start', v_start, 'end', v_end),
    'week', (select jsonb_build_object('jobs', count(*), 'revenue', coalesce(sum(amount),0))
             from j where d >= v_week0 and d <= v_today),
    'month', (select jsonb_build_object('jobs', count(*), 'revenue', coalesce(sum(amount),0))
              from j where d >= v_month0 and d <= v_today),
    'income', (select jsonb_build_object(
                 'jobs', (select count(*) from j where d between v_start and v_end),
                 'revenue', (select coalesce(sum(amount),0) from j where d between v_start and v_end),
                 'collected', (select coalesce(sum(amount),0) from pay where d between v_start and v_end),
                 'payments', (select count(*) filter (where amount > 0) from pay where d between v_start and v_end),
                 'avg_per_car', (select case when count(*) = 0 then 0 else round(sum(amount) / count(*), 2) end from j where d between v_start and v_end))),
    'collected_by_day', (select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb) from (
                           select d as day, count(*) filter (where amount > 0) as payments, sum(amount) as amount
                           from pay where d between v_start and v_end group by d) x),
    'uninvoiced_total', (select coalesce(sum(amount),0) from j where invoice_id is null),
    'uninvoiced_jobs',  (select count(*) from j where invoice_id is null),
    'outstanding_total', (select coalesce(sum(total - amount_paid),0) from public.invoices
                          where company_id = v_company and status in ('submitted','partial')),
    'outstanding_invoices', (select count(*) from public.invoices
                             where company_id = v_company and status in ('submitted','partial')),
    'draft_total', (select coalesce(sum(total),0) from public.invoices where company_id = v_company and status = 'draft'),
    'avg_days_to_pay', (select round(avg(extract(epoch from (paid_at - submitted_at)) / 86400)::numeric, 1)
                        from public.invoices
                        where company_id = v_company and status = 'paid' and submitted_at is not null and paid_at is not null),
    'paid_last_90', (select coalesce(sum(amount),0) from pay where d >= v_today - 90),
    'by_service', (select coalesce(jsonb_agg(row_to_json(x) order by x.revenue desc), '[]'::jsonb) from (
                     select s.id as service_id, s.name, count(*) as jobs, sum(js.price) as revenue
                     from public.job_services js
                     join public.services s on s.id = js.service_id
                     join j on j.id = js.job_id
                     where j.d between v_start and v_end
                     group by s.id, s.name) x),
    'by_detailer', (select coalesce(jsonb_agg(row_to_json(x) order by x.jobs desc), '[]'::jsonb) from (
                      select p.id as detailer_id, p.full_name as name, count(*) as jobs, sum(j.amount) as revenue
                      from j join public.profiles p on p.id = j.detailer_id
                      where j.d between v_start and v_end
                      group by p.id, p.full_name) x),
    'by_day', (select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb) from (
                 select d as day, count(*) as jobs, sum(amount) as revenue
                 from j where d between v_start and v_end group by d) x),
    'overdue', (select coalesce(jsonb_agg(row_to_json(x) order by x.submitted_at), '[]'::jsonb) from (
                  select i.id, i.display_number, d.name as dealership, i.total, i.amount_paid, i.submitted_at,
                         (v_today - (i.submitted_at at time zone v_tz)::date) as days_outstanding
                  from public.invoices i join public.dealerships d on d.id = i.dealership_id
                  where i.company_id = v_company and i.status in ('submitted','partial')
                    and i.submitted_at < now() - make_interval(days => v_days)) x),
    'reminder_days', v_days
  ) into v_out;

  return v_out;
end $$;
