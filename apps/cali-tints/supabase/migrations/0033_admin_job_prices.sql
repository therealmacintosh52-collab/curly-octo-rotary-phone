-- =============================================================================
-- 0033 — Owner and admin see prices on jobs
--   Prices on a job (the price list, the lines on the job page, overriding a
--   price with a reason) are for the owner and admins. Invoices, payments,
--   income, the price-list settings and the export stay the owner's alone;
--   managers and detailers still see no money at all.
-- Re-runnable.
-- =============================================================================

-- "May see and set the price on a job": owner or admin.
create or replace function public.can_price_jobs()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_owner_admin()
$$;
grant execute on function public.can_price_jobs() to authenticated, service_role;

-- The price list carries prices for owner and admin.
drop function if exists public.dealership_price_list(uuid);
create function public.dealership_price_list(p_dealership_id uuid)
returns table (service_id uuid, name text, description text, category text, price numeric, price_min numeric, price_max numeric, is_override boolean, sort_order integer, open_amount boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.category,
         case when public.can_price_jobs() then coalesce(dsp.price, s.default_price) end as price,
         case when public.can_price_jobs() then s.price_min end as price_min,
         case when public.can_price_jobs() then s.price_max end as price_max,
         public.can_price_jobs() and dsp.price is not null as is_override,
         s.sort_order,
         s.default_price = 0 and s.price_min = 0 and s.price_max >= 10000 as open_amount
  from public.services s
  join public.dealerships d on d.id = p_dealership_id and d.company_id = s.company_id
  left join public.dealership_service_prices dsp on dsp.service_id = s.id and dsp.dealership_id = d.id
  where s.company_id = public.current_company_id() and s.active
  order by s.sort_order, s.name;
$$;
grant execute on function public.dealership_price_list(uuid) to authenticated, service_role;

-- The job-line price view opens to admins (the settings price view stays the owner's).
drop view if exists public.job_service_prices_v;
create view public.job_service_prices_v with (security_barrier = true) as
  select js.id as job_service_id, js.job_id, js.service_id, js.company_id, j.dealership_id, j.invoice_id, j.deleted_at,
         js.price, js.override_reason, js.needs_price
  from public.job_services js
  join public.jobs j on j.id = js.job_id
  where js.company_id = public.current_company_id() and public.can_price_jobs();
grant select on public.job_service_prices_v to authenticated, service_role;

-- Owner and admin may send a price (override with a reason) when logging or editing a job.
create or replace function public._job_service_price(
  p_dealership uuid, p_service uuid, p_sent_price numeric, p_sent_reason text,
  out o_price numeric, out o_reason text, out o_needs_price boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_list numeric; v_min numeric; v_max numeric;
begin
  v_list := public.resolve_service_price(p_dealership, p_service);
  if v_list is null then
    raise exception 'Unknown service %', p_service using errcode = '22023';
  end if;
  select price_min, price_max into v_min, v_max from public.services where id = p_service;
  if public.can_price_jobs() then
    o_price  := coalesce(p_sent_price, v_list);
    o_reason := nullif(trim(p_sent_reason), '');
    if not public.price_within_policy(p_service, v_list, o_price) and o_reason is null then
      raise exception 'A reason is required when overriding the price' using errcode = '22023';
    end if;
    if o_price = v_list then o_reason := null; end if;
    o_needs_price := false;
  else
    o_price  := v_list;
    o_reason := null;
    -- "Other": no list price and an open range → the owner or an admin fills in the amount.
    o_needs_price := v_list = 0 and v_min is not null and v_max is not null and v_min = 0 and v_max >= 10000;
  end if;
end $$;

-- Which open jobs still need a price: owner and admin.
create or replace function public.jobs_needing_price()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.job_services js join public.jobs j on j.id = js.job_id
  where js.company_id = public.current_company_id() and public.can_price_jobs() and js.needs_price and j.deleted_at is null and j.invoice_id is null;
$$;
grant execute on function public.jobs_needing_price() to authenticated;
