-- =============================================================================
-- 0016 — Invoices search matches services too
--   "loaner", "pdi", "paint" in the search box find the invoices carrying
--   that service. Same function as 0015 with one more ilike on
--   invoice_items.service_name. Re-runnable.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- The one list (re-created from 0015: the search also matches service names). Returns {count, total, balance, rows}. Statuses:
--   all (not void) | unpaid (draft+submitted+partial) | outstanding
--   (submitted+partial) | draft | submitted | partial | overdue | paid | void
-- Detailers get only the invoices that carry their cars.
-- ---------------------------------------------------------------------------
create or replace function public.invoices_filtered(
  p_q text default null, p_service uuid default null, p_dealership uuid default null, p_detailer uuid default null,
  p_from date default null, p_to date default null, p_status text default 'all',
  p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_uid     uuid := auth.uid();
  v_admin   boolean := public.is_admin();
  v_days    integer;
  v_q       text := nullif(trim(coalesce(p_q, '')), '');
  v_out     jsonb;
begin
  if v_company is null then
    raise exception 'Not a member of any company' using errcode = '42501';
  end if;
  select reminder_days into v_days from public.companies where id = v_company;

  with base as (
    select i.*,
           d.name as dealership_name,
           coalesce(i.status in ('submitted','partial') and i.submitted_at < now() - make_interval(days => v_days), false) as overdue
    from public.invoices i
    join public.dealerships d on d.id = i.dealership_id
    where i.company_id = v_company
      and (v_admin or exists (select 1 from public.jobs j where j.invoice_id = i.id and j.detailer_id = v_uid))
      and (case coalesce(p_status, 'all')
             when 'all'       then i.status <> 'void'
             when 'unpaid'    then i.status in ('draft','submitted','partial')
             when 'outstanding' then i.status in ('submitted','partial')
             when 'overdue'   then i.status in ('submitted','partial') and i.submitted_at < now() - make_interval(days => v_days)
             when 'draft'     then i.status = 'draft'
             when 'submitted' then i.status = 'submitted'
             when 'partial'   then i.status = 'partial'
             when 'paid'      then i.status = 'paid'
             when 'void'      then i.status = 'void'
             else true end)
      and (p_dealership is null or i.dealership_id = p_dealership)
      and (p_from is null or i.period_end >= p_from)
      and (p_to is null or i.period_start <= p_to)
      and (p_detailer is null or exists (select 1 from public.jobs j where j.invoice_id = i.id and j.detailer_id = p_detailer))
      and (p_service is null or exists (select 1 from public.invoice_items ii join public.job_services js on js.id = ii.job_service_id
                                        where ii.invoice_id = i.id and js.service_id = p_service))
      and (v_q is null
           or i.display_number ilike '%' || v_q || '%'
           or i.ro_po_number ilike '%' || v_q || '%'
           or exists (select 1 from public.invoice_items ii where ii.invoice_id = i.id
                      and (ii.tag_number ilike '%' || v_q || '%' or ii.vin ilike '%' || v_q || '%'
                           or ii.model ilike '%' || v_q || '%' or ii.ro_po_number ilike '%' || v_q || '%'
                           or ii.service_name ilike '%' || v_q || '%')))
  ),
  pagen as (
    select * from base order by number desc limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'count',   (select count(*) from base),
    'total',   (select coalesce(sum(total), 0) from base),
    'balance', (select coalesce(sum(total - amount_paid), 0) from base where status in ('draft','submitted','partial')),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
               'id', b.id,
               'display_number', b.display_number,
               'status', b.status,
               'overdue', b.overdue,
               'total', b.total,
               'amount_paid', b.amount_paid,
               'balance', b.total - b.amount_paid,
               'period_start', b.period_start,
               'period_end', b.period_end,
               'ro_po_number', b.ro_po_number,
               'submitted_at', b.submitted_at,
               'paid_at', b.paid_at,
               'created_at', b.created_at,
               'dealership_id', b.dealership_id,
               'dealership', b.dealership_name,
               'car_count', (select count(distinct ii.job_id) from public.invoice_items ii where ii.invoice_id = b.id),
               'cars', (select coalesce(jsonb_agg(jsonb_build_object('tag', c.tag_number, 'vin', c.vin,
                                 'vehicle', nullif(concat_ws(' ', c.year, c.make, c.model), ''), 'detailer', c.detailer_name)
                                 order by c.performed_at, c.tag_number), '[]'::jsonb)
                        from (select distinct on (ii.job_id) ii.job_id, ii.tag_number, ii.vin, ii.year, ii.make, ii.model, ii.detailer_name, ii.performed_at
                              from public.invoice_items ii where ii.invoice_id = b.id order by ii.job_id, ii.sort_order limit 4) c),
               'services', (select coalesce(jsonb_agg(distinct ii.service_name), '[]'::jsonb) from public.invoice_items ii where ii.invoice_id = b.id)
             ) order by b.number desc), '[]'::jsonb) from pagen b)
  ) into v_out;

  return v_out;
end $$;
grant execute on function public.invoices_filtered(text, uuid, uuid, uuid, date, date, text, integer, integer) to authenticated, service_role;

