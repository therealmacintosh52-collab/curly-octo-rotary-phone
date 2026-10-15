-- =============================================================================
-- 0069 — The customer's agreement to the terms is kept with the approval
--   From their link a customer now chooses Approve or Decline, then ticks the
--   terms, then signs. The exact words they agreed to (the line they ticked and
--   the shop's terms they saw) are stored on the authorization as consent_text,
--   next to the signature, time, IP and device.
--   * estimate_respond keeps p ->> 'consent' on the authorization row
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

select public._patch_function('estimate_respond', 'consent_text',
  $a$approved_line_ids, signature_path, ip, user_agent, pay_choice, total)$a$,
  $a$approved_line_ids, signature_path, ip, user_agent, pay_choice, total, consent_text)$a$);
select public._patch_function('estimate_respond', 'p ->> ''consent''',
  $a$else 'at_shop' end, e.total);$a$,
  $a$else 'at_shop' end, e.total, nullif(left(coalesce(p ->> 'consent', ''), 2000), ''));$a$);

drop function public._patch_function(text, text, text, text);
