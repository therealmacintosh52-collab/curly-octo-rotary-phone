-- Exercises triggers, RLS helpers and RPCs as two fake authenticated users.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"display_name":"Alice","role":"technician"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '{"display_name":"Bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'mallory@example.com', '{"display_name":"Mallory","role":"admin"}');

do $$ begin
  if (select count(*) from public.profiles) <> 3 then raise exception 'profile trigger failed'; end if;
  if (select role from public.profiles where id = '33333333-3333-3333-3333-333333333333') <> 'diy' then raise exception 'admin self-assignment must be blocked'; end if;
  if (select role from public.profiles where id = '11111111-1111-1111-1111-111111111111') <> 'technician' then raise exception 'role from metadata failed'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.vehicles (owner_id, vin, year, make, model, engine)
values (auth.uid(), '1FTEW1EF5FFA00001', 2015, 'FORD', 'F-150', '5.0L V8');

insert into public.fixes (author_id, title, year, make, model, engine, symptoms, root_cause, fix_description)
values (auth.uid(), 'Smoke test fix', 2015, 'Ford', 'F-150', '5.0L V8', 'Lean codes', 'Cracked hose', 'Replaced hose')
returning id \gset fix_
create temp table smoke as select :'fix_id'::uuid as fix_id;
insert into public.fix_dtcs values (:'fix_id', 'P0171'), (:'fix_id', 'P0174');

do $$ begin
  if (select count(*) from public.moderation_queue where kind = 'new_fix') <> 1 then raise exception 'moderation enqueue failed'; end if;
  if not exists (select 1 from public.rank_fixes('ford', 'f-150', 2016, '5.0L', array['P0171'])) then raise exception 'rank_fixes failed'; end if;
  if (select count(*) from public.rank_fixes('ford', 'f-150', 2015, null, array['P0300'])) <> 0 then raise exception 'rank_fixes code filter failed'; end if;
end $$;

-- author cannot confirm own fix
do $$ begin
  insert into public.fix_confirmations (fix_id, user_id, verdict) values ((select fix_id from smoke), auth.uid(), 'fixed');
  raise exception 'self confirmation should fail';
exception when others then
  if sqlerrm not like '%own fix%' then raise; end if;
end $$;

-- edit creates a revision
update public.fixes set root_cause = 'Cracked PCV hose' where id = :'fix_id';
do $$ begin
  if (select version from public.fixes where id = (select fix_id from smoke)) <> 2 then raise exception 'version bump failed'; end if;
  if (select count(*) from public.fix_revisions where fix_id = (select fix_id from smoke)) <> 1 then raise exception 'revision snapshot failed'; end if;
end $$;

-- AI quota
do $$ begin
  if not public.consume_ai_query(2) then raise exception 'quota 1 failed'; end if;
  if not public.consume_ai_query(2) then raise exception 'quota 2 failed'; end if;
  if public.consume_ai_query(2) then raise exception 'quota should be exhausted'; end if;
  if not public.consume_ai_query(null) then raise exception 'unlimited quota failed'; end if;
end $$;

-- Bob confirms
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
insert into public.fix_confirmations (fix_id, user_id, verdict) values (:'fix_id', auth.uid(), 'fixed');
do $$ begin
  if (select net_score from public.fixes where id = (select fix_id from smoke)) <> 1 then raise exception 'net score failed'; end if;
  if (select reputation from public.profiles where id = '11111111-1111-1111-1111-111111111111') <> 3 then raise exception 'author reputation failed'; end if;
  if (select reputation from public.profiles where id = '22222222-2222-2222-2222-222222222222') <> 1 then raise exception 'confirmer reputation failed'; end if;
  -- Bob cannot see Alice's vehicle
  if exists (select 1 from public.vehicles) then raise exception 'vehicle RLS leak'; end if;
  -- but can see the approved fix and the sample fixes
  if (select count(*) from public.fixes) < 21 then raise exception 'fix visibility failed'; end if;
  if (select count(*) from public.dtc_codes) < 100 then raise exception 'dtc seed too small'; end if;
  if (select count(*) from public.fixes where source_label = 'SAMPLE') <> 20 then raise exception 'expected 20 sample fixes'; end if;
  if (select count(*) from public.rank_fixes('Chevrolet', 'Silverado 1500', 2014, '5.3L', array['P0300'])) < 1 then raise exception 'sample ranking failed'; end if;
  if (select count(*) from public.search_fixes('lifter tick')) < 1 then raise exception 'search failed'; end if;
end $$;
rollback;
