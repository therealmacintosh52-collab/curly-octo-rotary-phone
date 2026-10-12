-- 0041: retail payments. Deposits taken online (Clover hosted checkout,
-- behind DEPOSITS_ONLINE) or at the shop, the balance at the counter, every
-- payment on one ledger, and the customer's signed receipt at pickup.
--
-- A paid deposit confirms a booking (lead → booked). The job's balance is
-- its total minus the deposit already paid. The webhook writes through a
-- service-role RPC only; app users never touch the payments table directly.
-- Re-runnable; nothing destructive.
--
-- Reversal: drop payments, receipt_tokens, the receipt columns on jobs, the deposit columns
-- on appointments and the functions below; restore retail_charge /
-- record_retail_payment from 0034.

create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  customer_id         uuid references public.customers (id),
  appointment_id      uuid references public.appointments (id),
  estimate_id         uuid references public.estimates (id),
  job_id              uuid references public.jobs (id),
  kind                text not null check (kind in ('deposit', 'balance', 'refund')),
  status              text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'failed', 'cancelled')),
  amount              numeric(12,2) not null check (amount >= 0),
  method              text not null default 'other' check (method in ('clover_online', 'clover_flex', 'cash', 'check', 'other')),
  provider            text not null default 'none' check (provider in ('clover', 'none')),
  checkout_session_id text unique,
  provider_ref        text,
  paid_at             timestamptz,
  note                text,
  raw                 jsonb,
  refunds_payment_id  uuid references public.payments (id),
  created_by          uuid references public.profiles (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists payments_company_created_idx on public.payments (company_id, created_at desc);
create index if not exists payments_appointment_idx on public.payments (appointment_id);
create index if not exists payments_job_idx on public.payments (job_id);
create index if not exists payments_estimate_idx on public.payments (estimate_id);
create index if not exists payments_customer_idx on public.payments (customer_id);

alter table public.jobs add column if not exists receipt_signature_path text;
alter table public.jobs add column if not exists receipt_signed_at timestamptz;
alter table public.jobs add column if not exists receipt_signed_name text;

-- The receipt link's token lives apart from the job so no app user can read it (the RPCs hand it out).
create table if not exists public.receipt_tokens (
  job_id     uuid primary key references public.jobs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  token      text not null unique default translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_'),
  created_at timestamptz not null default now()
);
revoke all on public.receipt_tokens from public, authenticated, anon;

alter table public.appointments add column if not exists deposit_paid_at timestamptz;
alter table public.appointments add column if not exists deposit_payment_id uuid references public.payments (id);

do $$
begin
  execute 'drop trigger if exists set_updated_at on public.payments';
  execute 'create trigger set_updated_at before update on public.payments for each row execute function public.tg_set_updated_at()';
  execute 'drop trigger if exists audit on public.payments';
  execute 'create trigger audit after insert or update or delete on public.payments for each row execute function public.tg_audit()';
end $$;

alter table public.payments enable row level security;
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select to authenticated using (company_id = public.current_company_id());
revoke all on public.payments from authenticated, anon;
-- Members see that a payment exists and how; the amount only through the RPCs (owner/admin).
grant select (id, company_id, customer_id, appointment_id, estimate_id, job_id, kind, status, method, provider, paid_at, note, created_by, created_at, updated_at) on public.payments to authenticated;

create or replace function public._receipt_token(p_job uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  select token into v from public.receipt_tokens where job_id = p_job;
  if v is null then
    insert into public.receipt_tokens (job_id, company_id) select id, company_id from public.jobs where id = p_job
    on conflict (job_id) do nothing;
    select token into v from public.receipt_tokens where job_id = p_job;
  end if;
  return v;
end $$;
revoke execute on function public._receipt_token(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public._deposit_paid_for(p_appointment uuid, p_estimate uuid, p_job uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when p.kind = 'deposit' then p.amount else 0 end), 0)
       - coalesce(sum(case when p.kind = 'refund' then p.amount else 0 end), 0)
  from public.payments p
  where p.status in ('paid', 'refunded')
    and ((p_appointment is not null and p.appointment_id = p_appointment)
      or (p_estimate is not null and p.estimate_id = p_estimate)
      or (p_job is not null and p.job_id = p_job))
$$;
revoke execute on function public._deposit_paid_for(uuid, uuid, uuid) from public, anon, authenticated;

-- A paid deposit confirms the booking.
create or replace function public._apply_paid_deposit(p_appointment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.appointments; v_pay public.payments;
begin
  select * into a from public.appointments where id = p_appointment;
  if a.id is null then return; end if;
  select * into v_pay from public.payments
   where status = 'paid' and kind = 'deposit'
     and (appointment_id = a.id or (a.estimate_id is not null and estimate_id = a.estimate_id))
   order by paid_at desc limit 1;
  if v_pay.id is null then return; end if;
  update public.payments set appointment_id = coalesce(appointment_id, a.id), customer_id = coalesce(customer_id, a.customer_id) where id = v_pay.id;
  update public.appointments set
    deposit_paid_at = coalesce(deposit_paid_at, v_pay.paid_at),
    deposit_payment_id = coalesce(deposit_payment_id, v_pay.id),
    status = case when status in ('hold', 'lead') then 'booked' else status end,
    confirmed_at = coalesce(confirmed_at, now()),
    hold_expires_at = null
  where id = a.id;
end $$;
revoke execute on function public._apply_paid_deposit(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Deposits
-- ---------------------------------------------------------------------------

-- The pending deposit row the checkout link is made for (one live pending row per appointment/estimate).
create or replace function public._start_deposit(p_company uuid, p_appointment uuid, p_estimate uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a      public.appointments;
  e      public.estimates;
  v_amt  numeric;
  v_cust uuid;
  v_pay  public.payments;
  c      public.customers;
  v_num  text;
  v_veh  text;
begin
  if p_appointment is not null then
    select * into a from public.appointments where id = p_appointment and company_id = p_company;
    if a.id is null then raise exception 'Appointment not found' using errcode = 'P0002'; end if;
    if a.status not in ('hold', 'lead', 'booked', 'confirmed') then raise exception 'This appointment cannot take a deposit' using errcode = 'P0001'; end if;
    v_amt := a.deposit_required; v_cust := a.customer_id; v_num := a.display_number;
    select nullif(concat_ws(' ', v.year::text, v.make, v.model), '') into v_veh from public.vehicles v where v.id = a.vehicle_id;
    if public._deposit_paid_for(a.id, a.estimate_id, null) >= v_amt then raise exception 'The deposit is already paid' using errcode = 'P0001'; end if;
  else
    select * into e from public.estimates where id = p_estimate and company_id = p_company;
    if e.id is null then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
    if e.status <> 'accepted' then raise exception 'Only an approved estimate takes a deposit' using errcode = 'P0001'; end if;
    v_amt := e.deposit_required; v_cust := e.customer_id; v_num := e.display_number;
    select nullif(concat_ws(' ', v.year::text, v.make, v.model), '') into v_veh from public.vehicles v where v.id = e.vehicle_id;
    if public._deposit_paid_for(null, e.id, null) >= v_amt then raise exception 'The deposit is already paid' using errcode = 'P0001'; end if;
  end if;
  if coalesce(v_amt, 0) <= 0 then raise exception 'No deposit is due' using errcode = 'P0001'; end if;

  select * into v_pay from public.payments
   where company_id = p_company and kind = 'deposit' and status = 'pending'
     and ((p_appointment is not null and appointment_id = p_appointment) or (p_appointment is null and estimate_id = p_estimate))
   order by created_at desc limit 1;
  if v_pay.id is null or v_pay.amount <> v_amt then
    if v_pay.id is not null then update public.payments set status = 'cancelled' where id = v_pay.id; end if;
    insert into public.payments (company_id, customer_id, appointment_id, estimate_id, kind, status, amount, method, provider)
    values (p_company, v_cust, p_appointment, case when p_appointment is null then p_estimate else a.estimate_id end, 'deposit', 'pending', v_amt, 'clover_online', 'clover')
    returning * into v_pay;
  end if;
  select * into c from public.customers where id = v_cust;
  return jsonb_build_object('payment_id', v_pay.id, 'amount', v_pay.amount, 'amount_cents', round(v_pay.amount * 100)::bigint, 'display_number', v_num, 'vehicle', v_veh,
                            'customer', jsonb_build_object('first_name', c.first_name, 'last_name', c.last_name, 'email', c.email, 'phone', c.phone));
end $$;
revoke execute on function public._start_deposit(uuid, uuid, uuid) from public, anon, authenticated;

-- The customer, by the link they hold: the appointment's (`/a/<token>`) or the estimate's (`/e/<token>`) deposit.
create or replace function public.start_deposit_by_token(p_kind text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.appointments; e public.estimates;
begin
  if p_kind = 'appointment' then
    a := public._appointment_for_token(p_token);
    if a.id is null then raise exception 'That booking link is not valid' using errcode = 'P0002'; end if;
    return public._start_deposit(a.company_id, a.id, null);
  else
    e := public._estimate_for_token(p_token);
    if e.id is null then raise exception 'That estimate link is not valid' using errcode = 'P0002'; end if;
    return public._start_deposit(e.company_id, null, e.id);
  end if;
end $$;
grant execute on function public.start_deposit_by_token(text, text) to anon, authenticated;

-- Staff: the same, from the appointment page (the link is then texted or shown).
create or replace function public.start_deposit(p_appointment uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the owner, an admin or a manager starts a deposit' using errcode = '42501'; end if;
  return public._start_deposit(public.current_company_id(), p_appointment, null);
end $$;
grant execute on function public.start_deposit(uuid) to authenticated;

-- Service role: the hosted checkout result. p = {payment_id | checkout_session_id, status paid|failed, provider_ref, amount?, raw}
create or replace function public.record_payment_system_retail(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pay public.payments; v_status text := coalesce(p ->> 'status', 'paid');
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') then
    raise exception 'service role only' using errcode = '42501';
  end if;
  select * into v_pay from public.payments
   where (nullif(p ->> 'payment_id', '') is not null and id = (p ->> 'payment_id')::uuid)
      or (nullif(p ->> 'checkout_session_id', '') is not null and checkout_session_id = p ->> 'checkout_session_id');
  if v_pay.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown payment');
  end if;
  if v_pay.status = 'paid' then
    return jsonb_build_object('ok', true, 'payment_id', v_pay.id, 'already', true);
  end if;
  if v_status = 'paid' then
    update public.payments set
      status = 'paid', paid_at = coalesce(paid_at, now()), provider_ref = coalesce(nullif(p ->> 'provider_ref', ''), provider_ref),
      amount = coalesce(nullif(p ->> 'amount', '')::numeric, amount), raw = coalesce(p -> 'raw', raw)
    where id = v_pay.id returning * into v_pay;
    if v_pay.appointment_id is not null then
      perform public._apply_paid_deposit(v_pay.appointment_id);
    elsif v_pay.estimate_id is not null then
      perform public._apply_paid_deposit(ap.id) from public.appointments ap where ap.estimate_id = v_pay.estimate_id and ap.status in ('hold', 'lead', 'booked', 'confirmed');
    end if;
  else
    update public.payments set status = 'failed', raw = coalesce(p -> 'raw', raw), note = nullif(left(coalesce(p ->> 'note', ''), 300), '') where id = v_pay.id returning * into v_pay;
  end if;
  return jsonb_build_object('ok', true, 'payment_id', v_pay.id, 'status', v_pay.status, 'appointment_id', v_pay.appointment_id);
end $$;
revoke execute on function public.record_payment_system_retail(jsonb) from public, anon, authenticated;
grant execute on function public.record_payment_system_retail(jsonb) to service_role;

-- The server attaches the Clover session id to the pending row (service role).
create or replace function public.attach_checkout_session(p_payment uuid, p_session_id text, p_raw jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') then
    raise exception 'service role only' using errcode = '42501';
  end if;
  update public.payments set checkout_session_id = p_session_id, raw = coalesce(p_raw, raw) where id = p_payment and status = 'pending';
end $$;
revoke execute on function public.attach_checkout_session(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.attach_checkout_session(uuid, text, jsonb) to service_role;

-- Staff: the deposit taken at drop-off (cash, check, on the Flex) or a Clover payment matched by hand (owner).
create or replace function public.record_deposit_at_shop(p_appointment uuid, p_method text, p_reference text default null, p_amount numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.appointments; v_amt numeric; v_pay public.payments;
begin
  if not public.is_admin() then raise exception 'Only the owner, an admin or a manager records a deposit' using errcode = '42501'; end if;
  if p_method not in ('clover_flex', 'cash', 'check', 'other', 'clover_online') then raise exception 'Unknown method' using errcode = '22023'; end if;
  if p_method = 'clover_online' and not public.is_owner() then raise exception 'Only the owner matches an online payment by hand' using errcode = '42501'; end if;
  select * into a from public.appointments where id = p_appointment and company_id = public.current_company_id();
  if a.id is null then raise exception 'Appointment not found' using errcode = 'P0002'; end if;
  v_amt := coalesce(p_amount, a.deposit_required);
  if v_amt <= 0 then raise exception 'Amount must be positive' using errcode = '22023'; end if;
  update public.payments set status = 'cancelled' where appointment_id = a.id and kind = 'deposit' and status = 'pending';
  insert into public.payments (company_id, customer_id, appointment_id, estimate_id, kind, status, amount, method, provider, provider_ref, paid_at, created_by)
  values (a.company_id, a.customer_id, a.id, a.estimate_id, 'deposit', 'paid', round(v_amt, 2), p_method, case when p_method = 'clover_online' then 'clover' else 'none' end, nullif(trim(coalesce(p_reference, '')), ''), now(), auth.uid())
  returning * into v_pay;
  perform public._apply_paid_deposit(a.id);
  return public._appointment_json(a.id, public.can_price_jobs(), false);
end $$;
grant execute on function public.record_deposit_at_shop(uuid, text, text, numeric) to authenticated;

-- Owner: record a refund (the money moves in Clover or the till; this is the ledger).
create or replace function public.refund_payment(p_id uuid, p_amount numeric, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pay public.payments; v_ref public.payments; v_done numeric;
begin
  if not public.is_owner() then raise exception 'Only the owner records a refund' using errcode = '42501'; end if;
  select * into v_pay from public.payments where id = p_id and company_id = public.current_company_id() and status in ('paid', 'refunded') and kind <> 'refund';
  if v_pay.id is null then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  select coalesce(sum(amount), 0) into v_done from public.payments where refunds_payment_id = v_pay.id;
  if p_amount is null or p_amount <= 0 or v_done + p_amount > v_pay.amount then raise exception 'Refund more than what was paid' using errcode = '22023'; end if;
  insert into public.payments (company_id, customer_id, appointment_id, estimate_id, job_id, kind, status, amount, method, provider, paid_at, note, refunds_payment_id, created_by)
  values (v_pay.company_id, v_pay.customer_id, v_pay.appointment_id, v_pay.estimate_id, v_pay.job_id, 'refund', 'paid', round(p_amount, 2), v_pay.method, v_pay.provider, now(), nullif(left(trim(coalesce(p_note, '')), 300), ''), v_pay.id, auth.uid())
  returning * into v_ref;
  if v_done + p_amount >= v_pay.amount then update public.payments set status = 'refunded' where id = v_pay.id; end if;
  return to_jsonb(v_ref);
end $$;
grant execute on function public.refund_payment(uuid, numeric, text) to authenticated;

-- Pending links that nobody paid are tidied away (service role, cron).
create or replace function public.expire_pending_payments()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') then
    raise exception 'service role only' using errcode = '42501';
  end if;
  update public.payments set status = 'cancelled' where status = 'pending' and created_at < now() - interval '1 hour';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.expire_pending_payments() from public, anon, authenticated;
grant execute on function public.expire_pending_payments() to service_role;

-- A booking that finishes after the deposit was paid on the estimate is booked right away.
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'confirm_hold';
  if v_src is not null and position('_apply_paid_deposit' in v_src) = 0 then
    v_src := replace(v_src, '  select * into a from public.appointments where id = a.id;
  return jsonb_build_object(''token'', a.token, ''status'', a.status, ''display_number'', a.display_number, ''starts_at'', a.starts_at, ''ends_at'', a.ends_at, ''total'', a.total, ''deposit_required'', a.deposit_required, ''pay_choice'', a.pay_choice);',
    '  perform public._apply_paid_deposit(a.id);
  select * into a from public.appointments where id = a.id;
  return jsonb_build_object(''token'', a.token, ''status'', a.status, ''display_number'', a.display_number, ''starts_at'', a.starts_at, ''ends_at'', a.ends_at, ''total'', a.total, ''deposit_required'', a.deposit_required, ''pay_choice'', a.pay_choice);');
    execute v_src;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- The appointment carries its deposit state and payments
-- ---------------------------------------------------------------------------
create or replace function public._appointment_json(p_id uuid, p_money boolean, p_public boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'display_number', a.display_number, 'status', a.status, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'duration_minutes', a.duration_minutes,
    'hold_expires_at', a.hold_expires_at, 'source', a.source, 'size_class', a.size_class, 'pay_choice', a.pay_choice, 'intake', a.intake,
    'notes', case when p_public then null else a.notes end, 'customer_notes', a.customer_notes,
    'estimate_id', a.estimate_id, 'job_id', a.job_id, 'confirmed_at', a.confirmed_at, 'checked_in_at', a.checked_in_at, 'done_at', a.done_at, 'cancelled_at', a.cancelled_at, 'cancel_reason', a.cancel_reason,
    'created_at', a.created_at, 'updated_at', a.updated_at, 'token', case when p_public then a.token else null end,
    'subtotal', case when p_money then a.subtotal end, 'tax', case when p_money then a.tax end, 'total', case when p_money then a.total end, 'deposit_required', case when p_money then a.deposit_required end,
    'deposit_paid_at', a.deposit_paid_at,
    'deposit_paid', case when p_money then public._deposit_paid_for(a.id, a.estimate_id, null) end,
    'payments', case when p_public then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'status', p.status, 'method', p.method, 'provider', p.provider, 'paid_at', p.paid_at, 'provider_ref', p.provider_ref, 'note', p.note,
                                                                                          'amount', case when p_money then p.amount end, 'created_at', p.created_at) order by p.created_at), '[]'::jsonb)
                                                          from public.payments p where p.appointment_id = a.id or (a.estimate_id is not null and p.estimate_id = a.estimate_id and p.appointment_id is null)) end,
    'customer', (select jsonb_build_object('id', c.id, 'display_name', case when p_public then nullif(trim(c.first_name), '') else c.display_name end, 'first_name', c.first_name,
                                           'phone', case when p_public then null else c.phone end, 'email', case when p_public then null else c.email end)
                 from public.customers c where c.id = a.customer_id),
    'vehicle', (select jsonb_build_object('id', v.id, 'name', nullif(concat_ws(' ', v.year::text, v.make, v.model), ''), 'color', v.color, 'plate', case when p_public then null else v.plate end, 'size_class', v.size_class)
                from public.vehicles v where v.id = a.vehicle_id),
    'services', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'service_id', s.service_id, 'name', s.name, 'qty', s.qty, 'duration_minutes', s.duration_minutes,
                                                              'unit_price', case when p_money then s.unit_price end, 'line_total', case when p_money then s.line_total end,
                                                              'modifiers', (select coalesce(jsonb_agg(jsonb_build_object('code', m ->> 'code', 'label', m ->> 'label')), '[]'::jsonb) from jsonb_array_elements(s.modifiers) m))
                                           order by s.sort_order), '[]'::jsonb) from public.appointment_services s where s.appointment_id = a.id),
    'resources', case when p_public then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'name', r.name) order by r.kind, r.sort_order), '[]'::jsonb)
                                                           from public.appointment_resources ar join public.resources r on r.id = ar.resource_id where ar.appointment_id = a.id) end,
    'estimate', (select jsonb_build_object('id', e.id, 'display_number', e.display_number, 'status', e.status) from public.estimates e where e.id = a.estimate_id),
    'company', (select jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email, 'address_line1', c.address_line1, 'city', c.city, 'state', c.state, 'postal_code', c.postal_code, 'timezone', c.timezone) from public.companies c where c.id = a.company_id),
    'policy', (select jsonb_build_object('cancel_hours', rs.cancel_hours, 'hold_minutes', rs.hold_minutes, 'deposit_kind', rs.deposit_kind, 'deposit_value', rs.deposit_value, 'deposit_refundable', rs.deposit_refundable, 'policy_text', rs.policy_text)
               from public.retail_settings rs where rs.company_id = a.company_id),
    'can_change', a.status in ('lead', 'booked', 'confirmed') and a.starts_at > now() + make_interval(hours => (select cancel_hours from public.retail_settings where company_id = a.company_id))
  )
  from public.appointments a where a.id = p_id
