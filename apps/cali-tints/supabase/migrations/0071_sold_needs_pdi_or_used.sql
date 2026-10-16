-- =============================================================================
-- 0071 — A sold car must also be charged as PDI or Used
--   "Sold" (the delivery clean) is never billed on its own: the dealership pays for
--   the PDI or the Used detail too. From now on a job with the Sold service must
--   also have PDI or Used, for everyone; older open jobs that lack it are flagged
--   for the managers.
--   * services.sold_marker (the Sold service) and services.satisfies_sold (PDI, Used),
--     kept in step with the service name by a trigger (there is no screen to change them)
--   * create_job / update_job refuse a Sold-without-PDI-or-Used line set
--     ("A sold car must also be charged as PDI or Used")
--   * jobs_missing_sold_charge(): the open, undeleted, uninvoiced jobs that lack it, for
--     owner, admin and manager (the banner, the Jobs filter and the badge)
--   Jobs already on an invoice are not touched.
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

alter table public.services add column if not exists sold_marker boolean not null default false;
alter table public.services add column if not exists satisfies_sold boolean not null default false;

-- Derived from the service name; never cleared by a rename (a shop may call it "PDI (new car)").
create or replace function public.tg_services_sold_flags()
returns trigger language plpgsql as $$
begin
  if lower(trim(new.name)) = 'sold' then new.sold_marker := true; end if;
  if lower(trim(new.name)) in ('pdi', 'used') then new.satisfies_sold := true; end if;
  return new;
end $$;
drop trigger if exists services_sold_flags on public.services;
create trigger services_sold_flags before insert or update of name on public.services
  for each row execute function public.tg_services_sold_flags();

update public.services set sold_marker = true where lower(trim(name)) = 'sold' and not sold_marker;
update public.services set satisfies_sold = true where lower(trim(name)) in ('pdi', 'used') and not satisfies_sold;

-- ---------------------------------------------------------------------------
-- The rule, in one place
-- ---------------------------------------------------------------------------
create or replace function public._job_sold_missing_charge(p_job uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.job_services js join public.services s on s.id = js.service_id where js.job_id = p_job and s.sold_marker)
     and not exists (select 1 from public.job_services js join public.services s on s.id = js.service_id where js.job_id = p_job and s.satisfies_sold)
$$;

create or replace function public._assert_sold_charged(p_job uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public._job_sold_missing_charge(p_job) then
    raise exception 'A sold car must also be charged as PDI or Used' using errcode = 'P0001';
  end if;
end $$;

select public._patch_function('create_job', '_assert_sold_charged',
  $a$  if cv.o_vehicle is not null and nullif(p ->> 'odometer', '') is not null then
    insert into public.odometer_readings (company_id, vehicle_id, reading, read_at, job_id, created_by)
    values (v_company, cv.o_vehicle,$a$,
  $a$  perform public._assert_sold_charged(v_job.id);

  if cv.o_vehicle is not null and nullif(p ->> 'odometer', '') is not null then
    insert into public.odometer_readings (company_id, vehicle_id, reading, read_at, job_id, created_by)
    values (v_company, cv.o_vehicle,$a$);

select public._patch_function('update_job', '_assert_sold_charged',
  $a$    end loop;
  end if;

  if v_job.vehicle_id is not null and nullif(p ->> 'odometer', '') is not null then$a$,
  $a$    end loop;
    perform public._assert_sold_charged(p_id);
  end if;

  if v_job.vehicle_id is not null and nullif(p ->> 'odometer', '') is not null then$a$);

-- ---------------------------------------------------------------------------
-- The flag: open jobs that are Sold without PDI or Used (managers and up)
-- ---------------------------------------------------------------------------
create or replace function public.jobs_missing_sold_charge()
returns uuid[] language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then
    coalesce((select array_agg(j.id order by j.performed_at desc) from public.jobs j
               where j.company_id = public.current_company_id() and j.deleted_at is null and j.invoice_id is null
                 and public._job_sold_missing_charge(j.id)), '{}')
    else '{}'::uuid[] end
$$;

revoke all on function public._job_sold_missing_charge(uuid), public._assert_sold_charged(uuid), public.jobs_missing_sold_charge() from public, anon;
grant execute on function public.jobs_missing_sold_charge() to authenticated;

drop function public._patch_function(text, text, text, text);
