-- =============================================================================
-- 0063 — The Workflow board's columns
--   * retail_technicians(): the people who can be sent a work order (detailers)
--   * send_to_tech(estimate, tech): the advisor hands an approved work order to a
--     technician in one step (no acceptance); null puts it back with the advisor
--   * list rows carry tech_id (the holder when the holder is a technician), so the
--     board groups by person and not by clashing initials
--   * "Needs parts ordered" (a status word, a transfer) also marks the parts as
--     needed, so the card lands under Waiting for parts
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

-- Technicians: names only for the picker, initials for the board
create or replace function public.retail_technicians()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'initials', public._initials(p.full_name)) order by p.full_name), '[]'::jsonb)
  from public.profiles p
  where p.company_id = public.current_company_id() and p.active and p.role::text = 'detailer' and public.is_member();
$$;
revoke execute on function public.retail_technicians() from public, anon;
grant execute on function public.retail_technicians() to authenticated;

-- Send an approved work order to a technician (or back to the advisor with null)
create or replace function public.send_to_tech(p_estimate uuid, p_tech uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.estimates; v_job public.jobs;
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor sends a work order to a tech' using errcode = '42501'; end if;
  select * into e from public.estimates where id = p_estimate and company_id = public.current_company_id() and kind = 'quote';
  if e.id is null then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  if e.job_id is null or e.status <> 'accepted' then raise exception 'Approve the estimate first; then send the work order to a tech' using errcode = 'P0001'; end if;
  select * into v_job from public.jobs where id = e.job_id;
  if v_job.picked_up_at is not null then raise exception 'This work order is closed' using errcode = 'P0001'; end if;
  if p_tech is null then
    update public.estimates set holder_id = auth.uid(), updated_at = now() where id = e.id;
  else
    if not exists (select 1 from public.profiles where id = p_tech and company_id = e.company_id and active and role::text = 'detailer') then
      raise exception 'Pick a technician' using errcode = '22023';
    end if;
    update public.estimate_transfers set state = 'cancelled', resolved_at = now() where estimate_id = e.id and state = 'pending';
    update public.estimates set holder_id = p_tech, updated_at = now() where id = e.id;
    perform set_config('app.bypass_lock', 'on', true);
    update public.jobs set detailer_id = p_tech where id = e.job_id;
    perform set_config('app.bypass_lock', 'off', true);
  end if;
end $$;
revoke execute on function public.send_to_tech(uuid, uuid) from public, anon;
grant execute on function public.send_to_tech(uuid, uuid) to authenticated;

-- List rows: the technician holding the visit (an id), so lanes are per person
select public._patch_function('estimates_filtered', '''tech_id''',
  $a$'label', b.label, 'status_label', b.status_label,$a$,
  $a$'tech_id', (select p.id from public.profiles p where p.id = coalesce(b.holder_id, (select j.detailer_id from public.jobs j where j.id = b.job_id)) and p.role::text = 'detailer'),
               'label', b.label, 'status_label', b.status_label,$a$);

-- A transfer with "Needs parts ordered" also marks the parts as needed
select public._patch_function('respond_transfer', 'parts_status = case',
  $a$update public.estimates set holder_id = t.to_user, status_label = t.status_label where id = t.estimate_id returning * into e;$a$,
  $a$update public.estimates set holder_id = t.to_user, status_label = t.status_label,
      parts_status = case when t.status_label = 'Needs parts ordered' and parts_status in ('none', 'arrived') then 'needed' else parts_status end
    where id = t.estimate_id returning * into e;$a$);

-- Same for the status word chosen on the work order itself
select public._patch_function('set_estimate_meta', 'Needs parts ordered',
  $a$parts_status = case when p ? 'parts_status' then coalesce(nullif(p ->> 'parts_status', ''), 'none') else parts_status end,$a$,
  $a$parts_status = case when p ? 'parts_status' then coalesce(nullif(p ->> 'parts_status', ''), 'none')
                         when p ->> 'status_label' = 'Needs parts ordered' and parts_status in ('none', 'arrived') then 'needed'
                         else parts_status end,$a$);

drop function public._patch_function(text, text, text, text);
