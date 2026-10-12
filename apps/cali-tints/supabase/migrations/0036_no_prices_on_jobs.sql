-- ---------------------------------------------------------------------------
-- 0036: no prices on jobs.
--
-- Every service is billed at the price list in Settings (default price, or the
-- dealership's own price). A job never carries a price of its own: the price
-- a client sends with a list service is ignored for everyone, so there are no
-- per-job overrides and no reasons to write. The one exception is an
-- open-amount service ("Other": list 0, range 0..10000+), where the owner or
-- an admin types what was done and what it costs; everyone else leaves it for
-- them (needs_price), as before.
-- Re-runnable: create or replace.
-- ---------------------------------------------------------------------------

create or replace function public._job_service_price(
  p_dealership uuid, p_service uuid, p_sent_price numeric, p_sent_reason text,
  out o_price numeric, out o_reason text, out o_needs_price boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_list numeric; v_min numeric; v_max numeric; v_open boolean;
begin
  v_list := public.resolve_service_price(p_dealership, p_service);
  if v_list is null then
    raise exception 'Unknown service %', p_service using errcode = '22023';
  end if;
  select price_min, price_max into v_min, v_max from public.services where id = p_service;
  v_open := v_list = 0 and v_min is not null and v_max is not null and v_min = 0 and v_max >= 10000;
  o_reason := null;
  if v_open and public.can_price_jobs() and coalesce(p_sent_price, 0) > 0 then
    -- "Other" priced by the owner or an admin: the amount they typed.
    o_price := p_sent_price;
    o_needs_price := false;
  else
    -- Everything else: the price list, whatever the client sent.
    o_price := v_list;
    o_needs_price := v_open;
  end if;
end $$;
