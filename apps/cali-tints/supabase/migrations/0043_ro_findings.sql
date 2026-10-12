-- =============================================================================
-- 0043 — The repair order: the Advisor role, RO numbers, the notes tab
--   * user_role gains 'advisor': a service advisor runs the retail counter.
--     Every job and the team dashboard (is_admin), writes and sends estimates
--     and sees retail money (can_price_jobs); no invoices, income, dealer
--     price list, Settings, export or QuickBooks (is_owner_admin / is_owner
--     unchanged). Role literals are compared as text so this file runs inside
--     one transaction with the enum change.
--   * Every retail job is the shop's repair order: jobs.ro_number
--     ('RO-000123', per company, from companies.next_ro_number) assigned by a
--     trigger when the job's location is the retail shop; dealership jobs
--     keep none. Existing retail jobs are numbered by date.
--   * The notes tab: job_findings (a tech's notes and findings with a
--     severity, a suggested service, a status that follows the estimate),
--     media on a finding (job_photos.finding_id; photo_kind gains 'finding'
--     and 'video'; the job-photos bucket takes short videos up to 100 MB and
--     an update policy so a resumed upload may overwrite its own file).
--   * RPCs: add_finding, update_finding, delete_finding, job_findings,
--     vehicle_open_findings (what was found last time and never done);
--     jobs_filtered and customer_timeline learn the RO number and the open
--     findings per vehicle.
-- Re-runnable. Reversal: drop job_findings, the three job_photos columns,
-- jobs.ro_number, companies.next_ro_number, the trigger and the RPCs; the
-- enum labels stay (Postgres cannot drop them).
-- =============================================================================

alter type public.user_role add value if not exists 'advisor';
alter type public.photo_kind add value if not exists 'finding';
alter type public.photo_kind add value if not exists 'video';

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('owner','admin','manager','advisor') from public.profiles where id = auth.uid() and active), false)
$$;

-- Prices on a job, estimate money, retail balances: owner, admin, advisor.
create or replace function public.can_price_jobs()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('owner','admin','advisor') from public.profiles where id = auth.uid() and active), false)
$$;

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

do $$
declare f text;
begin
  -- The estimate RPCs open to whoever may price (owner, admin, advisor).
  foreach f in array array['create_estimate', 'update_estimate', 'send_estimate', 'mark_estimate_accepted', 'decline_estimate', 'convert_estimate_to_job'] loop
    perform public._patch_function(f, 'not public.can_price_jobs() then', 'if not public.is_owner_admin() then', 'if not public.can_price_jobs() then');
  end loop;
  -- The dealer price list stays with the owner and admins.
  perform public._patch_function('dealership_price_list', 'public.is_owner_admin()', 'public.can_price_jobs()', 'public.is_owner_admin()');
end $$;

-- ---------------------------------------------------------------------------
-- RO numbers
-- ---------------------------------------------------------------------------
alter table public.companies add column if not exists next_ro_number integer not null default 1;
alter table public.jobs add column if not exists ro_number text;
create unique index if not exists jobs_ro_number_idx on public.jobs (company_id, ro_number) where ro_number is not null;

create or replace function public._next_ro_number(p_company uuid)
returns text language plpgsql as $$
declare v_num integer;
begin
  update public.companies set next_ro_number = next_ro_number + 1 where id = p_company returning next_ro_number - 1 into v_num;
  return 'RO-' || lpad(v_num::text, 6, '0');
end $$;
revoke execute on function public._next_ro_number(uuid) from public, anon, authenticated;

create or replace function public.tg_job_ro_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ro_number is null and exists (select 1 from public.dealerships d where d.id = new.dealership_id and d.retail) then
    new.ro_number := public._next_ro_number(new.company_id);
  end if;
  return new;
end $$;
drop trigger if exists ro_number on public.jobs;
create trigger ro_number before insert on public.jobs for each row execute function public.tg_job_ro_number();

-- Number the retail jobs that exist already, oldest first.
do $$
declare r record;
begin
  perform set_config('app.bypass_lock', 'on', true);
  for r in select j.id, j.company_id from public.jobs j join public.dealerships d on d.id = j.dealership_id
           where d.retail and j.ro_number is null order by j.company_id, j.performed_at, j.created_at loop
    update public.jobs set ro_number = public._next_ro_number(r.company_id) where id = r.id;
  end loop;
  perform set_config('app.bypass_lock', 'off', true);
end $$;

