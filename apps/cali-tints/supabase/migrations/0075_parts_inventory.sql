-- =============================================================================
-- 0075 — Parts inventory: vendors, stocked parts, orders and receiving
--   * vendors, inventory_items (a stocked part: number, bin, cost, list price,
--     on hand, reorder point), part_orders + part_order_lines (a PO to a
--     vendor, optionally for one estimate), stock_movements (an insert-only
--     ledger; on hand is its sum and a trigger keeps it).
--   * estimate_lines.inventory_item_id: a part line can be a stocked part. Stock
--     moves out when the visit is approved (estimates.applied_at is set),
--     exactly once per line, for approved lines only. On hand may go negative
--     (flagged): a missing count never blocks closing an invoice.
--   * Receiving a PO adds stock and, when the estimate's parts are all in,
--     sets its Parts status to Arrived. Marking a PO ordered sets Ordered.
--   Money (cost, list price, order totals) is for owner, admin and advisor;
--   anyone signed in reads name, number, bin and on hand.
-- Re-runnable.
-- =============================================================================

create or replace function public._patch_function(p_name text, p_marker text, p_from text, p_to text)
returns void language plpgsql as $$
declare src text;
begin
  select pg_get_functiondef(p.oid) into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = p_name;
  if src is null then raise exception 'patch: % missing', p_name; end if;
  if position(p_marker in src) > 0 then return; end if;
  if position(p_from in src) = 0 then raise exception 'patch: % anchor not found (%)', p_name, left(p_from, 60); end if;
  execute replace(src, p_from, p_to);
end $$;

alter table public.companies add column if not exists next_po_number integer not null default 1;
create or replace function public._next_po_number(p_company uuid)
returns text language plpgsql as $$
declare v_num integer;
begin
  update public.companies set next_po_number = next_po_number + 1 where id = p_company returning next_po_number - 1 into v_num;
  return 'PO-' || lpad(v_num::text, 6, '0');
end $$;
revoke execute on function public._next_po_number(uuid) from public, anon, authenticated;

create table if not exists public.vendors (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name       text not null check (length(name) between 1 and 80),
  phone      text,
  email      text,
  account_no text,
  notes      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists vendors_name_idx on public.vendors (company_id, lower(name));

create table if not exists public.inventory_items (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  part_number  text not null check (length(part_number) between 1 and 60),
  name         text not null check (length(name) between 1 and 120),
  vendor_id    uuid references public.vendors (id) on delete set null,
  brand        text,
  bin          text,
  cost         numeric(12, 2) check (cost is null or cost >= 0),
  list_price   numeric(12, 2) check (list_price is null or list_price >= 0),
  qty_on_hand  numeric(10, 2) not null default 0,
  reorder_at   numeric(10, 2) check (reorder_at is null or reorder_at >= 0),
  taxable      boolean,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists inventory_items_number_idx on public.inventory_items (company_id, lower(part_number));
create index if not exists inventory_items_search_idx on public.inventory_items (company_id, lower(name));

create table if not exists public.part_orders (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  number      text not null,
  vendor_id   uuid references public.vendors (id) on delete set null,
  estimate_id uuid references public.estimates (id) on delete set null,
  status      text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'cancelled')),
  note        text,
  ordered_at  timestamptz,
  received_at timestamptz,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  unique (company_id, number)
);
create index if not exists part_orders_estimate_idx on public.part_orders (estimate_id) where estimate_id is not null;

create table if not exists public.part_order_lines (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  order_id     uuid not null references public.part_orders (id) on delete cascade,
  item_id      uuid references public.inventory_items (id) on delete set null,
  part_number  text,
  name         text not null check (length(name) between 1 and 120),
  qty          numeric(10, 2) not null check (qty > 0),
  cost         numeric(12, 2) check (cost is null or cost >= 0),
  received_qty numeric(10, 2) not null default 0 check (received_qty >= 0),
  sort_order   integer not null default 0
);
create index if not exists part_order_lines_order_idx on public.part_order_lines (order_id, sort_order);

