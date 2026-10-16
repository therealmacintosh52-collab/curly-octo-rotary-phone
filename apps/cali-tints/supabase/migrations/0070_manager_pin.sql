-- =============================================================================
-- 0070 — A manager's PIN approves a detailer's edit or delete of a job
--   A detailer who wants to edit or delete a job asks a manager, who types their
--   own PIN on the detailer's phone. Each manager (and the owner and admins) has
--   their own PIN. The PIN is stored only as a bcrypt hash (pgcrypto).
--   * approval_pins: one hash per approver, never readable by the app
--   * verify_manager_pin(pin): the detailer's screen calls this; on a right PIN it
--     returns a one-time approval (valid 5 minutes) bound to that detailer; wrong
--     PINs are counted and 5 in 10 minutes lock that detailer out for 10 minutes
--     (it returns a result instead of raising so the count is kept)
--   * update_job needs the approval for non-admins; soft_delete_job lets a detailer
--     delete their OWN open job with one
--   * the direct-write side doors close: detailers can no longer update jobs or
--     job_services rows themselves (everything goes through the RPCs)
--   * set_my_pin / my_pin_status for owner, admin, manager; clear_pin for the owner
-- Re-runnable.
-- =============================================================================

create extension if not exists pgcrypto;

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

-- ---------------------------------------------------------------------------
-- Tables (no app access: only the definer RPCs below touch them)
-- ---------------------------------------------------------------------------
create table if not exists public.approval_pins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  pin_hash   text not null,
  set_at     timestamptz not null default now()
);

create table if not exists public.pin_attempts (
  id         bigint generated always as identity primary key,
  company_id uuid not null,
  user_id    uuid not null,
  ok         boolean not null,
  at         timestamptz not null default now()
);
create index if not exists pin_attempts_user_idx on public.pin_attempts (user_id, at desc);

-- One row per approval: who asked, which manager approved, for what job, and when it was used.
create table if not exists public.pin_grants (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null,
  requested_by uuid not null,
  approver_id  uuid not null,
  expires_at   timestamptz not null default now() + interval '5 minutes',
  used_at      timestamptz,
  job_id       uuid references public.jobs (id),
  action       text check (action in ('edit', 'delete')),
  created_at   timestamptz not null default now()
);
create index if not exists pin_grants_user_idx on public.pin_grants (requested_by, created_at desc);

alter table public.approval_pins enable row level security;
alter table public.pin_attempts enable row level security;
alter table public.pin_grants enable row level security;
revoke all on public.approval_pins, public.pin_attempts, public.pin_grants from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Setting a PIN
-- ---------------------------------------------------------------------------
create or replace function public._can_approve(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('owner', 'admin', 'manager') from public.profiles where id = p_user and active), false)
$$;

create or replace function public.set_my_pin(p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null or not public._can_approve(auth.uid()) then
    raise exception 'Only a manager, an admin or the owner can set an approval PIN' using errcode = '42501';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'The PIN is 4 to 6 digits' using errcode = '22023';
  end if;
  insert into public.approval_pins (user_id, company_id, pin_hash)
  values (auth.uid(), public.current_company_id(), crypt(p_pin, gen_salt('bf', 8)))
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, set_at = now();
end $$;

create or replace function public.my_pin_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'can_have_pin', public._can_approve(auth.uid()),
    'has_pin', exists (select 1 from public.approval_pins where user_id = auth.uid()),
    'set_at', (select set_at from public.approval_pins where user_id = auth.uid()))
$$;

