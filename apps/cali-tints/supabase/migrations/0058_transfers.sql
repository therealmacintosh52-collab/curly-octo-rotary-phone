-- =============================================================================
-- 0058 — Transfer a visit to a coworker (retail estimates)
--   * estimates.holder_id: who holds the visit right now (null = whoever wrote
--     it / the tech on it)
--   * estimate_transfers: a visit offered to a coworker with a status and a note;
--     the coworker accepts or declines, the sender can cancel. "Incoming" and
--     "Outgoing" on the dashboard read it.
--   * Accepting makes the coworker the holder; a detailer also becomes the tech
--     on the visit so they can open it.
--   * estimates_filtered rows carry `mine` and `holder` (initials only).
-- Re-runnable.
-- =============================================================================

create or replace function public._patch_function(p_name text, p_marker text, p_from text, p_to text)
returns void language plpgsql as $$
declare src text;
begin
  select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = p_name;
  if src is null then raise exception 'patch: % missing', p_name; end if;
  if position(p_marker in src) > 0 then return; end if;
  if position(p_from in src) = 0 then raise exception 'patch: % anchor not found (%)', p_name, left(p_from, 60); end if;
  execute replace(src, p_from, p_to);
end $$;

alter table public.estimates add column if not exists holder_id uuid references public.profiles (id);

create table if not exists public.estimate_transfers (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  estimate_id  uuid not null references public.estimates (id) on delete cascade,
  from_user    uuid not null references public.profiles (id),
  to_user      uuid not null references public.profiles (id),
  status_label text not null default 'Checked in',
  message      text,
  state        text not null default 'pending' check (state in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists estimate_transfers_to_idx on public.estimate_transfers (company_id, to_user, state);
create index if not exists estimate_transfers_est_idx on public.estimate_transfers (estimate_id, created_at desc);
alter table public.estimate_transfers enable row level security;
drop policy if exists estimate_transfers_select on public.estimate_transfers;
create policy estimate_transfers_select on public.estimate_transfers for select to authenticated
  using (company_id = public.current_company_id() and (from_user = auth.uid() or to_user = auth.uid() or public.is_admin()));
revoke all on public.estimate_transfers from authenticated, anon;
grant select on public.estimate_transfers to authenticated;

-- Who can be handed a visit (the picker shows names; every list shows initials only)
create or replace function public.transfer_candidates()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'initials', public._initials(p.full_name), 'role', p.role::text) order by p.full_name), '[]'::jsonb)
  from public.profiles p
  where p.company_id = public.current_company_id() and p.active and p.id <> auth.uid() and public.is_member();
$$;