$$;
revoke execute on function public._appointment_json(uuid, boolean, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The counter: balance = total − deposit; the payment lands on the ledger; the receipt is signed.
-- ---------------------------------------------------------------------------
create or replace function public._job_money(p_job uuid)
returns table (subtotal numeric, tax numeric, total numeric, deposit_paid numeric, paid numeric, balance numeric)
language sql stable security definer set search_path = public as $$
  with j as (select * from public.jobs where id = p_job),
       s as (select coalesce(sum(price), 0) as subtotal from public.job_services where job_id = p_job),
       t as (select coalesce((select a.tax from public.appointments a join j on a.id = j.appointment_id), (select e.tax from public.estimates e join j on e.job_id = j.id limit 1), 0) as tax),
       d as (select public._deposit_paid_for((select j.appointment_id from j), (select e.id from public.estimates e join j on e.job_id = j.id limit 1), p_job) as deposit_paid),
       b as (select coalesce(sum(case when p.kind = 'balance' then p.amount else 0 end), 0) as paid from public.payments p where p.job_id = p_job and p.status in ('paid', 'refunded'))
  select s.subtotal, t.tax, s.subtotal + t.tax, d.deposit_paid, b.paid, greatest(s.subtotal + t.tax - d.deposit_paid - b.paid, 0)
  from s, t, d, b
$$;
revoke execute on function public._job_money(uuid) from public, anon, authenticated;

drop function if exists public.retail_charge(uuid);
create function public.retail_charge(p_job_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare j public.jobs; v_retail boolean; m record;
begin
  select * into j from public.jobs where id = p_job_id and company_id = public.current_company_id();
  if j.id is null or not (public.is_admin() or j.detailer_id = auth.uid()) then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;
  select retail into v_retail from public.dealerships where id = j.dealership_id;
  if not coalesce(v_retail, false) then
    raise exception 'Not a retail job' using errcode = 'P0001';
  end if;
  if j.deleted_at is not null then
    raise exception 'This job is deleted' using errcode = 'P0001';
  end if;
  select * into m from public._job_money(j.id);
  return jsonb_build_object('job_id', j.id, 'tag', j.tag_number, 'vehicle', nullif(concat_ws(' ', j.year::text, j.make, j.model), ''),
                            'subtotal', m.subtotal, 'tax', m.tax, 'total', m.total, 'deposit_paid', m.deposit_paid, 'paid', m.paid, 'balance', m.balance,
                            'amount', m.balance, 'amount_cents', round(m.balance * 100)::bigint,
                            'paid_at', j.paid_at, 'receipt_signed_at', j.receipt_signed_at, 'receipt_signed_name', j.receipt_signed_name, 'has_signature', j.receipt_signature_path is not null,
                            'signature_required', coalesce((select signature_required_receipt from public.retail_settings where company_id = j.company_id), true),
                            'payments', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'status', p.status, 'method', p.method, 'amount', p.amount, 'paid_at', p.paid_at, 'provider_ref', p.provider_ref, 'note', p.note) order by p.paid_at, p.created_at), '[]'::jsonb)
                                         from public.payments p where p.status in ('paid', 'refunded') and (p.job_id = j.id or (j.appointment_id is not null and p.appointment_id = j.appointment_id))));
