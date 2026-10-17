-- SQL tests for 0073: inspection checklists on an estimate / work order.
-- Users: ...001 owner, ...002 detailer, ...004 manager, ...005 admin, ...006 advisor.

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, false);
  select set_config('role', 'authenticated', false);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', false);
  select set_config('request.jwt.claims', '', false);
$$;
create temp table i_ids (k text primary key, v text);
grant all on i_ids to authenticated, anon;

-- The starter lists are seeded; every member reads them
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare t jsonb := public.inspection_templates_list();
begin
  assert jsonb_array_length(t) = 3, '0073: three starter lists: ' || jsonb_array_length(t);
  assert exists (select 1 from jsonb_array_elements(t) x where x ->> 'name' = 'Pre-purchase inspection'), '0073: pre-purchase list';
  begin
    perform public.save_inspection_template('{"name":"Mine","items":[{"label":"x"}]}'::jsonb);
    raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();

-- Owner edits the lists
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare v_id uuid; t jsonb;
begin
  v_id := public.save_inspection_template('{"name":"Brake check","items":[{"label":"Front pads","group":"Brakes"},{"label":"  "},{"label":"Rotors"}]}'::jsonb);
  insert into i_ids values ('tpl', v_id::text);
  select x into t from jsonb_array_elements(public.inspection_templates_list()) x where x ->> 'id' = v_id::text;
  assert jsonb_array_length(t -> 'items') = 2, '0073: blank items dropped';
  perform public.save_inspection_template(jsonb_build_object('id', v_id, 'name', 'Brake check 2', 'items', '[{"label":"Front pads"}]'::jsonb));
  assert (select name from public.inspection_templates where id = v_id) = 'Brake check 2', '0073: renamed';
  begin perform public.save_inspection_template('{"name":"","items":[]}'::jsonb); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
end $$;

-- An estimate to hang a checklist on
do $$
declare e public.estimates; v_cust uuid := (select id from public.customers where company_id = public.current_company_id() order by created_at limit 1);
begin
  e := public.create_estimate(jsonb_build_object('customer_id', v_cust, 'options', jsonb_build_array(jsonb_build_object('tier', 'single', 'name', 'Work', 'recommended', true, 'lines', '[]'::jsonb))));
  insert into i_ids values ('est', e.id::text), ('token', e.token);
end $$;

-- Add from a template; the advisor and the tech (estimate still open) both tick
do $$
declare est uuid := (select v from i_ids where k = 'est')::uuid; ins jsonb; tpl uuid := (select id from public.inspection_templates where name = 'Pre-purchase inspection' limit 1);
begin
  ins := public.add_inspection(est, tpl, null, null);
  insert into i_ids values ('ins', ins ->> 'id');
  assert ins ->> 'name' = 'Pre-purchase inspection' and jsonb_array_length(ins -> 'items') = 12, '0073: items copied from the template';
  assert (select count(*) from public.job_inspection_items where inspection_id = (ins ->> 'id')::uuid and state = 'pending') = 12, '0073: all pending';
  ins := public.add_inspection(est, null, 'Walk-around', null);
  assert jsonb_array_length(ins -> 'items') = 0 and ins ->> 'name' = 'Walk-around', '0073: blank checklist';
  ins := public.add_inspection_item((ins ->> 'id')::uuid, 'Check the spare');
  assert jsonb_array_length(ins -> 'items') = 1, '0073: item added';
  insert into i_ids values ('blank', ins ->> 'id');
  begin perform public.add_inspection_item((ins ->> 'id')::uuid, ' '); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
end $$;
select pg_temp.logout();

