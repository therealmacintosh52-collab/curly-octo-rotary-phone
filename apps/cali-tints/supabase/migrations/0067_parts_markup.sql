-- =============================================================================
-- 0067 — Default parts markup
--   retail_settings.parts_markup_pct: when a part's cost is typed on an estimate
--   the list price is suggested as cost × (1 + markup / 100). Null = no suggestion.
--   The cost itself stays staff-only money (estimate_lines.cost, never in the
--   customer's JSON); the markup is returned by retail_catalog() only to the
--   people who may see prices (owner, admin, advisor).
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

alter table public.retail_settings add column if not exists parts_markup_pct numeric(6,2);
alter table public.retail_settings drop constraint if exists retail_settings_parts_markup_check;
alter table public.retail_settings add constraint retail_settings_parts_markup_check check (parts_markup_pct is null or parts_markup_pct between 0 and 1000);

select public._patch_function('retail_catalog', 'parts_markup_pct',
  $a$'settings', (select to_jsonb(rs) from public.retail_settings rs where rs.company_id = v_company),$a$,
  $a$'settings', (select to_jsonb(rs) - case when public.can_price_jobs() then array[]::text[] else array['parts_markup_pct'] end from public.retail_settings rs where rs.company_id = v_company),$a$);

drop function public._patch_function(text, text, text, text);