end $$;
grant execute on function public.retail_charge(uuid) to authenticated;

drop function if exists public.record_retail_payment(uuid, numeric, text, text);
create function public.record_retail_payment(p_job_id uuid, p_amount numeric, p_method text, p_reference text default null)
returns public.jobs language plpgsql security definer set search_path = public as $$
declare j public.jobs; v_retail boolean; m record;
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
  if p_method <> 'clover' and not public.is_owner_admin() then
    raise exception 'Only the owner or an admin records a cash or check payment' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = '22023';
  end if;
  insert into public.payments (company_id, customer_id, appointment_id, job_id, kind, status, amount, method, provider, provider_ref, paid_at, created_by)
  values (j.company_id, j.customer_id, j.appointment_id, j.id, 'balance', 'paid', round(p_amount, 2), case p_method when 'clover' then 'clover_flex' when 'cash' then 'cash' when 'check' then 'check' else 'other' end, 'none', nullif(trim(coalesce(p_reference, '')), ''), now(), auth.uid());
  select * into m from public._job_money(j.id);
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs
     set paid_at = now(), paid_amount = round(m.deposit_paid + m.paid, 2), payment_method = p_method, payment_ref = nullif(trim(coalesce(p_reference, '')), ''), paid_by = auth.uid(), updated_at = now()
   where id = j.id
   returning * into j;
  perform set_config('app.bypass_lock', 'off', true);
  if j.appointment_id is not null then
    update public.appointments set status = 'done', done_at = coalesce(done_at, now()) where id = j.appointment_id and status in ('booked', 'confirmed', 'in_progress');
  end if;
  return j;
