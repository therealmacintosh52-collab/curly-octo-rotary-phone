-- =============================================================================
-- 0014 — Charge several unpaid invoices with one payment
--   * terminal_sales.group_id: ties the per-invoice ledger rows of one
--     combined payment (one card tap / one check) together
--   * record_batch_payment(): split one amount across invoices, oldest first
--   * terminal_transactions(): returns group_id
-- Re-runnable: every statement is guarded.
-- =============================================================================

alter table public.terminal_sales add column if not exists group_id uuid;
create index if not exists terminal_sales_group_idx on public.terminal_sales (group_id) where group_id is not null;

-- One payment for several invoices. Allocates oldest invoice first (by
-- number): full balances until the money runs out, the last one partial.
-- Each invoice gets its own invoice_payments row so the existing recompute
-- trigger flips it to paid / partial. Returns what went where.
create or replace function public.record_batch_payment(
  p_invoice_ids uuid[], p_amount numeric, p_method public.payment_method, p_reference text default null,
  p_note text default null, p_source text default 'manual')
returns table (invoice_id uuid, payment_id uuid, amount numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_left    numeric := round(p_amount, 2);
  v_total   numeric;
  v_take    numeric;
  v_pay     uuid;
  r         record;
begin
  perform public.assert_admin();
  if p_invoice_ids is null or array_length(p_invoice_ids, 1) is null then
    raise exception 'Pick at least one invoice' using errcode = '22023';
  end if;
  if p_source not in ('manual', 'clover_card', 'clover_pos', 'clover_checkout') then
    raise exception 'Unknown payment source' using errcode = '22023';
  end if;

  -- Every id must be ours, open, and owed something.
  if exists (
    select 1 from unnest(p_invoice_ids) x(id)
    left join public.invoices i on i.id = x.id and i.company_id = v_company and i.status <> 'void' and i.total - i.amount_paid > 0
    where i.id is null)
  then
    raise exception 'One of the invoices is not open' using errcode = 'P0002';
  end if;

  select sum(total - amount_paid) into v_total from public.invoices where id = any (p_invoice_ids);
  if v_left <= 0 or v_left > v_total + 0.005 then
    raise exception 'Amount must be between 0.01 and %', v_total using errcode = '22023';
  end if;

  for r in
    select i.id, i.total - i.amount_paid as balance
    from public.invoices i
    where i.id = any (p_invoice_ids)
    order by i.number
    for update
  loop
    exit when v_left <= 0;
    v_take := least(r.balance, v_left);
    insert into public.invoice_payments (company_id, invoice_id, amount, paid_at, method, reference, note, created_by, source)
    values (v_company, r.id, v_take, (now() at time zone (select timezone from public.companies where id = v_company))::date,
            p_method, p_reference, p_note, auth.uid(), p_source)
    returning id into v_pay;
    v_left := v_left - v_take;
    invoice_id := r.id; payment_id := v_pay; amount := v_take;
    return next;
  end loop;
  return;
end $$;
grant execute on function public.record_batch_payment(uuid[], numeric, public.payment_method, text, text, text) to authenticated;

-- Refund rows keep the group of the sale they undo (same as 0011, plus group_id).
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

  insert into public.terminal_sales (company_id, kind, status, amount, method, source, invoice_id, payment_id, refund_of, group_id,
                                     description, customer_name, customer_email, reference, card_brand, last4,
                                     clover_payment_id, clover_charge_id, clover_refund_id, created_by)
  values (v_company, 'refund', 'captured', p_amount, v_sale.method, v_sale.source, v_sale.invoice_id, v_sale.payment_id, v_sale.id, v_sale.group_id,
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

-- Day list now carries group_id so combined payments can be shown as one.
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
             s.payment_id, s.refund_of, s.group_id, s.description, s.customer_name, s.customer_email, s.reference,
             s.card_brand, s.last4, s.clover_payment_id, s.receipt_sent_at, s.created_at as at
      from public.terminal_sales s
      left join public.invoices i on i.id = s.invoice_id
      left join public.dealerships d on d.id = i.dealership_id
      where s.company_id = v_company
        and (s.created_at at time zone v_tz)::date between v_start and v_end
      union all
      select p.id, 'sale', 'captured', p.amount, 0::numeric, p.method::text, p.source,
             p.invoice_id, i.display_number, d.name,
             p.id, null::uuid, null::uuid, p.note, null::text, null::text, p.reference,
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
