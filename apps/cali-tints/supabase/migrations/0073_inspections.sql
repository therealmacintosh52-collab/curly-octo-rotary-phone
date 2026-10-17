-- =============================================================================
-- 0073 — Inspection checklists on an estimate / work order
--   A checklist is a list of items the tech ticks: green = fine, red = needs
--   attention, grey = not applicable. Reusable templates (Settings → Shop menu)
--   copy their items onto a visit; the tech adds or removes items on the car.
--   A red item can become a finding (photo, price, send to the customer).
--   * inspection_templates          the shop's reusable lists
--   * job_inspections               one checklist on one visit (optionally under a job)
--   * job_inspection_items          the items and their state
--   Ticking is not priced work, so it stays open after the work order is
--   approved (the same people who may write notes may tick). A checklist is
--   internal unless the advisor turns on "Show the customer", and then the
--   customer link lists the items and their state (never the notes).
-- Re-runnable.
-- =============================================================================

create table if not exists public.inspection_templates (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name       text not null check (length(name) between 1 and 80),
  items      jsonb not null default '[]'::jsonb,
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists inspection_templates_company_idx on public.inspection_templates (company_id, sort_order);

create table if not exists public.job_inspections (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  estimate_id     uuid not null references public.estimates (id) on delete cascade,
  -- a draft save of the estimate rebuilds its jobs with new ids, so the link is soft and the title is kept
  estimate_job_id uuid references public.estimate_jobs (id) on delete set null,
  job_title       text,
  template_id     uuid references public.inspection_templates (id) on delete set null,
  name            text not null check (length(name) between 1 and 80),
  show_customer   boolean not null default false,
  sort_order      integer not null default 0,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now()
);
create index if not exists job_inspections_estimate_idx on public.job_inspections (estimate_id, sort_order);

create table if not exists public.job_inspection_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  inspection_id uuid not null references public.job_inspections (id) on delete cascade,
  label         text not null check (length(label) between 1 and 120),
  grp           text,
  state         text not null default 'pending' check (state in ('pending', 'ok', 'attention', 'na')),
  note          text,
  finding_id    uuid references public.job_findings (id) on delete set null,
  checked_by    uuid references public.profiles (id),
  checked_at    timestamptz,
  sort_order    integer not null default 0
);
create index if not exists job_inspection_items_idx on public.job_inspection_items (inspection_id, sort_order);

alter table public.inspection_templates enable row level security;
alter table public.job_inspections enable row level security;
alter table public.job_inspection_items enable row level security;
drop policy if exists inspection_templates_select on public.inspection_templates;
create policy inspection_templates_select on public.inspection_templates for select to authenticated using (company_id = public.current_company_id());
drop policy if exists job_inspections_select on public.job_inspections;
create policy job_inspections_select on public.job_inspections for select to authenticated using (company_id = public.current_company_id());
drop policy if exists job_inspection_items_select on public.job_inspection_items;
create policy job_inspection_items_select on public.job_inspection_items for select to authenticated using (company_id = public.current_company_id());
revoke all on public.inspection_templates, public.job_inspections, public.job_inspection_items from public, anon, authenticated;
grant select on public.inspection_templates, public.job_inspections, public.job_inspection_items to authenticated;
drop trigger if exists audit on public.job_inspection_items;
create trigger audit after insert or update or delete on public.job_inspection_items for each row execute function public.tg_audit();
drop trigger if exists audit on public.job_inspections;
create trigger audit after insert or update or delete on public.job_inspections for each row execute function public.tg_audit();

