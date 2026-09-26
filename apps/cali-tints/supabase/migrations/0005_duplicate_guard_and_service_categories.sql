-- =============================================================================
-- 0005 — double-billing guard + service categories
--
-- Problem: the same vehicle can end up on two invoices, for the same service
-- (a true duplicate) or a different one (sometimes legitimate: PDI on
-- arrival, full detail at sale). The owner needs to see it BEFORE the
-- invoice goes out and decide.
--
-- * find_invoice_conflicts(): for a candidate set of jobs, returns every job
--   that shares a VIN (or tag at the same dealership) with a job that is
--   already on a live invoice, or with another job in the same batch, within
--   a window (default 30 days). Says whether the services overlap.
-- * generate_invoice() / generate_per_job_invoices() accept p_exclude so
--   flagged jobs can be left off without deleting them.
-- * review_job_duplicate(): admin marks a flagged job as "reviewed, OK to
--   bill" with a note; it is then not flagged again. Audited via triggers.
-- * find_duplicate_jobs() (entry-time warning) now also reports the invoice
--   the earlier job is on, so the detailer sees "already billed" at the lot.
-- * services.category groups the price list the way the dealer buys it:
--   new (PDI, delivery), used (reconditioning), service (lane / loaners),
--   addon (tint, correction, ...).
-- =============================================================================

alter table public.services add column if not exists category text not null default 'addon'
  check (category in ('new', 'used', 'service', 'addon'));

alter table public.jobs
  add column if not exists dup_reviewed_at timestamptz,
  add column if not exists dup_reviewed_by uuid references public.profiles (id),
  add column if not exists dup_review_note text;

-- ---------------------------------------------------------------------------
-- Price list now carries the category (return type change → drop first).
-- ---------------------------------------------------------------------------
drop function if exists public.dealership_price_list(uuid);
create function public.dealership_price_list(p_dealership_id uuid)
returns table (service_id uuid, name text, description text, category text, price numeric, is_override boolean, sort_order integer)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.category,
         coalesce(dsp.price, s.default_price) as price,
         dsp.price is not null as is_override,
         s.sort_order
  from public.services s
  left join public.dealership_service_prices dsp
    on dsp.service_id = s.id and dsp.dealership_id = p_dealership_id
  join public.dealerships d on d.id = p_dealership_id
  where s.company_id = public.current_company_id()
    and d.company_id = public.current_company_id()
    and s.active
  order by case s.category when 'new' then 1 when 'used' then 2 when 'service' then 3 else 4 end, s.sort_order, s.name
