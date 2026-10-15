-- =============================================================================
-- 0066 — The activity log on every estimate / work order / invoice
--   Who viewed it, who did what, and when (date and time), newest first:
--   * visit_views: every time somebody opens the estimate, the invoice, a PDF or a
--     signed copy (staff by person, the customer by link). Insert-only.
--     log_visit_view (staff) and log_customer_view (the customer's link) write it,
--     one row per person and kind per ten minutes.
--   * visit_activity(estimate): one list built from what is already recorded (the
--     audit log of the estimate, its lines, approvals, the work order, findings,
--     photos and payments), the hand-offs, the automatic messages, the signed copies
--     and the views. Owner, admin, manager and advisor read it; amounts only for
--     those who may see prices. Staff show as initials, the customer as "Customer".
-- Re-runnable.
-- =============================================================================

create table if not exists public.visit_views (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  viewer_id   uuid references public.profiles (id),
  viewer_kind text not null check (viewer_kind in ('staff', 'customer')),
  what        text not null check (what in ('estimate', 'invoice', 'pdf', 'signed_copy')),
  viewed_at   timestamptz not null default now()
);
create index if not exists visit_views_est_idx on public.visit_views (estimate_id, viewed_at desc);
alter table public.visit_views enable row level security;
revoke all on public.visit_views from public, anon, authenticated;

create or replace function public.tg_visit_views_frozen() returns trigger language plpgsql as $$
begin raise exception 'The view log cannot be changed' using errcode = 'P0001'; end $$;
drop trigger if exists visit_views_frozen on public.visit_views;
create trigger visit_views_frozen before update or delete on public.visit_views for each row execute function public.tg_visit_views_frozen();

-- Staff opened something
create or replace function public.log_visit_view(p_estimate uuid, p_what text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.estimates;
begin
  if not public.is_member() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_what not in ('estimate', 'invoice', 'pdf', 'signed_copy') then raise exception 'Unknown view' using errcode = '22023'; end if;
  select * into e from public.estimates where id = p_estimate and company_id = public.current_company_id();
  if e.id is null then return; end if;
  if exists (select 1 from public.visit_views v where v.estimate_id = e.id and v.viewer_id = auth.uid() and v.what = p_what and v.viewed_at > now() - interval '10 minutes') then return; end if;
  insert into public.visit_views (company_id, estimate_id, viewer_id, viewer_kind, what) values (e.company_id, e.id, auth.uid(), 'staff', p_what);
end $$;
revoke execute on function public.log_visit_view(uuid, text) from public, anon;
grant execute on function public.log_visit_view(uuid, text) to authenticated;

-- The customer opened their link (an estimate link or an invoice link)
create or replace function public.log_customer_view(p_token text, p_what text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.estimates; v_job uuid;
begin
  if p_what not in ('estimate', 'invoice', 'pdf') or length(coalesce(p_token, '')) < 20 then return; end if;
  e := public._estimate_for_token(p_token);
  if e.id is null then
    select job_id into v_job from public.receipt_tokens where token = p_token;
    if v_job is not null then select * into e from public.estimates where job_id = v_job and kind = 'quote' order by created_at limit 1; end if;
  end if;
  if e.id is null then return; end if;
  if exists (select 1 from public.visit_views v where v.estimate_id = e.id and v.viewer_kind = 'customer' and v.what = p_what and v.viewed_at > now() - interval '10 minutes') then return; end if;
  insert into public.visit_views (company_id, estimate_id, viewer_id, viewer_kind, what) values (e.company_id, e.id, null, 'customer', p_what);
end $$;
revoke execute on function public.log_customer_view(text, text) from public;
grant execute on function public.log_customer_view(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Words for what the audit log recorded on an estimate row and on a work order row
-- ---------------------------------------------------------------------------
create or replace function public._act_estimate(p_action text, p_old jsonb, p_new jsonb, p_changed text[])
returns text language plpgsql stable set search_path = public as $$
declare v_x text; v_kind text := case when coalesce(p_new, p_old) ->> 'kind' = 'supplement' then 'Extra work ' else 'Estimate ' end; f text[] := '{}';
begin
  if p_action = 'insert' then return v_kind || coalesce(p_new ->> 'display_number', '') || ' written'; end if;
  if p_action <> 'update' then return null; end if;
  if 'status' = any (p_changed) then
    f := f || array[(case p_new ->> 'status' when 'sent' then 'Sent to the customer' when 'viewed' then 'Customer opened it' when 'accepted' then 'Approved' when 'declined' then 'Declined' when 'expired' then 'Expired' when 'draft' then 'Back to draft' else 'Status: ' || (p_new ->> 'status') end)::text];
  end if;
  if 'applied_at' = any (p_changed) and p_new ->> 'applied_at' is not null then f := f || array[('Approved work added to the work order')::text]; end if;
  if 'findings_sent_at' = any (p_changed) then f := f || array[('Findings sent to the customer')::text]; end if;
  if 'label' = any (p_changed) then f := f || array[(('Label: ' || coalesce(p_new ->> 'label', 'none')))::text]; end if;
  if 'status_label' = any (p_changed) then f := f || array[(('Status: ' || coalesce(p_new ->> 'status_label', 'none')))::text]; end if;
  if 'parts_status' = any (p_changed) then f := f || array[(('Parts: ' || coalesce(p_new ->> 'parts_status', 'none')))::text]; end if;
  if 'due_in' = any (p_changed) then f := f || array[('Due in changed')::text]; end if;
  if 'due_out' = any (p_changed) then f := f || array[('Due out changed')::text]; end if;
  if 'fleet_number' = any (p_changed) then f := f || array[('Fleet number changed')::text]; end if;
  if 'holder_id' = any (p_changed) then
    select public._initials(full_name) into v_x from public.profiles where id = nullif(p_new ->> 'holder_id', '')::uuid;
    f := f || array[(('Handed to ' || coalesce(v_x, 'someone')))::text];
  end if;
  if 'odometer' = any (p_changed) then f := f || array[(('Mileage in: ' || coalesce(p_new ->> 'odometer', 'none')))::text]; end if;
  if 'customer_concern' = any (p_changed) then f := f || array[('Customer''s concern edited')::text]; end if;
  if 'customer_notes' = any (p_changed) or 'internal_notes' = any (p_changed) then f := f || array[('Notes edited')::text]; end if;
  if 'vehicle_id' = any (p_changed) then f := f || array[('Car changed')::text]; end if;
  if 'po_number' = any (p_changed) then f := f || array[('PO number changed')::text]; end if;
  if array_length(f, 1) is null then return null; end if;
  return array_to_string(f, ' · ');
end $$;

create or replace function public._act_job(p_action text, p_old jsonb, p_new jsonb, p_changed text[])
returns text language plpgsql stable set search_path = public as $$
declare v_x text; f text[] := '{}';
begin
  if p_action = 'insert' then return 'Work order opened' || coalesce(' (' || (p_new ->> 'ro_number') || ')', ''); end if;
  if p_action <> 'update' then return null; end if;
  if 'completed_at' = any (p_changed) and p_new ->> 'completed_at' is not null then f := f || array[('Work marked done')::text]; end if;
  if 'qc_at' = any (p_changed) and p_new ->> 'qc_at' is not null then f := f || array[('Quality check signed off')::text]; end if;
  if 'invoiced_at' = any (p_changed) and p_new ->> 'invoiced_at' is not null then f := f || array[('Invoice made')::text]; end if;
  if 'paid_at' = any (p_changed) and p_new ->> 'paid_at' is not null then f := f || array[('Paid in full')::text]; end if;
  if 'receipt_signed_at' = any (p_changed) and p_new ->> 'receipt_signed_at' is not null then f := f || array[('Pickup signature taken')::text]; end if;
  if 'picked_up_at' = any (p_changed) and p_new ->> 'picked_up_at' is not null then f := f || array[('Picked up and closed')::text]; end if;
  if 'detailer_id' = any (p_changed) then
    select public._initials(full_name) into v_x from public.profiles where id = nullif(p_new ->> 'detailer_id', '')::uuid;
    f := f || array[(('Tech: ' || coalesce(v_x, 'someone')))::text];
  end if;
  if 'odometer_out' = any (p_changed) then f := f || array[(('Mileage out: ' || coalesce(p_new ->> 'odometer_out', 'none')))::text]; end if;
  if 'deleted_at' = any (p_changed) and p_new ->> 'deleted_at' is not null then f := f || array[('Deleted')::text]; end if;
  if array_length(f, 1) is null then return null; end if;
  return array_to_string(f, ' · ');
end $$;
revoke execute on function public._act_estimate(text, jsonb, jsonb, text[]), public._act_job(text, jsonb, jsonb, text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The log: newest first
-- ---------------------------------------------------------------------------
create or replace function public.visit_activity(p_estimate uuid, p_limit int default 300)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.estimates; v_company uuid := public.current_company_id(); v_money boolean := public.can_price_jobs(); v_job uuid; v_ids uuid[]; v_since timestamptz; r jsonb;
begin
  if not public.is_admin() then raise exception 'Only the owner, an admin, a manager or an advisor reads the activity log' using errcode = '42501'; end if;
  select * into e from public.estimates where id = p_estimate and company_id = v_company;
  if e.id is null then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  -- an extra-work estimate shows the log of the visit it belongs to
  if e.kind = 'supplement' and e.job_id is not null then
    select * into e from public.estimates where job_id = e.job_id and kind = 'quote' order by created_at limit 1;
  end if;
  v_job := e.job_id;
  select coalesce(array_agg(x.id), '{}') into v_ids from public.estimates x where x.company_id = v_company and (x.id = e.id or (v_job is not null and x.job_id = v_job));
  v_since := (select min(created_at) from public.estimates where id = any (v_ids)) - interval '1 day';

  with a as (
    select al.* from public.audit_log al
    where al.company_id = v_company and al.created_at >= v_since and (
         (al.table_name = 'estimates' and al.row_id = any (v_ids))
      or (al.table_name in ('estimate_lines', 'estimate_authorizations') and coalesce(al.new_data, al.old_data) ->> 'estimate_id' = any (select i::text from unnest(v_ids) i))
      or (v_job is not null and al.table_name = 'jobs' and al.row_id = v_job)
      or (v_job is not null and al.table_name = 'job_authorizations' and coalesce(al.new_data, al.old_data) ->> 'job_id' = v_job::text)
      or (al.table_name in ('job_findings', 'job_photos', 'payments') and (coalesce(al.new_data, al.old_data) ->> 'estimate_id' = any (select i::text from unnest(v_ids) i) or (v_job is not null and coalesce(al.new_data, al.old_data) ->> 'job_id' = v_job::text)))
    )
  ), who as (
    select al.id, public._initials(p.full_name) as ini from a al left join public.profiles p on p.id = al.actor_id
  ), items as (
    -- the estimate and the work order
    select al.created_at as at,
           coalesce(w.ini, case when al.table_name = 'estimates' and ('first_viewed_at' = any (al.changed) or (al.new_data ->> 'status') in ('accepted', 'declined')) then 'Customer' else 'System' end) as who,
           al.table_name as kind,
           case al.table_name when 'estimates' then public._act_estimate(al.action, al.old_data, al.new_data, al.changed) else public._act_job(al.action, al.old_data, al.new_data, al.changed) end as text
    from a al join who w on w.id = al.id where al.table_name in ('estimates', 'jobs')
    union all
    -- lines, one entry per person and minute (a save rewrites every line)
    select max(al.created_at), coalesce(max(w.ini), 'System'), 'lines',
           'Lines edited: ' || count(*) filter (where al.action = 'insert') || ' added, ' || count(*) filter (where al.action = 'delete') || ' removed, ' || count(*) filter (where al.action = 'update') || ' changed'
             || coalesce(' (now: ' || nullif(left(string_agg(distinct al.new_data ->> 'name', ', ') filter (where al.action = 'insert'), 120), '') || ')', '')
    from a al join who w on w.id = al.id where al.table_name = 'estimate_lines'
    group by al.actor_id, date_trunc('minute', al.created_at)
    union all
    -- approvals and signatures
    select al.created_at, case when (al.new_data ->> 'by_staff')::boolean then coalesce(w.ini, 'Staff') else 'Customer' end, al.table_name,
           case al.table_name
             when 'estimate_authorizations' then 'Approved by ' || coalesce(al.new_data ->> 'name', 'the customer') || ' (' || coalesce(al.new_data ->> 'method', 'online') || ')' || case when al.new_data ->> 'signature_path' is not null then ' · signature on file' else '' end || case when v_money and al.new_data ->> 'total' is not null then ' · $' || (al.new_data ->> 'total') else '' end
             else case al.new_data ->> 'kind'
                    when 'initial' then 'Check-in signed by ' || coalesce(al.new_data ->> 'name', 'the customer')
                    when 'pickup' then 'Pickup signed by ' || coalesce(al.new_data ->> 'name', 'the customer')
                    when 'change_order' then 'Extra work ' || coalesce(al.new_data ->> 'decision', 'approved') || ' by ' || coalesce(al.new_data ->> 'name', 'the customer') || ' (' || coalesce(al.new_data ->> 'method', 'online') || ')'
                    else null end
           end
    from a al join who w on w.id = al.id where al.action = 'insert' and al.table_name in ('estimate_authorizations', 'job_authorizations')
    union all
    -- findings and notes
    select al.created_at, coalesce(w.ini, 'System'), 'finding',
           case al.action when 'insert' then (case when al.new_data ->> 'kind' = 'note' then 'Note added' else 'Finding added: ' || coalesce(al.new_data ->> 'title', '') || ' (' || coalesce(al.new_data ->> 'severity', '') || ')' end) || case when al.new_data ->> 'customer_visible' = 'false' then ' · internal' else '' end
                          when 'update' then case when 'status' = any (al.changed) then 'Finding "' || coalesce(al.new_data ->> 'title', '') || '": ' || (al.new_data ->> 'status') else null end
                          else 'Removed "' || coalesce(al.old_data ->> 'title', 'a note') || '"' end
    from a al join who w on w.id = al.id where al.table_name = 'job_findings'
    union all
    -- photos and clips, per person and minute
    select max(al.created_at), coalesce(max(w.ini), 'System'), 'photos', count(*) || case when count(*) = 1 then ' photo or clip added' else ' photos or clips added' end
    from a al join who w on w.id = al.id where al.table_name = 'job_photos' and al.action = 'insert'
    group by al.actor_id, date_trunc('minute', al.created_at)
    union all
    -- payments
    select al.created_at, coalesce(w.ini, 'System'), 'payment',
           case when (al.action = 'insert' and al.new_data ->> 'status' = 'paid') or (al.action = 'update' and 'status' = any (al.changed) and al.new_data ->> 'status' in ('paid', 'refunded', 'cancelled', 'failed'))
                then initcap(coalesce(al.new_data ->> 'kind', 'payment')) || ' ' || (al.new_data ->> 'status') || ': ' || replace(coalesce(al.new_data ->> 'method', ''), '_', ' ') || case when v_money then ' $' || coalesce(al.new_data ->> 'amount', '') else '' end
                else null end
    from a al join who w on w.id = al.id where al.table_name = 'payments'
    union all
    -- hand-offs
    select t.created_at, coalesce(public._initials(pf.full_name), 'System'), 'transfer', 'Handed to ' || coalesce(public._initials(pt.full_name), 'someone') || ' · ' || coalesce(t.status_label, 'Checked in') || coalesce(' · "' || t.message || '"', '')
    from public.estimate_transfers t left join public.profiles pf on pf.id = t.from_user left join public.profiles pt on pt.id = t.to_user where t.estimate_id = any (v_ids)
    union all
    select t.resolved_at, coalesce(public._initials(pt.full_name), 'System'), 'transfer', case t.state when 'accepted' then 'Accepted the hand-off' when 'declined' then 'Declined the hand-off' else null end
    from public.estimate_transfers t left join public.profiles pt on pt.id = t.to_user where t.estimate_id = any (v_ids) and t.resolved_at is not null and t.state in ('accepted', 'declined')
    union all
    -- automatic messages
    select coalesce(ar.finished_at, ar.created_at), 'System', 'message', 'Automatic message "' || ru.name || '": ' || ar.status
    from public.automation_runs ar join public.automation_rules ru on ru.id = ar.rule_id
    where ar.company_id = v_company and ar.status in ('sent', 'failed', 'skipped') and ((ar.subject_type = 'estimate' and ar.subject_id = any (v_ids)) or (v_job is not null and ar.subject_type = 'job' and ar.subject_id = v_job))
    union all
    -- signed copies
    select d.created_at, 'System', 'document', 'Signed copy saved (' || d.kind || ')'
    from public.ro_documents d where d.estimate_id = any (v_ids)
    union all
    -- views
    select v.viewed_at, case v.viewer_kind when 'customer' then 'Customer' else coalesce(public._initials(pv.full_name), 'Staff') end, 'view',
           case v.what when 'estimate' then 'Opened the estimate' when 'invoice' then 'Opened the invoice' when 'pdf' then 'Downloaded the PDF' else 'Opened a signed copy' end
    from public.visit_views v left join public.profiles pv on pv.id = v.viewer_id where v.estimate_id = any (v_ids)
  )
  select coalesce(jsonb_agg(jsonb_build_object('at', x.at, 'who', x.who, 'kind', x.kind, 'text', x.text) order by x.at desc), '[]'::jsonb) into r
  from (select * from items where text is not null and at is not null order by at desc limit greatest(p_limit, 1)) x;
  return r;
end $$;
revoke execute on function public.visit_activity(uuid, int) from public, anon;
grant execute on function public.visit_activity(uuid, int) to authenticated;