-- ---------------------------------------------------------------------------
-- Starter lists (placeholders until the shop writes its own)
-- ---------------------------------------------------------------------------
create or replace function public._seed_inspection_templates(p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.inspection_templates where company_id = p_company) then return; end if;
  insert into public.inspection_templates (company_id, name, items, sort_order) values
    (p_company, 'Check-in checklist', '[
      {"label":"Lights on dash"},{"label":"Oil change sticker"},{"label":"DOT inspection sticker"},{"label":"Tire condition"},
      {"label":"Body damage / four corners"},{"label":"Exterior lights"},{"label":"Reflective tape"},{"label":"Evident leaks or odors"},
      {"label":"Windshield condition"},{"label":"Wiper blades"}]'::jsonb, 10),
    (p_company, 'Pre-purchase inspection', '[
      {"label":"Title and VIN match","group":"Paperwork"},{"label":"Warning lights","group":"Paperwork"},
      {"label":"Engine oil level and color","group":"Under the hood"},{"label":"Coolant level and color","group":"Under the hood"},
      {"label":"Belts and hoses","group":"Under the hood"},{"label":"Battery and terminals","group":"Under the hood"},
      {"label":"Brake pads and rotors","group":"Underneath"},{"label":"Suspension and bushings","group":"Underneath"},
      {"label":"Exhaust","group":"Underneath"},{"label":"Fluid leaks","group":"Underneath"},
      {"label":"Tire tread and age","group":"Wheels"},{"label":"Road test","group":"Drive"}]'::jsonb, 20),
    (p_company, 'Multi-point inspection', '[
      {"label":"Battery"},{"label":"Windshield chips and cracks"},{"label":"Air filter"},{"label":"Wiper blades"},
      {"label":"Serpentine belt"},{"label":"Tires for wear"},{"label":"Brake pads"},{"label":"Fluids topped off"},{"label":"All lights working"}]'::jsonb, 30);
end $$;
revoke execute on function public._seed_inspection_templates(uuid) from public, anon, authenticated;
do $$
declare c record;
begin
  for c in select id from public.companies loop perform public._seed_inspection_templates(c.id); end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Templates (owner or admin writes; every member reads)
-- ---------------------------------------------------------------------------
create or replace function public.inspection_templates_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'items', t.items, 'active', t.active) order by t.sort_order, t.name), '[]'::jsonb)
  from public.inspection_templates t
  where t.company_id = public.current_company_id() and public.is_member() and (t.active or public.is_owner_admin())
$$;
revoke execute on function public.inspection_templates_list() from public, anon;
grant execute on function public.inspection_templates_list() to authenticated;

-- p: {id?, name, items: [{label, group?}], active?}
create or replace function public.save_inspection_template(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_items jsonb; v_name text := trim(coalesce(p ->> 'name', ''));
begin
  if not public.is_owner_admin() then raise exception 'Only the owner or an admin edits inspection lists' using errcode = '42501'; end if;
  if v_name = '' or length(v_name) > 80 then raise exception 'Give the list a name' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('label', trim(x ->> 'label'), 'group', nullif(trim(coalesce(x ->> 'group', '')), '')))), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) x
   where length(trim(coalesce(x ->> 'label', ''))) between 1 and 120;
  if jsonb_array_length(v_items) > 80 then raise exception 'At most 80 items in a list' using errcode = '22023'; end if;
  if v_id is null then
    insert into public.inspection_templates (company_id, name, items, active, sort_order)
    values (public.current_company_id(), v_name, v_items, coalesce((p ->> 'active')::boolean, true),
            coalesce((select max(sort_order) + 10 from public.inspection_templates where company_id = public.current_company_id()), 10))
    returning id into v_id;
  else
    update public.inspection_templates set name = v_name, items = v_items, active = coalesce((p ->> 'active')::boolean, active)
     where id = v_id and company_id = public.current_company_id();
    if not found then raise exception 'List not found' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;
revoke execute on function public.save_inspection_template(jsonb) from public, anon;
grant execute on function public.save_inspection_template(jsonb) to authenticated;

create or replace function public.delete_inspection_template(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner_admin() then raise exception 'Only the owner or an admin edits inspection lists' using errcode = '42501'; end if;
  delete from public.inspection_templates where id = p_id and company_id = public.current_company_id();
end $$;
revoke execute on function public.delete_inspection_template(uuid) from public, anon;
grant execute on function public.delete_inspection_template(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The checklists on a visit (any member reads; no money in here)
-- ---------------------------------------------------------------------------
create or replace function public._inspection_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', i.id, 'name', i.name, 'estimate_job_id', i.estimate_job_id, 'job_title', i.job_title, 'show_customer', i.show_customer,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', it.id, 'label', it.label, 'group', it.grp, 'state', it.state, 'note', it.note,
                                                            'finding_id', it.finding_id, 'checked_at', it.checked_at,
                                                            'checked_by', public._initials((select full_name from public.profiles where id = it.checked_by)))
                                         order by it.sort_order, it.label)
                         from public.job_inspection_items it where it.inspection_id = i.id), '[]'::jsonb))
  from public.job_inspections i where i.id = p_id
