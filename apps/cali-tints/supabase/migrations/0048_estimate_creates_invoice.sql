-- =============================================================================
-- 0048 — A retail customer starts with an estimate; approving it makes the invoice
--   The customer approves and signs the estimate (on their phone or at the
--   counter) and the retail job — the work and its invoice, RI-… — is created
--   at that moment with the approved lines at the quoted prices, the deposit
--   applied. A supplement estimate lands on the repair order it was written for.
--   Nothing about this touches the dealership Jobs flow, the monthly invoices or
--   QuickBooks.
--   * _convert_estimate_core(): the conversion from 0044 without the role gate
--     (the customer's approval has no signed-in user: the owner holds the work
--     until an admin reassigns it). convert_estimate_to_job stays the gated
--     wrapper (it is only the fallback now).
--   * estimate_respond / mark_estimate_accepted call it once the estimate is
--     accepted. A failure there never undoes the approval.
--   * create_job refuses the retail location: retail work starts from an
--     estimate (or a booked appointment's check-in). Tests and internal tools
--     may set app.allow_retail_job = 'on'.
-- Re-runnable.
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

CREATE OR REPLACE FUNCTION public._convert_estimate_core(p_id uuid, p jsonb, p_actor uuid)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid;
  v_uid     uuid := p_actor;
  e         public.estimates;
  v_dealer  public.dealerships;
  v_veh     public.vehicles;
  v_detailer uuid := v_uid;
  j         public.jobs;
  l         record;
  v_svc     uuid;
  v_label   text;
  v_sup     numeric;
  v_n       integer := 0;
begin
  select * into e from public.estimates where id = p_id;
  if not found then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  v_company := e.company_id;
  -- an approval from the customer's phone has no signed-in user: the owner holds the work until an admin reassigns it
  if v_uid is null then
    select id into v_detailer from public.profiles where company_id = v_company and role::text = 'owner' and active order by created_at limit 1;
    v_uid := v_detailer;
  end if;
  if e.status <> 'accepted' then
    raise exception 'Only an accepted estimate becomes a job' using errcode = 'P0001';
  end if;
  if e.job_id is not null then
    select * into j from public.jobs where id = e.job_id;
    if e.applied_at is not null then return j; end if;
    if j.deleted_at is not null or j.paid_at is not null then
      raise exception 'That repair order is closed' using errcode = 'P0001';
    end if;
  else
    select * into v_dealer from public.dealerships
     where company_id = v_company and active and retail and (nullif(p ->> 'dealership_id', '') is null or id = (p ->> 'dealership_id')::uuid)
     order by name limit 1;
    if v_dealer.id is null then
      raise exception 'No retail location is set up (Settings → Dealerships → Retail)' using errcode = 'P0001';
    end if;
    if nullif(p ->> 'detailer_id', '') is not null and exists (select 1 from public.profiles where id = (p ->> 'detailer_id')::uuid and company_id = v_company) then
      v_detailer := (p ->> 'detailer_id')::uuid;
    end if;
    if e.vehicle_id is not null then
      select * into v_veh from public.vehicles where id = e.vehicle_id;
    end if;
    insert into public.jobs (company_id, dealership_id, detailer_id, client_id, tag_number, vin, year, make, model, color, performed_at, notes, customer_id, vehicle_id, created_by, updated_by)
    values (v_company, v_dealer.id, v_detailer, gen_random_uuid(),
            coalesce(nullif(upper(trim(p ->> 'tag_number')), ''), replace(e.display_number, 'EST-', 'E-')),
            v_veh.vin, v_veh.year, v_veh.make, v_veh.model, v_veh.color,
            coalesce(nullif(p ->> 'performed_at', '')::timestamptz, now()),
            coalesce(nullif(trim(p ->> 'notes'), ''), e.customer_notes),
            e.customer_id, e.vehicle_id, v_uid, v_uid)
    returning * into j;
  end if;

  perform set_config('app.bypass_lock', 'on', true);
  for l in
    select el.*, s.default_price = 0 and s.price_min = 0 and s.price_max >= 10000 as open_amount, s.name as service_name
    from public.estimate_lines el left join public.services s on s.id = el.service_id
    where el.estimate_id = p_id
      and ((el.option_id = e.selected_option_id and el.customer_approved is not false) or (el.option_id is null and el.customer_approved is true))
    order by el.option_id nulls last, el.sort_order
  loop
    if l.line_type = 'service' then
      if l.service_id is null then continue; end if;
      v_svc := l.service_id;
      v_label := case when coalesce(l.open_amount, false) or l.name <> l.service_name then left(l.name, 120) end;
      -- a catalog service already on the job keeps its line; the price stays as quoted
      if v_label is null and exists (select 1 from public.job_services js where js.job_id = j.id and js.service_id = v_svc and js.label is null) then continue; end if;
    else
      v_svc := public._estimate_system_service(e.company_id, l.line_type);
      v_label := left(case l.line_type
        when 'labor' then l.name || ' — ' || trim(to_char(l.hours, 'FM9990.00')) || ' h @ $' || trim(to_char(l.rate, 'FM9990.00'))
        when 'part' then l.name || case when l.part_number is not null then ' (' || l.part_number || coalesce(', ' || l.vendor, '') || ')' when l.vendor is not null then ' (' || l.vendor || ')' else '' end || case when l.qty <> 1 then ' × ' || trim(to_char(l.qty, 'FM9990.##')) else '' end
        when 'sublet' then l.name || case when l.vendor is not null then ' (' || l.vendor || ')' else '' end
        else l.name end, 120);
    end if;
    insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price)
    values (e.company_id, j.id, v_svc, l.line_total, null, v_label, false);
    v_n := v_n + 1;
  end loop;
  select shop_supplies into v_sup from public.estimate_options where id = e.selected_option_id;
  if coalesce(v_sup, 0) > 0 then
    insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price)
    values (e.company_id, j.id, public._estimate_system_service(e.company_id, 'shop_supplies'), v_sup, null, 'Shop supplies', false);
  end if;
  update public.jobs set updated_by = v_uid where id = j.id;
  perform set_config('app.bypass_lock', 'off', true);

  update public.estimates set job_id = j.id, applied_at = now() where id = p_id;
  update public.job_findings f set status = 'done' where false;  -- findings stay "approved" until the tech marks them done
  select * into j from public.jobs where id = j.id;
  return j;
