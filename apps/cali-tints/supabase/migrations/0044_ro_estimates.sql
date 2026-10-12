-- =============================================================================
-- 0044 — Estimates on the repair order: labor, parts, fees, sublets; per-item
--        approval; approved work onto the RO
--   * labor_rates (named shop rates, one default) and the shop-supplies rule
--     and taxable defaults on retail_settings.
--   * estimate_lines gains line_type service|labor|part|fee|sublet, hours,
--     rate, part_number, vendor, cost (staff money) and finding_id (the tech's
--     finding it quotes). Service lines price through the size matrix as
--     before; labor = hours × rate; part / fee / sublet = qty × price. Shop
--     supplies = min(pct × labor subtotal, cap) is a computed amount on the
--     option, never a line the customer can untick.
--   * estimates.job_id may be set at creation (an estimate written on an open
--     RO from its findings: kind 'supplement', an additional authorization);
--     estimates.applied_at records when the approved lines landed on the job.
--   * The customer may approve or decline every line of a single-option
--     estimate (approved_line_ids); tiered estimates keep tier + add-ons. Lines
--     untouched by the answer count as approved (older clients).
--   * Findings follow the estimate: quoted when sent, approved / declined
--     when answered (a trigger on estimates.status).
--   * convert_estimate_to_job also appends an accepted supplement's lines to
--     the RO it belongs to: labor / part / fee / sublet lines sit on hidden
--     system services (services.line_kind), labelled, so the counter balance
--     and the receipt carry them. job_services' unique (job_id, service_id)
--     becomes partial (catalog lines only) so repeated labor rows fit.
-- Re-runnable. Reversal: drop labor_rates, the new columns, the system
-- services, the trigger; restore the unique constraint.
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

-- ---------------------------------------------------------------------------
-- Settings: labor rates, shop supplies, taxable defaults
-- ---------------------------------------------------------------------------
create table if not exists public.labor_rates (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name       text not null check (length(name) between 1 and 60),
  rate       numeric(12,2) not null check (rate >= 0),
  is_default boolean not null default false,
  active     boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);
create unique index if not exists labor_rates_default_idx on public.labor_rates (company_id) where is_default;
drop trigger if exists set_updated_at on public.labor_rates;
create trigger set_updated_at before update on public.labor_rates for each row execute function public.tg_set_updated_at();
drop trigger if exists audit on public.labor_rates;
create trigger audit after insert or update or delete on public.labor_rates for each row execute function public.tg_audit();
alter table public.labor_rates enable row level security;
drop policy if exists labor_rates_select on public.labor_rates;
create policy labor_rates_select on public.labor_rates for select to authenticated using (company_id = public.current_company_id());
drop policy if exists labor_rates_write on public.labor_rates;
create policy labor_rates_write on public.labor_rates for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner_admin())
  with check (company_id = public.current_company_id() and public.is_owner_admin());
grant select, insert, update, delete on public.labor_rates to authenticated;

-- One placeholder rate per company until the owner sets the real one.
insert into public.labor_rates (company_id, name, rate, is_default, sort_order)
select c.id, 'Shop rate', 120, true, 10 from public.companies c
where not exists (select 1 from public.labor_rates lr where lr.company_id = c.id);

alter table public.retail_settings add column if not exists shop_supplies_pct numeric(6,2) not null default 0;
alter table public.retail_settings add column if not exists shop_supplies_cap numeric(12,2);
alter table public.retail_settings add column if not exists shop_supplies_taxable boolean not null default false;
alter table public.retail_settings add column if not exists parts_taxable_default boolean not null default true;
alter table public.retail_settings add column if not exists labor_taxable_default boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'retail_settings_supplies_pct_check') then
    alter table public.retail_settings add constraint retail_settings_supplies_pct_check check (shop_supplies_pct between 0 and 100);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Estimates: line types, supplies, the RO link
-- ---------------------------------------------------------------------------
alter table public.estimate_lines add column if not exists line_type text not null default 'service';
alter table public.estimate_lines add column if not exists hours numeric(8,2);
alter table public.estimate_lines add column if not exists rate numeric(12,2);
alter table public.estimate_lines add column if not exists part_number text;
alter table public.estimate_lines add column if not exists vendor text;
alter table public.estimate_lines add column if not exists cost numeric(12,2);
alter table public.estimate_lines add column if not exists finding_id uuid references public.job_findings (id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'estimate_lines_line_type_check') then
    alter table public.estimate_lines add constraint estimate_lines_line_type_check check (line_type in ('service', 'labor', 'part', 'fee', 'sublet'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'estimate_lines_service_needs_id') then
    alter table public.estimate_lines add constraint estimate_lines_service_needs_id check (line_type <> 'service' or service_id is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'estimate_lines_labor_hours') then
    alter table public.estimate_lines add constraint estimate_lines_labor_hours check (line_type <> 'labor' or (hours > 0 and rate >= 0));
  end if;
end $$;
create index if not exists estimate_lines_finding_idx on public.estimate_lines (finding_id) where finding_id is not null;
alter table public.estimate_options add column if not exists shop_supplies numeric(12,2) not null default 0;
alter table public.estimate_options add column if not exists labor_subtotal numeric(12,2) not null default 0;
alter table public.estimates add column if not exists shop_supplies numeric(12,2) not null default 0;
alter table public.estimates add column if not exists kind text not null default 'quote';
alter table public.estimates add column if not exists applied_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'estimates_kind_check') then
    alter table public.estimates add constraint estimates_kind_check check (kind in ('quote', 'supplement'));
  end if;