-- ---------------------------------------------------------------------------
-- Findings: the notes tab on a repair order
-- ---------------------------------------------------------------------------
create table if not exists public.job_findings (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies (id) on delete cascade,
  job_id                 uuid not null references public.jobs (id) on delete cascade,
  vehicle_id             uuid references public.vehicles (id) on delete set null,
  kind                   text not null default 'finding' check (kind in ('note', 'finding')),
  severity               text not null default 'soon' check (severity in ('ok', 'soon', 'urgent')),
  title                  text not null check (length(title) between 1 and 120),
  body                   text check (body is null or length(body) <= 4000),
  recommended_service_id uuid references public.services (id) on delete set null,
  status                 text not null default 'open' check (status in ('open', 'quoted', 'approved', 'declined', 'done')),
  estimate_line_id       uuid references public.estimate_lines (id) on delete set null,
  created_by             uuid references public.profiles (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists job_findings_job_idx on public.job_findings (job_id, created_at);
create index if not exists job_findings_vehicle_idx on public.job_findings (vehicle_id) where status in ('open', 'declined', 'quoted');

drop trigger if exists set_updated_at on public.job_findings;
create trigger set_updated_at before update on public.job_findings for each row execute function public.tg_set_updated_at();
drop trigger if exists audit on public.job_findings;
create trigger audit after insert or update or delete on public.job_findings for each row execute function public.tg_audit();

alter table public.job_findings enable row level security;
drop policy if exists job_findings_select on public.job_findings;
create policy job_findings_select on public.job_findings for select to authenticated
  using (company_id = public.current_company_id()
         and exists (select 1 from public.jobs j where j.id = job_id and (public.is_admin() or j.detailer_id = auth.uid())));
-- Writes go through the RPCs below.
grant select on public.job_findings to authenticated;

alter table public.job_photos add column if not exists finding_id uuid references public.job_findings (id) on delete set null;
alter table public.job_photos add column if not exists mime text;
alter table public.job_photos add column if not exists duration_s numeric(8,2);
create index if not exists job_photos_finding_idx on public.job_photos (finding_id) where finding_id is not null;

-- Short videos join the photos: 100 MB, mp4 / webm / mov.
update storage.buckets
   set file_size_limit = 104857600,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
 where id = 'job-photos';

-- A resumed or retried upload overwrites its own file inside the company folder.
drop policy if exists "job-photos update" on storage.objects;
create policy "job-photos update" on storage.objects for update to authenticated
  using (bucket_id = 'job-photos' and public.storage_path_company(name) = public.current_company_id())
  with check (bucket_id = 'job-photos' and public.storage_path_company(name) = public.current_company_id());

-- May this user write on this job's notes tab? Admins (incl. advisor) on any open job, a detailer on their own.
create or replace function public._can_note_job(p_job uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.jobs j where j.id = p_job and j.company_id = public.current_company_id() and j.deleted_at is null
                 and (public.is_admin() or j.detailer_id = auth.uid()))
$$;
revoke execute on function public._can_note_job(uuid) from public, anon;
grant execute on function public._can_note_job(uuid) to authenticated;

create or replace function public._finding_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', f.id, 'job_id', f.job_id, 'vehicle_id', f.vehicle_id, 'kind', f.kind, 'severity', f.severity, 'title', f.title, 'body', f.body,
    'recommended_service_id', f.recommended_service_id,
    'recommended_service', (select s.name from public.services s where s.id = f.recommended_service_id),
    'status', f.status, 'estimate_line_id', f.estimate_line_id, 'created_by', f.created_by, 'created_at', f.created_at, 'updated_at', f.updated_at,
    'job_ro_number', (select j.ro_number from public.jobs j where j.id = f.job_id),
    'job_performed_at', (select j.performed_at from public.jobs j where j.id = f.job_id),
    'media', (select coalesce(jsonb_agg(jsonb_build_object('id', ph.id, 'kind', ph.kind, 'storage_path', ph.storage_path, 'mime', ph.mime, 'duration_s', ph.duration_s, 'size_bytes', ph.size_bytes, 'created_at', ph.created_at) order by ph.created_at), '[]'::jsonb)
              from public.job_photos ph where ph.finding_id = f.id)
  ) from public.job_findings f where f.id = p_id
$$;
revoke execute on function public._finding_json(uuid) from public, anon, authenticated;

-- p: {job_id, kind note|finding, severity ok|soon|urgent, title, body, recommended_service_id}
create or replace function public.add_finding(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_job public.jobs; v_id uuid; v_kind text := coalesce(p ->> 'kind', 'finding'); v_svc uuid := nullif(p ->> 'recommended_service_id', '')::uuid;
begin
  select * into v_job from public.jobs where id = (p ->> 'job_id')::uuid;
  if not found or not public._can_note_job(v_job.id) then
    raise exception 'You cannot write on this job' using errcode = '42501';
  end if;
  if v_svc is not null and not exists (select 1 from public.services s where s.id = v_svc and s.company_id = v_job.company_id) then
    raise exception 'Unknown service' using errcode = '22023';
  end if;
  insert into public.job_findings (company_id, job_id, vehicle_id, kind, severity, title, body, recommended_service_id, created_by)
  values (v_job.company_id, v_job.id, v_job.vehicle_id, v_kind,
          case when v_kind = 'note' then 'ok' else coalesce(nullif(p ->> 'severity', ''), 'soon') end,
          trim(p ->> 'title'), nullif(trim(coalesce(p ->> 'body', '')), ''), v_svc, auth.uid())
  returning id into v_id;
  return public._finding_json(v_id);
end $$;
grant execute on function public.add_finding(jsonb) to authenticated;

-- p: any of {title, body, severity, status open|declined|done, recommended_service_id}
create or replace function public.update_finding(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_f public.job_findings; v_status text := p ->> 'status';
begin
  select * into v_f from public.job_findings where id = p_id;
  if not found or not public._can_note_job(v_f.job_id) then
    raise exception 'You cannot write on this job' using errcode = '42501';
  end if;
  if v_status is not null and v_status not in ('open', 'declined', 'done') then
    raise exception 'A finding is quoted or approved through the estimate' using errcode = '22023';
  end if;
  update public.job_findings set
    title = coalesce(nullif(trim(p ->> 'title'), ''), title),
    body = case when p ? 'body' then nullif(trim(coalesce(p ->> 'body', '')), '') else body end,
    severity = case when kind = 'note' then 'ok' else coalesce(nullif(p ->> 'severity', ''), severity) end,
    status = coalesce(v_status, status),
    recommended_service_id = case when p ? 'recommended_service_id' then nullif(p ->> 'recommended_service_id', '')::uuid else recommended_service_id end
  where id = p_id;
  return public._finding_json(p_id);
end $$;
grant execute on function public.update_finding(uuid, jsonb) to authenticated;

-- The owner, an admin, or the author while nothing was quoted from it. The media rows go too; the files are removed by the app.
create or replace function public.delete_finding(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_f public.job_findings; v_paths jsonb;
begin
  select * into v_f from public.job_findings where id = p_id;
  if not found or not public._can_note_job(v_f.job_id) or not (public.is_owner_admin() or v_f.created_by = auth.uid()) then
    raise exception 'You cannot remove this' using errcode = '42501';
  end if;
  if v_f.status not in ('open', 'declined', 'done') then
    raise exception 'This finding is on an estimate' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(ph.storage_path), '[]'::jsonb) into v_paths from public.job_photos ph where ph.finding_id = p_id;
  delete from public.job_photos where finding_id = p_id;
  delete from public.job_findings where id = p_id;
  return jsonb_build_object('id', p_id, 'paths', v_paths);
end $$;
grant execute on function public.delete_finding(uuid) to authenticated;

-- The notes tab: every note and finding on the job, oldest first, with its media.
create or replace function public.job_findings(p_job uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.jobs j where j.id = p_job and j.company_id = public.current_company_id() and (public.is_admin() or j.detailer_id = auth.uid()))
    then (select coalesce(jsonb_agg(public._finding_json(f.id) order by f.created_at), '[]'::jsonb) from public.job_findings f where f.job_id = p_job)
    else '[]'::jsonb end
$$;
grant execute on function public.job_findings(uuid) to authenticated;

-- "From last time": findings on this vehicle from other visits that were never done (open, declined, quoted).
create or replace function public.vehicle_open_findings(p_vehicle uuid, p_exclude_job uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._finding_json(f.id) order by f.created_at desc), '[]'::jsonb)
  from public.job_findings f
  where f.vehicle_id = p_vehicle and f.company_id = public.current_company_id() and f.kind = 'finding'
    and f.status in ('open', 'declined', 'quoted') and (p_exclude_job is null or f.job_id <> p_exclude_job)
    and exists (select 1 from public.jobs j where j.id = f.job_id and (public.is_admin() or j.detailer_id = auth.uid()))
$$;
grant execute on function public.vehicle_open_findings(uuid, uuid) to authenticated;

-- The Jobs list carries the RO number of a retail job.
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'jobs_filtered';
  if v_src is not null and position('''ro_number''' in v_src) = 0 then
    v_src := replace(v_src, '               ''tag'', b.tag_number,', '               ''tag'', b.tag_number,
               ''ro_number'', (select j2.ro_number from public.jobs j2 where j2.id = b.id),');
    execute v_src;
  end if;
end $$;

-- The customer's vehicles say how many findings are still open from earlier visits.
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'customer_timeline';
  if v_src is not null and position('''open_findings''' in v_src) = 0 then
    v_src := replace(v_src, '                   ''visits'', (select count(*) from public.jobs j where j.vehicle_id = v.id and j.deleted_at is null),',
      '                   ''open_findings'', (select count(*) from public.job_findings f where f.vehicle_id = v.id and f.kind = ''finding'' and f.status in (''open'', ''declined'', ''quoted'')),
                   ''visits'', (select count(*) from public.jobs j where j.vehicle_id = v.id and j.deleted_at is null),');
    execute v_src;
  end if;
  -- …and each visit shows its RO number.
  select pg_get_functiondef(p.oid) into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'customer_timeline';
  if v_src is not null and position('''ro_number''' in v_src) = 0 then
    v_src := replace(v_src, '''id'', j.id, ''performed_at'', j.performed_at, ''tag'', j.tag_number,', '''id'', j.id, ''performed_at'', j.performed_at, ''tag'', j.tag_number, ''ro_number'', j.ro_number,');
    execute v_src;
  end if;
end $$;

drop function if exists public._patch_function(text, text, text, text);
