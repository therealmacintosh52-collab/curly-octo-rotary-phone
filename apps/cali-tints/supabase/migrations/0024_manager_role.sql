-- =============================================================================
-- 0024 — Manager role
--   A manager runs the day: the owner's dashboard, every invoice, the
--   Terminal, sending and collecting. Settings (company, dealerships, prices,
--   users, Clover, export) stay with owner and admin.
--   * user_role gains 'manager'.
--   * is_admin() (invoices, payments, terminal, dashboards) now includes
--     managers; is_owner_admin() is the stricter check for settings tables.
--   Role literals are compared as text so this file runs inside one
--   transaction with the enum change.
-- Re-runnable.
-- =============================================================================

alter type public.user_role add value if not exists 'manager';

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('owner','admin','manager') from public.profiles where id = auth.uid() and active), false)
$$;

create or replace function public.is_owner_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('owner','admin') from public.profiles where id = auth.uid() and active), false)
$$;
grant execute on function public.is_owner_admin() to authenticated, service_role;

-- Settings tables: owner and admin only.
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated
  using (id = public.current_company_id() and public.is_owner_admin())
  with check (id = public.current_company_id());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (company_id = public.current_company_id() and (id = auth.uid() or public.is_owner_admin()))
  with check (company_id = public.current_company_id());

drop policy if exists dealerships_admin on public.dealerships;
create policy dealerships_admin on public.dealerships for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner_admin())
  with check (company_id = public.current_company_id() and public.is_owner_admin());

drop policy if exists services_admin on public.services;
create policy services_admin on public.services for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner_admin())
  with check (company_id = public.current_company_id() and public.is_owner_admin());

drop policy if exists dsp_admin on public.dealership_service_prices;
create policy dsp_admin on public.dealership_service_prices for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner_admin())
  with check (company_id = public.current_company_id() and public.is_owner_admin());

-- Only owner/admin may change someone's role, company or active flag.
create or replace function public.tg_guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role::text into v_role from public.profiles where id = auth.uid();
  if auth.uid() is null or v_role in ('owner','admin') then
    return new;
  end if;
  if new.role <> old.role or new.company_id <> old.company_id or new.active <> old.active then
    raise exception 'Only admins can change role, company or active status' using errcode = '42501';
  end if;
  return new;
end $$;
