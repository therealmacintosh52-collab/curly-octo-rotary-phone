-- =============================================================================
-- 0047 — Retail's own invoicing, apart from the dealership side
--   Every retail job (a repair order on the shop's own location) is also an
--   invoice with its own number, RI-000123, from its own counter. It is never
--   on a monthly dealership invoice and never goes to QuickBooks (close_month,
--   invoice_now and the QuickBooks sync already skip retail jobs; this file
--   keeps it that way). Paying it is what the counter card already does: the
--   deposit, the balance and the signed receipt are the invoice's payments.
--
--   * jobs.retail_invoice_number (RI-…), companies.next_retail_invoice_number,
--     assigned by a before-insert trigger exactly like the RO number; existing
--     retail jobs are numbered oldest first.
--   * jobs_filtered gets p_scope ('dealer' by default, 'retail', 'all'): the
--     dealership Jobs list no longer shows retail cars.
--   * dashboard_stats / team_dashboard / my_dashboard count dealership cars
--     only; retail_dashboard() is the retail side of the same dashboard.
--   * retail_invoices_filtered / retail_invoice_detail: the Retail → Invoices
--     list and page (owner, admin, advisor: whoever may see money).
--   * the receipt JSON carries the invoice and RO numbers.
-- Re-runnable. Nothing is dropped except the old jobs_filtered signature.
-- =============================================================================

create or replace function public._patch_function(p_name text, p_marker text, p_from text, p_to text)
returns void language plpgsql as $$
declare src text;
begin
  select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = p_name;
  if src is null then raise exception 'patch: % missing', p_name; end if;
  if position(p_marker in src) > 0 then return; end if;
  if position(p_from in src) = 0 then raise exception 'patch: % anchor not found', p_name; end if;
  execute replace(src, p_from, p_to);
end $$;

-- ---------------------------------------------------------------------------
-- Invoice numbers, RI-000123
-- ---------------------------------------------------------------------------
alter table public.companies add column if not exists next_retail_invoice_number integer not null default 1;
alter table public.jobs add column if not exists retail_invoice_number text;
create unique index if not exists jobs_retail_invoice_number_idx on public.jobs (company_id, retail_invoice_number) where retail_invoice_number is not null;

create or replace function public._next_retail_invoice_number(p_company uuid)
returns text language plpgsql as $$
declare v_num integer;
begin
  update public.companies set next_retail_invoice_number = next_retail_invoice_number + 1 where id = p_company returning next_retail_invoice_number - 1 into v_num;
  return 'RI-' || lpad(v_num::text, 6, '0');
end $$;
revoke execute on function public._next_retail_invoice_number(uuid) from public, anon, authenticated;

create or replace function public.tg_job_retail_invoice_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.retail_invoice_number is null and exists (select 1 from public.dealerships d where d.id = new.dealership_id and d.retail) then
    new.retail_invoice_number := public._next_retail_invoice_number(new.company_id);
  end if;
  return new;
end $$;
drop trigger if exists retail_invoice_number on public.jobs;
create trigger retail_invoice_number before insert on public.jobs for each row execute function public.tg_job_retail_invoice_number();

do $$
declare r record;
begin
  perform set_config('app.bypass_lock', 'on', true);
  for r in select j.id, j.company_id from public.jobs j join public.dealerships d on d.id = j.dealership_id
           where d.retail and j.retail_invoice_number is null order by j.company_id, j.performed_at, j.created_at loop
    update public.jobs set retail_invoice_number = public._next_retail_invoice_number(r.company_id) where id = r.id;
  end loop;
  perform set_config('app.bypass_lock', 'off', true);
end $$;

-- ---------------------------------------------------------------------------
-- The dealership Jobs list leaves retail alone (p_scope: dealer | retail | all)
-- ---------------------------------------------------------------------------
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'jobs_filtered';
  if v_src is not null and position('p_scope' in v_src) = 0 then
    drop function public.jobs_filtered(text, uuid, uuid, uuid, date, date, text, integer, integer);
    v_src := replace(v_src, 'p_offset integer DEFAULT 0)', 'p_offset integer DEFAULT 0, p_scope text DEFAULT ''dealer''::text)');
    v_src := replace(v_src, 'and (p_dealership is null or j.dealership_id = p_dealership)', 'and (coalesce(p_scope, ''dealer'') = ''all'' or (coalesce(p_scope, ''dealer'') = ''retail'') = d.retail)
      and (p_dealership is null or j.dealership_id = p_dealership)');
    v_src := replace(v_src, '''retail'', b.retail,', '''retail'', b.retail, ''retail_invoice_number'', b.retail_invoice_number,');
    execute v_src;
  end if;
end $$;
revoke all on function public.jobs_filtered(text, uuid, uuid, uuid, date, date, text, integer, integer, text) from public, anon;
grant execute on function public.jobs_filtered(text, uuid, uuid, uuid, date, date, text, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The dealership dashboards count dealership cars only
-- ---------------------------------------------------------------------------
select public._patch_function('dashboard_stats', 'and not exists (select 1 from public.dealerships dd', 'where j.company_id = v_company and j.deleted_at is null
  ),
  pay as (', 'where j.company_id = v_company and j.deleted_at is null
      and not exists (select 1 from public.dealerships dd where dd.id = j.dealership_id and dd.retail)
  ),
  pay as (');
select public._patch_function('team_dashboard', 'and not exists (select 1 from public.dealerships dd', 'where j.company_id = v_company and j.deleted_at is null
  )', 'where j.company_id = v_company and j.deleted_at is null
      and not exists (select 1 from public.dealerships dd where dd.id = j.dealership_id and dd.retail)
  )');
select public._patch_function('my_dashboard', 'and not exists (select 1 from public.dealerships dd', 'where j.company_id = v_company and j.detailer_id = v_uid and j.deleted_at is null
  )', 'where j.company_id = v_company and j.detailer_id = v_uid and j.deleted_at is null
      and not exists (select 1 from public.dealerships dd where dd.id = j.dealership_id and dd.retail)
  )');

-- ---------------------------------------------------------------------------
-- Status of a retail invoice
--   void: the job was deleted · paid: the counter closed it · partial: a
--   deposit or part is in · unpaid: nothing yet
-- ---------------------------------------------------------------------------
create or replace function public._retail_invoice_status(p_deleted boolean, p_paid_at timestamptz, p_received numeric)
returns text language sql immutable as $$
  select case when p_deleted then 'void' when p_paid_at is not null then 'paid' when coalesce(p_received, 0) > 0 then 'partial' else 'unpaid' end
$$;

-- The list: owner, admin, advisor (whoever may see money).
create or replace function public.retail_invoices_filtered(p_q text default null, p_status text default 'open', p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_q       text := nullif(trim(coalesce(p_q, '')), '');
  v_out     jsonb;
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor opens retail invoices' using errcode = '42501'; end if;
  with base as (
    select j.id, j.performed_at, j.retail_invoice_number, j.ro_number, j.tag_number, j.paid_at, j.deleted_at,
           nullif(concat_ws(' ', j.year::text, j.make, j.model), '') as vehicle,
           c.id as customer_id, c.display_name as customer,
           m.total, m.deposit_paid, m.paid, m.balance,
           public._retail_invoice_status(j.deleted_at is not null, j.paid_at, m.deposit_paid + m.paid) as status
    from public.jobs j
    join public.dealerships d on d.id = j.dealership_id and d.retail
    left join public.customers c on c.id = j.customer_id
    cross join lateral public._job_money(j.id) m
    where j.company_id = v_company and j.retail_invoice_number is not null
      and (v_q is null
           or j.retail_invoice_number ilike '%' || v_q || '%' or j.ro_number ilike '%' || v_q || '%' or j.tag_number ilike '%' || v_q || '%'
           or j.make ilike '%' || v_q || '%' or j.model ilike '%' || v_q || '%' or j.vin ilike '%' || v_q || '%'
           or c.display_name ilike '%' || v_q || '%'
           or (public.phone_digits(v_q) is not null and length(public.phone_digits(v_q)) >= 3 and c.phone_digits like '%' || public.phone_digits(v_q) || '%'))
  ), shown as (
    select * from base
    where case coalesce(p_status, 'open')
            when 'open' then status in ('unpaid', 'partial')
            when 'all' then true
            else status = p_status end
  )
  select jsonb_build_object(
    'count', (select count(*) from shown),
    'unpaid_total', (select coalesce(sum(balance), 0) from base where status in ('unpaid', 'partial')),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'number', s.retail_invoice_number, 'ro_number', s.ro_number, 'tag', s.tag_number, 'performed_at', s.performed_at,
               'customer_id', s.customer_id, 'customer', s.customer, 'vehicle', s.vehicle, 'status', s.status,
               'total', s.total, 'deposit_paid', s.deposit_paid, 'paid', s.paid, 'balance', s.balance, 'paid_at', s.paid_at
             ) order by s.performed_at desc, s.retail_invoice_number desc), '[]'::jsonb)
             from (select * from shown order by performed_at desc, retail_invoice_number desc
                   limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))) s)
  ) into v_out;
  return v_out;
