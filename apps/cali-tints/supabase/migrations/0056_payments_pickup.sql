-- =============================================================================
-- 0056 — How it was paid, split payments, and "Close job · Picked up"
--   * payments.method gains zelle and venmo (cash, check, card on the Clover Flex
--     and "other" were already there)
--   * record_retail_payment: any number of payments (part card, part cash); the
--     job is PAID only when the balance reaches zero; a payment can never be more
--     than the balance; the advisor (owner, admin, advisor) records cash, check,
--     Zelle, Venmo and a card taken by hand, not only the owner/admin
--   * the customer signs AFTER paying: sign_receipt refuses an unpaid job
--   * close_ro: the last step, "Close job · Picked up" (needs the payment and,
--     when the shop requires it, the pickup signature); this is what closes the
--     RO (jobs.closed_at) and starts the declined-work follow-up, not the payment
--   * jobs.picked_up_at / picked_up_by; carried on the receipt JSON and the charge
-- Re-runnable.
-- =============================================================================

create or replace function public._patch_function(p_name text, p_marker text, p_from text, p_to text)
returns void language plpgsql as $$
declare src text;
begin
  select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = p_name;
  if src is null then raise exception 'patch: % missing', p_name; end if;
  if position(p_marker in src) > 0 then return; end if;
  if position(p_from in src) = 0 then raise exception 'patch: % anchor not found (%)', p_name, left(p_from, 60); end if;
  execute replace(src, p_from, p_to);
end $$;

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check check (method in ('clover_online', 'clover_flex', 'cash', 'check', 'zelle', 'venmo', 'other'));

alter table public.jobs add column if not exists picked_up_at timestamptz;
alter table public.jobs add column if not exists picked_up_by uuid references public.profiles (id);

-- Retail jobs that were already paid are already gone from the shop.
do $$
begin
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs j set picked_up_at = coalesce(j.closed_at, j.paid_at)
   where j.paid_at is not null and j.picked_up_at is null
     and exists (select 1 from public.dealerships d where d.id = j.dealership_id and d.retail);
  perform set_config('app.bypass_lock', 'off', true);
end $$;

-- ---------------------------------------------------------------------------
-- Payments: split, any method, paid only at zero balance
-- ---------------------------------------------------------------------------
create or replace function public.record_retail_payment(p_job_id uuid, p_amount numeric, p_method text, p_reference text default null)
returns public.jobs language plpgsql security definer set search_path = public as $$
declare j public.jobs; v_retail boolean; m record; v_ref text := nullif(trim(coalesce(p_reference, '')), ''); v_pm text; v_jm text;
begin
  select * into j from public.jobs where id = p_job_id and company_id = public.current_company_id();
  if j.id is null or not (public.is_admin() or j.detailer_id = auth.uid()) then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;
  select retail into v_retail from public.dealerships where id = j.dealership_id;
  if not coalesce(v_retail, false) then
    raise exception 'Not a retail job' using errcode = 'P0001';
  end if;
  if j.paid_at is not null then
    raise exception 'Already paid' using errcode = 'P0001';
  end if;
  if j.invoiced_at is null and coalesce(current_setting('app.allow_retail_job', true), '') <> 'on' then
    raise exception 'Convert the repair order to an invoice first' using errcode = 'P0001';
  end if;
  if p_method not in ('clover', 'card', 'cash', 'check', 'zelle', 'venmo', 'other') then
    raise exception 'Say how it was paid: card, cash, check, Zelle, Venmo or other' using errcode = '22023';
  end if;
  if p_method <> 'clover' and not public.can_price_jobs() then
    raise exception 'Only the owner, an admin or an advisor records a payment by hand' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = '22023';
  end if;
  select * into m from public._job_money(j.id);
  if round(p_amount, 2) > m.balance + 0.004 then
    raise exception 'That is more than the balance (%)', m.balance using errcode = '22023';
  end if;
  v_pm := case p_method when 'clover' then 'clover_flex' when 'card' then 'clover_flex' when 'cash' then 'cash' when 'check' then 'check' when 'zelle' then 'zelle' when 'venmo' then 'venmo' else 'other' end;
  v_jm := case when p_method in ('clover', 'card') then 'clover' when p_method in ('cash', 'check') then p_method else 'other' end;
  insert into public.payments (company_id, customer_id, appointment_id, job_id, kind, status, amount, method, provider, provider_ref, note, paid_at, created_by)
  values (j.company_id, j.customer_id, j.appointment_id, j.id, 'balance', 'paid', round(p_amount, 2), v_pm, 'none', v_ref, case when p_method = 'card' then 'Card entered by hand' else null end, now(), auth.uid());
  select * into m from public._job_money(j.id);
  -- part paid: the job stays open for the rest
  if m.balance > 0.004 then
    return j;
  end if;
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs
     set paid_at = now(), paid_amount = round(m.deposit_paid + m.paid, 2), payment_method = v_jm, payment_ref = v_ref, paid_by = auth.uid(), updated_at = now()
   where id = j.id
   returning * into j;
  perform set_config('app.bypass_lock', 'off', true);
  perform public._emit(j.company_id, 'job.paid', 'job', j.id, j.customer_id, jsonb_build_object('method', p_method, 'appointment_id', j.appointment_id));
  if j.appointment_id is not null then
    update public.appointments set status = 'done', done_at = coalesce(done_at, now()) where id = j.appointment_id and status in ('booked', 'confirmed', 'in_progress');
  end if;
  return j;