end $function$

;
revoke execute on function public._convert_estimate_core(uuid, jsonb, uuid) from public, anon, authenticated;

-- The staff button (fallback): same conversion, behind the same gate as before.
create or replace function public.convert_estimate_to_job(p_id uuid, p jsonb default '{}'::jsonb)
returns public.jobs language plpgsql security definer set search_path = public as $$
begin
  if not public.can_price_jobs() then
    raise exception 'Only the owner, an admin or an advisor converts an estimate' using errcode = '42501';
  end if;
  if not exists (select 1 from public.estimates where id = p_id and company_id = public.current_company_id()) then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  return public._convert_estimate_core(p_id, p, auth.uid());
end $$;
grant execute on function public.convert_estimate_to_job(uuid, jsonb) to authenticated;

-- Approval makes the invoice. A problem here (no retail location set up, a closed repair order) leaves the approval standing;
-- the estimate page then offers "Create the invoice" to retry.
create or replace function public._auto_invoice_estimate(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public._convert_estimate_core(p_id, '{}'::jsonb, auth.uid());
  exception when others then
    raise notice 'estimate % was approved but the invoice was not created: %', p_id, sqlerrm;
  end;
end $$;
revoke execute on function public._auto_invoice_estimate(uuid) from public, anon, authenticated;

do $$
begin
  perform public._patch_function('estimate_respond', '_auto_invoice_estimate',
    '  return jsonb_build_object(''status'', ''accepted'', ''total'', e.total,',
    '  perform public._auto_invoice_estimate(e.id);
  return jsonb_build_object(''status'', ''accepted'', ''total'', e.total,');
  perform public._patch_function('mark_estimate_accepted', '_auto_invoice_estimate',
    '          coalesce(p_method, ''in_person''), auth.uid(), p_option, coalesce(p_line_ids, ''{}''), e.total);
  return e;',
    '          coalesce(p_method, ''in_person''), auth.uid(), p_option, coalesce(p_line_ids, ''{}''), e.total);
  perform public._auto_invoice_estimate(p_id);
  select * into e from public.estimates where id = p_id;
  return e;');
  -- Retail work starts from an estimate (or an appointment's check-in): the plain job log refuses the retail location.
  perform public._patch_function('create_job', 'app.allow_retail_job',
    '  v_detailer := v_uid;
  if public.is_admin() and nullif(p ->> ''detailer_id'', '''') is not null then',
    '  if v_dealer.retail and coalesce(current_setting(''app.allow_retail_job'', true), '''') <> ''on'' then
    raise exception ''Retail work starts from an estimate'' using errcode = ''P0001'';
  end if;
  v_detailer := v_uid;
  if public.is_admin() and nullif(p ->> ''detailer_id'', '''') is not null then');
end $$;

-- The estimate's job block carries the invoice number (the estimate page links to it).
select public._patch_function('_estimate_json', '''invoice_number'', j.retail_invoice_number',
  '''job'', (select jsonb_build_object(''id'', j.id, ''ro_number'', j.ro_number,',
  '''job'', (select jsonb_build_object(''id'', j.id, ''ro_number'', j.ro_number, ''invoice_number'', j.retail_invoice_number,');

drop function public._patch_function(text, text, text, text);
