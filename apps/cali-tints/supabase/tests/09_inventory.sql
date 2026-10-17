-- SQL tests for 0075: parts inventory, orders and receiving.
-- Users: ...001 owner, ...002 detailer, ...004 manager, ...005 admin, ...006 advisor.

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, false);
  select set_config('role', 'authenticated', false);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', false);
  select set_config('request.jwt.claims', '', false);
$$;
create temp table p_ids (k text primary key, v text);
grant all on p_ids to authenticated;

-- No direct table access
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare vl jsonb; w uuid; i jsonb;
begin
  begin perform count(*) from public.inventory_items; raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
  begin perform count(*) from public.stock_movements; raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
  w := public.save_vendor('{"name":"NAPA","phone":"555-0100","account_no":"A-77"}'::jsonb);
  insert into p_ids values ('vendor', w::text);
  begin perform public.save_vendor('{"name":"napa"}'::jsonb); raise exception 'expected 23505';
  exception when unique_violation then null; end;
  begin perform public.save_vendor('{"name":" "}'::jsonb); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
  assert jsonb_array_length(public.vendors_list()) = 1, '0075: vendor listed';

  i := public.save_inventory_item(jsonb_build_object('part_number', 'BP-100', 'name', 'Brake pad set', 'vendor_id', w, 'bin', 'A3', 'cost', 50, 'list_price', 90, 'reorder_at', 2, 'qty_on_hand', 5));
  insert into p_ids values ('item', i ->> 'id');
  assert (i ->> 'qty_on_hand')::numeric = 5 and (i ->> 'cost')::numeric = 50 and (i ->> 'vendor') = 'NAPA' and not (i ->> 'low')::boolean, '0075: created with a starting count';
  assert (select count(*) from public.inventory_item_history((i ->> 'id')::uuid) h, jsonb_array_elements(h) x where x ->> 'note' = 'Starting count') = 1, '0075: the starting count is in the ledger';
  begin perform public.save_inventory_item('{"part_number":"bp-100","name":"Dup"}'::jsonb); raise exception 'expected 23505';
  exception when unique_violation then null; end;
  begin perform public.save_inventory_item('{"part_number":"","name":"x"}'::jsonb); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
  i := public.adjust_stock((i ->> 'id')::uuid, -2, 'Two used on a car');
  assert (i ->> 'qty_on_hand')::numeric = 3 and not (i ->> 'low')::boolean, '0075: adjusted down';
  i := public.adjust_stock((i ->> 'id')::uuid, -2, 'Damaged');
  assert (i ->> 'qty_on_hand')::numeric = 1 and (i ->> 'low')::boolean, '0075: low at or under the reorder point';
  assert public.parts_low_stock() = 1, '0075: low-stock count';
  begin perform public.adjust_stock((i ->> 'id')::uuid, 0, null); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
  i := public.adjust_stock((i ->> 'id')::uuid, 4, 'Recount');
  assert (i ->> 'qty_on_hand')::numeric = 5, '0075: recount up';
  -- an edit keeps the count (the ledger owns it)
  i := public.save_inventory_item(jsonb_build_object('id', i ->> 'id', 'part_number', 'BP-100', 'name', 'Brake pad set (ceramic)', 'vendor_id', w, 'bin', 'A3', 'cost', 52, 'list_price', 95, 'reorder_at', 2));
  assert (i ->> 'qty_on_hand')::numeric = 5 and (i ->> 'name') = 'Brake pad set (ceramic)', '0075: edit keeps the count';
  vl := public.inventory_list(null, false);
  assert jsonb_array_length(vl) = 1 and (vl -> 0 ->> 'cost')::numeric = 52, '0075: the advisor sees cost';
  assert jsonb_array_length(public.inventory_list('brake', false)) = 1 and jsonb_array_length(public.inventory_list('zzz', false)) = 0, '0075: search';
  assert jsonb_array_length(public.inventory_list('a3', false)) = 1, '0075: search by bin';
end $$;
select pg_temp.logout();

-- Cost and list price are money: a tech and a manager see name, number, bin, on hand, nothing else; and cannot write
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare vv jsonb := public.inventory_list(null, false);
begin
  assert jsonb_array_length(vv) = 1 and (vv -> 0 ->> 'cost') is null and (vv -> 0 ->> 'list_price') is null and (vv -> 0 ->> 'bin') = 'A3' and (vv -> 0 ->> 'qty_on_hand')::numeric = 5, '0075: a tech sees no money';
  assert public.vendors_list() = '[]'::jsonb and public.part_orders_list() = '[]'::jsonb, '0075: no vendors or orders for a tech';
  begin perform public.save_inventory_item('{"part_number":"X","name":"x"}'::jsonb); raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
  begin perform public.adjust_stock((select v from p_ids where k = 'item')::uuid, 1, null); raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
  begin perform public.create_part_order('{"lines":[{"name":"x","qty":1}]}'::jsonb); raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
  assert public.inventory_item_history((select v from p_ids where k = 'item')::uuid) = '[]'::jsonb, '0075: no history for a tech';
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$ begin
  assert (public.inventory_list(null, false) -> 0 ->> 'cost') is null, '0075: a manager sees no money';