$$;
revoke execute on function public._inspection_json(uuid) from public, anon, authenticated;

create or replace function public.visit_inspections(p_estimate uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_member() and exists (select 1 from public.estimates e where e.id = p_estimate and e.company_id = public.current_company_id())
    then coalesce((select jsonb_agg(public._inspection_json(i.id) order by i.sort_order, i.created_at) from public.job_inspections i where i.estimate_id = p_estimate), '[]'::jsonb)
    else '[]'::jsonb end
$$;
revoke execute on function public.visit_inspections(uuid) from public, anon;
grant execute on function public.visit_inspections(uuid) to authenticated;

-- A checklist on a visit: from a template, or blank. p_job = the estimate job (optional) to show it under.
create or replace function public.add_inspection(p_estimate uuid, p_template uuid default null, p_name text default null, p_job uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.estimates; t public.inspection_templates; v_id uuid; v_name text; v_title text; v_n integer;
begin
  select * into e from public.estimates where id = p_estimate and company_id = public.current_company_id();
  if e.id is null then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  if not public._can_note_estimate(e.id) and not public.is_admin() then raise exception 'You cannot add a checklist here' using errcode = '42501'; end if;
  if p_template is not null then
    select * into t from public.inspection_templates where id = p_template and company_id = e.company_id and active;
    if t.id is null then raise exception 'List not found' using errcode = 'P0002'; end if;
  end if;
  v_name := coalesce(nullif(trim(coalesce(p_name, '')), ''), t.name, 'Inspection');
  if length(v_name) > 80 then v_name := left(v_name, 80); end if;
  if p_job is not null then select title into v_title from public.estimate_jobs where id = p_job and estimate_id = e.id; end if;
  select coalesce(max(sort_order), 0) + 10 into v_n from public.job_inspections where estimate_id = e.id;
  insert into public.job_inspections (company_id, estimate_id, estimate_job_id, job_title, template_id, name, sort_order, created_by)
  values (e.company_id, e.id, case when v_title is not null then p_job end, v_title, t.id, v_name, v_n, auth.uid())
  returning id into v_id;
  if t.id is not null then
    insert into public.job_inspection_items (company_id, inspection_id, label, grp, sort_order)
    select e.company_id, v_id, x ->> 'label', nullif(x ->> 'group', ''), (o * 10)::integer
      from jsonb_array_elements(t.items) with ordinality as a(x, o);
  end if;
  return public._inspection_json(v_id);
end $$;
revoke execute on function public.add_inspection(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.add_inspection(uuid, uuid, text, uuid) to authenticated;

-- Resolve an item → its inspection and estimate, and check the caller may write on that visit.
create or replace function public._inspection_item_gate(p_item uuid)
returns public.job_inspection_items language plpgsql stable security definer set search_path = public as $$
declare it public.job_inspection_items; i public.job_inspections;
begin
  select * into it from public.job_inspection_items where id = p_item and company_id = public.current_company_id();
  if it.id is null then raise exception 'Item not found' using errcode = 'P0002'; end if;
  select * into i from public.job_inspections where id = it.inspection_id;
  if not public._can_note_estimate(i.estimate_id) and not public.is_admin() then raise exception 'You cannot change this checklist' using errcode = '42501'; end if;
  return it;
end $$;
revoke execute on function public._inspection_item_gate(uuid) from public, anon, authenticated;

create or replace function public.set_inspection_item(p_item uuid, p_state text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare it public.job_inspection_items;
begin
  if p_state not in ('pending', 'ok', 'attention', 'na') then raise exception 'Unknown state' using errcode = '22023'; end if;
  it := public._inspection_item_gate(p_item);
  update public.job_inspection_items
     set state = p_state,
         note = case when p_note is null then note else nullif(trim(p_note), '') end,
         checked_by = case when p_state = 'pending' then null else auth.uid() end,
         checked_at = case when p_state = 'pending' then null else now() end
   where id = it.id;
  return public._inspection_json(it.inspection_id);
end $$;
revoke execute on function public.set_inspection_item(uuid, text, text) from public, anon;
grant execute on function public.set_inspection_item(uuid, text, text) to authenticated;

create or replace function public.add_inspection_item(p_inspection uuid, p_label text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.job_inspections; v_label text := trim(coalesce(p_label, ''));
begin
  select * into i from public.job_inspections where id = p_inspection and company_id = public.current_company_id();
  if i.id is null then raise exception 'Checklist not found' using errcode = 'P0002'; end if;
  if not public._can_note_estimate(i.estimate_id) and not public.is_admin() then raise exception 'You cannot change this checklist' using errcode = '42501'; end if;
  if v_label = '' or length(v_label) > 120 then raise exception 'Type what to check' using errcode = '22023'; end if;
  if (select count(*) from public.job_inspection_items where inspection_id = i.id) >= 80 then raise exception 'At most 80 items in a list' using errcode = '22023'; end if;
  insert into public.job_inspection_items (company_id, inspection_id, label, sort_order)
  values (i.company_id, i.id, v_label, coalesce((select max(sort_order) + 10 from public.job_inspection_items where inspection_id = i.id), 10));
  return public._inspection_json(i.id);
end $$;
revoke execute on function public.add_inspection_item(uuid, text) from public, anon;
grant execute on function public.add_inspection_item(uuid, text) to authenticated;

create or replace function public.delete_inspection_item(p_item uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare it public.job_inspection_items;
begin
  it := public._inspection_item_gate(p_item);
  delete from public.job_inspection_items where id = it.id;
  return public._inspection_json(it.inspection_id);
end $$;
revoke execute on function public.delete_inspection_item(uuid) from public, anon;
grant execute on function public.delete_inspection_item(uuid) to authenticated;

create or replace function public.delete_inspection(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare i public.job_inspections;
begin
  select * into i from public.job_inspections where id = p_id and company_id = public.current_company_id();
  if i.id is null then return; end if;
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor removes a checklist' using errcode = '42501'; end if;
  delete from public.job_inspections where id = i.id;
end $$;
revoke execute on function public.delete_inspection(uuid) from public, anon;
grant execute on function public.delete_inspection(uuid) to authenticated;

create or replace function public.set_inspection_customer(p_id uuid, p_show boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor shares a checklist' using errcode = '42501'; end if;
  update public.job_inspections set show_customer = coalesce(p_show, false) where id = p_id and company_id = public.current_company_id();
end $$;
revoke execute on function public.set_inspection_customer(uuid, boolean) from public, anon;
grant execute on function public.set_inspection_customer(uuid, boolean) to authenticated;

-- A red item becomes a finding (title = the item, note = the tech's note); the item keeps the link.
create or replace function public.inspection_item_to_finding(p_item uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare it public.job_inspection_items; i public.job_inspections; e public.estimates; f jsonb;
begin
  it := public._inspection_item_gate(p_item);
  if it.finding_id is not null then raise exception 'That item is already a finding' using errcode = 'P0001'; end if;
  select * into i from public.job_inspections where id = it.inspection_id;
  select * into e from public.estimates where id = i.estimate_id;
  f := public.add_finding(case when e.job_id is not null
    then jsonb_build_object('job_id', e.job_id, 'kind', 'finding', 'severity', 'soon', 'title', it.label, 'body', it.note)
    else jsonb_build_object('estimate_id', e.id, 'kind', 'finding', 'severity', 'soon', 'title', it.label, 'body', it.note) end);
  update public.job_inspection_items set finding_id = (f ->> 'id')::uuid, state = 'attention' where id = it.id;
  return f;
end $$;
revoke execute on function public.inspection_item_to_finding(uuid) from public, anon;
grant execute on function public.inspection_item_to_finding(uuid) to authenticated;

-- The customer's link: only the checklists the shop chose to show, items and states, never the notes.
create or replace function public.inspections_by_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.estimates;
begin
  e := public._estimate_for_token(p_token);
  if e.id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'job_title', i.job_title,
             'items', coalesce((select jsonb_agg(jsonb_build_object('label', it.label, 'group', it.grp, 'state', it.state) order by it.sort_order, it.label)
                                from public.job_inspection_items it where it.inspection_id = i.id and it.state <> 'pending'), '[]'::jsonb))
             order by i.sort_order, i.created_at)
    from public.job_inspections i where i.estimate_id = e.id and i.show_customer), '[]'::jsonb);
end $$;
revoke execute on function public.inspections_by_token(text) from public;
grant execute on function public.inspections_by_token(text) to anon, authenticated;