end $$;
-- Estimates that already made or joined a job have their lines on it.
update public.estimates set applied_at = coalesce(accepted_at, created_at) where job_id is not null and applied_at is null;

grant select (line_type, hours, part_number, vendor, finding_id) on public.estimate_lines to authenticated;
grant select (kind, applied_at) on public.estimates to authenticated;

-- Hidden system services carry non-catalog lines on a job (labelled; never on a menu).
alter table public.services add column if not exists line_kind text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'services_line_kind_check') then
    alter table public.services add constraint services_line_kind_check check (line_kind is null or line_kind in ('labor', 'part', 'fee', 'sublet', 'shop_supplies'));
  end if;
end $$;
create unique index if not exists services_line_kind_idx on public.services (company_id, line_kind) where line_kind is not null;
grant select (line_kind) on public.services to authenticated;

create or replace function public._estimate_system_service(p_company uuid, p_kind text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tax boolean;
begin
  select id into v_id from public.services where company_id = p_company and line_kind = p_kind;
  if v_id is not null then return v_id; end if;
  select case p_kind when 'part' then coalesce(parts_taxable_default, true) when 'labor' then coalesce(labor_taxable_default, false) when 'shop_supplies' then coalesce(shop_supplies_taxable, false) else false end
    into v_tax from public.retail_settings where company_id = p_company;
  insert into public.services (company_id, name, description, category, default_price, price_min, price_max, active, sort_order, retail, dealer, taxable, placeholder, line_kind)
  values (p_company, case p_kind when 'labor' then 'Labor' when 'part' then 'Parts' when 'fee' then 'Fee' when 'sublet' then 'Sublet' else 'Shop supplies' end,
          'A line from a repair order estimate', 'addon', 0, 0, 100000, true, 990, false, false, coalesce(v_tax, false), false, p_kind)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public._estimate_system_service(uuid, text) from public, anon, authenticated;

-- A catalog service may appear once per job; labelled lines (Other, labor, parts…) may repeat.
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'job_services_job_id_service_id_key') then
    alter table public.job_services drop constraint job_services_job_id_service_id_key;
  end if;
end $$;
create unique index if not exists job_services_catalog_line_idx on public.job_services (job_id, service_id) where label is null;

