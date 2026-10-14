-- =============================================================================
-- 0059 — Signatures: the e-signature on every approval, staff-captured with its
--        consent line and device, declines logged, and a way for staff to see
--        the signature image
--   * mark_estimate_accepted takes the signature path (+ ip, device) the staff
--     member captured in person; the path must sit under that estimate's folder;
--     the consent line is stored with the row
--   * job_authorizations.decision approved|declined: a declined extra-work
--     estimate is logged next to the approvals (declines are never lost)
--   * signature_path_for(kind, id): the stored path, for owner/admin/advisor/
--     manager only; the app streams the image through a staff-only route
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

alter table public.estimate_authorizations add column if not exists consent_text text;
alter table public.job_authorizations add column if not exists consent_text text;
alter table public.job_authorizations add column if not exists decision text not null default 'approved';
alter table public.job_authorizations drop constraint if exists job_authorizations_decision_check;
alter table public.job_authorizations add constraint job_authorizations_decision_check check (decision in ('approved', 'declined'));

-- Staff record an approval with the customer's signature (in person) and the consent line
select public._patch_function('mark_estimate_accepted', 'p_signature_path',
  $a$p_method text DEFAULT 'in_person'::text)$a$,
  $a$p_method text DEFAULT 'in_person'::text, p_signature_path text DEFAULT NULL::text, p_ip text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)$a$);
drop function if exists public.mark_estimate_accepted(uuid, uuid, uuid[], text, text);

select public._patch_function('mark_estimate_accepted', 'consent_text',
  $a$insert into public.estimate_authorizations (company_id, estimate_id, name, method, by_staff, selected_option_id, approved_line_ids, total)$a$,
  $a$insert into public.estimate_authorizations (company_id, estimate_id, name, method, by_staff, selected_option_id, approved_line_ids, total, signature_path, ip, user_agent, consent_text)$a$);
select public._patch_function('mark_estimate_accepted', 'nullif(p_signature_path, '''')',
  $a$coalesce(p_method, 'in_person'), auth.uid(), p_option, coalesce(p_line_ids, '{}'), e.total);$a$,
  $a$coalesce(p_method, 'in_person'), auth.uid(), p_option, coalesce(p_line_ids, '{}'), e.total,
          nullif(p_signature_path, ''), left(p_ip, 64), left(p_user_agent, 300),
          case when nullif(p_signature_path, '') is not null then 'I agree to sign electronically, and I approve the work and the prices on this estimate.' end);$a$);
select public._patch_function('mark_estimate_accepted', 'Bad signature path',
  $a$if not exists (select 1 from public.estimate_options where id = p_option and estimate_id = p_id) then$a$,
  $a$if nullif(p_signature_path, '') is not null and p_signature_path not like e.company_id::text || '/estimates/' || p_id::text || '/%' then
    raise exception 'Bad signature path' using errcode = '22023';
  end if;
  if not exists (select 1 from public.estimate_options where id = p_option and estimate_id = p_id) then$a$);
revoke execute on function public.mark_estimate_accepted(uuid, uuid, uuid[], text, text, text, text, text) from public, anon;
grant execute on function public.mark_estimate_accepted(uuid, uuid, uuid[], text, text, text, text, text) to authenticated;

-- The consent line travels to the visit's authorization log
select public._patch_function('_convert_estimate_core', 'consent_text',
  $a$insert into public.job_authorizations (company_id, job_id, kind, estimate_id, amount, name, method, by_staff, signature_path, ip, user_agent, authorized_at, created_by)$a$,
  $a$insert into public.job_authorizations (company_id, job_id, kind, estimate_id, amount, name, method, by_staff, signature_path, ip, user_agent, authorized_at, created_by, consent_text)$a$);
select public._patch_function('_convert_estimate_core', 'v_ea.consent_text',
  $a$v_ea.signature_path, v_ea.ip, v_ea.user_agent, v_ea.authorized_at, v_ea.by_staff)$a$,
  $a$v_ea.signature_path, v_ea.ip, v_ea.user_agent, v_ea.authorized_at, v_ea.by_staff, v_ea.consent_text)$a$);

-- Declines of extra work are logged beside the approvals
create or replace function public._log_supplement_decline(p_estimate uuid, p_method text, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.estimates;
begin
  select * into e from public.estimates where id = p_estimate;
  if e.id is null or e.kind <> 'supplement' or e.job_id is null then return; end if;
  insert into public.job_authorizations (company_id, job_id, kind, estimate_id, amount, name, method, by_staff, authorized_at, created_by, decision)
  values (e.company_id, e.job_id, 'change_order', e.id, coalesce(e.total, 0),
          coalesce((select c.display_name from public.customers c where c.id = e.customer_id), 'Customer'),
          case when p_method in ('online', 'in_person', 'phone', 'email') then p_method else 'in_person' end, p_by is not null, now(), p_by, 'declined');
end $$;
revoke execute on function public._log_supplement_decline(uuid, text, uuid) from public, anon, authenticated;

select public._patch_function('decline_estimate', '_log_supplement_decline',
  $a$raise exception 'Estimate not found or already answered' using errcode = 'P0002';
  end if;
  return e;$a$,
  $a$raise exception 'Estimate not found or already answered' using errcode = 'P0002';
  end if;
  perform public._log_supplement_decline(e.id, 'in_person', auth.uid());
  return e;$a$);
select public._patch_function('estimate_respond', '_log_supplement_decline',
  $a$perform public._emit(e.company_id, 'estimate.declined', 'estimate', e.id, e.customer_id, jsonb_build_object('method', 'online'));$a$,
  $a$perform public._emit(e.company_id, 'estimate.declined', 'estimate', e.id, e.customer_id, jsonb_build_object('method', 'online'));
    perform public._log_supplement_decline(e.id, 'online', null);$a$);

-- What the screens read: the decision on each authorization
select public._patch_function('ro_authorizations', '''decision''',
  $a$'has_signature', a.signature_path is not null,$a$,
  $a$'has_signature', a.signature_path is not null, 'decision', a.decision,$a$);
select public._patch_function('_receipt_json', '''decision''',
  $a$'amount', a.amount) order by a.authorized_at)$a$,
  $a$'amount', a.amount, 'decision', a.decision) order by a.authorized_at)$a$);

-- Staff view of a signature: the path, only for people who can see the visit
create or replace function public.signature_path_for(p_kind text, p_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_path text;
begin
  if not public.is_admin() then return null; end if;
  if p_kind = 'estimate' then
    select signature_path into v_path from public.estimate_authorizations where id = p_id and company_id = public.current_company_id();
  elsif p_kind = 'job' then
    select signature_path into v_path from public.job_authorizations where id = p_id and company_id = public.current_company_id();
  elsif p_kind = 'pickup' then
    select receipt_signature_path into v_path from public.jobs where id = p_id and company_id = public.current_company_id();
  end if;
  return v_path;
end $$;
revoke execute on function public.signature_path_for(text, uuid) from public, anon;
grant execute on function public.signature_path_for(text, uuid) to authenticated;

drop function public._patch_function(text, text, text, text);
