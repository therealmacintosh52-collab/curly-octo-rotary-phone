-- ---------------------------------------------------------------------------
-- 0035: no employee names on jobs.
--
-- A job carries who did it (jobs.detailer_id) for the owner's filters and the
-- team dashboard's per-detailer counts, but the name no longer travels with the
-- job itself: not on the Jobs list rows, the job page, the duplicate check, the
-- dashboards' per-car rows, nor on invoice lines (the snapshot column
-- invoice_items.detailer_name stays for the CSV contract and is always null).
-- Re-runnable: every step is a guarded text replace on the current definition,
-- a no-op once applied.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_src text;
  v_from text;
  v_to text;
begin
  -- Invoice snapshots (_create_invoice_from_jobs, edit_invoice_car): the line's
  -- detailer_name becomes null. The profiles join stays; it is harmless.
  v_from := 'p.full_name, coalesce(nullif(js.label, ''''), s.name), js.price';
  v_to   := 'null::text, coalesce(nullif(js.label, ''''), s.name), js.price';
  for r in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('_create_invoice_from_jobs', 'edit_invoice_car')
  loop
    v_src := pg_get_functiondef(r.oid);
    if position(v_from in v_src) > 0 then
      execute replace(v_src, v_from, v_to);
    end if;
  end loop;

  -- Jobs list rows.
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'jobs_filtered';
  if v_src is not null and position('''detailer'', b.detailer_name,' in v_src) > 0 then
    execute replace(v_src, '''detailer'', b.detailer_name,', '''detailer'', null::text,');
  end if;

  -- Team dashboard: today's cars (the by_detailer counts keep their names).
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'team_dashboard';
  if v_src is not null and position('d.name as dealership, p.full_name as detailer, j.performed_at,' in v_src) > 0 then
    execute replace(v_src, 'd.name as dealership, p.full_name as detailer, j.performed_at,', 'd.name as dealership, null::text as detailer, j.performed_at,');
  end if;

  -- Invoices list: the cars on each invoice.
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'invoices_filtered';
  if v_src is not null and position('''detailer'', c.detailer_name)' in v_src) > 0 then
    execute replace(v_src, '''detailer'', c.detailer_name)', '''detailer'', null::text)');
  end if;

  -- Duplicate check while logging a car.
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'find_duplicate_jobs';
  if v_src is not null and position('j.performed_at, p.full_name,' in v_src) > 0 then
    execute replace(v_src, 'j.performed_at, p.full_name,', 'j.performed_at, null::text,');
  end if;
end $$;

-- Lines already snapshotted lose the name too.
update public.invoice_items set detailer_name = null where detailer_name is not null;