-- The menus never show the system rows.
do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'retail_catalog';
  if v_src is not null and position('s.line_kind is null' in v_src) = 0 then
    v_src := replace(v_src, 'from public.services s where s.company_id = v_company)', 'from public.services s where s.company_id = v_company and s.line_kind is null)');
    v_src := replace(v_src, '''tax_rate'', (select tax_rate from public.companies where id = v_company)',
      '''labor_rates'', (select coalesce(jsonb_agg(to_jsonb(lr) order by lr.sort_order, lr.name), ''[]''::jsonb) from public.labor_rates lr where lr.company_id = v_company and lr.active),
    ''tax_rate'', (select tax_rate from public.companies where id = v_company)');
    execute v_src;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Pricing
-- ---------------------------------------------------------------------------
-- One line of the builder's payload, priced: a service through the matrix, labor = hours × rate, the rest qty × price.
-- p_line: {line_type?, service_id, qty, label, price, modifiers[], hours, rate, part_number, vendor, taxable?, cost, finding_id}
create or replace function public._estimate_price_line(p_company uuid, p_size public.vehicle_size, p_line jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_set   public.retail_settings;
  v_type  text := coalesce(nullif(p_line ->> 'line_type', ''), 'service');
  v_q     jsonb;
  v_qty   numeric;
  v_unit  numeric;
  v_hours numeric;
  v_rate  numeric;
  v_label text := nullif(left(trim(coalesce(p_line ->> 'label', '')), 120), '');
  v_tax   boolean;
  v_extra jsonb;
begin
  select * into v_set from public.retail_settings where company_id = p_company;
  v_extra := jsonb_build_object(
    'cost', nullif(p_line ->> 'cost', '')::numeric,
    'finding_id', nullif(p_line ->> 'finding_id', '')::uuid,
    'part_number', nullif(left(trim(coalesce(p_line ->> 'part_number', '')), 60), ''),
    'vendor', nullif(left(trim(coalesce(p_line ->> 'vendor', '')), 80), ''));
  if v_type = 'service' then
    v_q := public._quote_total(p_company, p_size, jsonb_build_array(p_line), false) -> 'lines' -> 0;
    return v_q || jsonb_build_object('line_type', 'service', 'hours', null, 'rate', null) || v_extra;
  end if;
  if v_type not in ('labor', 'part', 'fee', 'sublet') then
    raise exception 'Unknown line type %', v_type using errcode = '22023';
  end if;
  if v_label is null then
    raise exception 'A % line needs a name', v_type using errcode = '22023';
  end if;
  if v_type = 'labor' then
    v_hours := coalesce(nullif(p_line ->> 'hours', '')::numeric, 0);
    v_rate := coalesce(nullif(p_line ->> 'rate', '')::numeric, (select rate from public.labor_rates where company_id = p_company and is_default and active));
    if v_hours <= 0 then raise exception 'Labor needs hours' using errcode = '22023'; end if;
    if v_rate is null or v_rate < 0 then raise exception 'Pick a labor rate' using errcode = '22023'; end if;
    v_qty := v_hours;
    v_unit := v_rate;
    v_tax := coalesce(v_set.tax_all_lines, false) or coalesce((p_line ->> 'taxable')::boolean, coalesce(v_set.labor_taxable_default, false));
  else
    v_qty := greatest(coalesce(nullif(p_line ->> 'qty', '')::numeric, 1), 0.01);
    v_unit := greatest(coalesce(nullif(p_line ->> 'price', '')::numeric, 0), 0);
    v_tax := coalesce(v_set.tax_all_lines, false) or coalesce((p_line ->> 'taxable')::boolean, case when v_type = 'part' then coalesce(v_set.parts_taxable_default, true) else false end);
  end if;
  return jsonb_build_object(
    'line_type', v_type, 'service_id', null, 'name', v_label, 'benefit_text', null,
    'unit_price', v_unit, 'qty', v_qty, 'modifiers', '[]'::jsonb, 'line_total', round(v_unit * v_qty, 2), 'taxable', v_tax,
    'duration_minutes', case when v_type = 'labor' then round(v_hours * 60)::int else 0 end, 'placeholder', false,
    'hours', v_hours, 'rate', v_rate) || v_extra;
end $$;
revoke execute on function public._estimate_price_line(uuid, public.vehicle_size, jsonb) from public, anon, authenticated;

-- An option's numbers from its stored lines. After the customer answered, a single option counts only the lines they kept.
create or replace function public._estimate_option_totals(p_estimate uuid, p_option uuid, p_answered boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e        public.estimates;
  v_set    public.retail_settings;
  v_rate   numeric;
  v_single boolean;
  v_sub    numeric := 0;
  v_labor  numeric := 0;
  v_taxsum numeric := 0;
  v_dur    integer := 0;
  v_sup    numeric := 0;
  v_tax    numeric := 0;
begin
  select * into e from public.estimates where id = p_estimate;
  select * into v_set from public.retail_settings where company_id = e.company_id;
  select tax_rate into v_rate from public.companies where id = e.company_id;
  select tier = 'single' into v_single from public.estimate_options where id = p_option;
  select coalesce(sum(line_total), 0),
         coalesce(sum(case when line_type = 'labor' then line_total else 0 end), 0),
         coalesce(sum(case when taxable then line_total else 0 end), 0),
         coalesce(sum(case when line_type = 'service' then duration_minutes * greatest(qty, 1)::int else duration_minutes end), 0)
    into v_sub, v_labor, v_taxsum, v_dur
  from public.estimate_lines
  where estimate_id = p_estimate and option_id = p_option
    and (not p_answered or not coalesce(v_single, false) or customer_approved is not false);
  if coalesce(v_set.shop_supplies_pct, 0) > 0 and v_labor > 0 then
    v_sup := round(v_labor * v_set.shop_supplies_pct / 100, 2);
    if v_set.shop_supplies_cap is not null then v_sup := least(v_sup, v_set.shop_supplies_cap); end if;
  end if;
  if coalesce(v_set.shop_supplies_taxable, false) then v_taxsum := v_taxsum + v_sup; end if;
  v_tax := round(v_taxsum * coalesce(v_rate, 0), 2);
  return jsonb_build_object('subtotal', v_sub, 'labor_subtotal', v_labor, 'shop_supplies', v_sup, 'tax', v_tax, 'total', v_sub + v_sup + v_tax, 'duration_minutes', v_dur);
end $$;
revoke execute on function public._estimate_option_totals(uuid, uuid, boolean) from public, anon, authenticated;

create or replace function public._estimate_recompute(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e        public.estimates;
  v_opt    uuid;
  v_o      jsonb;
  v_sub    numeric := 0;
  v_tax    numeric := 0;
  v_rate   numeric;
  v_set    public.retail_settings;
  v_dep    numeric := 0;
  v_asub   numeric := 0;
  v_atax   numeric := 0;
begin
  select * into e from public.estimates where id = p_id;
  select tax_rate into v_rate from public.companies where id = e.company_id;
  select * into v_set from public.retail_settings where company_id = e.company_id;
  v_opt := e.selected_option_id;
  if v_opt is null then
    select id into v_opt from public.estimate_options where estimate_id = p_id order by recommended desc, sort_order limit 1;
  end if;
  v_o := public._estimate_option_totals(p_id, v_opt, e.status = 'accepted');
  -- the add-ons that count: approved ones once the customer answered, else the default-on ones
  select coalesce(sum(line_total), 0), coalesce(sum(case when taxable then line_total else 0 end), 0) into v_asub, v_atax
  from public.estimate_lines
  where estimate_id = p_id and option_id is null
    and (case when e.status in ('accepted') then customer_approved is true else default_on end);
  v_sub := (v_o ->> 'subtotal')::numeric + v_asub;
  v_tax := (v_o ->> 'tax')::numeric + round(v_atax * coalesce(v_rate, 0), 2);
  if v_set.deposit_kind = 'percent' then v_dep := round((v_sub + (v_o ->> 'shop_supplies')::numeric + v_tax) * v_set.deposit_value / 100, 2);
  elsif v_set.deposit_kind = 'flat' then v_dep := least(v_set.deposit_value, v_sub + (v_o ->> 'shop_supplies')::numeric + v_tax);
  else v_dep := 0; end if;
  update public.estimates
     set subtotal = v_sub, shop_supplies = (v_o ->> 'shop_supplies')::numeric, tax_rate = coalesce(v_rate, 0), tax = v_tax,
         total = v_sub + (v_o ->> 'shop_supplies')::numeric + v_tax, deposit_required = v_dep
   where id = p_id;
end $$;

-- Replace an estimate's options and lines from the builder's payload, pricing every line.
create or replace function public._estimate_apply(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  e        public.estimates;
  v_opt    jsonb;
  v_line   jsonb;
  v_optid  uuid;
  v_lineid uuid;
  v_ql     jsonb;
  v_t      jsonb;
  v_i      integer := 0;
  v_j      integer;
begin
  select * into e from public.estimates where id = p_id;
  if jsonb_array_length(coalesce(p -> 'options', '[]'::jsonb)) = 0 then
    raise exception 'An estimate needs at least one option' using errcode = '22023';
  end if;
  update public.estimates set selected_option_id = null where id = p_id;
  delete from public.estimate_lines where estimate_id = p_id;
  delete from public.estimate_options where estimate_id = p_id;

  for v_opt in select * from jsonb_array_elements(p -> 'options') loop
    v_i := v_i + 1;
    if jsonb_array_length(coalesce(v_opt -> 'lines', '[]'::jsonb)) = 0 then
      raise exception 'Option "%" has no lines', coalesce(v_opt ->> 'name', v_i::text) using errcode = '22023';
    end if;
    insert into public.estimate_options (company_id, estimate_id, tier, name, description, recommended, sort_order)
    values (e.company_id, p_id, coalesce(nullif(v_opt ->> 'tier', ''), 'single'), coalesce(nullif(left(trim(v_opt ->> 'name'), 60), ''), 'Option ' || v_i),
            nullif(left(trim(coalesce(v_opt ->> 'description', '')), 300), ''), coalesce((v_opt ->> 'recommended')::boolean, false), v_i)
    returning id into v_optid;
    v_j := 0;
    for v_line in select * from jsonb_array_elements(v_opt -> 'lines') loop
      v_j := v_j + 1;
      v_ql := public._estimate_price_line(e.company_id, e.size_class, v_line);
      insert into public.estimate_lines (company_id, estimate_id, option_id, service_id, name, benefit_text, qty, unit_price, modifiers, taxable, line_total, duration_minutes, default_on, sort_order,
                                         line_type, hours, rate, part_number, vendor, cost, finding_id)
      values (e.company_id, p_id, v_optid, nullif(v_ql ->> 'service_id', '')::uuid, v_ql ->> 'name', v_ql ->> 'benefit_text', (v_ql ->> 'qty')::numeric, (v_ql ->> 'unit_price')::numeric,
              coalesce(v_ql -> 'modifiers', '[]'::jsonb), (v_ql ->> 'taxable')::boolean, (v_ql ->> 'line_total')::numeric, (v_ql ->> 'duration_minutes')::int, true, v_j,
              v_ql ->> 'line_type', nullif(v_ql ->> 'hours', '')::numeric, nullif(v_ql ->> 'rate', '')::numeric, v_ql ->> 'part_number', v_ql ->> 'vendor', nullif(v_ql ->> 'cost', '')::numeric, nullif(v_ql ->> 'finding_id', '')::uuid)
      returning id into v_lineid;
      if nullif(v_ql ->> 'finding_id', '') is not null then
        update public.job_findings set estimate_line_id = v_lineid, status = case when status in ('open', 'declined', 'quoted') then 'quoted' else status end
        where id = (v_ql ->> 'finding_id')::uuid and company_id = e.company_id;
      end if;
    end loop;
    v_t := public._estimate_option_totals(p_id, v_optid, false);
    update public.estimate_options set subtotal = (v_t ->> 'subtotal')::numeric, labor_subtotal = (v_t ->> 'labor_subtotal')::numeric, shop_supplies = (v_t ->> 'shop_supplies')::numeric,
                                       tax = (v_t ->> 'tax')::numeric, total = (v_t ->> 'total')::numeric, duration_minutes = (v_t ->> 'duration_minutes')::int
     where id = v_optid;
  end loop;

  v_j := 0;
  for v_line in select * from jsonb_array_elements(coalesce(p -> 'addons', '[]'::jsonb)) loop
    v_j := v_j + 1;
    v_ql := public._estimate_price_line(e.company_id, e.size_class, v_line);
    insert into public.estimate_lines (company_id, estimate_id, option_id, service_id, name, benefit_text, qty, unit_price, modifiers, taxable, line_total, duration_minutes, default_on, sort_order,
                                       line_type, hours, rate, part_number, vendor, cost, finding_id)
    values (e.company_id, p_id, null, nullif(v_ql ->> 'service_id', '')::uuid, v_ql ->> 'name', v_ql ->> 'benefit_text', (v_ql ->> 'qty')::numeric, (v_ql ->> 'unit_price')::numeric,
            coalesce(v_ql -> 'modifiers', '[]'::jsonb), (v_ql ->> 'taxable')::boolean, (v_ql ->> 'line_total')::numeric, (v_ql ->> 'duration_minutes')::int, coalesce((v_line ->> 'default_on')::boolean, false), v_j,
            v_ql ->> 'line_type', nullif(v_ql ->> 'hours', '')::numeric, nullif(v_ql ->> 'rate', '')::numeric, v_ql ->> 'part_number', v_ql ->> 'vendor', nullif(v_ql ->> 'cost', '')::numeric, nullif(v_ql ->> 'finding_id', '')::uuid);
  end loop;

  perform public._estimate_recompute(p_id);
end $$;

-- An estimate may be written on an open repair order (p.job_id): the customer and car come from the job; it is a supplement.
create or replace function public.create_estimate(p jsonb)
returns public.estimates language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_uid     uuid := auth.uid();
  v_num     integer;
  v_size    public.vehicle_size;
  v_days    integer;
  v_job     public.jobs;
  v_cust    uuid := nullif(p ->> 'customer_id', '')::uuid;
  v_veh     uuid := nullif(p ->> 'vehicle_id', '')::uuid;
  e         public.estimates;
begin
  if not public.can_price_jobs() then
    raise exception 'Only the owner, an admin or an advisor writes estimates' using errcode = '42501';
  end if;
  if nullif(p ->> 'job_id', '') is not null then
    select j.* into v_job from public.jobs j join public.dealerships d on d.id = j.dealership_id
     where j.id = (p ->> 'job_id')::uuid and j.company_id = v_company and j.deleted_at is null and d.retail;
    if v_job.id is null then
      raise exception 'Repair order not found' using errcode = 'P0002';
    end if;
    v_cust := coalesce(v_cust, v_job.customer_id);
    v_veh := coalesce(v_veh, v_job.vehicle_id);
  end if;
  if v_cust is null or not exists (select 1 from public.customers where id = v_cust and company_id = v_company) then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  if v_veh is not null then
    select size_class into v_size from public.vehicles where id = v_veh and company_id = v_company and customer_id = v_cust;
    if v_size is null then
      raise exception 'Vehicle not found' using errcode = 'P0002';
    end if;
  end if;
  if nullif(p ->> 'size_class', '') is not null then v_size := (p ->> 'size_class')::public.vehicle_size; end if;
  select estimate_valid_days into v_days from public.retail_settings where company_id = v_company;

  update public.companies set next_estimate_number = next_estimate_number + 1 where id = v_company returning next_estimate_number - 1 into v_num;
  insert into public.estimates (company_id, number, display_number, customer_id, vehicle_id, size_class, expires_at, po_number, internal_notes, customer_notes, created_by, job_id, kind)
  values (v_company, v_num, 'EST-' || lpad(v_num::text, 6, '0'), v_cust, v_veh, coalesce(v_size, 'sedan'),
          coalesce(nullif(p ->> 'expires_at', '')::timestamptz, now() + make_interval(days => coalesce(v_days, 14))),
          nullif(left(trim(coalesce(p ->> 'po_number', '')), 40), ''), nullif(trim(coalesce(p ->> 'internal_notes', '')), ''), nullif(trim(coalesce(p ->> 'customer_notes', '')), ''), v_uid,
          v_job.id, case when v_job.id is null then 'quote' else 'supplement' end)
  returning * into e;
  perform public._estimate_apply(e.id, p);
  select * into e from public.estimates where id = e.id;
  return e;
end $$;
grant execute on function public.create_estimate(jsonb) to authenticated;

-- The customer (or staff) may untick lines of a single option; lines the answer never mentions count as kept.
do $$
begin
  perform public._patch_function('estimate_respond', 'single option: per-line approval',
    'update public.estimate_lines set customer_approved = (id = any (v_ids)) where estimate_id = e.id and option_id is null;',
    'update public.estimate_lines set customer_approved = (id = any (v_ids)) where estimate_id = e.id and option_id is null;
  -- single option: per-line approval when the answer names any of its lines
  if exists (select 1 from public.estimate_options o where o.id = v_opt and o.tier = ''single'')
     and exists (select 1 from public.estimate_lines l where l.estimate_id = e.id and l.option_id = v_opt and l.id = any (v_ids)) then
    update public.estimate_lines set customer_approved = (id = any (v_ids)) where estimate_id = e.id and option_id = v_opt;
  else
    update public.estimate_lines set customer_approved = true where estimate_id = e.id and option_id = v_opt;
  end if;');
  perform public._patch_function('mark_estimate_accepted', 'single option: per-line approval',
    'update public.estimate_lines set customer_approved = (id = any (coalesce(p_line_ids, ''{}''))) where estimate_id = p_id and option_id is null;',
    'update public.estimate_lines set customer_approved = (id = any (coalesce(p_line_ids, ''{}''))) where estimate_id = p_id and option_id is null;
  -- single option: per-line approval when the answer names any of its lines
  if exists (select 1 from public.estimate_options o where o.id = p_option and o.tier = ''single'')
     and exists (select 1 from public.estimate_lines l where l.estimate_id = p_id and l.option_id = p_option and l.id = any (coalesce(p_line_ids, ''{}''))) then
    update public.estimate_lines set customer_approved = (id = any (coalesce(p_line_ids, ''{}''))) where estimate_id = p_id and option_id = p_option;
  else
    update public.estimate_lines set customer_approved = true where estimate_id = p_id and option_id = p_option;
  end if;');
end $$;

-- Findings follow the estimate they are on.
create or replace function public.tg_estimate_findings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status in ('sent', 'viewed') then
    update public.job_findings f set status = 'quoted'
    where f.status in ('open', 'declined', 'quoted') and f.estimate_line_id in (select id from public.estimate_lines where estimate_id = new.id);
  elsif new.status = 'accepted' then
    update public.job_findings f set status = case when l.customer_approved is not false and (l.option_id is null and l.customer_approved is true or l.option_id = new.selected_option_id) then 'approved' else 'declined' end
    from public.estimate_lines l
    where l.id = f.estimate_line_id and l.estimate_id = new.id and f.status in ('open', 'quoted', 'declined', 'approved');
  elsif new.status in ('declined', 'expired') then
    update public.job_findings f set status = 'declined'
    where f.status = 'quoted' and f.estimate_line_id in (select id from public.estimate_lines where estimate_id = new.id);
  end if;
  return new;
end $$;
drop trigger if exists estimate_findings on public.estimates;
create trigger estimate_findings after update of status on public.estimates for each row execute function public.tg_estimate_findings();

-- ---------------------------------------------------------------------------
-- The approved work onto the repair order
-- ---------------------------------------------------------------------------
-- An accepted estimate becomes a retail job (a quote) or lands on the RO it was written for (a supplement), at the snapshot prices.
-- p: {dealership_id?, tag_number?, performed_at?, detailer_id?, notes?}
create or replace function public.convert_estimate_to_job(p_id uuid, p jsonb default '{}'::jsonb)
returns public.jobs language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_uid     uuid := auth.uid();
  e         public.estimates;
  v_dealer  public.dealerships;
  v_veh     public.vehicles;
  v_detailer uuid := v_uid;
  j         public.jobs;
  l         record;
  v_svc     uuid;
  v_label   text;
  v_sup     numeric;
  v_n       integer := 0;
begin
  if not public.can_price_jobs() then
    raise exception 'Only the owner, an admin or an advisor converts an estimate' using errcode = '42501';
  end if;
  select * into e from public.estimates where id = p_id and company_id = v_company;
  if not found then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  if e.status <> 'accepted' then
    raise exception 'Only an accepted estimate becomes a job' using errcode = 'P0001';
  end if;
  if e.job_id is not null then
    select * into j from public.jobs where id = e.job_id;
    if e.applied_at is not null then return j; end if;
    if j.deleted_at is not null or j.paid_at is not null then
      raise exception 'That repair order is closed' using errcode = 'P0001';
    end if;
  else
    select * into v_dealer from public.dealerships
     where company_id = v_company and active and retail and (nullif(p ->> 'dealership_id', '') is null or id = (p ->> 'dealership_id')::uuid)
     order by name limit 1;
    if v_dealer.id is null then
      raise exception 'No retail location is set up (Settings → Dealerships → Retail)' using errcode = 'P0001';
    end if;
    if nullif(p ->> 'detailer_id', '') is not null and exists (select 1 from public.profiles where id = (p ->> 'detailer_id')::uuid and company_id = v_company) then
      v_detailer := (p ->> 'detailer_id')::uuid;
    end if;
    if e.vehicle_id is not null then
      select * into v_veh from public.vehicles where id = e.vehicle_id;
    end if;
    insert into public.jobs (company_id, dealership_id, detailer_id, client_id, tag_number, vin, year, make, model, color, performed_at, notes, customer_id, vehicle_id, created_by, updated_by)
    values (v_company, v_dealer.id, v_detailer, gen_random_uuid(),
            coalesce(nullif(upper(trim(p ->> 'tag_number')), ''), replace(e.display_number, 'EST-', 'E-')),
            v_veh.vin, v_veh.year, v_veh.make, v_veh.model, v_veh.color,
            coalesce(nullif(p ->> 'performed_at', '')::timestamptz, now()),
            coalesce(nullif(trim(p ->> 'notes'), ''), e.customer_notes),
            e.customer_id, e.vehicle_id, v_uid, v_uid)
    returning * into j;
  end if;

  perform set_config('app.bypass_lock', 'on', true);
  for l in
    select el.*, s.default_price = 0 and s.price_min = 0 and s.price_max >= 10000 as open_amount, s.name as service_name
    from public.estimate_lines el left join public.services s on s.id = el.service_id
    where el.estimate_id = p_id
      and ((el.option_id = e.selected_option_id and el.customer_approved is not false) or (el.option_id is null and el.customer_approved is true))
    order by el.option_id nulls last, el.sort_order
  loop
    if l.line_type = 'service' then
      if l.service_id is null then continue; end if;
      v_svc := l.service_id;
      v_label := case when coalesce(l.open_amount, false) or l.name <> l.service_name then left(l.name, 120) end;
      -- a catalog service already on the job keeps its line; the price stays as quoted
      if v_label is null and exists (select 1 from public.job_services js where js.job_id = j.id and js.service_id = v_svc and js.label is null) then continue; end if;
    else
      v_svc := public._estimate_system_service(e.company_id, l.line_type);
      v_label := left(case l.line_type
        when 'labor' then l.name || ' — ' || trim(to_char(l.hours, 'FM9990.00')) || ' h @ $' || trim(to_char(l.rate, 'FM9990.00'))
        when 'part' then l.name || case when l.part_number is not null then ' (' || l.part_number || coalesce(', ' || l.vendor, '') || ')' when l.vendor is not null then ' (' || l.vendor || ')' else '' end || case when l.qty <> 1 then ' × ' || trim(to_char(l.qty, 'FM9990.##')) else '' end
        when 'sublet' then l.name || case when l.vendor is not null then ' (' || l.vendor || ')' else '' end
        else l.name end, 120);
    end if;
    insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price)
    values (e.company_id, j.id, v_svc, l.line_total, null, v_label, false);
    v_n := v_n + 1;
  end loop;
  select shop_supplies into v_sup from public.estimate_options where id = e.selected_option_id;
  if coalesce(v_sup, 0) > 0 then
    insert into public.job_services (company_id, job_id, service_id, price, override_reason, label, needs_price)
    values (e.company_id, j.id, public._estimate_system_service(e.company_id, 'shop_supplies'), v_sup, null, 'Shop supplies', false);
  end if;
  update public.jobs set updated_by = v_uid where id = j.id;
  perform set_config('app.bypass_lock', 'off', true);

  update public.estimates set job_id = j.id, applied_at = now() where id = p_id;
  update public.job_findings f set status = 'done' where false;  -- findings stay "approved" until the tech marks them done
  select * into j from public.jobs where id = j.id;
  return j;
end $$;
grant execute on function public.convert_estimate_to_job(uuid, jsonb) to authenticated;

-- The retail job's tax: its appointment's, plus every supplement applied to it (never the appointment's own estimate twice).
create or replace function public._job_money(p_job uuid)
returns table (subtotal numeric, tax numeric, total numeric, deposit_paid numeric, paid numeric, balance numeric)
language sql stable security definer set search_path = public as $$
  with j as (select * from public.jobs where id = p_job),
       s as (select coalesce(sum(price), 0) as subtotal from public.job_services where job_id = p_job),
       a as (select a.id, a.estimate_id, a.tax from public.appointments a join j on a.id = j.appointment_id),
       t as (select coalesce((select tax from a), 0)
                  + coalesce((select sum(e.tax) from public.estimates e join j on e.job_id = j.id where e.applied_at is not null and e.status = 'accepted' and e.id is distinct from (select estimate_id from a)), 0) as tax),
       d as (select public._deposit_paid_for((select j.appointment_id from j), (select e.id from public.estimates e join j on e.job_id = j.id order by e.created_at limit 1), p_job) as deposit_paid),
       b as (select coalesce(sum(case when p.kind = 'balance' then p.amount else 0 end), 0) as paid from public.payments p where p.job_id = p_job and p.status in ('paid', 'refunded'))
  select s.subtotal, t.tax, s.subtotal + t.tax, d.deposit_paid, b.paid, greatest(s.subtotal + t.tax - d.deposit_paid - b.paid, 0)
  from s, t, d, b
$$;
revoke execute on function public._job_money(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reads: the estimate JSON gains the line types, supplies, the RO and the findings it quotes
-- ---------------------------------------------------------------------------
create or replace function public._estimate_json(p_id uuid, p_money boolean, p_public boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', e.id, 'display_number', e.display_number, 'status', e.status, 'size_class', e.size_class, 'kind', e.kind,
    'expires_at', e.expires_at, 'po_number', e.po_number,
    'internal_notes', case when p_public then null else e.internal_notes end,
    'customer_notes', e.customer_notes,
    'selected_option_id', e.selected_option_id,
    'sent_at', e.sent_at, 'first_viewed_at', e.first_viewed_at, 'last_viewed_at', e.last_viewed_at, 'view_count', e.view_count,
    'accepted_at', e.accepted_at, 'declined_at', e.declined_at, 'decline_reason', e.decline_reason, 'job_id', e.job_id, 'applied_at', e.applied_at,
    'created_at', e.created_at, 'updated_at', e.updated_at,
    'token', case when p_public then e.token else null end,
    'subtotal', case when p_money then e.subtotal end, 'shop_supplies', case when p_money then e.shop_supplies end, 'tax_rate', case when p_money then e.tax_rate end,
    'tax', case when p_money then e.tax end, 'total', case when p_money then e.total end,
    'deposit_required', case when p_money then e.deposit_required end,
    'customer', (select jsonb_build_object('id', c.id, 'display_name', case when p_public then nullif(trim(c.first_name), '') else c.display_name end,
                                           'first_name', c.first_name, 'phone', case when p_public then null else c.phone end, 'email', case when p_public then null else c.email end)
                 from public.customers c where c.id = e.customer_id),
    'vehicle', (select jsonb_build_object('id', v.id, 'name', nullif(concat_ws(' ', v.year::text, v.make, v.model), ''), 'color', v.color, 'plate', case when p_public then null else v.plate end, 'size_class', v.size_class)
                from public.vehicles v where v.id = e.vehicle_id),
    'job', (select jsonb_build_object('id', j.id, 'ro_number', j.ro_number, 'tag_number', j.tag_number, 'performed_at', j.performed_at, 'paid_at', j.paid_at,
                                      'odometer', (select o.reading from public.odometer_readings o where o.job_id = j.id order by o.read_at desc limit 1))
            from public.jobs j where j.id = e.job_id),
    'options', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', o.id, 'tier', o.tier, 'name', o.name, 'description', o.description, 'recommended', o.recommended, 'sort_order', o.sort_order,
                  'duration_minutes', o.duration_minutes,
                  'subtotal', case when p_money then o.subtotal end, 'labor_subtotal', case when p_money then o.labor_subtotal end, 'shop_supplies', case when p_money then o.shop_supplies end,
                  'tax', case when p_money then o.tax end, 'total', case when p_money then o.total end,
                  'lines', (select coalesce(jsonb_agg(jsonb_build_object(
                              'id', l.id, 'service_id', l.service_id, 'line_type', l.line_type, 'name', l.name, 'benefit_text', l.benefit_text, 'qty', l.qty, 'taxable', l.taxable,
                              'duration_minutes', l.duration_minutes, 'hours', l.hours, 'part_number', l.part_number, 'vendor', l.vendor, 'finding_id', l.finding_id,
                              'customer_approved', l.customer_approved,
                              'unit_price', case when p_money then l.unit_price end, 'rate', case when p_money then l.rate end, 'line_total', case when p_money then l.line_total end,
                              'cost', case when p_money and not p_public then l.cost end,
                              'modifiers', case when p_money then l.modifiers else (select coalesce(jsonb_agg(jsonb_build_object('code', m ->> 'code', 'label', m ->> 'label')), '[]'::jsonb) from jsonb_array_elements(l.modifiers) m) end
                            ) order by l.sort_order), '[]'::jsonb) from public.estimate_lines l where l.option_id = o.id)
                ) order by o.sort_order), '[]'::jsonb) from public.estimate_options o where o.estimate_id = e.id),
    'addons', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', l.id, 'service_id', l.service_id, 'line_type', l.line_type, 'name', l.name, 'benefit_text', l.benefit_text, 'qty', l.qty, 'taxable', l.taxable,
                 'duration_minutes', l.duration_minutes, 'default_on', l.default_on, 'customer_approved', l.customer_approved, 'hours', l.hours, 'part_number', l.part_number, 'vendor', l.vendor, 'finding_id', l.finding_id,
                 'unit_price', case when p_money then l.unit_price end, 'rate', case when p_money then l.rate end, 'line_total', case when p_money then l.line_total end,
                 'cost', case when p_money and not p_public then l.cost end,
                 'modifiers', case when p_money then l.modifiers else (select coalesce(jsonb_agg(jsonb_build_object('code', m ->> 'code', 'label', m ->> 'label')), '[]'::jsonb) from jsonb_array_elements(l.modifiers) m) end
               ) order by l.sort_order), '[]'::jsonb) from public.estimate_lines l where l.estimate_id = e.id and l.option_id is null),
    'findings', (select coalesce(jsonb_agg(public._finding_json(f.id) order by f.created_at), '[]'::jsonb)
                 from public.job_findings f where f.estimate_line_id in (select l.id from public.estimate_lines l where l.estimate_id = e.id)),
    'authorizations', (select coalesce(jsonb_agg(jsonb_build_object(
                         'id', a.id, 'authorized_at', a.authorized_at, 'name', a.name, 'method', a.method, 'by_staff', a.by_staff,
                         'selected_option_id', a.selected_option_id, 'approved_line_ids', to_jsonb(a.approved_line_ids), 'signature_path', a.signature_path,
                         'pay_choice', a.pay_choice, 'total', case when p_money then a.total end
                       ) order by a.authorized_at desc), '[]'::jsonb) from public.estimate_authorizations a where a.estimate_id = e.id),
    'company', (select jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email, 'address_line1', c.address_line1, 'address_line2', c.address_line2, 'city', c.city, 'state', c.state, 'postal_code', c.postal_code, 'logo_path', c.logo_path, 'timezone', c.timezone)
                from public.companies c where c.id = e.company_id),
    'policy', (select jsonb_build_object('policy_text', rs.policy_text, 'deposit_kind', rs.deposit_kind, 'deposit_value', rs.deposit_value, 'deposit_refundable', rs.deposit_refundable,
                                         'signature_required', rs.signature_required_estimate, 'cancel_hours', rs.cancel_hours,
                                         'shop_supplies_pct', rs.shop_supplies_pct, 'shop_supplies_cap', rs.shop_supplies_cap, 'shop_supplies_taxable', rs.shop_supplies_taxable,
                                         'tax_rate', (select tax_rate from public.companies c where c.id = e.company_id))
               from public.retail_settings rs where rs.company_id = e.company_id),
    -- what the customer sees always carries money: it is their quote
    'public_money', p_public
  )
  from public.estimates e where e.id = p_id
$$;
revoke execute on function public._estimate_json(uuid, boolean, boolean) from public, anon, authenticated;

-- The estimates written on a repair order, for its page (the notes tab).
create or replace function public.job_estimates(p_job uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.jobs j where j.id = p_job and j.company_id = public.current_company_id() and (public.is_admin() or j.detailer_id = auth.uid()))
    then (select coalesce(jsonb_agg(jsonb_build_object(
            'id', e.id, 'display_number', e.display_number, 'status', e.status, 'kind', e.kind, 'sent_at', e.sent_at, 'accepted_at', e.accepted_at, 'applied_at', e.applied_at,
            'total', case when public.can_price_jobs() then e.total end,
            'lines', (select count(*) from public.estimate_lines l where l.estimate_id = e.id and ((l.option_id = e.selected_option_id and l.customer_approved is not false) or (l.option_id is null and l.customer_approved is true)))
          ) order by e.created_at desc), '[]'::jsonb) from public.estimates e where e.job_id = p_job)
    else '[]'::jsonb end
$$;
grant execute on function public.job_estimates(uuid) to authenticated;

drop function if exists public._patch_function(text, text, text, text);
