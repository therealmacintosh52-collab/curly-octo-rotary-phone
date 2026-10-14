-- =============================================================================
-- 0052 — One repair order that moves through stages
--   Estimate → Work in progress → Invoice → Paid/Closed, on one record with one
--   RO number. Nothing is rewritten between stages: the approved estimate lines
--   become the RO's lines and carry a link back (job_services.estimate_line_id)
--   and the authorization that covered them (job_services.authorization_id).
--   * The invoice (RI-…) is no longer created when the customer approves: the
--     advisor converts the RO (convert_ro_to_invoice) once the work is done and
--     it matches what was approved. Approval makes the RO.
--   * The customer's concern (their words) lives on the estimate and the RO;
--     the advisor's initials ride on the estimate.
--   * job_authorizations is the append-only record of who authorized what, how,
--     when and for how much (initial at check-in, the estimate, change orders).
--     A line with no authorization is "not authorized" and blocks the invoice.
--   * Check-in (check_in_appointment) records mileage in, the concern and the
--     initial authorization (signature) and opens the RO.
--   * The RO number is minted when an estimate is first sent (or approved
--     in person), so drafts never burn numbers. A supplement carries the RO it
--     was written for.
--   * Existing retail invoices are backfilled as converted; paid ones as closed.
--   * A retail repair order's lines change through an estimate, not the plain
--     job editor (a retail update_job with services is refused).
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

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.estimates add column if not exists customer_concern text;
alter table public.estimates add column if not exists ro_number text;
create index if not exists estimates_ro_number_idx on public.estimates (company_id, ro_number) where ro_number is not null;

alter table public.jobs add column if not exists customer_concern text;
alter table public.jobs add column if not exists invoiced_at timestamptz;
alter table public.jobs add column if not exists closed_at timestamptz;
alter table public.jobs add column if not exists advisor_id uuid references public.profiles (id);

-- ---------------------------------------------------------------------------
-- The authorization record (append-only; money readable through the RPCs only)
-- ---------------------------------------------------------------------------
create table if not exists public.job_authorizations (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  job_id         uuid not null references public.jobs (id) on delete cascade,
  kind           text not null check (kind in ('initial', 'estimate', 'change_order')),
  estimate_id    uuid references public.estimates (id) on delete set null,
  amount         numeric(12,2) not null default 0,
  name           text not null,
  method         text not null check (method in ('online', 'in_person', 'phone', 'email')),
  by_staff       boolean not null default false,
  signature_path text,
  ip             text,
  user_agent     text,
  authorized_at  timestamptz not null default now(),
  created_by     uuid references public.profiles (id)
);
create index if not exists job_authorizations_job_idx on public.job_authorizations (job_id, authorized_at desc);

alter table public.job_authorizations enable row level security;
drop policy if exists job_authorizations_select on public.job_authorizations;
create policy job_authorizations_select on public.job_authorizations for select to authenticated using (company_id = public.current_company_id());
revoke all on public.job_authorizations from authenticated, anon;
grant select (id, company_id, job_id, kind, estimate_id, name, method, by_staff, signature_path, authorized_at) on public.job_authorizations to authenticated;
drop trigger if exists audit on public.job_authorizations;
create trigger audit after insert or update or delete on public.job_authorizations for each row execute function public.tg_audit();

-- the tie from an RO line back to the estimate line and the authorization that covered it
alter table public.job_services add column if not exists estimate_line_id uuid references public.estimate_lines (id) on delete set null;
alter table public.job_services add column if not exists authorization_id uuid references public.job_authorizations (id) on delete set null;
grant select (estimate_line_id, authorization_id) on public.job_services to authenticated;
create index if not exists job_services_authorization_idx on public.job_services (authorization_id) where authorization_id is not null;

-- ---------------------------------------------------------------------------
-- Existing retail work: invoices already issued stay converted (paid ones closed)
-- ---------------------------------------------------------------------------
do $$
begin
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs set invoiced_at = coalesce(invoiced_at, performed_at, created_at) where retail_invoice_number is not null and invoiced_at is null;
  update public.jobs set closed_at = paid_at where paid_at is not null and closed_at is null and invoiced_at is not null;
  perform set_config('app.bypass_lock', 'off', true);