select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare est uuid := (select v from i_ids where k = 'est')::uuid; r jsonb; it uuid;
begin
  r := public.visit_inspections(est);
  assert jsonb_array_length(r) = 2, '0073: a tech sees the checklists';
  select (x ->> 'id')::uuid into it from jsonb_array_elements(r -> 0 -> 'items') x limit 1;
  r := public.set_inspection_item(it, 'ok');
  assert (select state from public.job_inspection_items where id = it) = 'ok' and (select checked_by from public.job_inspection_items where id = it) = '10000000-0000-4000-8000-000000000002', '0073: ticked by the tech';
  r := public.set_inspection_item(it, 'attention', 'pads at 2mm');
  assert (select note from public.job_inspection_items where id = it) = 'pads at 2mm', '0073: note saved';
  insert into i_ids values ('red_item', it::text);
  r := public.set_inspection_item(it, 'pending');
  assert (select checked_by from public.job_inspection_items where id = it) is null, '0073: untick clears the stamp';
  r := public.set_inspection_item(it, 'attention');
  begin perform public.set_inspection_item(it, 'bogus'); raise exception 'expected 22023';
  exception when sqlstate '22023' then null; end;
  -- a red item becomes a finding
  perform public.inspection_item_to_finding(it);
  assert (select finding_id from public.job_inspection_items where id = it) is not null, '0073: finding linked';
  assert exists (select 1 from public.job_findings where estimate_id = est and title = (select label from public.job_inspection_items where id = it)), '0073: the finding exists';
  begin perform public.inspection_item_to_finding(it); raise exception 'expected P0001';
  exception when sqlstate 'P0001' then null; end;
  -- a tech cannot share or remove a checklist
  begin perform public.set_inspection_customer((select v from i_ids where k = 'ins')::uuid, true); raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
  begin perform public.delete_inspection((select v from i_ids where k = 'ins')::uuid); raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
  -- direct writes are not allowed
  begin update public.job_inspection_items set state = 'ok' where id = it; raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();

-- Internal until the advisor shares it; then items (no notes) show on the link
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
declare tok text := (select v from i_ids where k = 'token'); ins uuid := (select v from i_ids where k = 'ins')::uuid; r jsonb;
begin
  assert jsonb_array_length(public.inspections_by_token(tok)) = 0, '0073: hidden until shared';
  perform public.set_inspection_customer(ins, true);
  r := public.inspections_by_token(tok);
  assert jsonb_array_length(r) = 1, '0073: shared list shows';
  assert jsonb_array_length(r -> 0 -> 'items') = 1, '0073: only ticked items show: ' || jsonb_array_length(r -> 0 -> 'items');
  assert position('2mm' in r::text) = 0, '0073: notes never shown';
  assert jsonb_array_length(public.inspections_by_token('x')) = 0, '0073: a bad token shows nothing';
end $$;
select pg_temp.logout();

-- The customer link works without a login
set role anon;
select set_config('request.jwt.claims', '', false);
do $$ begin assert jsonb_array_length(public.inspections_by_token((select v from i_ids where k = 'token'))) = 1, '0073: anon by token'; end $$;
select pg_temp.logout();

-- A manager reads and ticks (team-wide) but cannot remove; the advisor can
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare est uuid := (select v from i_ids where k = 'est')::uuid;
begin
  assert jsonb_array_length(public.visit_inspections(est)) = 2, '0073: a manager reads them';
  begin perform public.delete_inspection((select v from i_ids where k = 'blank')::uuid); raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
begin
  perform public.delete_inspection((select v from i_ids where k = 'blank')::uuid);
  assert jsonb_array_length(public.visit_inspections((select v from i_ids where k = 'est')::uuid)) = 1, '0073: advisor removed one';
  perform public.delete_inspection_item((select v from i_ids where k = 'red_item')::uuid);
end $$;
select pg_temp.logout();

-- Ticking stays open after approval (it is not priced work)
do $$
declare est uuid := (select v from i_ids where k = 'est')::uuid; ins uuid := (select v from i_ids where k = 'ins')::uuid; it uuid;
begin
  update public.estimates set status = 'accepted', accepted_at = now() where id = est;
  select id into it from public.job_inspection_items where inspection_id = ins and state = 'pending' limit 1;
  insert into i_ids values ('after_item', it::text);
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000005');
do $$
begin
  perform public.set_inspection_item((select v from i_ids where k = 'after_item')::uuid, 'ok');
  assert (select state from public.job_inspection_items where id = (select v from i_ids where k = 'after_item')::uuid) = 'ok', '0073: an admin ticks after approval';
end $$;
select pg_temp.logout();

-- Templates delete is owner/admin only
select pg_temp.login('10000000-0000-4000-8000-000000000006');
do $$
begin
  begin perform public.delete_inspection_template((select v from i_ids where k = 'tpl')::uuid); raise exception 'expected refused';
  exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
begin
  perform public.delete_inspection_template((select v from i_ids where k = 'tpl')::uuid);
  assert not exists (select 1 from public.inspection_templates where id = (select v from i_ids where k = 'tpl')::uuid), '0073: template deleted';
end $$;
select pg_temp.logout();