create table if not exists public.stock_movements (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  item_id          uuid not null references public.inventory_items (id) on delete cascade,
  qty_delta        numeric(10, 2) not null check (qty_delta <> 0),
  reason           text not null check (reason in ('receive', 'sold', 'adjust', 'return')),
  order_id         uuid references public.part_orders (id) on delete set null,
  estimate_id      uuid references public.estimates (id) on delete set null,
  estimate_line_id uuid,
  note             text,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now()
);
create index if not exists stock_movements_item_idx on public.stock_movements (item_id, created_at desc);
-- a visit's line leaves stock once, however many times the approval is replayed
create unique index if not exists stock_movements_sold_line_idx on public.stock_movements (estimate_line_id) where reason = 'sold';

create or replace function public.tg_stock_movement() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.inventory_items set qty_on_hand = qty_on_hand + new.qty_delta, updated_at = now() where id = new.item_id;
    return new;
  end if;
  raise exception 'The stock ledger cannot be changed' using errcode = 'P0001';
end $$;
drop trigger if exists stock_movement_apply on public.stock_movements;
create trigger stock_movement_apply after insert on public.stock_movements for each row execute function public.tg_stock_movement();
drop trigger if exists stock_movement_frozen on public.stock_movements;
create trigger stock_movement_frozen before update or delete on public.stock_movements for each row execute function public.tg_stock_movement();

alter table public.vendors enable row level security;
alter table public.inventory_items enable row level security;
alter table public.part_orders enable row level security;
alter table public.part_order_lines enable row level security;
alter table public.stock_movements enable row level security;
-- No direct access at all: everything goes through the RPCs below (cost and list price are money)
revoke all on public.vendors, public.inventory_items, public.part_orders, public.part_order_lines, public.stock_movements from public, anon, authenticated;
drop trigger if exists audit on public.inventory_items;
create trigger audit after insert or update or delete on public.inventory_items for each row execute function public.tg_audit();
drop trigger if exists audit on public.part_orders;
create trigger audit after insert or update or delete on public.part_orders for each row execute function public.tg_audit();

-- ---------------------------------------------------------------------------
-- A part line can be a stocked part
-- ---------------------------------------------------------------------------
alter table public.estimate_lines add column if not exists inventory_item_id uuid references public.inventory_items (id) on delete set null;
select public._patch_function('_estimate_price_line', 'inventory_item_id',
  $a$'tech_id', nullif(p_line ->> 'tech_id', ''),$a$,
  $a$'tech_id', nullif(p_line ->> 'tech_id', ''),
    'inventory_item_id', nullif(p_line ->> 'inventory_item_id', ''),$a$);
select public._patch_function('_estimate_apply', 'inventory_item_id',
  'part_number, vendor, part_condition, cost, tech_id,', 'part_number, vendor, part_condition, cost, tech_id, inventory_item_id,');
select public._patch_function('_estimate_apply', 'v_ql ->> ''inventory_item_id''',
  $a$pr.active and pr.role::text = 'detailer')$a$,
  $a$pr.active and pr.role::text = 'detailer'),
              (select it.id from public.inventory_items it where it.id = nullif(v_ql ->> 'inventory_item_id', '')::uuid and it.company_id = e.company_id)$a$);
select public._patch_function('_estimate_json', '''inventory_item_id''',
  $a$'tech_id', l.tech_id,$a$,
  $a$'tech_id', l.tech_id, 'inventory_item_id', l.inventory_item_id,$a$);

-- Stock leaves when the approved work lands on the work order (once per line)
create or replace function public.tg_estimate_sell_stock() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.applied_at is null and new.applied_at is not null then
    insert into public.stock_movements (company_id, item_id, qty_delta, reason, estimate_id, estimate_line_id, note)
    select el.company_id, el.inventory_item_id, -el.qty, 'sold', new.id, el.id, 'Used on ' || new.display_number
      from public.estimate_lines el
     where el.estimate_id = new.id and el.inventory_item_id is not null and el.line_type = 'part' and el.qty > 0
       and ((el.option_id = new.selected_option_id and el.customer_approved is not false) or (el.option_id is null and el.customer_approved is true))
    on conflict (estimate_line_id) where reason = 'sold' do nothing;
  end if;
  return null;