end $$;
revoke execute on function public.retail_invoices_filtered(text, text, integer, integer) from public, anon;
grant execute on function public.retail_invoices_filtered(text, text, integer, integer) to authenticated;

-- One invoice (the job id is its address): the receipt body plus the invoice fields.
create or replace function public.retail_invoice_detail(p_job_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare j public.jobs; v_retail boolean;
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor opens retail invoices' using errcode = '42501'; end if;
  select * into j from public.jobs where id = p_job_id and company_id = public.current_company_id();
  if j.id is null then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  select retail into v_retail from public.dealerships where id = j.dealership_id;
  if not coalesce(v_retail, false) or j.retail_invoice_number is null then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  return public._receipt_json(j.id, false) || jsonb_build_object(
    'status', public._retail_invoice_status(j.deleted_at is not null, j.paid_at, (select m.deposit_paid + m.paid from public._job_money(j.id) m)),
    'invoice_number', j.retail_invoice_number, 'ro_number', j.ro_number, 'job_id', j.id, 'deleted', j.deleted_at is not null);
end $$;
revoke execute on function public.retail_invoice_detail(uuid) from public, anon;
grant execute on function public.retail_invoice_detail(uuid) to authenticated;

-- The receipt body carries the numbers too (customer page and PDF title).
select public._patch_function('_receipt_json', '''invoice_number'',', '''id'', j.id, ''tag'', j.tag_number,', '''id'', j.id, ''invoice_number'', j.retail_invoice_number, ''ro_number'', j.ro_number, ''tag'', j.tag_number,');

-- ---------------------------------------------------------------------------
-- The retail side of the dashboard
--   Counts for every admin-side role; the money only for whoever may see it.
-- ---------------------------------------------------------------------------
create or replace function public.retail_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_tz      text;
  v_today   date;
  v_week0   timestamptz;
  v_month0  date;
  v_money   boolean := public.can_price_jobs();
  v_out     jsonb;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  select timezone into v_tz from public.companies where id = v_company;
  v_today := (now() at time zone v_tz)::date;
  v_month0 := date_trunc('month', v_today)::date;
  v_week0 := (date_trunc('week', now() at time zone v_tz)) at time zone v_tz;

  with r as (
    select j.id, j.paid_at, (j.performed_at at time zone v_tz)::date as d, public._retail_invoice_status(false, j.paid_at, m.deposit_paid + m.paid) as status, m.balance
    from public.jobs j
    join public.dealerships dd on dd.id = j.dealership_id and dd.retail
    cross join lateral public._job_money(j.id) m
    where j.company_id = v_company and j.deleted_at is null
  )
  select jsonb_build_object(
    'today', jsonb_build_object('cars', (select count(*) from r where d = v_today)),
    'month', jsonb_build_object('cars', (select count(*) from r where d >= v_month0 and d <= v_today)),
    'open_jobs', (select count(*) from r where status <> 'paid'),
    'appointments_today', (select count(*) from public.appointments a where a.company_id = v_company and a.status in ('booked', 'confirmed', 'in_progress') and (a.starts_at at time zone v_tz)::date = v_today),
    'money', case when v_money then jsonb_build_object(
        'collected_week', (select coalesce(sum(case when p.kind = 'refund' then -p.amount else p.amount end), 0) from public.payments p where p.company_id = v_company and p.status in ('paid', 'refunded') and p.paid_at >= v_week0),
        'collected_month', (select coalesce(sum(case when p.kind = 'refund' then -p.amount else p.amount end), 0) from public.payments p where p.company_id = v_company and p.status in ('paid', 'refunded') and (p.paid_at at time zone v_tz)::date >= v_month0),
        'unpaid_invoices', (select count(*) from r where status in ('unpaid', 'partial')),
        'unpaid_total', (select coalesce(sum(balance), 0) from r where status in ('unpaid', 'partial')),
        'deposits_outstanding', (select coalesce(sum(a.deposit_required), 0) from public.appointments a where a.company_id = v_company and a.status in ('lead', 'booked', 'confirmed') and a.deposit_required > 0 and a.deposit_paid_at is null and a.starts_at > now() - interval '1 day')
      ) else null end
  ) into v_out;
  return v_out;
end $$;
revoke execute on function public.retail_dashboard() from public, anon;
grant execute on function public.retail_dashboard() to authenticated;

drop function public._patch_function(text, text, text, text);