-- The owner resets someone's PIN (a forgotten one); they set a new one themselves.
create or replace function public.clear_pin(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Only the owner can reset a PIN' using errcode = '42501'; end if;
  delete from public.approval_pins where user_id = p_user and company_id = public.current_company_id();
end $$;

-- Who has a PIN set (the owner's Users screen).
create or replace function public.pin_holders()
returns uuid[] language sql stable security definer set search_path = public as $$
  select case when public.is_owner() then coalesce(array_agg(user_id), '{}') else '{}'::uuid[] end
    from public.approval_pins where company_id = public.current_company_id()
$$;

-- ---------------------------------------------------------------------------
-- The detailer's screen: type the PIN a manager gave -> a one-time approval
-- ---------------------------------------------------------------------------
create or replace function public.verify_manager_pin(p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := auth.uid();
  v_company uuid := public.current_company_id();
  v_fail    int;
  v_ok      uuid;
  v_grant   uuid;
  r         record;
begin
  if v_uid is null or v_company is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    return jsonb_build_object('ok', false, 'reason', 'format');
  end if;
  select count(*) into v_fail from public.pin_attempts where user_id = v_uid and not ok and at > now() - interval '10 minutes';
  if v_fail >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'retry_minutes', 10);
  end if;
  -- Every approver's hash is compared (no early exit) so the time does not say who matched.
  for r in
    select ap.user_id, ap.pin_hash from public.approval_pins ap join public.profiles p on p.id = ap.user_id
     where ap.company_id = v_company and p.active and p.role::text in ('owner', 'admin', 'manager')
  loop
    if r.pin_hash = crypt(p_pin, r.pin_hash) then v_ok := r.user_id; end if;
  end loop;
  if v_ok is null then
    insert into public.pin_attempts (company_id, user_id, ok) values (v_company, v_uid, false);
    return jsonb_build_object('ok', false, 'reason', 'wrong', 'attempts_left', greatest(0, 4 - v_fail));
  end if;
  delete from public.pin_attempts where user_id = v_uid and not ok;
  insert into public.pin_grants (company_id, requested_by, approver_id) values (v_company, v_uid, v_ok) returning id into v_grant;
  return jsonb_build_object('ok', true, 'grant', v_grant);
end $$;

-- Internal: spend an approval on one job and one action (bound to the person who asked).
create or replace function public._consume_grant(p_grant uuid, p_job uuid, p_action text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_approver uuid;
begin
  update public.pin_grants set used_at = now(), job_id = p_job, action = p_action
   where id = p_grant and requested_by = auth.uid() and used_at is null and expires_at > now()
     and company_id = public.current_company_id()
  returning approver_id into v_approver;
  if v_approver is null then
    raise exception 'A manager''s approval is needed' using errcode = '42501';
  end if;
  return v_approver;
end $$;

-- ---------------------------------------------------------------------------
-- Edit: a detailer needs the approval; managers and up edit as before
-- ---------------------------------------------------------------------------
select public._patch_function('update_job', '_consume_grant',
  $a$  if v_job.invoice_id is not null then
    raise exception 'Job is invoiced and locked' using errcode = 'P0001';
  end if;$a$,
  $a$  if v_job.invoice_id is not null then
    raise exception 'Job is invoiced and locked' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    perform public._consume_grant(nullif(p ->> 'approval_grant', '')::uuid, p_id, 'edit');
  end if;$a$);

-- ---------------------------------------------------------------------------
-- Delete: a detailer may delete their OWN open job with an approval
-- ---------------------------------------------------------------------------
drop function if exists public.soft_delete_job(uuid, text);
create or replace function public.soft_delete_job(p_id uuid, p_reason text default null, p_grant uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_id and company_id = public.current_company_id() and deleted_at is null;
  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;
  if not public.is_admin() then
    if v_job.detailer_id <> auth.uid() then
      raise exception 'You can only delete your own jobs' using errcode = '42501';
    end if;
    if v_job.invoice_id is not null then
      raise exception 'Job is invoiced and locked' using errcode = 'P0001';
    end if;
    perform public._consume_grant(p_grant, p_id, 'delete');
  end if;
  update public.jobs set deleted_at = now(), deleted_by = auth.uid(), delete_reason = p_reason
   where id = p_id and company_id = public.current_company_id() and deleted_at is null;
end $$;

-- ---------------------------------------------------------------------------
-- Close the side doors: a detailer cannot change a job or its services directly
-- ---------------------------------------------------------------------------
drop policy if exists jobs_update on public.jobs;
create policy jobs_update on public.jobs for update to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());

drop policy if exists job_services_write on public.job_services;
create policy job_services_write on public.job_services for all to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());

-- Grants
revoke all on function public.set_my_pin(text), public.my_pin_status(), public.clear_pin(uuid), public.pin_holders(),
  public.verify_manager_pin(text), public._consume_grant(uuid, uuid, text), public._can_approve(uuid),
  public.soft_delete_job(uuid, text, uuid) from public, anon;
grant execute on function public.set_my_pin(text), public.my_pin_status(), public.clear_pin(uuid), public.pin_holders(),
  public.verify_manager_pin(text), public.soft_delete_job(uuid, text, uuid) to authenticated;

drop function public._patch_function(text, text, text, text);