end $$;
select pg_temp.logout();

-- A part line can be a stocked part; stock leaves once when the visit is approved
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare e public.estimates; v_cust uuid; v_item uuid := (select v from p_ids where k = 'item')::uuid; d jsonb;
begin
  select id into v_cust from public.customers where company_id = public.current_company_id() order by created_at limit 1;
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Work', 'recommended', true,
    'lines', jsonb_build_array(
      jsonb_build_object('line_type', 'part', 'label', 'Brake pad set', 'qty', 2, 'price', 95, 'part_number', 'BP-100', 'inventory_item_id', v_item),
      jsonb_build_object('line_type', 'part', 'label', 'Declined rotor', 'qty', 1, 'price', 120, 'inventory_item_id', v_item),
      jsonb_build_object('line_type', 'part', 'label', 'Not ours', 'qty', 1, 'price', 10, 'inventory_item_id', '99999999-9999-4999-8999-999999999999'))))));
  insert into p_ids values ('est', e.id::text);
  d := public.estimate_detail(e.id);
  assert exists (select 1 from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') x where x ->> 'name' = 'Brake pad set' and (x ->> 'inventory_item_id') = v_item::text), '0075: the line carries its stocked part';
  assert exists (select 1 from jsonb_array_elements(d -> 'options' -> 0 -> 'lines') x where x ->> 'name' = 'Not ours' and nullif(x ->> 'inventory_item_id', '') is null), '0075: an unknown part id is dropped';
end $$;
select pg_temp.logout();
do $$
declare est uuid := (select v from p_ids where k = 'est')::uuid; v_item uuid := (select v from p_ids where k = 'item')::uuid; v_opt uuid;
begin
  select id into v_opt from public.estimate_options where estimate_id = est limit 1;
  update public.estimate_lines set customer_approved = false where estimate_id = est and name = 'Declined rotor';
  update public.estimates set status = 'accepted', accepted_at = now(), selected_option_id = v_opt where id = est;
  assert (select qty_on_hand from public.inventory_items where id = v_item) = 5, '0075: nothing leaves until the work lands';
  update public.estimates set applied_at = now() where id = est;
  assert (select qty_on_hand from public.inventory_items where id = v_item) = 3, '0075: two pads left stock: ' || (select qty_on_hand from public.inventory_items where id = v_item);
  assert (select count(*) from public.stock_movements where estimate_id = est and reason = 'sold') = 1, '0075: one movement, the declined line did not move stock';
  -- replaying the approval does not take them twice
  update public.estimates set applied_at = null where id = est;
  update public.estimates set applied_at = now() where id = est;
  assert (select qty_on_hand from public.inventory_items where id = v_item) = 3 and (select count(*) from public.stock_movements where estimate_id = est and reason = 'sold') = 1, '0075: idempotent';
end $$;

-- Order what is missing, mark it ordered, receive it in two parts
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare e public.estimates; v_cust uuid; v_item uuid := (select v from p_ids where k = 'item')::uuid; o jsonb; v_vendor uuid := (select v from p_ids where k = 'vendor')::uuid; l1 uuid; l2 uuid; i2 jsonb;
begin
  select id into v_cust from public.customers where company_id = public.current_company_id() order by created_at limit 1;
  i2 := public.save_inventory_item('{"part_number":"RT-9","name":"Rotor","bin":"B1","cost":60,"reorder_at":1}'::jsonb);
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Work', 'recommended', true,
    'lines', jsonb_build_array(
      jsonb_build_object('line_type', 'part', 'label', 'Brake pad set', 'qty', 2, 'price', 95, 'inventory_item_id', v_item),
      jsonb_build_object('line_type', 'part', 'label', 'Rotor', 'qty', 2, 'price', 120, 'part_number', 'RT-9', 'inventory_item_id', i2 ->> 'id'),
      jsonb_build_object('line_type', 'part', 'label', 'Caliper bolt kit', 'qty', 1, 'price', 15, 'part_number', 'CB-1'))))));
  insert into p_ids values ('est2', e.id::text), ('item2', i2 ->> 'id');
  o := public.order_parts_for_estimate(e.id);
  insert into p_ids values ('order', o ->> 'id');
  assert (o ->> 'number') like 'PO-%' and (o ->> 'status') = 'draft', '0075: a draft order with a PO number: ' || (o ->> 'number');
  assert jsonb_array_length(o -> 'lines') = 2, '0075: the pad set (3 in stock >= 2) is left out, the rotor and the bolt kit are on: ' || jsonb_array_length(o -> 'lines');
  o := public.mark_part_order_ordered((o ->> 'id')::uuid, v_vendor);
  assert (o ->> 'status') = 'ordered' and (o ->> 'vendor') = 'NAPA', '0075: marked ordered with a vendor';
  begin perform public.mark_part_order_ordered((o ->> 'id')::uuid); raise exception 'expected P0001';
  exception when sqlstate 'P0001' then null; end;
  select (x ->> 'id')::uuid into l1 from jsonb_array_elements(o -> 'lines') x where x ->> 'part_number' = 'RT-9';
  select (x ->> 'id')::uuid into l2 from jsonb_array_elements(o -> 'lines') x where x ->> 'part_number' = 'CB-1';
  insert into p_ids values ('l1', l1::text), ('l2', l2::text);
  begin perform public.receive_part_order((o ->> 'id')::uuid, '[]'::jsonb); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
  o := public.receive_part_order((o ->> 'id')::uuid, jsonb_build_array(jsonb_build_object('line_id', l1, 'qty', 1)));
  assert (o ->> 'status') = 'ordered', '0075: partly received stays ordered';
  assert (select (x ->> 'qty_on_hand')::numeric from jsonb_array_elements(public.inventory_list('RT-9', false)) x limit 1) = 1, '0075: one rotor in';
