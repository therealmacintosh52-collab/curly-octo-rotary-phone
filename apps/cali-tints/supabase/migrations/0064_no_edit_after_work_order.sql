-- =============================================================================
-- 0064 — No edits once an estimate has become a work order
--   An approved estimate (it has its job, or its lines were applied) cannot be
--   rewritten. More work goes through a new extra-work estimate that the customer
--   approves and signs. Label, status word, parts, due times and notes are not
--   the priced work and stay editable (set_estimate_meta, findings).
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

select public._patch_function('update_estimate', 'This work order is approved',
  $a$raise exception 'This estimate was already answered; make a new one' using errcode = 'P0001';$a$,
  $a$raise exception 'This estimate was already answered; make a new one' using errcode = 'P0001';
  end if;
  if e.applied_at is not null or (e.kind = 'quote' and e.job_id is not null) then
    raise exception 'This work order is approved; add extra work for the customer to approve' using errcode = 'P0001';$a$);

drop function public._patch_function(text, text, text, text);
