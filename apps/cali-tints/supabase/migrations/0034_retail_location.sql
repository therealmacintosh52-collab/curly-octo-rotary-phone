-- =============================================================================
-- 0034 — The shop as a location: retail jobs paid at the counter
--   A dealership row flagged `retail` is the company's own shop (Cali Tint ·
--   Fulton Ave). Its jobs are walk-in customers: logged the same way, but
--   never put on a monthly invoice or into the QuickBooks month invoice.
--   They are paid on the Clover at the counter (the Clover app launches the
--   device's payment screen) or recorded as cash/check, and the job keeps
--   the payment.
-- Re-runnable.
-- =============================================================================

alter table public.dealerships add column if not exists retail boolean not null default false;

alter table public.jobs add column if not exists paid_at timestamptz;
alter table public.jobs add column if not exists paid_amount numeric(12,2);
alter table public.jobs add column if not exists payment_method text check (payment_method is null or payment_method in ('clover', 'cash', 'check', 'other'));
alter table public.jobs add column if not exists payment_ref text;
alter table public.jobs add column if not exists paid_by uuid references public.profiles (id);

-- The month close skips retail: nothing to invoice a dealership for.
create or replace function public.close_month(p_company uuid, p_through date default null)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  v_tz     text;
  v_cutoff date;
  r        record;
begin
  select timezone into v_tz from public.companies where id = p_company;
  if v_tz is null then
    raise exception 'Unknown company' using errcode = '22023';
  end if;
  v_cutoff := date_trunc('month', coalesce(p_through, (now() at time zone v_tz)::date))::date;

  for r in
    select j.dealership_id,
           date_trunc('month', (j.performed_at at time zone v_tz)::date)::date as m0,
           array_agg(j.id order by j.performed_at, j.tag_number) as ids
    from public.jobs j
    join public.dealerships d on d.id = j.dealership_id
    where j.company_id = p_company and j.deleted_at is null and j.invoice_id is null
      and not d.retail
      and (j.performed_at at time zone v_tz)::date < v_cutoff
    group by j.dealership_id, 2, d.name
    order by 2, d.name
  loop
    return next public._create_invoice_from_jobs(p_company, r.dealership_id, r.ids, r.m0, (r.m0 + interval '1 month - 1 day')::date, null, null);
  end loop;
  return;
end $$;
revoke all on function public.close_month(uuid, date) from public, anon, authenticated;
grant execute on function public.close_month(uuid, date) to service_role;

-- Invoice now refuses the shop.
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'invoice_now';
  if v_src is not null and position('Retail jobs are paid at the counter' in v_src) = 0 and position('perform public.assert_owner();' in v_src) > 0 then
    execute replace(v_src, 'perform public.assert_owner();',
      'perform public.assert_owner(); if exists (select 1 from public.dealerships where id = p_dealership_id and retail) then raise exception ''Retail jobs are paid at the counter, not invoiced'' using errcode = ''P0001''; end if;');
  end if;
end $$;

-- The Jobs list knows which rows are retail and whether they are paid.
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'jobs_filtered';
  if v_src is not null and position('''retail''' in v_src) = 0 then
    v_src := replace(v_src, 'd.name as dealership_name,', 'd.name as dealership_name, d.retail,');
    v_src := replace(v_src, '''quickbooks_doc_number'', b.quickbooks_doc_number,', '''quickbooks_doc_number'', b.quickbooks_doc_number, ''retail'', b.retail, ''paid_at'', b.paid_at,');
    execute v_src;
  end if;
end $$;

-- What to charge at the counter for a retail job (the Clover shows it anyway): any member who can see the job.
create or replace function public.retail_charge(p_job_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare j public.jobs; v_retail boolean; v_amount numeric;
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
  if j.paid_at is not null then
    raise exception 'Already paid' using errcode = 'P0001';
  end if;
  select coalesce(sum(price), 0) into v_amount from public.job_services where job_id = j.id;
  return jsonb_build_object('job_id', j.id, 'tag', j.tag_number, 'vehicle', nullif(concat_ws(' ', j.year::text, j.make, j.model), ''),
                            'amount', v_amount, 'amount_cents', round(v_amount * 100)::bigint);
end $$;
grant execute on function public.retail_charge(uuid) to authenticated;

-- Record the counter payment on the job: the Clover's result, or cash/check by hand (owner, admin).
create or replace function public.record_retail_payment(p_job_id uuid, p_amount numeric, p_method text, p_reference text default null)
returns public.jobs language plpgsql security definer set search_path = public as $$
declare j public.jobs; v_retail boolean;
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
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs
     set paid_at = now(), paid_amount = round(p_amount, 2), payment_method = p_method, payment_ref = nullif(trim(coalesce(p_reference, '')), ''), paid_by = auth.uid(), updated_at = now()
   where id = j.id
   returning * into j;
  perform set_config('app.bypass_lock', 'off', true);
  return j;
end $$;
grant execute on function public.record_retail_payment(uuid, numeric, text, text) to authenticated;
