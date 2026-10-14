-- =============================================================================
-- 0049 — Mileage on the estimate (the car lookup bar at the top of Retail)
--   estimates.odometer: the mileage when the car came in. Saving an estimate
--   logs it as a reading on the car (if it changed); approving the estimate
--   attaches that reading to the new job, so the invoice shows the mileage.
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

alter table public.estimates add column if not exists odometer integer check (odometer is null or (odometer > 0 and odometer < 10000000));

-- p_job null: log the estimate's mileage on the car when it differs from the last reading.
-- p_job set: attach it to that job (the matching loose reading, or a new one).
create or replace function public._estimate_odometer(p_id uuid, p_job uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare e public.estimates; v_last integer; v_reading uuid;
begin
  select * into e from public.estimates where id = p_id;
  if e.id is null or e.odometer is null or e.vehicle_id is null then return; end if;
  if p_job is not null then
    if exists (select 1 from public.odometer_readings where job_id = p_job) then return; end if;
    select id into v_reading from public.odometer_readings where vehicle_id = e.vehicle_id and reading = e.odometer and job_id is null order by read_at desc limit 1;
    if v_reading is not null then
      update public.odometer_readings set job_id = p_job where id = v_reading;
    else
      insert into public.odometer_readings (company_id, vehicle_id, reading, read_at, job_id, created_by) values (e.company_id, e.vehicle_id, e.odometer, clock_timestamp(), p_job, auth.uid());
    end if;
    return;
  end if;
  select reading into v_last from public.odometer_readings where vehicle_id = e.vehicle_id order by read_at desc limit 1;
  if v_last is distinct from e.odometer then
    insert into public.odometer_readings (company_id, vehicle_id, reading, read_at, created_by) values (e.company_id, e.vehicle_id, e.odometer, clock_timestamp(), auth.uid());
  end if;
end $$;
revoke execute on function public._estimate_odometer(uuid, uuid) from public, anon, authenticated;

do $$
begin
  perform public._patch_function('create_estimate', '_estimate_odometer',
    'po_number, internal_notes, customer_notes, created_by, job_id, kind)',
    'po_number, internal_notes, customer_notes, created_by, job_id, kind, odometer)');
  perform public._patch_function('create_estimate', 'p ->> ''odometer''',
    '          v_job.id, case when v_job.id is null then ''quote'' else ''supplement'' end)',
    '          v_job.id, case when v_job.id is null then ''quote'' else ''supplement'' end,
          nullif(regexp_replace(coalesce(p ->> ''odometer'', ''''), ''[^0-9]'', '''', ''g''), '''')::integer)');
  perform public._patch_function('create_estimate', '_estimate_odometer(e.id)',
    '  perform public._estimate_apply(e.id, p);
  select * into e from public.estimates where id = e.id;
  return e;',
    '  perform public._estimate_apply(e.id, p);
  perform public._estimate_odometer(e.id);
  select * into e from public.estimates where id = e.id;
  return e;');
  perform public._patch_function('update_estimate', 'p ->> ''odometer''',
    '    po_number      = case when p ? ''po_number'' then nullif(left(trim(p ->> ''po_number''), 40), '''') else po_number end,',
    '    po_number      = case when p ? ''po_number'' then nullif(left(trim(p ->> ''po_number''), 40), '''') else po_number end,
    odometer       = case when p ? ''odometer'' then nullif(regexp_replace(coalesce(p ->> ''odometer'', ''''), ''[^0-9]'', '''', ''g''), '''')::integer else odometer end,');
  perform public._patch_function('update_estimate', '_estimate_odometer(p_id)',
    '  select * into e from public.estimates where id = p_id;
  return e;',
    '  perform public._estimate_odometer(p_id);
  select * into e from public.estimates where id = p_id;
  return e;');
  -- the estimate's JSON carries the mileage
  perform public._patch_function('_estimate_json', '''odometer'', e.odometer',
    '''expires_at'', e.expires_at, ''po_number'', e.po_number,',
    '''expires_at'', e.expires_at, ''po_number'', e.po_number, ''odometer'', e.odometer,');
  -- the receipt / invoice JSON carries the mileage (and the plate for staff)
  perform public._patch_function('_receipt_json', '''odometer'', (select o.reading',
    '''vehicle'', nullif(concat_ws('' '', j.year::text, j.make, j.model), ''''), ''color'', j.color,',
    '''vehicle'', nullif(concat_ws('' '', j.year::text, j.make, j.model), ''''), ''color'', j.color,
    ''odometer'', (select o.reading from public.odometer_readings o where o.job_id = j.id order by o.read_at desc limit 1),
    ''plate'', case when p_public then null else (select v.plate from public.vehicles v where v.id = j.vehicle_id) end,');
  -- approval attaches the mileage to the job
  perform public._patch_function('_convert_estimate_core', '_estimate_odometer(e.id',
    '  update public.estimates set job_id = j.id, applied_at = now() where id = p_id;',
    '  update public.estimates set job_id = j.id, applied_at = now() where id = p_id;
  perform public._estimate_odometer(e.id, j.id);');
end $$;

-- The car lookup bar: a plate or a VIN (spacing and punctuation ignored) finds the car, its owner and its last mileage.
create or replace function public.find_vehicle(p_plate text default null, p_vin text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with q as (
    select nullif(upper(regexp_replace(coalesce(p_vin, ''), '[^A-Za-z0-9]', '', 'g')), '') as vin,
           nullif(upper(regexp_replace(coalesce(p_plate, ''), '[^A-Za-z0-9]', '', 'g')), '') as plate
  )
  select jsonb_build_object('vehicle_id', v.id, 'customer_id', v.customer_id, 'name', nullif(concat_ws(' ', v.year::text, v.make, v.model), ''),
                            'color', v.color, 'plate', v.plate, 'vin', v.vin, 'size_class', v.size_class,
                            'customer', (select c.display_name from public.customers c where c.id = v.customer_id),
                            'last_odometer', (select o.reading from public.odometer_readings o where o.vehicle_id = v.id order by o.read_at desc limit 1))
  from public.vehicles v, q
  where v.company_id = public.current_company_id() and v.archived_at is null
    and ((q.vin is not null and upper(v.vin) = q.vin)
      or (q.plate is not null and upper(regexp_replace(coalesce(v.plate, ''), '[^A-Za-z0-9]', '', 'g')) = q.plate))
  order by (q.vin is not null and upper(v.vin) = q.vin) desc, v.updated_at desc
  limit 1
$$;
revoke execute on function public.find_vehicle(text, text) from public, anon;
grant execute on function public.find_vehicle(text, text) to authenticated;

drop function public._patch_function(text, text, text, text);
