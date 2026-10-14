-- =============================================================================
-- 0061 — The fields the shop's own screens show on a work order
--   * estimates.label (VIP Customer, Drop-off, Waiting, Fleet), due_in / due_out,
--     status_label (Checked in, Needs parts ordered, …; a transfer sets it),
--     parts_status (none, needed, ordered, arrived), fleet_number
--   * set_estimate_meta: owner/admin/advisor set everything; a tech sets the status
--     word and the parts status
--   * list rows carry label, status_label, parts_status, due dates and the latest note
--   * the estimate JSON carries the same, the customer's previous visits and source,
--     and the mileage out
-- Re-runnable.
-- =============================================================================

create or replace function public._patch_function(p_name text, p_marker text, p_from text, p_to text)
returns void language plpgsql as $$
declare src text;
begin
  select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = p_name order by p.oid desc limit 1;
  if src is null then raise exception 'patch: % missing', p_name; end if;
  if position(p_marker in src) > 0 then return; end if;
  if position(p_from in src) = 0 then raise exception 'patch: % anchor not found (%)', p_name, left(p_from, 60); end if;
  execute replace(src, p_from, p_to);
end $$;

alter table public.estimates add column if not exists label text;
alter table public.estimates add column if not exists due_in timestamptz;
alter table public.estimates add column if not exists due_out timestamptz;
alter table public.estimates add column if not exists status_label text;
alter table public.estimates add column if not exists parts_status text not null default 'none';
alter table public.estimates add column if not exists fleet_number text;
alter table public.estimates drop constraint if exists estimates_parts_status_check;
alter table public.estimates add constraint estimates_parts_status_check check (parts_status in ('none', 'needed', 'ordered', 'arrived'));
alter table public.estimates drop constraint if exists estimates_label_check;
alter table public.estimates add constraint estimates_label_check check (label is null or label in ('VIP Customer', 'Drop-off', 'Waiting', 'Fleet'));

create or replace function public.set_estimate_meta(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare e public.estimates; v_pricer boolean := public.can_price_jobs();
begin
  if not public.is_member() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into e from public.estimates where id = p_id and company_id = public.current_company_id();
  if e.id is null then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  if (p ? 'label' or p ? 'due_in' or p ? 'due_out' or p ? 'fleet_number') and not v_pricer then
    raise exception 'Only the owner, an admin or an advisor changes the label, the due times or the fleet number' using errcode = '42501';
  end if;
  update public.estimates set
    label        = case when p ? 'label' then nullif(trim(coalesce(p ->> 'label', '')), '') else label end,
    due_in       = case when p ? 'due_in' then nullif(p ->> 'due_in', '')::timestamptz else due_in end,
    due_out      = case when p ? 'due_out' then nullif(p ->> 'due_out', '')::timestamptz else due_out end,
    fleet_number = case when p ? 'fleet_number' then nullif(left(trim(coalesce(p ->> 'fleet_number', '')), 40), '') else fleet_number end,
    status_label = case when p ? 'status_label' then nullif(left(trim(coalesce(p ->> 'status_label', '')), 40), '') else status_label end,
    parts_status = case when p ? 'parts_status' then coalesce(nullif(p ->> 'parts_status', ''), 'none') else parts_status end,
    updated_at   = now()
  where id = p_id;
end $$;
revoke execute on function public.set_estimate_meta(uuid, jsonb) from public, anon;
grant execute on function public.set_estimate_meta(uuid, jsonb) to authenticated;

-- A transfer carries its status word onto the visit
select public._patch_function('respond_transfer', 'status_label = t.status_label',
  $a$update public.estimates set holder_id = t.to_user where id = t.estimate_id returning * into e;$a$,
  $a$update public.estimates set holder_id = t.to_user, status_label = t.status_label where id = t.estimate_id returning * into e;$a$);

-- List rows: the label, the status word, parts, due times and the latest note
select public._patch_function('estimates_filtered', '''parts_status''',
  $a$'ro_number', coalesce((select j.ro_number from public.jobs j where j.id = b.job_id), b.ro_number),$a$,
  $a$'ro_number', coalesce((select j.ro_number from public.jobs j where j.id = b.job_id), b.ro_number),
               'label', b.label, 'status_label', b.status_label, 'parts_status', b.parts_status, 'due_in', b.due_in, 'due_out', b.due_out,
               'note', coalesce((select left(coalesce(nullif(f.body, ''), f.title), 140) from public.job_findings f where f.kind = 'note' and (f.estimate_id = b.id or (b.job_id is not null and f.job_id = b.job_id)) order by f.created_at desc limit 1), nullif(left(b.internal_notes, 140), '')),$a$);

-- The estimate JSON: the same fields, the customer's history and source, the mileage out
select public._patch_function('_estimate_json', '''fleet_number''',
  $a$'customer_concern', e.customer_concern,$a$,
  $a$'customer_concern', e.customer_concern,
    'label', e.label, 'due_in', e.due_in, 'due_out', e.due_out, 'status_label', e.status_label, 'parts_status', e.parts_status, 'fleet_number', e.fleet_number,
    'previous_visits', case when p_public then null else (select count(*) from public.estimates q where q.customer_id = e.customer_id and q.kind = 'quote' and q.id <> e.id and q.status not in ('draft', 'declined', 'expired')) end,$a$);
select public._patch_function('_estimate_json', '''best_contact''',
  $a$'first_name', c.first_name, 'phone'$a$,
  $a$'first_name', c.first_name, 'source', case when p_public then null else c.source end, 'best_contact', case when p_public then null when c.sms_opt_in then 'Text' else 'Call' end, 'phone'$a$);
select public._patch_function('_estimate_json', '''odometer_out''',
  $a$'primary_estimate_id', (select q.id$a$,
  $a$'odometer_out', j.odometer_out, 'primary_estimate_id', (select q.id$a$);

drop function public._patch_function(text, text, text, text);
