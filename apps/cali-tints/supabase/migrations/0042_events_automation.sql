-- 0042: the events outbox and the automation engine. Every retail write
-- that matters records an event; rules (when EVENT → wait N minutes → if
-- CONDITION → ACTION) turn events into runs; a runner every five minutes
-- claims due runs, sends the email, queues the text for the owner's phone
-- (no SMS provider is paid for), notifies the owner, and logs the result.
-- Some kinds are derived from state on each pass (a hold about to expire,
-- the 24 h / 2 h reminders, an abandoned booking, an unanswered estimate).
-- Quiet hours hold a run until morning. Re-runnable; nothing destructive.
--
-- Reversal: drop text_queue, automation_runs, automation_rules, events,
-- the review columns on customers, the automation columns on
-- retail_settings and the functions below; the patched RPCs lose their
-- _emit calls when re-created from 0039–0041.

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  kind         text not null,
  subject_type text not null check (subject_type in ('appointment', 'estimate', 'job', 'customer', 'payment')),
  subject_id   uuid not null,
  customer_id  uuid references public.customers (id),
  payload      jsonb not null default '{}'::jsonb,
  dedupe_key   text unique,
  occurred_at  timestamptz not null default now(),
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists events_company_unprocessed_idx on public.events (company_id, occurred_at) where processed_at is null;
create index if not exists events_subject_idx on public.events (subject_type, subject_id, kind);

create table if not exists public.automation_rules (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  key           text,
  name          text not null,
  enabled       boolean not null default true,
  event_kind    text not null,
  delay_minutes integer not null default 0 check (delay_minutes between 0 and 43200),
  condition     jsonb not null default '{}'::jsonb,
  action        jsonb not null default '{}'::jsonb,
  system        boolean not null default false,
  sort_order    integer not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, key)
);

create table if not exists public.automation_runs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  rule_id      uuid not null references public.automation_rules (id) on delete cascade,
  event_id     uuid not null references public.events (id) on delete cascade,
  subject_type text not null,
  subject_id   uuid not null,
  customer_id  uuid references public.customers (id),
  due_at       timestamptz not null,
  status       text not null default 'queued' check (status in ('queued', 'claimed', 'sent', 'skipped', 'failed')),
  result       text,
  claimed_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (rule_id, event_id)
);
create index if not exists automation_runs_due_idx on public.automation_runs (company_id, due_at) where status = 'queued';
create index if not exists automation_runs_log_idx on public.automation_runs (company_id, created_at desc);

create table if not exists public.text_queue (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  customer_id  uuid references public.customers (id),
  run_id       uuid references public.automation_runs (id) on delete set null,
  phone        text not null,
  body         text not null,
  reason       text,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  sent_by      uuid references public.profiles (id),
  dismissed_at timestamptz
);
create index if not exists text_queue_open_idx on public.text_queue (company_id, created_at) where sent_at is null and dismissed_at is null;

alter table public.customers add column if not exists review_requested_at timestamptz;
alter table public.customers add column if not exists reviewed_at timestamptz;
alter table public.retail_settings add column if not exists review_url text;
alter table public.retail_settings add column if not exists quiet_from time not null default '20:00';
alter table public.retail_settings add column if not exists quiet_to time not null default '08:00';
alter table public.retail_settings add column if not exists abandoned_minutes integer not null default 15 check (abandoned_minutes between 1 and 1440);
alter table public.retail_settings add column if not exists review_delay_minutes integer not null default 30 check (review_delay_minutes between 0 and 10080);
alter table public.retail_settings add column if not exists review_skip_days integer not null default 90 check (review_skip_days between 0 and 3650);
alter table public.retail_settings add column if not exists estimate_nudge_days integer not null default 3 check (estimate_nudge_days between 0 and 60);

do $$
declare t text;
begin
  execute 'drop trigger if exists set_updated_at on public.automation_rules';
  execute 'create trigger set_updated_at before update on public.automation_rules for each row execute function public.tg_set_updated_at()';
  foreach t in array array['automation_rules', 'text_queue'] loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

-- Access: rules and the log are owner/admin reading through RPCs; the text queue is every member's; events are the runner's.
alter table public.events enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;
alter table public.text_queue enable row level security;
revoke all on public.events, public.automation_rules, public.automation_runs, public.text_queue from authenticated, anon;
drop policy if exists automation_rules_select on public.automation_rules;
create policy automation_rules_select on public.automation_rules for select to authenticated using (company_id = public.current_company_id() and public.is_owner_admin());
drop policy if exists automation_runs_select on public.automation_runs;
create policy automation_runs_select on public.automation_runs for select to authenticated using (company_id = public.current_company_id() and public.is_owner_admin());
drop policy if exists text_queue_select on public.text_queue;
create policy text_queue_select on public.text_queue for select to authenticated using (company_id = public.current_company_id());
grant select on public.automation_rules, public.automation_runs, public.text_queue to authenticated;