end $$;
select pg_temp.logout();
do $$ begin
  assert (select parts_status from public.estimates where id = (select v from p_ids where k = 'est2')::uuid) = 'ordered', '0075: the visit shows Parts: Ordered';
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare o jsonb; oid uuid := (select v from p_ids where k = 'order')::uuid;
begin
  o := public.receive_part_order(oid, jsonb_build_array(jsonb_build_object('line_id', (select v from p_ids where k = 'l1')::uuid, 'qty', 1), jsonb_build_object('line_id', (select v from p_ids where k = 'l2')::uuid, 'qty', 1)));
  assert (o ->> 'status') = 'received' and (o ->> 'received_at') is not null, '0075: fully received';
  assert (select (x ->> 'qty_on_hand')::numeric from jsonb_array_elements(public.inventory_list('RT-9', false)) x limit 1) = 2, '0075: both rotors in';
  assert exists (select 1 from jsonb_array_elements(public.inventory_list('CB-1', false)) x where (x ->> 'qty_on_hand')::numeric = 1), '0075: the typed part became a stocked part when it arrived';
  begin perform public.receive_part_order(oid, jsonb_build_array(jsonb_build_object('line_id', (select v from p_ids where k = 'l1')::uuid, 'qty', 1))); raise exception 'expected P0001';
  exception when sqlstate 'P0001' then null; end;
  begin perform public.cancel_part_order(oid); raise exception 'expected P0001';
  exception when sqlstate 'P0001' then null; end;
  assert jsonb_array_length(public.part_orders_list('received')) = 1, '0075: the order list';
  assert jsonb_array_length((public.part_order_detail(oid)) -> 'lines') = 2, '0075: detail';
  begin perform public.order_parts_for_estimate((select v from p_ids where k = 'est')::uuid); raise exception 'expected P0001';
  exception when sqlstate 'P0001' then null; end;
end $$;
select pg_temp.logout();
do $$ begin
  assert (select parts_status from public.estimates where id = (select v from p_ids where k = 'est2')::uuid) = 'arrived', '0075: every part is in, so the visit shows Parts: Arrived';
end $$;

-- A draft order can be cancelled; the ledger cannot be edited
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare o jsonb;
begin
  o := public.create_part_order(jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('name', 'Wiper blade', 'qty', 2, 'cost', 8))));
  assert (o ->> 'vendor') is null, '0075: an order can start without a vendor';
  perform public.cancel_part_order((o ->> 'id')::uuid);
  assert (public.part_order_detail((o ->> 'id')::uuid) ->> 'status') = 'cancelled', '0075: cancelled';
  begin perform public.create_part_order('{"lines":[{"name":"x","qty":0}]}'::jsonb); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
  begin perform public.create_part_order('{"lines":[]}'::jsonb); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
end $$;
select pg_temp.logout();
do $$ begin
  begin update public.stock_movements set qty_delta = 99; raise exception 'expected P0001';
  exception when sqlstate 'P0001' then null; end;
  begin delete from public.stock_movements; raise exception 'expected P0001';
  exception when sqlstate 'P0001' then null; end;
  -- on hand is the ledger's sum
  assert (select count(*) from public.inventory_items i where i.qty_on_hand <> coalesce((select sum(qty_delta) from public.stock_movements m where m.item_id = i.id), 0)) = 0, '0075: on hand equals the ledger';
end $$;
