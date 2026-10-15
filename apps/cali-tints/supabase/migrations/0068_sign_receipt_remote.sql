-- =============================================================================
-- 0068 — A customer who is not at the counter signs the invoice from their link
--   The same "I received my vehicle, the work was done as described and I paid $X"
--   signature as at pickup, taken on the customer's own phone through the invoice
--   link once the invoice is paid. Typed name, drawn mark, the consent line, time,
--   IP and device are kept on the job next to the counter signature.
--   * jobs: receipt_signed_online / _ip / _user_agent / _consent
--   * sign_receipt_by_token(token, name, signature path, ip, user agent, consent)
--   * the activity log shows an online pickup signature as the Customer's
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

alter table public.jobs add column if not exists receipt_signed_online boolean not null default false;
alter table public.jobs add column if not exists receipt_signed_ip text;
alter table public.jobs add column if not exists receipt_signed_user_agent text;
alter table public.jobs add column if not exists receipt_consent text;

create or replace function public.sign_receipt_by_token(p_token text, p_name text, p_signature_path text, p_ip text default null, p_user_agent text default null, p_consent text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_job uuid; j public.jobs;
begin
  if length(coalesce(p_token, '')) < 20 then raise exception 'Not found' using errcode = 'P0002'; end if;
  select job_id into v_job from public.receipt_tokens where token = p_token;
  if v_job is null then raise exception 'Not found' using errcode = 'P0002'; end if;
  select * into j from public.jobs where id = v_job and deleted_at is null;
  if j.id is null then raise exception 'Not found' using errcode = 'P0002'; end if;
  if j.paid_at is null then raise exception 'The invoice is signed after it is paid' using errcode = 'P0001'; end if;
  if j.receipt_signed_at is not null then raise exception 'This invoice is already signed' using errcode = 'P0001'; end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then raise exception 'Please type your name' using errcode = '22023'; end if;
  if p_signature_path is null or p_signature_path not like j.company_id::text || '/receipts/' || j.id::text || '/%' then
    raise exception 'Bad signature file' using errcode = '22023';
  end if;
  perform set_config('app.bypass_lock', 'on', true);
  update public.jobs set receipt_signature_path = p_signature_path, receipt_signed_at = now(), receipt_signed_name = left(trim(p_name), 120),
    receipt_signed_online = true, receipt_signed_ip = left(p_ip, 80), receipt_signed_user_agent = left(p_user_agent, 300), receipt_consent = left(p_consent, 600), updated_at = now()
  where id = j.id;
  perform set_config('app.bypass_lock', 'off', true);
  return jsonb_build_object('job_id', j.id, 'company_id', j.company_id, 'signed_at', now());
end $$;
revoke execute on function public.sign_receipt_by_token(text, text, text, text, text, text) from public;
grant execute on function public.sign_receipt_by_token(text, text, text, text, text, text) to anon, authenticated;

-- The log: an online pickup signature is the customer's
select public._patch_function('visit_activity', '''receipt_signed_at'' = any (al.changed) and al.actor_id is null',
  $a$or (al.new_data ->> 'status') in ('accepted', 'declined')) then 'Customer' else 'System' end$a$,
  $a$or (al.new_data ->> 'status') in ('accepted', 'declined')) then 'Customer' when al.table_name = 'jobs' and 'receipt_signed_at' = any (al.changed) and al.actor_id is null then 'Customer' else 'System' end$a$);

drop function public._patch_function(text, text, text, text);