$$;
grant execute on function public.dealership_price_list(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Entry-time duplicate check: add invoice info.
-- ---------------------------------------------------------------------------
drop function if exists public.find_duplicate_jobs(text, text, uuid);
create function public.find_duplicate_jobs(p_tag_number text, p_vin text default null, p_dealership_id uuid default null)
returns table (id uuid, tag_number text, vin text, year integer, make text, model text,
               performed_at timestamptz, detailer_name text, services text, invoice_number text)
language sql stable security definer set search_path = public as $$
  select j.id, j.tag_number, j.vin, j.year, j.make, j.model, j.performed_at, p.full_name,
         (select string_agg(s.name, ', ' order by s.name)
            from public.job_services js join public.services s on s.id = js.service_id
           where js.job_id = j.id),
         (select i.display_number from public.invoices i where i.id = j.invoice_id and i.status <> 'void')
  from public.jobs j
  join public.profiles p on p.id = j.detailer_id
  where j.company_id = public.current_company_id()
    and j.deleted_at is null
    and j.performed_at >= now() - interval '7 days'
    and (p_dealership_id is null or j.dealership_id = p_dealership_id)
    and (upper(j.tag_number) = upper(p_tag_number)
         or (p_vin is not null and j.vin = upper(p_vin)))
  order by j.performed_at desc
  limit 5
$$;
grant execute on function public.find_duplicate_jobs(text, text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Invoice-time conflict finder.
-- ---------------------------------------------------------------------------
create or replace function public.find_invoice_conflicts(p_job_ids uuid[], p_days integer default 30)
returns table (
  job_id uuid,                 -- the candidate job (in p_job_ids)
  other_job_id uuid,           -- the job it collides with
  kind text,                   -- 'invoiced' | 'in_batch'
  other_tag text,
  other_vin text,
  other_performed_at timestamptz,
  other_invoice_number text,
  other_services text,
  shared_services text,        -- services both jobs have (null = different work)
  match_on text                -- 'vin' | 'tag'
)
language sql stable security definer set search_path = public as $$
  with cand as (
    select j.* from public.jobs j
    where j.id = any (p_job_ids)
      and j.company_id = public.current_company_id()
      and j.deleted_at is null
      and j.dup_reviewed_at is null
  ),
  pairs as (
    select c.id as job_id, o.id as other_job_id,
           case when o.invoice_id is not null then 'invoiced' else 'in_batch' end as kind,
           o.tag_number, o.vin, o.performed_at, o.invoice_id,
           case when c.vin is not null and c.vin = o.vin then 'vin' else 'tag' end as match_on
    from cand c
    join public.jobs o
      on o.id <> c.id
     and o.company_id = c.company_id
     and o.deleted_at is null
     and abs(extract(epoch from (o.performed_at - c.performed_at))) <= p_days * 86400
     and (
          (c.vin is not null and o.vin = c.vin)
       or (o.dealership_id = c.dealership_id and upper(o.tag_number) = upper(c.tag_number))
     )
     and (
          -- already billed on a live invoice
          (o.invoice_id is not null and exists (select 1 from public.invoices i where i.id = o.invoice_id and i.status <> 'void'))
          -- or also in this batch (report each pair once, from the earlier job's side)
       or (o.id = any (p_job_ids) and o.invoice_id is null and (o.performed_at, o.id) > (c.performed_at, c.id))
     )
  )
  select p.job_id, p.other_job_id, p.kind, p.tag_number, p.vin, p.performed_at,
         (select i.display_number from public.invoices i where i.id = p.invoice_id),
         (select string_agg(s.name, ', ' order by s.name)
            from public.job_services js join public.services s on s.id = js.service_id
           where js.job_id = p.other_job_id),
         (select string_agg(s.name, ', ' order by s.name)
            from public.job_services a
            join public.job_services b on b.service_id = a.service_id and b.job_id = p.other_job_id
            join public.services s on s.id = a.service_id
           where a.job_id = p.job_id),
         p.match_on
  from pairs p
  order by p.performed_at desc
$$;
grant execute on function public.find_invoice_conflicts(uuid[], integer) to authenticated, service_role;

-- Admin decision: this job is legitimately billable despite the match.
create or replace function public.review_job_duplicate(p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.jobs
     set dup_reviewed_at = now(), dup_reviewed_by = auth.uid(), dup_review_note = nullif(trim(p_note), ''), updated_by = auth.uid()
   where id = p_id and company_id = public.current_company_id() and deleted_at is null and invoice_id is null;
  if not found then
    raise exception 'Job not found or already invoiced' using errcode = 'P0002';
  end if;
end $$;
grant execute on function public.review_job_duplicate(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Generation with exclusions.
-- ---------------------------------------------------------------------------
drop function if exists public.generate_invoice(uuid, date, date, text);
create function public.generate_invoice(p_dealership_id uuid, p_start date, p_end date, p_notes text default null, p_exclude uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_ids     uuid[];
begin
  perform public.assert_admin();
  if not exists (select 1 from public.dealerships where id = p_dealership_id and company_id = v_company) then
    raise exception 'Unknown dealership' using errcode = '22023';
  end if;

  select array_agg(id) into v_ids
  from public.uninvoiced_jobs(p_dealership_id, p_start, p_end)
  where not (id = any (coalesce(p_exclude, '{}')));
  if v_ids is null then
    raise exception 'No uninvoiced jobs between % and %', p_start, p_end using errcode = 'P0002';
  end if;

  return public._create_invoice_from_jobs(v_company, p_dealership_id, v_ids, p_start, p_end, null, p_notes);
end $$;
grant execute on function public.generate_invoice(uuid, date, date, text, uuid[]) to authenticated, service_role;

drop function if exists public.generate_per_job_invoices(uuid, text);
create function public.generate_per_job_invoices(p_dealership_id uuid, p_notes text default null, p_exclude uuid[] default '{}')
returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_tz      text;
  r         record;
begin
  perform public.assert_admin();
  select timezone into v_tz from public.companies where id = v_company;
  if not exists (select 1 from public.dealerships where id = p_dealership_id and company_id = v_company) then
    raise exception 'Unknown dealership' using errcode = '22023';
  end if;

  for r in
    select coalesce(j.ro_po_number, j.id::text) as grp,
           j.ro_po_number,
           array_agg(j.id) as ids,
           min((j.performed_at at time zone v_tz)::date) as d0,
           max((j.performed_at at time zone v_tz)::date) as d1
    from public.jobs j
    where j.company_id = v_company and j.dealership_id = p_dealership_id
      and j.deleted_at is null and j.invoice_id is null
      and not (j.id = any (coalesce(p_exclude, '{}')))
    group by 1, 2
    order by min(j.performed_at)
  loop
    return next public._create_invoice_from_jobs(v_company, p_dealership_id, r.ids, r.d0, r.d1, r.ro_po_number, p_notes);
  end loop;
  return;
end $$;
grant execute on function public.generate_per_job_invoices(uuid, text, uuid[]) to authenticated, service_role;
