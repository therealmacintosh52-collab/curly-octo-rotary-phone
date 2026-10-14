-- =============================================================================
-- 0051 — The estimate screen: the car's engine details, Diagnosis / Repairs
--   * vehicles.engine_size ("2.0L") and engine_code ("EJ25"): next to year,
--     make, model, trim, VIN and plate. save_vehicle, find_vehicle and the
--     estimate JSON carry them (the estimate's car block also carries the
--     year / make / model / trim / VIN for the builder).
--   * estimate_lines.section 'diagnosis' | 'repair' (default repair): every
--     line is itemized under Diagnosis or Repairs; labor / parts / fees /
--     sublets in either. A diagnosis line lands on the invoice as
--     "Diagnosis · <line>".
--   * An estimate can be a blank draft (the tech starts documenting the car
--     before the advisor itemizes); it cannot be sent without a line.
--   * delete_draft_estimate: remove a draft that never went anywhere.
-- Re-runnable.
-- =============================================================================

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

alter table public.vehicles add column if not exists engine_size text check (engine_size is null or length(engine_size) <= 30);
alter table public.vehicles add column if not exists engine_code text check (engine_code is null or length(engine_code) <= 30);
alter table public.estimate_lines add column if not exists section text not null default 'repair' check (section in ('diagnosis', 'repair'));

do $$
begin
  -- save_vehicle
  perform public._patch_function('save_vehicle', 'engine_size',
    'size_class_source, color, plate, notes, created_by)',
    'size_class_source, color, plate, notes, created_by, engine_size, engine_code)');
  perform public._patch_function('save_vehicle', 'nullif(trim(p ->> ''engine_size'')',
    'nullif(trim(p ->> ''notes''), ''''), v_uid)',
    'nullif(trim(p ->> ''notes''), ''''), v_uid, nullif(trim(p ->> ''engine_size''), ''''), nullif(upper(trim(p ->> ''engine_code'')), ''''))');
  perform public._patch_function('save_vehicle', 'engine_size  =',
    '      notes      = case when p ? ''notes'' then nullif(trim(p ->> ''notes''), '''') else notes end,',
    '      notes      = case when p ? ''notes'' then nullif(trim(p ->> ''notes''), '''') else notes end,
      engine_size  = case when p ? ''engine_size'' then nullif(trim(p ->> ''engine_size''), '''') else engine_size end,
      engine_code  = case when p ? ''engine_code'' then nullif(upper(trim(p ->> ''engine_code'')), '''') else engine_code end,');
  -- the car lookup bar
  perform public._patch_function('find_vehicle', 'engine_code',
    '''color'', v.color, ''plate'', v.plate,',
    '''color'', v.color, ''trim'', v.trim, ''year'', v.year, ''make'', v.make, ''model'', v.model, ''engine_size'', v.engine_size, ''engine_code'', v.engine_code, ''plate'', v.plate,');
  -- the estimate JSON: the car in full, the lines' section
  perform public._patch_function('_estimate_json', 'engine_code',
    '''vehicle'', (select jsonb_build_object(''id'', v.id, ''name'', nullif(concat_ws('' '', v.year::text, v.make, v.model), ''''), ''color'', v.color,',
    '''vehicle'', (select jsonb_build_object(''id'', v.id, ''name'', nullif(concat_ws('' '', v.year::text, v.make, v.model), ''''), ''year'', v.year, ''make'', v.make, ''model'', v.model, ''trim'', v.trim,
                  ''engine_size'', v.engine_size, ''engine_code'', v.engine_code, ''vin'', case when p_public then null else v.vin end, ''color'', v.color,');
  perform public._patch_function('_estimate_json', '''section'', l.section',
    '''id'', l.id, ''service_id'', l.service_id, ''line_type'', l.line_type,',
    '''id'', l.id, ''service_id'', l.service_id, ''section'', l.section, ''line_type'', l.line_type,');
  -- the lines of an estimate carry their section
  perform public._patch_function('_estimate_apply', 'section,',
    'line_type, hours, rate, part_number, vendor, cost, finding_id)',
    'line_type, hours, rate, part_number, vendor, cost, finding_id, section)');
  perform public._patch_function('_estimate_apply', 'v_line ->> ''section''',
    'nullif(v_ql ->> ''finding_id'', '''')::uuid)
      returning id into v_lineid;',
    'nullif(v_ql ->> ''finding_id'', '''')::uuid, case when v_line ->> ''section'' = ''diagnosis'' then ''diagnosis'' else ''repair'' end)
      returning id into v_lineid;');
  perform public._patch_function('_estimate_apply', 'v_line ->> ''section'' = ''diagnosis'') then',
    'nullif(v_ql ->> ''finding_id'', '''')::uuid);
  end loop;',
    'nullif(v_ql ->> ''finding_id'', '''')::uuid, case when v_line ->> ''section'' = ''diagnosis'' then ''diagnosis'' else ''repair'' end);
  end loop;');
  -- on the invoice a diagnosis line reads "Diagnosis · <line>"
  perform public._patch_function('_convert_estimate_core', 'Diagnosis · ',
    'v_label := left(case l.line_type', 'v_label := left(case when l.section = ''diagnosis'' then ''Diagnosis · '' else '''' end || case l.line_type');
  -- a draft may be blank (nothing itemized yet)
  perform public._patch_function('_estimate_apply', 'a blank draft',
    '    if jsonb_array_length(coalesce(v_opt -> ''lines'', ''[]''::jsonb)) = 0 then
      raise exception ''Option "%" has no lines'', coalesce(v_opt ->> ''name'', v_i::text) using errcode = ''22023'';
    end if;
',
    '    -- a blank draft is fine (nothing itemized yet); send_estimate refuses to send it
');
  -- a quote cannot go out without a line
  perform public._patch_function('send_estimate', 'Add at least one line',
    '  if e.expires_at < now() then',
    '  if not exists (select 1 from public.estimate_lines where estimate_id = p_id) then
    raise exception ''Add at least one line before sending'' using errcode = ''22023'';
  end if;
  if e.expires_at < now() then');
end $$;

-- Remove a draft that never went anywhere (blank, or abandoned). Returns the media files to delete from storage.
create or replace function public.delete_draft_estimate(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.estimates; v_paths jsonb;
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor removes a draft' using errcode = '42501'; end if;
  select * into e from public.estimates where id = p_id and company_id = public.current_company_id();
  if not found then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  if e.status <> 'draft' or e.job_id is not null or e.sent_at is not null then
    raise exception 'Only a draft that was never sent can be removed' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(ph.storage_path), '[]'::jsonb) into v_paths from public.job_photos ph where ph.estimate_id = p_id;
  delete from public.estimates where id = p_id;
  return jsonb_build_object('id', p_id, 'paths', v_paths);
end $$;
grant execute on function public.delete_draft_estimate(uuid) to authenticated;

drop function public._patch_function(text, text, text, text);
