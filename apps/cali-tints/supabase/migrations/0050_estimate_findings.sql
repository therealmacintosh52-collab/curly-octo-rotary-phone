-- =============================================================================
-- 0050 — Findings on the estimate, carried onto the invoice, seen by the customer
--   A tech inspects the car before anything is approved, so notes, findings
--   (with severity and a suggested service), photos and clips can live on the
--   ESTIMATE (job_findings.estimate_id, job_photos.estimate_id). When the
--   customer approves, they move onto the new job and the invoice shows the
--   same rows. A finding can be marked Internal only (customer_visible = false).
--   The customer's links show them: /e/<token> (any estimate status, a draft
--   is "being prepared") and /r/<token> (the invoice, open as soon as it exists).
--   "Send findings" records when they went out (estimates.findings_sent_at).
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

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
alter table public.job_findings alter column job_id drop not null;
alter table public.job_findings add column if not exists estimate_id uuid references public.estimates (id) on delete cascade;
alter table public.job_findings add column if not exists customer_visible boolean not null default true;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'job_findings_subject') then
    alter table public.job_findings add constraint job_findings_subject check (job_id is not null or estimate_id is not null);
  end if;
end $$;
create index if not exists job_findings_estimate_idx on public.job_findings (estimate_id, created_at) where estimate_id is not null;

alter table public.job_photos alter column job_id drop not null;
alter table public.job_photos add column if not exists estimate_id uuid references public.estimates (id) on delete cascade;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'job_photos_subject') then
    alter table public.job_photos add constraint job_photos_subject check (job_id is not null or estimate_id is not null);
  end if;
end $$;
create index if not exists job_photos_estimate_idx on public.job_photos (estimate_id) where estimate_id is not null;
create unique index if not exists job_photos_estimate_client_idx on public.job_photos (estimate_id, client_id) where estimate_id is not null and client_id is not null;

alter table public.estimates add column if not exists findings_sent_at timestamptz;

-- Rows that live on an estimate (not on a job yet) are readable by the company's members.
drop policy if exists job_findings_estimate_select on public.job_findings;
create policy job_findings_estimate_select on public.job_findings for select to authenticated
  using (company_id = public.current_company_id() and job_id is null);
drop policy if exists job_photos_estimate_select on public.job_photos;
create policy job_photos_estimate_select on public.job_photos for select to authenticated
  using (company_id = public.current_company_id() and job_id is null);

-- ---------------------------------------------------------------------------
-- Who may write on an estimate's notes: any member while it is open (the tech
-- inspects before the customer answers); once approved the job's rule applies.
-- ---------------------------------------------------------------------------
create or replace function public._can_note_estimate(p_estimate uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.estimates e
    where e.id = p_estimate and e.company_id = public.current_company_id()
      and (e.status in ('draft', 'sent', 'viewed') or (e.job_id is not null and public._can_note_job(e.job_id))))
$$;
revoke execute on function public._can_note_estimate(uuid) from public, anon;
grant execute on function public._can_note_estimate(uuid) to authenticated;

create or replace function public._can_note_finding(p_finding uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when f.job_id is not null then public._can_note_job(f.job_id) else public._can_note_estimate(f.estimate_id) end
                   from public.job_findings f where f.id = p_finding), false)
$$;
revoke execute on function public._can_note_finding(uuid) from public, anon;
grant execute on function public._can_note_finding(uuid) to authenticated;