end $$;

-- ---------------------------------------------------------------------------
-- The RI- number is minted when the RO is converted, not when the job is created
-- ---------------------------------------------------------------------------
create or replace function public.tg_job_retail_invoice_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  return new;  -- minted by convert_ro_to_invoice (0052)
end $$;

-- Lines on a repair order that no authorization covers.
create or replace function public._ro_unauthorized_count(p_job uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.job_services where job_id = p_job and authorization_id is null
$$;
revoke execute on function public._ro_unauthorized_count(uuid) from public, anon, authenticated;

-- Convert the repair order to the customer's invoice (advisor / admin / owner).
-- Slice 3 adds the completion checks (mileage out, cause and correction, quality check).
create or replace function public.convert_ro_to_invoice(p_job uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare j public.jobs; v_retail boolean; v_bad integer;
begin
  if not public.can_price_jobs() then
    raise exception 'Only the owner, an admin or an advisor converts a repair order to an invoice' using errcode = '42501';
  end if;
  select * into j from public.jobs where id = p_job and company_id = public.current_company_id();
  if j.id is null then raise exception 'Repair order not found' using errcode = 'P0002'; end if;
  select retail into v_retail from public.dealerships where id = j.dealership_id;
  if not coalesce(v_retail, false) then raise exception 'Not a retail repair order' using errcode = 'P0001'; end if;
  if j.deleted_at is not null then raise exception 'That repair order was deleted' using errcode = 'P0001'; end if;
  if j.invoiced_at is not null then raise exception 'Already invoiced' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.job_services where job_id = j.id) then
    raise exception 'There is no approved work on this repair order' using errcode = '22023';
  end if;
  v_bad := public._ro_unauthorized_count(j.id);
  if v_bad > 0 then
    raise exception '% line(s) are not authorized by the customer; get an approval before invoicing', v_bad using errcode = 'P0001';
  end if;
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs
     set retail_invoice_number = coalesce(retail_invoice_number, public._next_retail_invoice_number(j.company_id)), invoiced_at = now(), updated_at = now()
   where id = j.id
   returning * into j;
  perform set_config('app.bypass_lock', 'off', true);
  perform public._emit(j.company_id, 'ro.invoiced', 'job', j.id, j.customer_id);
  return jsonb_build_object('job_id', j.id, 'invoice_number', j.retail_invoice_number, 'invoiced_at', j.invoiced_at);
end $$;
revoke execute on function public.convert_ro_to_invoice(uuid) from public, anon;
grant execute on function public.convert_ro_to_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Estimates: the concern, the RO number, the advisor's initials
-- ---------------------------------------------------------------------------
do $$
begin
  -- a supplement carries the RO it was written for
  perform public._patch_function('create_estimate', 'customer_concern',
    'created_by, job_id, kind, odometer)',
    'created_by, job_id, kind, odometer, customer_concern, ro_number)');
  perform public._patch_function('create_estimate', 'p ->> ''customer_concern''',
    ')::integer)
  returning * into e;',
    ')::integer,
          nullif(trim(coalesce(p ->> ''customer_concern'', '''')), ''''), v_job.ro_number)
  returning * into e;');
  perform public._patch_function('update_estimate', 'customer_concern',
    '    customer_notes = case when p ? ''customer_notes'' then nullif(trim(p ->> ''customer_notes''), '''') else customer_notes end,',
    '    customer_notes = case when p ? ''customer_notes'' then nullif(trim(p ->> ''customer_notes''), '''') else customer_notes end,
    customer_concern = case when p ? ''customer_concern'' then nullif(trim(p ->> ''customer_concern''), '''') else customer_concern end,');
  -- minted at the first send
  perform public._patch_function('send_estimate', '_next_ro_number',
    '  update public.estimates set status = case when status = ''viewed'' then ''viewed'' else ''sent'' end, sent_at = coalesce(sent_at, now()) where id = p_id returning * into e;',
    '  update public.estimates set status = case when status = ''viewed'' then ''viewed'' else ''sent'' end, sent_at = coalesce(sent_at, now()),
         ro_number = coalesce(ro_number, public._next_ro_number(e.company_id)) where id = p_id returning * into e;');
  perform public._patch_function('_estimate_json', '''customer_concern''',
    '''po_number'', e.po_number, ''odometer'', e.odometer,',
    '''po_number'', e.po_number, ''odometer'', e.odometer, ''customer_concern'', e.customer_concern, ''ro_number'', e.ro_number,
    ''advisor'', (select nullif(upper(left(split_part(trim(pr.full_name), '' '', 1), 1) || left(split_part(trim(pr.full_name), '' '', 2), 1)), '''') from public.profiles pr where pr.id = e.created_by),');
  perform public._patch_function('_estimate_json', '''invoiced_at''',
    '''performed_at'', j.performed_at, ''paid_at'', j.paid_at,',
    '''performed_at'', j.performed_at, ''paid_at'', j.paid_at, ''invoiced_at'', j.invoiced_at,');
  perform public._patch_function('_receipt_json', '''invoiced_at''',
    '''ro_number'', j.ro_number, ''tag'', j.tag_number, ''performed_at'', j.performed_at,',
    '''ro_number'', j.ro_number, ''invoiced_at'', j.invoiced_at, ''concern'', j.customer_concern, ''tag'', j.tag_number, ''performed_at'', j.performed_at,');
end $$;

-- ---------------------------------------------------------------------------
-- Approval makes the RO (no invoice yet), with the lines tied to their
-- estimate line and the authorization the customer (or staff) just gave.
-- ---------------------------------------------------------------------------
do $$
begin
  perform public._patch_function('_convert_estimate_core', 'v_auth',
    '  v_n       integer := 0;
begin',
    '  v_n       integer := 0;
  v_ea      public.estimate_authorizations;
  v_auth    uuid;
begin');
  perform public._patch_function('_convert_estimate_core', 'e.customer_concern',
    'performed_at, notes, customer_id, vehicle_id, created_by, updated_by)',
    'performed_at, notes, customer_id, vehicle_id, created_by, updated_by, ro_number, customer_concern, advisor_id)');
  perform public._patch_function('_convert_estimate_core', 'e.created_by)',
    '            e.customer_id, e.vehicle_id, v_uid, v_uid)
    returning * into j;',
    '            e.customer_id, e.vehicle_id, v_uid, v_uid, e.ro_number, e.customer_concern, e.created_by)
    returning * into j;');
  perform public._patch_function('_convert_estimate_core', 'job_authorizations',
    '  perform set_config(''app.bypass_lock'', ''on'', true);
  for l in',
    '  select * into v_ea from public.estimate_authorizations where estimate_id = p_id order by authorized_at desc limit 1;
  if v_ea.id is not null then
    insert into public.job_authorizations (company_id, job_id, kind, estimate_id, amount, name, method, by_staff, signature_path, ip, user_agent, authorized_at, created_by)
    values (e.company_id, j.id, case when e.kind = ''supplement'' then ''change_order'' else ''estimate'' end, e.id, v_ea.total, v_ea.name, v_ea.method, v_ea.by_staff is not null,
            v_ea.signature_path, v_ea.ip, v_ea.user_agent, v_ea.authorized_at, v_ea.by_staff)
    returning id into v_auth;
  end if;
  perform set_config(''app.bypass_lock'', ''on'', true);
  for l in');
  perform public._patch_function('_convert_estimate_core', 'estimate_line_id',
    'insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price)
    values (e.company_id, j.id, v_svc, l.line_total, null, v_label, false);',
    'insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price, estimate_line_id, authorization_id)
    values (e.company_id, j.id, v_svc, l.line_total, null, v_label, false, l.id, v_auth);');
  perform public._patch_function('_convert_estimate_core', 'Shop supplies'', false, null',
    'insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price)
    values (e.company_id, j.id, public._estimate_system_service(e.company_id, ''shop_supplies''), v_sup, null, ''Shop supplies'', false);',
    'insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price, estimate_line_id, authorization_id)
    values (e.company_id, j.id, public._estimate_system_service(e.company_id, ''shop_supplies''), v_sup, null, ''Shop supplies'', false, null, v_auth);');
  perform public._patch_function('_convert_estimate_core', 'ro_number = j.ro_number',
    '  update public.estimates set job_id = j.id, applied_at = now() where id = p_id;',
    '  update public.estimates set job_id = j.id, applied_at = now(), ro_number = coalesce(ro_number, j.ro_number) where id = p_id;');
end $$;

-- A retail repair order's lines come from estimates, never the plain job editor.
do $$
begin
  perform public._patch_function('update_job', 'Retail work changes through an estimate',
    '    delete from public.job_services where job_id = p_id;',
    '    if coalesce(v_dealer.retail, false) and coalesce(current_setting(''app.allow_retail_job'', true), '''') <> ''on'' then
      raise exception ''Retail work changes through an estimate'' using errcode = ''P0001'';
    end if;
    delete from public.job_services where job_id = p_id;');
  -- the counter takes payment on an invoice, not on work in progress
  perform public._patch_function('record_retail_payment', 'Convert the repair order to an invoice first',
    '  if p_method <> ''clover'' and not public.is_owner_admin() then',
    '  if j.invoiced_at is null and coalesce(current_setting(''app.allow_retail_job'', true), '''') <> ''on'' then
    raise exception ''Convert the repair order to an invoice first'' using errcode = ''P0001'';
  end if;
  if p_method <> ''clover'' and not public.is_owner_admin() then');
  -- the dashboard counts invoices, not work in progress
  perform public._patch_function('retail_dashboard', 'invoiced',
    'public._retail_invoice_status(false, j.paid_at, m.deposit_paid + m.paid) as status, m.balance',
    'public._retail_invoice_status(false, j.paid_at, m.deposit_paid + m.paid) as status, m.balance, (j.invoiced_at is not null) as invoiced');
  perform public._patch_function('retail_dashboard', 'where invoiced and status in (''unpaid'', ''partial'')) ,',
    '''unpaid_invoices'', (select count(*) from r where status in (''unpaid'', ''partial'')),',
    '''unpaid_invoices'', (select count(*) from r where invoiced and status in (''unpaid'', ''partial'')),');
  perform public._patch_function('retail_dashboard', 'sum(balance), 0) from r where invoiced',
    '''unpaid_total'', (select coalesce(sum(balance), 0) from r where status in (''unpaid'', ''partial'')),',
    '''unpaid_total'', (select coalesce(sum(balance), 0) from r where invoiced and status in (''unpaid'', ''partial'')),');
end $$;

-- ---------------------------------------------------------------------------
-- Check-in: mileage in, the customer's concern, the initial authorization
--   p: {odometer?, concern?, name, amount_limit?, method?, signature_path?}
--   Opens the repair order (set_appointment_status → _appointment_create_job),
--   writes the authorization and ties the lines already on the RO to it.
-- ---------------------------------------------------------------------------
create or replace function public.check_in_appointment(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a        public.appointments;
  v_json   jsonb;
  v_job    uuid;
  j        public.jobs;
  v_name   text := nullif(left(trim(coalesce(p ->> 'name', '')), 120), '');
  v_method text := coalesce(nullif(p ->> 'method', ''), 'in_person');
  v_odo    integer := nullif(regexp_replace(coalesce(p ->> 'odometer', ''), '[^0-9]', '', 'g'), '')::integer;
  v_limit  numeric := nullif(p ->> 'amount_limit', '')::numeric;
  v_sig    text := nullif(p ->> 'signature_path', '');
  v_need   boolean;
  v_auth   uuid;
begin
  if not public.is_admin() then
    raise exception 'Only the owner, an admin, an advisor or a manager checks a car in' using errcode = '42501';
  end if;
  select * into a from public.appointments where id = p_id and company_id = public.current_company_id();
  if a.id is null then raise exception 'Appointment not found' using errcode = 'P0002'; end if;
  if v_name is null then raise exception 'The customer''s name is needed for the authorization' using errcode = '22023'; end if;
  if v_method not in ('online', 'in_person', 'phone', 'email') then raise exception 'Unknown method' using errcode = '22023'; end if;
  select signature_required_estimate into v_need from public.retail_settings where company_id = a.company_id;
  if v_method = 'in_person' and coalesce(v_need, false) and v_sig is null then
    raise exception 'The customer signs to authorize the diagnosis' using errcode = '22023';
  end if;
  if v_sig is not null and v_sig not like a.company_id::text || '/checkins/' || a.id::text || '/%' then
    raise exception 'Unknown signature file' using errcode = '22023';
  end if;

  v_json := public.set_appointment_status(p_id, 'in_progress');
  v_job := nullif(v_json ->> 'job_id', '')::uuid;
  if v_job is null then raise exception 'The repair order was not opened' using errcode = 'P0001'; end if;
  select * into j from public.jobs where id = v_job;

  if v_odo is not null and j.vehicle_id is not null then
    if not exists (select 1 from public.odometer_readings where job_id = v_job) then
      insert into public.odometer_readings (company_id, vehicle_id, reading, read_at, job_id, created_by)
      values (j.company_id, j.vehicle_id, v_odo, clock_timestamp(), v_job, auth.uid());
    end if;
  end if;
  update public.jobs set customer_concern = coalesce(nullif(trim(coalesce(p ->> 'concern', '')), ''), customer_concern), advisor_id = coalesce(advisor_id, auth.uid()), updated_at = now() where id = v_job;

  insert into public.job_authorizations (company_id, job_id, kind, amount, name, method, by_staff, signature_path, ip, user_agent, created_by)
  values (j.company_id, v_job, 'initial',
          coalesce(v_limit, (select coalesce(sum(price), 0) from public.job_services where job_id = v_job)),
          v_name, v_method, true, v_sig, null, null, auth.uid())
  returning id into v_auth;
  perform set_config('app.bypass_lock', 'on', true);
  update public.job_services set authorization_id = v_auth where job_id = v_job and authorization_id is null;
  perform set_config('app.bypass_lock', 'off', true);
  return v_json;
end $$;
revoke execute on function public.check_in_appointment(uuid, jsonb) from public, anon;
grant execute on function public.check_in_appointment(uuid, jsonb) to authenticated;

-- The authorizations of one repair order, for the RO page (money only for those who price jobs).
create or replace function public.ro_authorizations(p_job uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_money boolean := public.can_price_jobs();
begin
  if not exists (select 1 from public.jobs where id = p_job and company_id = public.current_company_id()) then
    raise exception 'Repair order not found' using errcode = 'P0002';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', a.id, 'kind', a.kind, 'authorized_at', a.authorized_at, 'name', a.name, 'method', a.method, 'by_staff', a.by_staff,
            'has_signature', a.signature_path is not null, 'estimate_id', a.estimate_id,
            'amount', case when v_money then a.amount end
          ) order by a.authorized_at), '[]'::jsonb)
          from public.job_authorizations a where a.job_id = p_job);
end $$;
revoke execute on function public.ro_authorizations(uuid) from public, anon;
grant execute on function public.ro_authorizations(uuid) to authenticated;

-- The customer's link (/r/<token>) opens on work in progress too: what we found and what is approved.
select public._patch_function('receipt_link', 'dealerships d',
  '(paid_at is not null or retail_invoice_number is not null)',
  '(paid_at is not null or retail_invoice_number is not null or exists (select 1 from public.dealerships d where d.id = dealership_id and d.retail))');

-- Retail rows in the Work list carry their stage (invoiced_at; paid_at is already there).
select public._patch_function('jobs_filtered', '''invoiced_at''',
  '''retail_invoice_number'', b.retail_invoice_number,',
  '''retail_invoice_number'', b.retail_invoice_number, ''invoiced_at'', b.invoiced_at,');

drop function public._patch_function(text, text, text, text);