create or replace function public.transfer_estimate(p_estimate uuid, p_to uuid, p_status text default 'Checked in', p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare e public.estimates; v_job public.jobs; v_id uuid;
begin
  if not public.is_member() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into e from public.estimates where id = p_estimate and company_id = public.current_company_id() and kind = 'quote';
  if e.id is null then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  if e.job_id is not null then select * into v_job from public.jobs where id = e.job_id; end if;
  if v_job.id is not null and v_job.picked_up_at is not null then raise exception 'This estimate is closed' using errcode = 'P0001'; end if;
  if not (public.is_admin() or coalesce(e.holder_id, v_job.detailer_id, e.created_by) = auth.uid()) then
    raise exception 'Only the person holding it, or the advisor or owner, can hand it over' using errcode = '42501';
  end if;
  if p_to is null or p_to = auth.uid() or not exists (select 1 from public.profiles where id = p_to and company_id = e.company_id and active) then
    raise exception 'Pick a coworker' using errcode = '22023';
  end if;
  update public.estimate_transfers set state = 'cancelled', resolved_at = now() where estimate_id = e.id and state = 'pending';
  insert into public.estimate_transfers (company_id, estimate_id, from_user, to_user, status_label, message)
  values (e.company_id, e.id, auth.uid(), p_to, left(coalesce(nullif(trim(p_status), ''), 'Checked in'), 40), nullif(left(trim(coalesce(p_message, '')), 500), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.respond_transfer(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare t public.estimate_transfers; e public.estimates; v_role text;
begin
  select * into t from public.estimate_transfers where id = p_id and company_id = public.current_company_id();
  if t.id is null or t.to_user <> auth.uid() then raise exception 'Transfer not found' using errcode = 'P0002'; end if;
  if t.state <> 'pending' then raise exception 'That transfer was already answered' using errcode = 'P0001'; end if;
  update public.estimate_transfers set state = case when p_accept then 'accepted' else 'declined' end, resolved_at = now() where id = t.id;
  if p_accept then
    update public.estimates set holder_id = t.to_user where id = t.estimate_id returning * into e;
    select role::text into v_role from public.profiles where id = t.to_user;
    if v_role = 'detailer' and e.job_id is not null then
      perform set_config('app.bypass_lock', 'on', true);
      update public.jobs set detailer_id = t.to_user where id = e.job_id;
      perform set_config('app.bypass_lock', 'off', true);
    end if;
  end if;
end $$;

create or replace function public.cancel_transfer(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.estimate_transfers;
begin
  select * into t from public.estimate_transfers where id = p_id and company_id = public.current_company_id();
  if t.id is null or not (t.from_user = auth.uid() or public.is_admin()) then raise exception 'Transfer not found' using errcode = 'P0002'; end if;
  if t.state <> 'pending' then raise exception 'That transfer was already answered' using errcode = 'P0001'; end if;
  update public.estimate_transfers set state = 'cancelled', resolved_at = now() where id = t.id;
end $$;

-- Incoming (offered to me) and outgoing (I offered, not answered yet); initials only
create or replace function public.my_transfers()
returns jsonb language sql stable security definer set search_path = public as $$
  with t as (
    select x.*, e.display_number, e.customer_id, e.vehicle_id,
           (select j.retail_invoice_number from public.jobs j where j.id = e.job_id) as invoice_number,
           (select c.display_name from public.customers c where c.id = e.customer_id) as customer,
           (select trim(concat_ws(' ', v.year::text, v.make, v.model)) from public.vehicles v where v.id = e.vehicle_id) as vehicle,
           public._initials((select p.full_name from public.profiles p where p.id = x.from_user)) as from_initials,
           public._initials((select p.full_name from public.profiles p where p.id = x.to_user)) as to_initials
    from public.estimate_transfers x join public.estimates e on e.id = x.estimate_id
    where x.company_id = public.current_company_id() and x.state = 'pending' and (x.to_user = auth.uid() or x.from_user = auth.uid())
  )
  select jsonb_build_object(
    'incoming', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'estimate_id', t.estimate_id, 'number', coalesce(t.invoice_number, t.display_number), 'customer', t.customer, 'vehicle', t.vehicle, 'from', t.from_initials, 'to', t.to_initials, 'status_label', t.status_label, 'message', t.message, 'created_at', t.created_at) order by t.created_at desc), '[]'::jsonb) from t where t.to_user = auth.uid()),
    'outgoing', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'estimate_id', t.estimate_id, 'number', coalesce(t.invoice_number, t.display_number), 'customer', t.customer, 'vehicle', t.vehicle, 'from', t.from_initials, 'to', t.to_initials, 'status_label', t.status_label, 'message', t.message, 'created_at', t.created_at) order by t.created_at desc), '[]'::jsonb) from t where t.from_user = auth.uid())
  );
$$;

revoke execute on function public.transfer_candidates(), public.my_transfers() from public, anon;
revoke execute on function public.transfer_estimate(uuid, uuid, text, text), public.respond_transfer(uuid, boolean), public.cancel_transfer(uuid) from public, anon;
grant execute on function public.transfer_candidates(), public.my_transfers() to authenticated;
grant execute on function public.transfer_estimate(uuid, uuid, text, text), public.respond_transfer(uuid, boolean), public.cancel_transfer(uuid) to authenticated;

-- The list rows say who holds each visit and whether it is mine
select public._patch_function('estimates_filtered', '''holder''',
  '''advisor'', public._initials((select p.full_name from public.profiles p where p.id = b.created_by)),',
  '''advisor'', public._initials((select p.full_name from public.profiles p where p.id = b.created_by)),
               ''holder'', public._initials((select p.full_name from public.profiles p where p.id = coalesce(b.holder_id, (select j.detailer_id from public.jobs j where j.id = b.job_id)))),
               ''mine'', coalesce(b.holder_id, (select j.detailer_id from public.jobs j where j.id = b.job_id), b.created_by) = auth.uid(),');

drop function public._patch_function(text, text, text, text);