-- The two new customer emails, added to every company's templates when missing.
update public.retail_settings set email_templates = email_templates
  || case when email_templates ? 'review_request' then '{}'::jsonb else jsonb_build_object('review_request', jsonb_build_object('subject', 'How did we do?', 'body', E'Hi {{first_name}},\n\nThanks for bringing the {{vehicle}} in. If you have a minute, a review helps us more than you know: {{review_url}}\n\n{{company}}')) end
  || case when email_templates ? 'estimate_nudge' then '{}'::jsonb else jsonb_build_object('estimate_nudge', jsonb_build_object('subject', 'Still thinking it over?', 'body', E'Hi {{first_name}},\n\nYour estimate for the {{vehicle}} is still open: {{estimate_url}}\n\nQuestions? Just reply. It is good until {{expires}}.\n\n{{company}}')) end
  || case when email_templates ? 'booking_received' then '{}'::jsonb else jsonb_build_object('booking_received', jsonb_build_object('subject', 'We got your booking request', 'body', E'Hi {{first_name}},\n\nThanks! We have the {{vehicle}} down for {{starts_at}} and will confirm shortly. Move or cancel here: {{manage_url}}\n\n{{company}}')) end;

-- ---------------------------------------------------------------------------
-- Emission
-- ---------------------------------------------------------------------------
create or replace function public._emit(p_company uuid, p_kind text, p_subject_type text, p_subject_id uuid, p_customer uuid default null, p_payload jsonb default '{}'::jsonb, p_dedupe text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.events (company_id, kind, subject_type, subject_id, customer_id, payload, dedupe_key)
  values (p_company, p_kind, p_subject_type, p_subject_id, p_customer, coalesce(p_payload, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public._emit(uuid, text, text, uuid, uuid, jsonb, text) from public, anon, authenticated;

-- Patch the RPCs from 0039–0041 so they record their events (idempotent: each patch checks for its marker).
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
begin
  -- hold.created
  perform public._patch_function('create_hold', '''hold.created''',
    'return jsonb_build_object(''token'', a.token, ''display_number'', a.display_number, ''starts_at'', a.starts_at, ''ends_at'', a.ends_at, ''hold_expires_at'', a.hold_expires_at,',
    'perform public._emit(a.company_id, ''hold.created'', ''appointment'', a.id, a.customer_id);
  return jsonb_build_object(''token'', a.token, ''display_number'', a.display_number, ''starts_at'', a.starts_at, ''ends_at'', a.ends_at, ''hold_expires_at'', a.hold_expires_at,');
  -- booking.lead
  perform public._patch_function('confirm_hold', '''booking.lead''',
    '  select * into a from public.appointments where id = a.id;
  return jsonb_build_object(''token'', a.token, ''status'', a.status,',
    '  select * into a from public.appointments where id = a.id;
  if a.status = ''lead'' then perform public._emit(a.company_id, ''booking.lead'', ''appointment'', a.id, a.customer_id); end if;
  return jsonb_build_object(''token'', a.token, ''status'', a.status,');
  -- staff status changes
  perform public._patch_function('set_appointment_status', '''booking.booked''',
    'update public.appointments set status = ''booked'', confirmed_at = now(), hold_expires_at = null where id = a.id;',
    'update public.appointments set status = ''booked'', confirmed_at = now(), hold_expires_at = null where id = a.id; perform public._emit(a.company_id, ''booking.booked'', ''appointment'', a.id, a.customer_id, jsonb_build_object(''by'', ''staff''));');
  perform public._patch_function('set_appointment_status', '''booking.checked_in''',
    'perform public._appointment_create_job(a.id);',
    'perform public._appointment_create_job(a.id); perform public._emit(a.company_id, ''booking.checked_in'', ''appointment'', a.id, a.customer_id);');
  perform public._patch_function('set_appointment_status', '''booking.done''',
    'update public.appointments set status = ''done'', done_at = now() where id = a.id;',
    'update public.appointments set status = ''done'', done_at = now() where id = a.id; perform public._emit(a.company_id, ''booking.done'', ''appointment'', a.id, a.customer_id);');
  perform public._patch_function('set_appointment_status', '''booking.cancelled''',
    'cancel_reason = nullif(left(trim(coalesce(p_reason, '''')), 300), '''') where id = a.id;',
    'cancel_reason = nullif(left(trim(coalesce(p_reason, '''')), 300), '''') where id = a.id; perform public._emit(a.company_id, ''booking.cancelled'', ''appointment'', a.id, a.customer_id, jsonb_build_object(''by'', ''staff''));');
  perform public._patch_function('set_appointment_status', '''booking.no_show''',
    ', ''No show'') where id = a.id;',
    ', ''No show'') where id = a.id; perform public._emit(a.company_id, ''booking.no_show'', ''appointment'', a.id, a.customer_id);');
  -- moves
  perform public._patch_function('reschedule_appointment', '''booking.rescheduled''',
    'update public.appointments set reminders_sent = ''{}'' where id = a.id;',
    'update public.appointments set reminders_sent = ''{}'' where id = a.id; perform public._emit(a.company_id, ''booking.rescheduled'', ''appointment'', a.id, a.customer_id, jsonb_build_object(''by'', ''staff''));');
  perform public._patch_function('reschedule_by_token', '''booking.rescheduled''',
    'update public.appointments set reminders_sent = ''{}'' where id = a.id;',
    'update public.appointments set reminders_sent = ''{}'' where id = a.id; perform public._emit(a.company_id, ''booking.rescheduled'', ''appointment'', a.id, a.customer_id, jsonb_build_object(''by'', ''customer''));');
  perform public._patch_function('cancel_by_token', '''booking.cancelled''',
    ', ''Cancelled by the customer'') where id = a.id;',
    ', ''Cancelled by the customer'') where id = a.id; perform public._emit(a.company_id, ''booking.cancelled'', ''appointment'', a.id, a.customer_id, jsonb_build_object(''by'', ''customer''));');
  -- payments
  perform public._patch_function('record_payment_system_retail', '''payment.paid''',
    '    if v_pay.appointment_id is not null then
      perform public._apply_paid_deposit(v_pay.appointment_id);',
    '    perform public._emit(v_pay.company_id, ''payment.paid'', ''payment'', v_pay.id, v_pay.customer_id, jsonb_build_object(''kind'', v_pay.kind, ''method'', v_pay.method, ''appointment_id'', v_pay.appointment_id, ''estimate_id'', v_pay.estimate_id));
    if v_pay.appointment_id is not null then
      perform public._apply_paid_deposit(v_pay.appointment_id);');
  perform public._patch_function('record_deposit_at_shop', '''payment.paid''',
    '  perform public._apply_paid_deposit(a.id);
  return public._appointment_json(a.id, public.can_price_jobs(), false);',
    '  perform public._emit(a.company_id, ''payment.paid'', ''payment'', v_pay.id, a.customer_id, jsonb_build_object(''kind'', ''deposit'', ''method'', p_method, ''appointment_id'', a.id));
  perform public._apply_paid_deposit(a.id);
  return public._appointment_json(a.id, public.can_price_jobs(), false);');
  perform public._patch_function('record_retail_payment', '''job.paid''',
    '  perform set_config(''app.bypass_lock'', ''off'', true);
  if j.appointment_id is not null then',
    '  perform set_config(''app.bypass_lock'', ''off'', true);
  perform public._emit(j.company_id, ''job.paid'', ''job'', j.id, j.customer_id, jsonb_build_object(''method'', p_method, ''appointment_id'', j.appointment_id));
  if j.appointment_id is not null then');
  -- estimates
  perform public._patch_function('send_estimate', '''estimate.sent''',
    'sent_at = coalesce(sent_at, now()) where id = p_id returning * into e;',
    'sent_at = coalesce(sent_at, now()) where id = p_id returning * into e;
  perform public._emit(e.company_id, ''estimate.sent'', ''estimate'', e.id, e.customer_id);');
  perform public._patch_function('estimate_mark_viewed', '''estimate.viewed''',
    '  if e.id is null then return; end if;
  update public.estimates set',
    '  if e.id is null then return; end if;
  if e.first_viewed_at is null then perform public._emit(e.company_id, ''estimate.viewed'', ''estimate'', e.id, e.customer_id); end if;
  update public.estimates set');
  perform public._patch_function('estimate_respond', '''estimate.accepted''',
    'update public.estimates set status = ''accepted'', accepted_at = now(), selected_option_id = v_opt where id = e.id;',
    'update public.estimates set status = ''accepted'', accepted_at = now(), selected_option_id = v_opt where id = e.id;
  perform public._emit(e.company_id, ''estimate.accepted'', ''estimate'', e.id, e.customer_id, jsonb_build_object(''method'', ''online'', ''pay_choice'', p ->> ''pay_choice''));');
  perform public._patch_function('estimate_respond', '''estimate.declined''',
    'decline_reason = nullif(left(trim(coalesce(p ->> ''reason'', '''')), 300), '''') where id = e.id;',
    'decline_reason = nullif(left(trim(coalesce(p ->> ''reason'', '''')), 300), '''') where id = e.id;
    perform public._emit(e.company_id, ''estimate.declined'', ''estimate'', e.id, e.customer_id, jsonb_build_object(''method'', ''online''));');
  perform public._patch_function('mark_estimate_accepted', '''estimate.accepted''',
    'update public.estimates set status = ''accepted'', accepted_at = now(), selected_option_id = p_option where id = p_id;',
    'update public.estimates set status = ''accepted'', accepted_at = now(), selected_option_id = p_option where id = p_id;
  perform public._emit(public.current_company_id(), ''estimate.accepted'', ''estimate'', p_id, (select customer_id from public.estimates where id = p_id), jsonb_build_object(''method'', coalesce(p_method, ''in_person'')));');
  perform public._patch_function('decline_estimate', '''estimate.declined''',
    'update public.estimates set status = ''declined'', declined_at = now(), decline_reason = nullif(trim(coalesce(p_reason, '''')), '''')',
    'perform public._emit(public.current_company_id(), ''estimate.declined'', ''estimate'', p_id, (select customer_id from public.estimates where id = p_id), jsonb_build_object(''method'', ''staff''));
  update public.estimates set status = ''declined'', declined_at = now(), decline_reason = nullif(trim(coalesce(p_reason, '''')), '''')');
end $$;

-- A paid deposit books the lead, and says so.
create or replace function public._apply_paid_deposit(p_appointment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.appointments; v_pay public.payments; v_was text;
begin
  select * into a from public.appointments where id = p_appointment;
  if a.id is null then return; end if;
  select * into v_pay from public.payments
   where status = 'paid' and kind = 'deposit'
     and (appointment_id = a.id or (a.estimate_id is not null and estimate_id = a.estimate_id))
   order by paid_at desc limit 1;
  if v_pay.id is null then return; end if;
  v_was := a.status;
  update public.payments set appointment_id = coalesce(appointment_id, a.id), customer_id = coalesce(customer_id, a.customer_id) where id = v_pay.id;
  update public.appointments set
    deposit_paid_at = coalesce(deposit_paid_at, v_pay.paid_at),
    deposit_payment_id = coalesce(deposit_payment_id, v_pay.id),
    status = case when status in ('hold', 'lead') then 'booked' else status end,
    confirmed_at = coalesce(confirmed_at, now()),
    hold_expires_at = null
  where id = a.id;
  if v_was in ('hold', 'lead') then
    perform public._emit(a.company_id, 'booking.booked', 'appointment', a.id, a.customer_id, jsonb_build_object('by', 'deposit'));
  end if;
end $$;
revoke execute on function public._apply_paid_deposit(uuid) from public, anon, authenticated;

-- An expired hold gives its bay back, and says so (the abandoned-booking rule listens).
create or replace function public._release_expired_holds()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select * from public.appointments where status = 'hold' and hold_expires_at < now() for update skip locked loop
    update public.appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Hold expired' where id = r.id;
    perform public._emit(r.company_id, 'hold.expired', 'appointment', r.id, r.customer_id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public._release_expired_holds() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------
-- action: {kind: email|text|both|notify_owner|none, template, owner_subject}  condition: {status_in[], pay_choice, needs_email, needs_consent, review_ok, deposit_unpaid, still_open}
create or replace function public.seed_automation_defaults(p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select * from (values
      ('hold_expiring',      'Hold running out',          'hold.expiring',       0,  '{"status_in":["hold"],"needs_email":true}'::jsonb,                       '{"kind":"email","template":"hold_expiring"}'::jsonb,                           10),
      ('hold_abandoned',     'Abandoned booking',         'hold.expired',       15,  '{"status_in":["cancelled"],"needs_consent":true,"no_later_booking":true}'::jsonb, '{"kind":"both","template":"abandoned"}'::jsonb,                           20),
      ('booking_booked',     'Booking confirmed',         'booking.booked',      0,  '{"status_in":["booked","confirmed"],"needs_email":true}'::jsonb,         '{"kind":"email","template":"booking_confirmed"}'::jsonb,                       30),
      ('booking_reminder',   'Reminder before the visit', 'booking.reminder',    0,  '{"status_in":["booked","confirmed"]}'::jsonb,                            '{"kind":"both","template":"reminder"}'::jsonb,                                 40),
      ('booking_cancelled',  'Cancelled',                 'booking.cancelled',   0,  '{"needs_email":true}'::jsonb,                                            '{"kind":"email","template":"cancelled"}'::jsonb,                               50),
      ('job_review',         'Ask for a review',          'job.paid',           30,  '{"review_ok":true}'::jsonb,                                              '{"kind":"both","template":"review_request"}'::jsonb,                           60),
      ('estimate_nudge',     'Estimate not answered',     'estimate.unanswered', 0,  '{"still_open":true,"needs_email":true}'::jsonb,                          '{"kind":"email","template":"estimate_nudge"}'::jsonb,                          70),
      ('estimate_accepted',  'Tell me when one is approved', 'estimate.accepted', 0, '{}'::jsonb,                                                              '{"kind":"notify_owner","owner_subject":"Estimate approved"}'::jsonb,           80),
      ('lead_created',       'Tell me about a new online booking', 'booking.lead', 0, '{}'::jsonb,                                                            '{"kind":"notify_owner","owner_subject":"New online booking to confirm"}'::jsonb, 90),
      ('lead_received',      'Booking request received',  'booking.lead',        0,  '{"status_in":["lead"],"needs_email":true}'::jsonb,                       '{"kind":"email","template":"booking_received"}'::jsonb,                        95),
      ('payment_receipt',    'Receipt after a paid job',  'job.paid',            0,  '{"needs_email":true}'::jsonb,                                            '{"kind":"email","template":"receipt"}'::jsonb,                                 100)
    ) as v(key, name, event_kind, delay_minutes, condition, action, sort_order)
  loop
    insert into public.automation_rules (company_id, key, name, event_kind, delay_minutes, condition, action, system, sort_order)
    values (p_company, r.key, r.name, r.event_kind, r.delay_minutes, r.condition, r.action, true, r.sort_order)
    on conflict (company_id, key) do nothing;
  end loop;
end $$;
revoke execute on function public.seed_automation_defaults(uuid) from public, anon, authenticated;
do $$
declare c record;
begin
  for c in select id from public.companies loop perform public.seed_automation_defaults(c.id); end loop;
end $$;

-- ---------------------------------------------------------------------------
-- The runner's side (service role)
-- ---------------------------------------------------------------------------
create or replace function public._assert_service_role()
returns void language plpgsql as $$
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') then
    raise exception 'service role only' using errcode = '42501';
  end if;
end $$;
revoke execute on function public._assert_service_role() from public, anon, authenticated;

-- Derived events, once each: a hold about to run out, the reminders, an abandoned booking, an unanswered estimate.
create or replace function public._derive_events()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; v_h integer;
begin
  -- hold.expiring: 10 minutes before the hold ends
  for r in select a.* from public.appointments a where a.status = 'hold' and a.hold_expires_at between now() and now() + interval '10 minutes' loop
    if public._emit(r.company_id, 'hold.expiring', 'appointment', r.id, r.customer_id, '{}'::jsonb, 'hold.expiring:' || r.id::text) is not null then n := n + 1; end if;
  end loop;
  -- booking.reminder: per reminder hour, when inside the window and not yet sent for that mark
  for r in
    select a.*, rs.reminder_hours from public.appointments a join public.retail_settings rs on rs.company_id = a.company_id
    where a.status in ('booked', 'confirmed') and a.starts_at > now() and a.starts_at < now() + interval '49 hours'
  loop
    foreach v_h in array coalesce(r.reminder_hours, '{}') loop
      if r.starts_at - make_interval(hours => v_h) <= now() and r.starts_at - make_interval(hours => v_h) > now() - interval '12 hours' then
        if public._emit(r.company_id, 'booking.reminder', 'appointment', r.id, r.customer_id, jsonb_build_object('hours', v_h), 'booking.reminder:' || r.id::text || ':' || v_h::text || ':' || r.starts_at::text) is not null then n := n + 1; end if;
      end if;
    end loop;
  end loop;
  -- estimate.unanswered: sent N days ago, still open
  for r in
    select e.* from public.estimates e join public.retail_settings rs on rs.company_id = e.company_id
    where e.status in ('sent', 'viewed') and rs.estimate_nudge_days > 0 and e.sent_at < now() - make_interval(days => rs.estimate_nudge_days) and (e.expires_at is null or e.expires_at > now())
  loop
    if public._emit(r.company_id, 'estimate.unanswered', 'estimate', r.id, r.customer_id, '{}'::jsonb, 'estimate.unanswered:' || r.id::text) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function public._derive_events() from public, anon, authenticated;

-- Events → runs (one per matching enabled rule), due after the rule's delay.
create or replace function public.enqueue_due_runs()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_derived integer; v_runs integer := 0; v_events integer := 0; ev record; rl record;
begin
  perform public._assert_service_role();
  perform public._release_expired_holds();
  v_derived := public._derive_events();
  for ev in select * from public.events where processed_at is null order by occurred_at limit 500 loop
    for rl in select * from public.automation_rules where company_id = ev.company_id and enabled and event_kind = ev.kind loop
      insert into public.automation_runs (company_id, rule_id, event_id, subject_type, subject_id, customer_id, due_at)
      values (ev.company_id, rl.id, ev.id, ev.subject_type, ev.subject_id, ev.customer_id,
              ev.occurred_at + make_interval(mins => case when rl.key = 'hold_abandoned' then coalesce((select abandoned_minutes from public.retail_settings where company_id = ev.company_id), rl.delay_minutes)
                                                         when rl.key = 'job_review' then coalesce((select review_delay_minutes from public.retail_settings where company_id = ev.company_id), rl.delay_minutes)
                                                         else rl.delay_minutes end))
      on conflict (rule_id, event_id) do nothing;
      v_runs := v_runs + 1;
    end loop;
    update public.events set processed_at = now() where id = ev.id;
    v_events := v_events + 1;
  end loop;
  return jsonb_build_object('derived', v_derived, 'events', v_events, 'runs', v_runs);
end $$;
revoke execute on function public.enqueue_due_runs() from public, anon, authenticated;
grant execute on function public.enqueue_due_runs() to service_role;

-- Inside quiet hours (shop time)?
create or replace function public._in_quiet_hours(p_company uuid, p_at timestamptz default now())
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when rs.quiet_from = rs.quiet_to then false
    when rs.quiet_from < rs.quiet_to then (p_at at time zone c.timezone)::time >= rs.quiet_from and (p_at at time zone c.timezone)::time < rs.quiet_to
    else (p_at at time zone c.timezone)::time >= rs.quiet_from or (p_at at time zone c.timezone)::time < rs.quiet_to end
  from public.retail_settings rs join public.companies c on c.id = rs.company_id where rs.company_id = p_company
$$;
revoke execute on function public._in_quiet_hours(uuid, timestamptz) from public, anon, authenticated;

-- The subject as the runner needs it: who, the car, the times, the links' tokens, the shop.
create or replace function public._run_subject(p_type text, p_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select case p_type
    when 'appointment' then (select jsonb_build_object('status', a.status, 'starts_at', a.starts_at, 'hold_expires_at', a.hold_expires_at, 'token', a.token, 'pay_choice', a.pay_choice, 'deposit_paid_at', a.deposit_paid_at, 'deposit_required', a.deposit_required, 'display_number', a.display_number,
                                                        'customer_id', a.customer_id, 'contact', a.contact, 'vehicle_draft', a.vehicle_draft, 'job_id', a.job_id,
                                                        'vehicle', (select nullif(concat_ws(' ', v.year::text, v.make, v.model), '') from public.vehicles v where v.id = a.vehicle_id),
                                                        'services', (select string_agg(s.name, ', ' order by s.sort_order) from public.appointment_services s where s.appointment_id = a.id))
                             from public.appointments a where a.id = p_id)
    when 'estimate' then (select jsonb_build_object('status', e.status, 'token', e.token, 'expires_at', e.expires_at, 'display_number', e.display_number, 'customer_id', e.customer_id, 'total', e.total, 'deposit_required', e.deposit_required,
                                                     'vehicle', (select nullif(concat_ws(' ', v.year::text, v.make, v.model), '') from public.vehicles v where v.id = e.vehicle_id))
                          from public.estimates e where e.id = p_id)
    when 'job' then (select jsonb_build_object('status', case when j.paid_at is not null then 'paid' else 'open' end, 'tag', j.tag_number, 'customer_id', j.customer_id, 'paid_at', j.paid_at,
                                                'receipt_token', public._receipt_token(j.id),
                                                'vehicle', nullif(concat_ws(' ', j.year::text, j.make, j.model), ''),
                                                'services', (select string_agg(coalesce(js.label, s.name), ', ') from public.job_services js left join public.services s on s.id = js.service_id where js.job_id = j.id))
                     from public.jobs j where j.id = p_id)
    when 'payment' then (select jsonb_build_object('status', p.status, 'kind', p.kind, 'amount', p.amount, 'customer_id', p.customer_id, 'appointment_id', p.appointment_id, 'job_id', p.job_id) from public.payments p where p.id = p_id)
    else '{}'::jsonb end
$$;
revoke execute on function public._run_subject(text, uuid) from public, anon, authenticated;

-- Due runs, checked against their rule's condition, handed to the runner with everything it needs. Quiet hours hold them.
create or replace function public.claim_runs(p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; out jsonb := '[]'::jsonb; subj jsonb; cond jsonb; c public.customers; rs public.retail_settings; co public.companies; skip text; v_has_later boolean;
begin
  perform public._assert_service_role();
  for r in
    select ar.*, rl.action, rl.condition, rl.key as rule_key, rl.name as rule_name, rl.event_kind, ev.payload
    from public.automation_runs ar join public.automation_rules rl on rl.id = ar.rule_id join public.events ev on ev.id = ar.event_id
    where ar.status = 'queued' and ar.due_at <= now()
    order by ar.due_at limit greatest(1, least(coalesce(p_limit, 50), 200))
    for update of ar skip locked
  loop
    if public._in_quiet_hours(r.company_id) and coalesce((r.action ->> 'respect_quiet')::boolean, true) and (r.action ->> 'kind') <> 'notify_owner' then
      continue;   -- stays queued until the morning
    end if;
    subj := public._run_subject(r.subject_type, r.subject_id);
    cond := coalesce(r.condition, '{}'::jsonb);
    select * into c from public.customers where id = coalesce(r.customer_id, (subj ->> 'customer_id')::uuid);
    select * into rs from public.retail_settings where company_id = r.company_id;
    select * into co from public.companies where id = r.company_id;
    skip := null;
    if cond ? 'status_in' and not (coalesce(subj ->> 'status', '') = any (array(select jsonb_array_elements_text(cond -> 'status_in')))) then skip := 'status is ' || coalesce(subj ->> 'status', 'unknown');
    elsif coalesce((cond ->> 'needs_email')::boolean, false) and nullif(trim(coalesce(c.email, '')), '') is null then skip := 'no email on file';
    elsif coalesce((cond ->> 'needs_consent')::boolean, false) and not (coalesce(c.sms_opt_in, false) or nullif(trim(coalesce(c.email, '')), '') is not null) then skip := 'no consent or email';
    elsif coalesce((cond ->> 'still_open')::boolean, false) and coalesce(subj ->> 'status', '') not in ('sent', 'viewed') then skip := 'estimate is ' || coalesce(subj ->> 'status', 'unknown');
    elsif coalesce((cond ->> 'review_ok')::boolean, false) and c.id is null then skip := 'no customer on the job';
    elsif coalesce((cond ->> 'review_ok')::boolean, false) and (nullif(trim(coalesce(rs.review_url, '')), '') is null) then skip := 'no review link in Settings → Booking';
    elsif coalesce((cond ->> 'review_ok')::boolean, false) and c.reviewed_at is not null then skip := 'already reviewed';
    elsif coalesce((cond ->> 'review_ok')::boolean, false) and c.review_requested_at > now() - make_interval(days => rs.review_skip_days) then skip := 'asked within ' || rs.review_skip_days || ' days';
    elsif coalesce((cond ->> 'no_later_booking')::boolean, false) then
      select exists (select 1 from public.appointments a2 where a2.customer_id = c.id and a2.id <> r.subject_id and a2.status in ('lead', 'booked', 'confirmed', 'in_progress', 'done') and a2.created_at > r.created_at - interval '1 day') into v_has_later;
      if c.id is null then skip := 'no customer on the hold'; elsif v_has_later then skip := 'they booked after all'; end if;
    end if;
    if skip is not null then
      update public.automation_runs set status = 'skipped', result = skip, finished_at = now() where id = r.id;
      continue;
    end if;
    update public.automation_runs set status = 'claimed', claimed_at = now() where id = r.id;
    out := out || jsonb_build_object(
      'run_id', r.id, 'company_id', r.company_id, 'rule_key', r.rule_key, 'rule_name', r.rule_name, 'event_kind', r.event_kind, 'payload', r.payload,
      'subject_type', r.subject_type, 'subject_id', r.subject_id, 'subject', subj,
      'action', r.action,
      'customer', case when c.id is null then null else jsonb_build_object('id', c.id, 'first_name', c.first_name, 'display_name', c.display_name, 'email', c.email, 'phone', c.phone, 'sms_opt_in', c.sms_opt_in) end,
      'company', jsonb_build_object('name', co.name, 'email', co.email, 'phone', co.phone, 'timezone', co.timezone, 'address', concat_ws(', ', co.address_line1, co.city, co.state)),
      'settings', jsonb_build_object('hold_minutes', rs.hold_minutes, 'review_url', rs.review_url, 'email_templates', rs.email_templates)
    );
  end loop;
  return out;
end $$;
revoke execute on function public.claim_runs(integer) from public, anon, authenticated;
grant execute on function public.claim_runs(integer) to service_role;

create or replace function public.complete_run(p_id uuid, p_status text, p_result text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.automation_runs;
begin
  perform public._assert_service_role();
  if p_status not in ('sent', 'skipped', 'failed') then raise exception 'bad status' using errcode = '22023'; end if;
  update public.automation_runs set status = p_status, result = left(coalesce(p_result, ''), 500), finished_at = now() where id = p_id returning * into r;
  if p_status = 'sent' and r.id is not null then
    if exists (select 1 from public.automation_rules rl where rl.id = r.rule_id and rl.key = 'job_review') and r.customer_id is not null then
      update public.customers set review_requested_at = now() where id = r.customer_id;
    end if;
  end if;
end $$;
revoke execute on function public.complete_run(uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_run(uuid, text, text) to service_role;

create or replace function public.queue_text(p_company uuid, p_customer uuid, p_phone text, p_body text, p_reason text default null, p_run uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public._assert_service_role();
  if public.phone_digits(p_phone) is null then return null; end if;
  insert into public.text_queue (company_id, customer_id, run_id, phone, body, reason) values (p_company, p_customer, p_run, p_phone, left(p_body, 1000), left(p_reason, 120)) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.queue_text(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.queue_text(uuid, uuid, text, text, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
create or replace function public.automation_rules_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner_admin() then raise exception 'Owner or admin only' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order, r.name), '[]'::jsonb) from public.automation_rules r where r.company_id = public.current_company_id());
end $$;
grant execute on function public.automation_rules_list() to authenticated;

-- p = {id?, name, enabled, event_kind, delay_minutes, condition, action}; system rules keep their key, kind and condition.
create or replace function public.save_automation_rule(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_company uuid := public.current_company_id(); r public.automation_rules; v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if not public.is_owner_admin() then raise exception 'Owner or admin only' using errcode = '42501'; end if;
  if v_id is not null then
    select * into r from public.automation_rules where id = v_id and company_id = v_company;
    if r.id is null then raise exception 'Rule not found' using errcode = 'P0002'; end if;
    update public.automation_rules set
      name = coalesce(nullif(left(trim(coalesce(p ->> 'name', '')), 80), ''), name),
      enabled = coalesce((p ->> 'enabled')::boolean, enabled),
      delay_minutes = coalesce((p ->> 'delay_minutes')::int, delay_minutes),
      action = case when p ? 'action' then coalesce(action, '{}'::jsonb) || (p -> 'action') else action end,
      event_kind = case when system then event_kind else coalesce(nullif(p ->> 'event_kind', ''), event_kind) end,
      condition = case when system then condition else coalesce(p -> 'condition', condition) end
    where id = v_id returning * into r;
  else
    insert into public.automation_rules (company_id, name, enabled, event_kind, delay_minutes, condition, action, system)
    values (v_company, nullif(left(trim(coalesce(p ->> 'name', '')), 80), ''), coalesce((p ->> 'enabled')::boolean, true), p ->> 'event_kind', coalesce((p ->> 'delay_minutes')::int, 0), coalesce(p -> 'condition', '{}'::jsonb), coalesce(p -> 'action', '{}'::jsonb), false)
    returning * into r;
  end if;
  return to_jsonb(r);
end $$;
grant execute on function public.save_automation_rule(jsonb) to authenticated;

create or replace function public.delete_automation_rule(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner_admin() then raise exception 'Owner or admin only' using errcode = '42501'; end if;
  delete from public.automation_rules where id = p_id and company_id = public.current_company_id() and not system;
end $$;
grant execute on function public.delete_automation_rule(uuid) to authenticated;

create or replace function public.automation_log(p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner_admin() then raise exception 'Owner or admin only' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', ar.id, 'rule', rl.name, 'rule_key', rl.key, 'event_kind', rl.event_kind, 'status', ar.status, 'result', ar.result, 'due_at', ar.due_at, 'finished_at', ar.finished_at, 'created_at', ar.created_at,
      'subject_type', ar.subject_type, 'subject_id', ar.subject_id,
      'customer', (select coalesce(c.display_name, c.phone) from public.customers c where c.id = ar.customer_id), 'customer_id', ar.customer_id
    ) order by ar.created_at desc), '[]'::jsonb)
    from (select * from public.automation_runs where company_id = public.current_company_id() order by created_at desc limit greatest(1, least(coalesce(p_limit, 100), 500))) ar
    join public.automation_rules rl on rl.id = ar.rule_id);
end $$;
grant execute on function public.automation_log(integer) to authenticated;

create or replace function public.text_queue_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'customer_id', t.customer_id, 'customer', (select coalesce(c.display_name, c.phone) from public.customers c where c.id = t.customer_id), 'phone', t.phone, 'body', t.body, 'reason', t.reason, 'created_at', t.created_at) order by t.created_at), '[]'::jsonb)
  from public.text_queue t where t.company_id = public.current_company_id() and t.sent_at is null and t.dismissed_at is null
$$;
grant execute on function public.text_queue_list() to authenticated;

create or replace function public.text_queue_done(p_id uuid, p_dismiss boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'Members only' using errcode = '42501'; end if;
  update public.text_queue set sent_at = case when p_dismiss then sent_at else now() end, sent_by = case when p_dismiss then sent_by else auth.uid() end, dismissed_at = case when p_dismiss then now() else dismissed_at end
  where id = p_id and company_id = public.current_company_id() and sent_at is null and dismissed_at is null;
end $$;
grant execute on function public.text_queue_done(uuid, boolean) to authenticated;

create or replace function public.mark_reviewed(p_customer uuid, p_on boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'Members only' using errcode = '42501'; end if;
  update public.customers set reviewed_at = case when p_on then now() else null end where id = p_customer and company_id = public.current_company_id();
end $$;
grant execute on function public.mark_reviewed(uuid, boolean) to authenticated;