end $$;
grant execute on function public.record_retail_payment(uuid, numeric, text, text) to authenticated;

-- The customer signs the receipt at pickup (any member who can see the job; the file sits under the job's folder).
create or replace function public.sign_receipt(p_job_id uuid, p_signature_path text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = p_job_id and company_id = public.current_company_id();
  if j.id is null or not (public.is_admin() or j.detailer_id = auth.uid()) then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then raise exception 'Please type the name' using errcode = '22023'; end if;
  if p_signature_path is null or p_signature_path not like j.company_id::text || '/receipts/' || j.id::text || '/%' then
    raise exception 'Bad signature file' using errcode = '22023';
  end if;
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs set receipt_signature_path = p_signature_path, receipt_signed_at = now(), receipt_signed_name = left(trim(p_name), 120), updated_at = now() where id = j.id;
  perform set_config('app.bypass_lock', 'off', true);
  return jsonb_build_object('job_id', j.id, 'signed_at', now());
end $$;
grant execute on function public.sign_receipt(uuid, text, text) to authenticated;

-- The receipt (staff with money, or the customer by token).
create or replace function public._receipt_json(p_job uuid, p_public boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', j.id, 'tag', j.tag_number, 'performed_at', j.performed_at, 'paid_at', j.paid_at, 'payment_method', j.payment_method,
    'vehicle', nullif(concat_ws(' ', j.year::text, j.make, j.model), ''), 'color', j.color,
    'customer', (select jsonb_build_object('id', c.id, 'display_name', case when p_public then nullif(trim(c.first_name), '') else c.display_name end, 'first_name', c.first_name, 'email', case when p_public then null else c.email end, 'phone', case when p_public then null else c.phone end) from public.customers c where c.id = j.customer_id),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(js.label, s.name), 'price', js.price) order by s.sort_order, s.name), '[]'::jsonb) from public.job_services js left join public.services s on s.id = js.service_id where js.job_id = j.id),
    'subtotal', m.subtotal, 'tax', m.tax, 'total', m.total, 'deposit_paid', m.deposit_paid, 'paid', m.paid, 'balance', m.balance,
    'tax_rate', (select tax_rate from public.companies where id = j.company_id),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('kind', p.kind, 'method', p.method, 'amount', p.amount, 'paid_at', p.paid_at, 'provider_ref', case when p_public then null else p.provider_ref end) order by p.paid_at, p.created_at), '[]'::jsonb)
                 from public.payments p where p.status in ('paid', 'refunded') and (p.job_id = j.id or (j.appointment_id is not null and p.appointment_id = j.appointment_id))),
    'signed_name', j.receipt_signed_name, 'signed_at', j.receipt_signed_at, 'has_signature', j.receipt_signature_path is not null,
    'token', case when p_public then (select rt.token from public.receipt_tokens rt where rt.job_id = j.id) else null end,
    'company', (select jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email, 'address_line1', c.address_line1, 'address_line2', c.address_line2, 'city', c.city, 'state', c.state, 'postal_code', c.postal_code, 'logo_path', c.logo_path, 'timezone', c.timezone) from public.companies c where c.id = j.company_id)
  )
  from public.jobs j, public._job_money(j.id) m where j.id = p_job