-- The finding JSON knows its estimate and whether the customer sees it.
select public._patch_function('_finding_json', '''customer_visible'',',
  '''id'', f.id, ''job_id'', f.job_id,',
  '''id'', f.id, ''job_id'', f.job_id, ''estimate_id'', f.estimate_id, ''customer_visible'', f.customer_visible,');

-- add_finding: on a job (as before) or on an estimate.
-- p: {job_id | estimate_id, kind note|finding, severity ok|soon|urgent, title, body, recommended_service_id, customer_visible}
create or replace function public.add_finding(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs; v_est public.estimates; v_id uuid; v_company uuid; v_vehicle uuid;
  v_kind text := coalesce(p ->> 'kind', 'finding'); v_svc uuid := nullif(p ->> 'recommended_service_id', '')::uuid;
  v_visible boolean := coalesce((p ->> 'customer_visible')::boolean, true);
begin
  if nullif(p ->> 'job_id', '') is not null then
    select * into v_job from public.jobs where id = (p ->> 'job_id')::uuid;
    if not found or not public._can_note_job(v_job.id) then
      raise exception 'You cannot write on this job' using errcode = '42501';
    end if;
    v_company := v_job.company_id; v_vehicle := v_job.vehicle_id;
  else
    select * into v_est from public.estimates where id = nullif(p ->> 'estimate_id', '')::uuid;
    if not found or not public._can_note_estimate(v_est.id) then
      raise exception 'You cannot write on this estimate' using errcode = '42501';
    end if;
    v_company := v_est.company_id; v_vehicle := v_est.vehicle_id; v_job := null;
  end if;
  if v_svc is not null and not exists (select 1 from public.services s where s.id = v_svc and s.company_id = v_company) then
    raise exception 'Unknown service' using errcode = '22023';
  end if;
  insert into public.job_findings (company_id, job_id, estimate_id, vehicle_id, kind, severity, title, body, recommended_service_id, customer_visible, created_by)
  values (v_company, v_job.id, case when v_job.id is null then v_est.id end, v_vehicle, v_kind,
          case when v_kind = 'note' then 'ok' else coalesce(nullif(p ->> 'severity', ''), 'soon') end,
          trim(p ->> 'title'), nullif(trim(coalesce(p ->> 'body', '')), ''), v_svc, v_visible, auth.uid())
  returning id into v_id;
  return public._finding_json(v_id);
end $$;
grant execute on function public.add_finding(jsonb) to authenticated;

-- update / delete follow the same rule (job or estimate); update also flips customer_visible.
select public._patch_function('update_finding', '_can_note_finding',
  'not public._can_note_job(v_f.job_id)', 'not public._can_note_finding(v_f.id)');
select public._patch_function('update_finding', 'customer_visible',
  '    status = coalesce(v_status, status),',
  '    status = coalesce(v_status, status),
    customer_visible = case when p ? ''customer_visible'' then (p ->> ''customer_visible'')::boolean else customer_visible end,');
select public._patch_function('delete_finding', '_can_note_finding',
  'not public._can_note_job(v_f.job_id)', 'not public._can_note_finding(v_f.id)');

-- A photo or clip on a finding (the file is already in the job-photos bucket under the company folder).
-- p: {path, mime, size, duration, kind photo|video}
create or replace function public.add_finding_media(p_finding uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f public.job_findings; v_id uuid; v_path text := p ->> 'path'; v_mime text := lower(coalesce(p ->> 'mime', ''));
begin
  select * into f from public.job_findings where id = p_finding;
  if not found or not public._can_note_finding(p_finding) then
    raise exception 'You cannot write here' using errcode = '42501';
  end if;
  if v_path is null or v_path not like f.company_id::text || '/%' or v_path ~ '[^A-Za-z0-9._/-]' then
    raise exception 'Bad file path' using errcode = '22023';
  end if;
  if v_mime not in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime') then
    raise exception 'That file type is not supported' using errcode = '22023';
  end if;
  insert into public.job_photos (company_id, job_id, estimate_id, kind, storage_path, size_bytes, client_id, finding_id, mime, duration_s, created_by)
  values (f.company_id, f.job_id, case when f.job_id is null then f.estimate_id end, case when v_mime like 'video/%' then 'video'::public.photo_kind else 'finding'::public.photo_kind end,
          v_path, nullif(p ->> 'size', '')::integer, gen_random_uuid(), p_finding, v_mime, nullif(p ->> 'duration', '')::numeric, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;
grant execute on function public.add_finding_media(uuid, jsonb) to authenticated;

-- The estimate's side panel: every finding on it, and on its job once approved. Any member (no money in here).
create or replace function public.estimate_findings(p_estimate uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.estimates e where e.id = p_estimate and e.company_id = public.current_company_id())
    then (select coalesce(jsonb_agg(public._finding_json(f.id) order by f.created_at), '[]'::jsonb)
          from public.job_findings f, public.estimates e
          where e.id = p_estimate and (f.estimate_id = e.id or (e.job_id is not null and f.job_id = e.job_id)))
    else '[]'::jsonb end
$$;
revoke execute on function public.estimate_findings(uuid) from public, anon;
grant execute on function public.estimate_findings(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- What the estimate and the invoice carry
-- ---------------------------------------------------------------------------
-- estimate JSON: its own findings, its job's, and the ones quoted from lines; the customer sees the visible ones only.
select public._patch_function('_estimate_json', 'f.estimate_id = e.id',
  'from public.job_findings f where f.estimate_line_id in (select l.id from public.estimate_lines l where l.estimate_id = e.id)),',
  'from public.job_findings f
                 where (f.estimate_id = e.id or (e.job_id is not null and f.job_id = e.job_id) or f.estimate_line_id in (select l.id from public.estimate_lines l where l.estimate_id = e.id))
                   and (not p_public or f.customer_visible)),
    ''findings_sent_at'', e.findings_sent_at,');

-- receipt / invoice JSON: the job's findings
select public._patch_function('_receipt_json', '''findings'',',
  '''signed_name'', j.receipt_signed_name,',
  '''findings'', (select coalesce(jsonb_agg(public._finding_json(f.id) order by f.created_at), ''[]''::jsonb) from public.job_findings f where f.job_id = j.id and (not p_public or f.customer_visible)),
    ''signed_name'', j.receipt_signed_name,');

-- approval: the estimate's findings and media move onto the new job (estimate_id stays, so both pages list the same rows)
select public._patch_function('_convert_estimate_core', 'estimate_id = e.id and job_id is null',
  '  perform public._estimate_odometer(e.id, j.id);',
  '  perform public._estimate_odometer(e.id, j.id);
  update public.job_findings set job_id = j.id, vehicle_id = coalesce(vehicle_id, j.vehicle_id) where estimate_id = e.id and job_id is null;
  update public.job_photos set job_id = j.id where estimate_id = e.id and job_id is null;');

-- the customer cannot answer a quote that is still being prepared (a findings-only link may already be out)
select public._patch_function('estimate_respond', 'still preparing',
  '  if e.expires_at < now() then',
  '  if e.status = ''draft'' then
    raise exception ''The shop is still preparing this estimate'' using errcode = ''P0001'';
  end if;
  if e.expires_at < now() then');

-- the invoice link opens as soon as the invoice exists (it was paid receipts only)
select public._patch_function('receipt_by_token', 'deleted_at is null and false',
  'and x.paid_at is not null and x.deleted_at is null;', 'and x.deleted_at is null;');
select public._patch_function('receipt_link', 'retail_invoice_number',
  'where id = p_job_id and company_id = public.current_company_id() and paid_at is not null)',
  'where id = p_job_id and company_id = public.current_company_id() and (paid_at is not null or retail_invoice_number is not null))');

-- "Send findings": record when they went out (the email / text itself is sent by the app).
create or replace function public.mark_findings_sent(p_estimate uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.estimates;
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor sends findings' using errcode = '42501'; end if;
  select * into e from public.estimates where id = p_estimate and company_id = public.current_company_id();
  if not found then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  update public.estimates set findings_sent_at = now() where id = e.id returning * into e;
  perform public._emit(e.company_id, 'estimate.findings_sent', 'estimate', e.id, e.customer_id, jsonb_build_object('job_id', e.job_id));
  return jsonb_build_object('token', e.token, 'job_id', e.job_id, 'findings_sent_at', e.findings_sent_at);
end $$;
grant execute on function public.mark_findings_sent(uuid) to authenticated;

drop function public._patch_function(text, text, text, text);