end $$;
drop trigger if exists estimate_sell_stock on public.estimates;
create trigger estimate_sell_stock after update of applied_at on public.estimates for each row execute function public.tg_estimate_sell_stock();

-- ---------------------------------------------------------------------------
-- Vendors (owner, admin, advisor)
-- ---------------------------------------------------------------------------
create or replace function public.vendors_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.can_price_jobs() then coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'phone', v.phone, 'email', v.email, 'account_no', v.account_no, 'notes', v.notes, 'active', v.active) order by v.name)
                                                          from public.vendors v where v.company_id = public.current_company_id()), '[]'::jsonb) else '[]'::jsonb end
$$;
revoke execute on function public.vendors_list() from public, anon;
grant execute on function public.vendors_list() to authenticated;

create or replace function public.save_vendor(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_name text := trim(coalesce(p ->> 'name', ''));
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor edits vendors' using errcode = '42501'; end if;
  if v_name = '' or length(v_name) > 80 then raise exception 'Give the vendor a name' using errcode = '22023'; end if;
  if v_id is null then
    insert into public.vendors (company_id, name, phone, email, account_no, notes, active)
    values (public.current_company_id(), v_name, nullif(trim(coalesce(p ->> 'phone', '')), ''), nullif(trim(coalesce(p ->> 'email', '')), ''), nullif(trim(coalesce(p ->> 'account_no', '')), ''), nullif(trim(coalesce(p ->> 'notes', '')), ''), coalesce((p ->> 'active')::boolean, true))
    returning id into v_id;
  else
    update public.vendors set name = v_name, phone = nullif(trim(coalesce(p ->> 'phone', '')), ''), email = nullif(trim(coalesce(p ->> 'email', '')), ''), account_no = nullif(trim(coalesce(p ->> 'account_no', '')), ''),
           notes = nullif(trim(coalesce(p ->> 'notes', '')), ''), active = coalesce((p ->> 'active')::boolean, active)
     where id = v_id and company_id = public.current_company_id();
    if not found then raise exception 'Vendor not found' using errcode = 'P0002'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'A vendor with that name already exists' using errcode = '23505';
end $$;
revoke execute on function public.save_vendor(jsonb) from public, anon;
grant execute on function public.save_vendor(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Parts
-- ---------------------------------------------------------------------------
create or replace function public._item_json(p_id uuid, p_money boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', i.id, 'part_number', i.part_number, 'name', i.name, 'vendor_id', i.vendor_id, 'vendor', (select v.name from public.vendors v where v.id = i.vendor_id),
    'brand', i.brand, 'bin', i.bin, 'qty_on_hand', i.qty_on_hand, 'reorder_at', i.reorder_at, 'taxable', i.taxable, 'active', i.active,
    'cost', case when p_money then i.cost end, 'list_price', case when p_money then i.list_price end,
    'low', (i.reorder_at is not null and i.qty_on_hand <= i.reorder_at), 'negative', i.qty_on_hand < 0)
  from public.inventory_items i where i.id = p_id
$$;
revoke execute on function public._item_json(uuid, boolean) from public, anon, authenticated;

create or replace function public.inventory_list(p_q text default null, p_low boolean default false, p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_money boolean := public.can_price_jobs(); v_q text := lower(trim(coalesce(p_q, '')));
begin
  if not public.is_member() then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(public._item_json(x.id, v_money) order by x.name)
    from (select i.id, i.name from public.inventory_items i
           where i.company_id = public.current_company_id() and (i.active or v_money)
             and (v_q = '' or lower(i.name) like '%' || v_q || '%' or lower(i.part_number) like '%' || v_q || '%' or lower(coalesce(i.brand, '')) like '%' || v_q || '%' or lower(coalesce(i.bin, '')) like '%' || v_q || '%')
             and (not coalesce(p_low, false) or (i.reorder_at is not null and i.qty_on_hand <= i.reorder_at))
           order by i.name limit least(greatest(coalesce(p_limit, 200), 1), 500)) x), '[]'::jsonb);
end $$;
revoke execute on function public.inventory_list(text, boolean, integer) from public, anon;
grant execute on function public.inventory_list(text, boolean, integer) to authenticated;

-- p: {id?, part_number, name, vendor_id?, brand?, bin?, cost?, list_price?, reorder_at?, taxable?, active?, qty_on_hand? (new parts only)}
create or replace function public.save_inventory_item(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid; v_company uuid := public.current_company_id();
  v_no text := trim(coalesce(p ->> 'part_number', '')); v_name text := trim(coalesce(p ->> 'name', ''));
  v_vendor uuid := nullif(p ->> 'vendor_id', '')::uuid; v_qty numeric := coalesce(nullif(p ->> 'qty_on_hand', '')::numeric, 0);
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor edits stocked parts' using errcode = '42501'; end if;
  if v_no = '' or length(v_no) > 60 then raise exception 'Give the part a number' using errcode = '22023'; end if;
  if v_name = '' or length(v_name) > 120 then raise exception 'Give the part a name' using errcode = '22023'; end if;
  if v_vendor is not null and not exists (select 1 from public.vendors v where v.id = v_vendor and v.company_id = v_company) then raise exception 'Unknown vendor' using errcode = '22023'; end if;
  if v_id is null then
    insert into public.inventory_items (company_id, part_number, name, vendor_id, brand, bin, cost, list_price, reorder_at, taxable, active)
    values (v_company, v_no, v_name, v_vendor, nullif(trim(coalesce(p ->> 'brand', '')), ''), nullif(trim(coalesce(p ->> 'bin', '')), ''),
            nullif(p ->> 'cost', '')::numeric, nullif(p ->> 'list_price', '')::numeric, nullif(p ->> 'reorder_at', '')::numeric,
            case when p ? 'taxable' and jsonb_typeof(p -> 'taxable') = 'boolean' then (p ->> 'taxable')::boolean end, coalesce((p ->> 'active')::boolean, true))
    returning id into v_id;
    if v_qty <> 0 then
      insert into public.stock_movements (company_id, item_id, qty_delta, reason, note, created_by) values (v_company, v_id, v_qty, 'adjust', 'Starting count', auth.uid());
    end if;
  else
    update public.inventory_items set part_number = v_no, name = v_name, vendor_id = v_vendor, brand = nullif(trim(coalesce(p ->> 'brand', '')), ''), bin = nullif(trim(coalesce(p ->> 'bin', '')), ''),
           cost = nullif(p ->> 'cost', '')::numeric, list_price = nullif(p ->> 'list_price', '')::numeric, reorder_at = nullif(p ->> 'reorder_at', '')::numeric,
           taxable = case when p ? 'taxable' and jsonb_typeof(p -> 'taxable') = 'boolean' then (p ->> 'taxable')::boolean else taxable end,
           active = coalesce((p ->> 'active')::boolean, active), updated_at = now()
     where id = v_id and company_id = v_company;
    if not found then raise exception 'Part not found' using errcode = 'P0002'; end if;
  end if;
  return public._item_json(v_id, true);
exception when unique_violation then
  raise exception 'A part with that number already exists' using errcode = '23505';
end $$;
revoke execute on function public.save_inventory_item(jsonb) from public, anon;
grant execute on function public.save_inventory_item(jsonb) to authenticated;

-- A recount or a correction: the ledger records who, why and how many
create or replace function public.adjust_stock(p_item uuid, p_delta numeric, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor adjusts stock' using errcode = '42501'; end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then raise exception 'Type how many to add or remove' using errcode = '22023'; end if;
  if not exists (select 1 from public.inventory_items i where i.id = p_item and i.company_id = public.current_company_id()) then raise exception 'Part not found' using errcode = 'P0002'; end if;
  insert into public.stock_movements (company_id, item_id, qty_delta, reason, note, created_by)
  values (public.current_company_id(), p_item, p_delta, case when p_delta > 0 then 'adjust' else 'adjust' end, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
  return public._item_json(p_item, true);
end $$;
revoke execute on function public.adjust_stock(uuid, numeric, text) from public, anon;
grant execute on function public.adjust_stock(uuid, numeric, text) to authenticated;

create or replace function public.inventory_item_history(p_item uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.can_price_jobs() then coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'qty_delta', m.qty_delta, 'reason', m.reason, 'note', m.note, 'created_at', m.created_at,
                                       'by', public._initials((select pr.full_name from public.profiles pr where pr.id = m.created_by)),
                                       'order', (select o.number from public.part_orders o where o.id = m.order_id),
                                       'estimate', (select e.display_number from public.estimates e where e.id = m.estimate_id)) order by m.created_at desc)
    from (select * from public.stock_movements where item_id = p_item and company_id = public.current_company_id() order by created_at desc limit 50) m), '[]'::jsonb)
  else '[]'::jsonb end
$$;
revoke execute on function public.inventory_item_history(uuid) from public, anon;
grant execute on function public.inventory_item_history(uuid) to authenticated;

-- The count for the dashboard banner (parts at or under their reorder point, or negative)
create or replace function public.parts_low_stock()
returns integer language sql stable security definer set search_path = public as $$
  select case when public.is_member() then (select count(*)::int from public.inventory_items i where i.company_id = public.current_company_id() and i.active and ((i.reorder_at is not null and i.qty_on_hand <= i.reorder_at) or i.qty_on_hand < 0)) else 0 end
$$;
revoke execute on function public.parts_low_stock() from public, anon;
grant execute on function public.parts_low_stock() to authenticated;

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create or replace function public._order_json(p_id uuid, p_lines boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'status', o.status, 'note', o.note, 'vendor_id', o.vendor_id, 'vendor', (select v.name from public.vendors v where v.id = o.vendor_id),
    'estimate_id', o.estimate_id, 'estimate_number', (select e.display_number from public.estimates e where e.id = o.estimate_id),
    'ordered_at', o.ordered_at, 'received_at', o.received_at, 'created_at', o.created_at,
    'line_count', (select count(*) from public.part_order_lines l where l.order_id = o.id),
    'total', (select coalesce(sum(l.qty * coalesce(l.cost, 0)), 0) from public.part_order_lines l where l.order_id = o.id),
    'lines', case when p_lines then coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'item_id', l.item_id, 'part_number', l.part_number, 'name', l.name, 'qty', l.qty, 'cost', l.cost, 'received_qty', l.received_qty) order by l.sort_order, l.name)
                                              from public.part_order_lines l where l.order_id = o.id), '[]'::jsonb) end)
  from public.part_orders o where o.id = p_id