$$;
revoke execute on function public._receipt_json(uuid, boolean) from public, anon, authenticated;

create or replace function public.job_receipt(p_job_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare j public.jobs;
begin
  if not public.can_price_jobs() then raise exception 'Only the owner or an admin opens receipts' using errcode = '42501'; end if;
  select * into j from public.jobs where id = p_job_id and company_id = public.current_company_id();
  if j.id is null then raise exception 'Job not found' using errcode = 'P0002'; end if;
  return public._receipt_json(j.id, false);
end $$;
grant execute on function public.job_receipt(uuid) to authenticated;

create or replace function public.receipt_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare j public.jobs;
begin
  select x.* into j from public.jobs x join public.receipt_tokens rt on rt.job_id = x.id where rt.token = p_token and length(p_token) >= 20 and x.paid_at is not null and x.deleted_at is null;
  if j.id is null then raise exception 'Receipt not found' using errcode = 'P0002'; end if;
  return public._receipt_json(j.id, true);
end $$;
grant execute on function public.receipt_by_token(text) to anon, authenticated;

-- The receipt link for staff who may send it.
create or replace function public.receipt_link(p_job_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  if not public.is_admin() then raise exception 'Only the owner, an admin or a manager shares a receipt' using errcode = '42501'; end if;
  if not exists (select 1 from public.jobs where id = p_job_id and company_id = public.current_company_id() and paid_at is not null) then
    raise exception 'Receipt not found' using errcode = 'P0002';
  end if;
  return public._receipt_token(p_job_id);
end $$;
grant execute on function public.receipt_link(uuid) to authenticated;

-- The signature file path the receipt route needs (service role reads the storage object).
create or replace function public.receipt_signature_path(p_job_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select receipt_signature_path from public.jobs where id = p_job_id
$$;
revoke execute on function public.receipt_signature_path(uuid) from public, anon, authenticated;
grant execute on function public.receipt_signature_path(uuid) to service_role;

-- Retail money for the owner/admin: deposits outstanding, taken this week, collected this week.
create or replace function public.retail_money_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := public.current_company_id(); v_tz text; v_week timestamptz;
begin
  if not public.can_price_jobs() then raise exception 'Owner or admin only' using errcode = '42501'; end if;
  select timezone into v_tz from public.companies where id = v_company;
  v_week := (date_trunc('week', now() at time zone v_tz)) at time zone v_tz;
  return jsonb_build_object(
    'deposits_outstanding', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(a.deposit_required), 0)) from public.appointments a
                             where a.company_id = v_company and a.status in ('lead', 'booked', 'confirmed') and a.deposit_required > 0 and a.deposit_paid_at is null and a.starts_at > now() - interval '1 day'),
    'deposits_week', (select coalesce(sum(p.amount), 0) from public.payments p where p.company_id = v_company and p.kind = 'deposit' and p.status in ('paid', 'refunded') and p.paid_at >= v_week),
    'collected_week', (select coalesce(sum(case when p.kind = 'refund' then -p.amount else p.amount end), 0) from public.payments p where p.company_id = v_company and p.status in ('paid', 'refunded') and p.paid_at >= v_week),
    'pending_links', (select count(*) from public.payments p where p.company_id = v_company and p.status = 'pending')
  );
end $$;
grant execute on function public.retail_money_summary() to authenticated;

-- The customer's timeline lists their payments (money for owner/admin).
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'customer_timeline';
  if v_src is not null and position('''payments'',' in v_src) = 0 then
    v_src := replace(v_src, '    ''stats'', jsonb_build_object(', '    ''payments'', (select coalesce(jsonb_agg(jsonb_build_object(
               ''id'', pm.id, ''kind'', pm.kind, ''status'', pm.status, ''method'', pm.method, ''paid_at'', pm.paid_at, ''amount'', case when v_money then pm.amount end,
               ''appointment_id'', pm.appointment_id, ''job_id'', pm.job_id, ''estimate_id'', pm.estimate_id
             ) order by coalesce(pm.paid_at, pm.created_at) desc), ''[]''::jsonb) from public.payments pm where pm.customer_id = v_c.id and pm.status in (''paid'', ''refunded'')),
    ''stats'', jsonb_build_object(');
    execute v_src;
  end if;
end $$;