end $$;
grant execute on function public.record_retail_payment(uuid, numeric, text, text) to authenticated;

-- The customer signs after paying.
select public._patch_function('sign_receipt', 'Take the payment first',
  '  if nullif(trim(coalesce(p_name',
  '  if j.paid_at is null then
    raise exception ''Take the payment first, then the customer signs'' using errcode = ''P0001'';
  end if;
  if nullif(trim(coalesce(p_name');

-- ---------------------------------------------------------------------------
-- Close job · Picked up
-- ---------------------------------------------------------------------------
create or replace function public.close_ro(p_job uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare j public.jobs; v_retail boolean; v_sig boolean;
begin
  if not (public.is_admin() or public.can_price_jobs()) then
    raise exception 'Only the owner, an admin or an advisor closes the job' using errcode = '42501';
  end if;
  select * into j from public.jobs where id = p_job and company_id = public.current_company_id();
  if j.id is null then raise exception 'Repair order not found' using errcode = 'P0002'; end if;
  select retail into v_retail from public.dealerships where id = j.dealership_id;
  if not coalesce(v_retail, false) then raise exception 'Not a retail repair order' using errcode = 'P0001'; end if;
  if j.deleted_at is not null then raise exception 'This job is deleted' using errcode = 'P0001'; end if;
  if j.picked_up_at is not null then raise exception 'This job is already closed' using errcode = 'P0001'; end if;
  if j.paid_at is null then raise exception 'Take the payment first' using errcode = 'P0001'; end if;
  v_sig := coalesce((select signature_required_receipt from public.retail_settings where company_id = j.company_id), true);
  if v_sig and j.receipt_signature_path is null then
    raise exception 'The customer signs first' using errcode = 'P0001';
  end if;
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs set picked_up_at = now(), picked_up_by = auth.uid(), closed_at = coalesce(closed_at, now()), updated_at = now() where id = j.id returning * into j;
  perform set_config('app.bypass_lock', 'off', true);
  -- work the customer put off becomes a reminder for the next visit
  if exists (select 1 from public.estimate_jobs ej join public.estimates es on es.id = ej.estimate_id where es.job_id = j.id and ej.status = 'declined') then
    perform public._emit(j.company_id, 'ro.closed', 'job', j.id, j.customer_id);
  end if;
  return jsonb_build_object('job_id', j.id, 'picked_up_at', j.picked_up_at);
end $$;
revoke execute on function public.close_ro(uuid) from public, anon;
grant execute on function public.close_ro(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- What the screens and the invoice read
-- ---------------------------------------------------------------------------
select public._patch_function('retail_charge', 'picked_up_at',
  '''paid_at'', j.paid_at,',
  '''paid_at'', j.paid_at, ''picked_up_at'', j.picked_up_at,');

select public._patch_function('_receipt_json', 'picked_up_at',
  '''signed_name'', j.receipt_signed_name,',
  '''picked_up_at'', j.picked_up_at, ''signed_name'', j.receipt_signed_name,');

select public._patch_function('_receipt_json', '''note'', p.note',
  '''provider_ref'', case when p_public then null else p.provider_ref end)',
  '''provider_ref'', case when p_public then null else p.provider_ref end, ''note'', p.note)');

drop function public._patch_function(text, text, text, text);