$$;
revoke execute on function public._order_json(uuid, boolean) from public, anon, authenticated;

create or replace function public.part_orders_list(p_status text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.can_price_jobs() then coalesce((
    select jsonb_agg(public._order_json(x.id, false) order by x.created_at desc)
    from (select o.id, o.created_at from public.part_orders o where o.company_id = public.current_company_id() and (p_status is null or o.status = p_status) order by o.created_at desc limit 100) x), '[]'::jsonb)
  else '[]'::jsonb end
$$;
revoke execute on function public.part_orders_list(text) from public, anon;
grant execute on function public.part_orders_list(text) to authenticated;

create or replace function public.part_order_detail(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor reads orders' using errcode = '42501'; end if;
  if not exists (select 1 from public.part_orders o where o.id = p_id and o.company_id = public.current_company_id()) then raise exception 'Order not found' using errcode = 'P0002'; end if;
  return public._order_json(p_id, true);
end $$;
revoke execute on function public.part_order_detail(uuid) from public, anon;
grant execute on function public.part_order_detail(uuid) to authenticated;

-- p: {vendor_id?, estimate_id?, note?, lines: [{item_id?, part_number?, name, qty, cost?}]}
create or replace function public.create_part_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id(); v_id uuid; x jsonb; n integer := 0;
  v_vendor uuid := nullif(p ->> 'vendor_id', '')::uuid; v_est uuid := nullif(p ->> 'estimate_id', '')::uuid; v_item uuid;
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor orders parts' using errcode = '42501'; end if;
  if v_vendor is not null and not exists (select 1 from public.vendors v where v.id = v_vendor and v.company_id = v_company) then raise exception 'Unknown vendor' using errcode = '22023'; end if;
  if v_est is not null and not exists (select 1 from public.estimates e where e.id = v_est and e.company_id = v_company) then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  if jsonb_typeof(coalesce(p -> 'lines', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p -> 'lines', '[]'::jsonb)) = 0 then raise exception 'Add at least one part to the order' using errcode = '22023'; end if;
  if jsonb_array_length(p -> 'lines') > 60 then raise exception 'At most 60 lines on an order' using errcode = '22023'; end if;
  insert into public.part_orders (company_id, number, vendor_id, estimate_id, note, created_by)
  values (v_company, public._next_po_number(v_company), v_vendor, v_est, nullif(trim(coalesce(p ->> 'note', '')), ''), auth.uid()) returning id into v_id;
  for x in select * from jsonb_array_elements(p -> 'lines') loop
    n := n + 1;
    v_item := nullif(x ->> 'item_id', '')::uuid;
    if v_item is not null and not exists (select 1 from public.inventory_items i where i.id = v_item and i.company_id = v_company) then raise exception 'Unknown part' using errcode = '22023'; end if;
    if coalesce((x ->> 'qty')::numeric, 0) <= 0 then raise exception 'Every line needs a quantity' using errcode = '22023'; end if;
    if length(trim(coalesce(x ->> 'name', ''))) = 0 then raise exception 'Every line needs a name' using errcode = '22023'; end if;
    insert into public.part_order_lines (company_id, order_id, item_id, part_number, name, qty, cost, sort_order)
    values (v_company, v_id, v_item, nullif(left(trim(coalesce(x ->> 'part_number', '')), 60), ''), left(trim(x ->> 'name'), 120), (x ->> 'qty')::numeric, nullif(x ->> 'cost', '')::numeric, n);
  end loop;
  return public._order_json(v_id, true);
end $$;
revoke execute on function public.create_part_order(jsonb) from public, anon;
grant execute on function public.create_part_order(jsonb) to authenticated;

-- A draft order from a visit's part lines (parts already in stock are left out)
create or replace function public.order_parts_for_estimate(p_estimate uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.estimates; v_lines jsonb;
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor orders parts' using errcode = '42501'; end if;
  select * into e from public.estimates where id = p_estimate and company_id = public.current_company_id();
  if e.id is null then raise exception 'Estimate not found' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('item_id', l.inventory_item_id, 'part_number', l.part_number, 'name', l.name, 'qty', l.qty, 'cost', l.cost) order by l.sort_order), '[]'::jsonb) into v_lines
    from public.estimate_lines l
    left join public.inventory_items i on i.id = l.inventory_item_id
   where l.estimate_id = e.id and l.line_type = 'part' and l.qty > 0 and l.customer_approved is not false
     and (i.id is null or i.qty_on_hand < l.qty);
  if jsonb_array_length(v_lines) = 0 then raise exception 'There is nothing to order: no part lines, or everything is in stock' using errcode = 'P0001'; end if;
  return public.create_part_order(jsonb_build_object('estimate_id', e.id, 'note', 'For ' || e.display_number, 'lines', v_lines));
end $$;
revoke execute on function public.order_parts_for_estimate(uuid) from public, anon;
grant execute on function public.order_parts_for_estimate(uuid) to authenticated;

create or replace function public.mark_part_order_ordered(p_id uuid, p_vendor uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.part_orders;
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor orders parts' using errcode = '42501'; end if;
  select * into o from public.part_orders where id = p_id and company_id = public.current_company_id();
  if o.id is null then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if o.status <> 'draft' then raise exception 'Only a draft order is marked ordered' using errcode = 'P0001'; end if;
  if p_vendor is not null and not exists (select 1 from public.vendors v where v.id = p_vendor and v.company_id = o.company_id) then raise exception 'Unknown vendor' using errcode = '22023'; end if;
  update public.part_orders set status = 'ordered', ordered_at = now(), vendor_id = coalesce(p_vendor, vendor_id) where id = o.id;
  if o.estimate_id is not null then
    update public.estimates set parts_status = 'ordered' where id = o.estimate_id and parts_status in ('none', 'needed');
  end if;
  return public._order_json(o.id, true);
end $$;
revoke execute on function public.mark_part_order_ordered(uuid, uuid) from public, anon;
grant execute on function public.mark_part_order_ordered(uuid, uuid) to authenticated;

create or replace function public.cancel_part_order(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor cancels an order' using errcode = '42501'; end if;
  update public.part_orders set status = 'cancelled' where id = p_id and company_id = public.current_company_id() and status in ('draft', 'ordered');
  if not found then raise exception 'That order cannot be cancelled' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.cancel_part_order(uuid) from public, anon;
grant execute on function public.cancel_part_order(uuid) to authenticated;

-- Receive parts: p_lines = [{line_id, qty}] (qty received now). A typed part with a number becomes a stocked part.
create or replace function public.receive_part_order(p_id uuid, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.part_orders; x jsonb; l public.part_order_lines; v_qty numeric; v_item uuid; v_company uuid := public.current_company_id();
begin
  if not public.can_price_jobs() then raise exception 'Only the owner, an admin or an advisor receives parts' using errcode = '42501'; end if;
  select * into o from public.part_orders where id = p_id and company_id = v_company;
  if o.id is null then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if o.status not in ('draft', 'ordered') then raise exception 'That order is already closed' using errcode = 'P0001'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Type what arrived' using errcode = '22023'; end if;
  for x in select * from jsonb_array_elements(p_lines) loop
    v_qty := coalesce((x ->> 'qty')::numeric, 0);
    if v_qty <= 0 then continue; end if;
    select * into l from public.part_order_lines where id = (x ->> 'line_id')::uuid and order_id = o.id for update;
    if l.id is null then raise exception 'Line not found' using errcode = 'P0002'; end if;
    v_item := l.item_id;
    if v_item is null and l.part_number is not null then
      select i.id into v_item from public.inventory_items i where i.company_id = v_company and lower(i.part_number) = lower(l.part_number);
      if v_item is null then
        insert into public.inventory_items (company_id, part_number, name, vendor_id, cost) values (v_company, l.part_number, l.name, o.vendor_id, l.cost) returning id into v_item;
      end if;
      update public.part_order_lines set item_id = v_item where id = l.id;
    end if;
    update public.part_order_lines set received_qty = received_qty + v_qty where id = l.id;
    if v_item is not null then
      insert into public.stock_movements (company_id, item_id, qty_delta, reason, order_id, estimate_id, note, created_by)
      values (v_company, v_item, v_qty, 'receive', o.id, o.estimate_id, 'Received on ' || o.number, auth.uid());
      -- a received part updates what it costs us
      if l.cost is not null then update public.inventory_items set cost = l.cost where id = v_item; end if;
    end if;
  end loop;
  if not exists (select 1 from public.part_order_lines l2 where l2.order_id = o.id and l2.received_qty < l2.qty) then
    update public.part_orders set status = 'received', received_at = now() where id = o.id;
    -- every open order for the visit is in: its parts are here
    if o.estimate_id is not null and not exists (select 1 from public.part_orders o2 where o2.estimate_id = o.estimate_id and o2.id <> o.id and o2.status in ('draft', 'ordered')) then
      update public.estimates set parts_status = 'arrived' where id = o.estimate_id and parts_status in ('needed', 'ordered');
    end if;
  elsif o.status = 'draft' then
    update public.part_orders set status = 'ordered', ordered_at = coalesce(ordered_at, now()) where id = o.id;
  end if;
  return public._order_json(o.id, true);
end $$;
revoke execute on function public.receive_part_order(uuid, jsonb) from public, anon;
grant execute on function public.receive_part_order(uuid, jsonb) to authenticated;

drop function public._patch_function(text, text, text, text);
