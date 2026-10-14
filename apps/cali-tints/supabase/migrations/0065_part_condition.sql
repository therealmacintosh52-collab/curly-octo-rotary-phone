-- =============================================================================
-- 0065 — Part condition on part lines (new / used / rebuilt / reconditioned)
--   California: each part on an invoice must say whether it was new, used,
--   reconditioned or rebuilt (16 CCR §3356, B&P §9884.8); on an estimate every
--   part is presumed new unless it is identified otherwise (B&P §9884.9,
--   16 CCR §3353(a)). Checked 2026-10-14 against search results quoting the BAR
--   "Write It Right" page (updated January 2026); the official pages could not be
--   opened from the build machine, so the owner should read them once.
--   Crash-part (OEM / non-OEM aftermarket) wording is for collision work and is not
--   built here.
--   * estimate_lines.part_condition (default 'new'), only meaningful on part lines
--   * create/update estimate, add_finding_lines and the apply step carry it
--   * the estimate JSON and the invoice (receipt) JSON return it per line
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

alter table public.estimate_lines add column if not exists part_condition text not null default 'new';
alter table public.estimate_lines drop constraint if exists estimate_lines_part_condition_check;
alter table public.estimate_lines add constraint estimate_lines_part_condition_check check (part_condition in ('new', 'used', 'rebuilt', 'reconditioned'));
grant select (part_condition) on public.estimate_lines to authenticated;

-- A line's condition: only a part has one; anything unsaid is new; anything else is refused
create or replace function public._part_condition(p_line jsonb)
returns text language plpgsql immutable as $$
declare v text;
begin
  if coalesce(p_line ->> 'line_type', 'service') <> 'part' then return 'new'; end if;
  v := lower(trim(coalesce(p_line ->> 'part_condition', '')));
  if v = '' then return 'new'; end if;
  if v not in ('new', 'used', 'rebuilt', 'reconditioned') then
    raise exception 'A part is new, used, rebuilt or reconditioned' using errcode = '22023';
  end if;
  return v;
end $$;

-- The priced line carries it, and every insert reads it from there
select public._patch_function('_estimate_price_line', 'part_condition',
  $a$'part_number', nullif(left(trim(coalesce(p_line ->> 'part_number', '')), 60), ''),$a$,
  $a$'part_number', nullif(left(trim(coalesce(p_line ->> 'part_number', '')), 60), ''),
    'part_condition', public._part_condition(p_line),$a$);

select public._patch_function('_estimate_apply', 'part_condition',
  'part_number, vendor, cost,', 'part_number, vendor, part_condition, cost,');
select public._patch_function('_estimate_apply', '''part_condition'', ''''), ''new'')',
  $a$v_ql ->> 'vendor', nullif(v_ql ->> 'cost', '')::numeric$a$,
  $a$v_ql ->> 'vendor', coalesce(nullif(v_ql ->> 'part_condition', ''), 'new'), nullif(v_ql ->> 'cost', '')::numeric$a$);

select public._patch_function('add_finding_lines', 'part_condition',
  'part_number, vendor, cost,', 'part_number, vendor, part_condition, cost,');
select public._patch_function('add_finding_lines', '''part_condition'', ''''), ''new'')',
  $a$v_ql ->> 'vendor', nullif(v_ql ->> 'cost', '')::numeric$a$,
  $a$v_ql ->> 'vendor', coalesce(nullif(v_ql ->> 'part_condition', ''), 'new'), nullif(v_ql ->> 'cost', '')::numeric$a$);

-- Out: the estimate JSON (both the option lines and the add-ons) and the invoice JSON
select public._patch_function('_estimate_json', '''part_condition''',
  $a$'part_number', l.part_number,$a$,
  $a$'part_number', l.part_number, 'part_condition', l.part_condition,$a$);
select public._patch_function('_receipt_json', '''part_condition''',
  $a$'part_number', el.part_number,$a$,
  $a$'part_number', el.part_number, 'part_condition', el.part_condition,$a$);

drop function public._patch_function(text, text, text, text);
