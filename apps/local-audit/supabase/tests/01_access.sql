-- Access-control tests: roles, RLS, the solutions leak rule, the report RPC,
-- cost roll-up and storage. Runs on the local stub (see run.sh). Each block
-- asserts and raises on failure; run.sh stops on the first error.

-- Helpers -------------------------------------------------------------------
create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, false);
  select set_config('role', 'authenticated', false);
$$;
create or replace function pg_temp.anon() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  select set_config('role', 'anon', false);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', false);
  select set_config('request.jwt.claims', '', false);
$$;

-- 1. Users: first becomes admin, bootstrap fires once ------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'admin@test',  '{}'),
  ('10000000-0000-4000-8000-000000000002', 'client@test', '{"role":"client","full_name":"Client One"}'),
  ('10000000-0000-4000-8000-000000000003', 'later@test',  '{}');

do $$
begin
  assert (select role from public.profiles where id = '10000000-0000-4000-8000-000000000001') = 'admin',  'first user becomes admin';
  assert (select role from public.profiles where id = '10000000-0000-4000-8000-000000000002') = 'client', 'metadata role honoured';
  assert (select role from public.profiles where id = '10000000-0000-4000-8000-000000000003') = 'client', 'bootstrap fires only once';
  assert (select full_name from public.profiles where id = '10000000-0000-4000-8000-000000000003') = 'later', 'name defaults to the email local part';
end $$;

-- 2. Fixtures (as postgres = trusted server code) ----------------------------
insert into public.businesses (id, name, canonical_domain, primary_category, address)
values ('20000000-0000-4000-8000-000000000001', 'Test Plumbing', 'testplumbing.example', 'Plumber', '1 Main St, Sacramento, CA');

insert into public.audits (id, business_id, status, progress_pct, inputs)
values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'succeeded', 100,
        '{"website":"https://testplumbing.example","secret_note":"INPUTS-MUST-NOT-LEAK"}');

insert into public.findings (id, audit_id, category, check_id, title, severity) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'conversion', 'phone_click_to_call', 'Phone number is not tappable on mobile', 'high'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'gbp',        'gbp_secondary_categories', 'Missing secondary categories', 'medium');

insert into public.solutions (id, finding_id, audit_id, steps, priority_rank) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '["SECRET-UNREVEALED-STEP one"]', 1),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '["SECRET-UNREVEALED-STEP two"]', 2),
  ('50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '["Add Water Heater Installation as a secondary category"]', 3);
update public.solutions set is_revealed = true where id = '50000000-0000-4000-8000-000000000003';

insert into public.share_links (id, audit_id, token) values
  ('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 't_ok');
insert into public.share_links (id, audit_id, token, expires_at) values
  ('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 't_expired', now() - interval '1 day');

insert into public.raw_snapshots (audit_id, provider, endpoint, cache_key, cost_usd) values
  ('30000000-0000-4000-8000-000000000001', 'anthropic', 'messages.create', 'k1', 0.25),
  ('30000000-0000-4000-8000-000000000001', 'pagespeed', 'runPagespeed',    'k2', 0.10);

do $$
begin
  assert (select total_cost_usd from public.audits where id = '30000000-0000-4000-8000-000000000001') = 0.35, 'trigger keeps total_cost_usd';
  assert public.audit_cost_usd('30000000-0000-4000-8000-000000000001') = 0.35, 'audit_cost_usd sums snapshots';
  assert (select revealed_at from public.solutions where id = '50000000-0000-4000-8000-000000000003') is not null, 'revealed_at set by trigger';
  assert (select revealed_at from public.solutions where id = '50000000-0000-4000-8000-000000000001') is null, 'unrevealed has no revealed_at';
end $$;

-- 3. Admin sees everything and can reveal ------------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare n int; s public.solutions;
begin
  assert public.is_admin(), 'admin resolved';
  select count(*) into n from public.solutions; assert n = 3, 'admin sees all solutions';
  select count(*) into n from public.audits;    assert n = 1, 'admin sees audits';
  select count(*) into n from public.profiles;  assert n = 3, 'admin sees all profiles';
  s := public.reveal_solution('50000000-0000-4000-8000-000000000002', true);
  assert s.is_revealed and s.revealed_at is not null, 'reveal sets flag + timestamp';
  s := public.reveal_solution('50000000-0000-4000-8000-000000000002', false);
  assert not s.is_revealed and s.revealed_at is null, 'unreveal clears timestamp';
  assert public.reveal_audit_solutions('30000000-0000-4000-8000-000000000001', true, 'nonexistent') = 0, 'bulk reveal filters by category';
  insert into public.evidence (audit_id, type, excerpt, storage_path)
  values ('30000000-0000-4000-8000-000000000001', 'html', 'tel: link missing in header', 'private/path.png');
end $$;
select pg_temp.logout();

-- 4. Client sees nothing but their own profile -------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare n int;
begin
  assert not public.is_admin(), 'client is not admin';
  select count(*) into n from public.solutions;        assert n = 0, 'client sees no solutions';
  select count(*) into n from public.audits;           assert n = 0, 'client sees no audits';
  select count(*) into n from public.findings;         assert n = 0, 'client sees no findings';
  select count(*) into n from public.evidence;         assert n = 0, 'client sees no evidence';
  select count(*) into n from public.raw_snapshots;    assert n = 0, 'client sees no snapshots';
  select count(*) into n from public.share_links;      assert n = 0, 'client sees no share links';
  select count(*) into n from public.citations;        assert n = 0, 'client sees no citations';
  select count(*) into n from public.social_profiles;  assert n = 0, 'client sees no social profiles';
  select count(*) into n from public.backlink_metrics; assert n = 0, 'client sees no backlink metrics';
  select count(*) into n from public.brand_mentions;   assert n = 0, 'client sees no brand mentions';
  select count(*) into n from public.agency_settings;  assert n = 0, 'client sees no agency settings';
  select count(*) into n from public.profiles;         assert n = 1, 'client sees only own profile';

  update public.solutions set is_revealed = true where id = '50000000-0000-4000-8000-000000000001';  -- RLS: touches 0 rows

  begin
    perform public.reveal_solution('50000000-0000-4000-8000-000000000001', true);
    raise exception 'expected 42501 from reveal_solution';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.audits (business_id) values ('20000000-0000-4000-8000-000000000001');
    raise exception 'expected 42501 from audits insert';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'expected 42501 from self-promotion';
  exception when sqlstate '42501' then null;
  end;
  update public.profiles set full_name = 'Client Renamed' where id = auth.uid();
  assert (select full_name from public.profiles where id = auth.uid()) = 'Client Renamed', 'client may edit own name';
end $$;
select pg_temp.logout();

do $$
begin
  assert (select is_revealed from public.solutions where id = '50000000-0000-4000-8000-000000000001') = false, 'client update was a no-op';
end $$;

-- 5. Anonymous: no tables, only the report RPC --------------------------------
select pg_temp.anon();
do $$
declare r jsonb;
begin
  begin
    perform count(*) from public.solutions;
    raise exception 'expected permission denied on solutions';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform count(*) from public.audits;
    raise exception 'expected permission denied on audits';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.reveal_solution('50000000-0000-4000-8000-000000000001', true);
    raise exception 'expected permission denied on reveal_solution';
  exception when sqlstate '42501' then null;
  end;

  assert public.get_client_report('t_expired') is null, 'expired token → null';
  assert public.get_client_report('nope') is null, 'unknown token → null';

  r := public.get_client_report('t_ok');
  assert r is not null, 'valid token → report';
  assert jsonb_array_length(r -> 'solutions') = 1, 'only revealed solutions';
  assert (r -> 'solution_counts' ->> 'total')::int = 3, 'total count exposed';
  assert (r -> 'solution_counts' ->> 'revealed')::int = 1, 'revealed count exposed';
  assert position('SECRET-UNREVEALED-STEP' in r::text) = 0, 'unrevealed steps never serialised';
  assert position('INPUTS-MUST-NOT-LEAK' in r::text) = 0, 'audit inputs never serialised';
  assert position('private/path.png' in r::text) = 0, 'storage paths never serialised';
  assert not (r -> 'audit' ? 'inputs'), 'no inputs key';
  assert not (r -> 'audit' ? 'total_cost_usd'), 'no cost key';
  assert not (r -> 'solutions' -> 0 ? 'is_revealed'), 'solution rows carry no is_revealed';
  assert (r -> 'business' ->> 'name') = 'Test Plumbing', 'business projected';
  assert jsonb_array_length(r -> 'findings') = 2, 'findings projected';
  assert jsonb_array_length(r -> 'evidence') = 1, 'evidence projected';
  assert (r -> 'share' ->> 'view_count')::int = 1, 'view counted';

  perform public.record_report_view('t_ok', 'summary', 12);
  perform public.record_report_view('nope', 'summary', 12);  -- ignored
end $$;
select pg_temp.logout();

do $$
declare n int;
begin
  assert (select view_count from public.share_links where token = 't_ok') = 1, 'view_count incremented once';
  assert (select last_viewed_at from public.share_links where token = 't_ok') is not null, 'last_viewed_at set';
  select count(*) into n from public.report_views; assert n = 1, 'one report view recorded';
end $$;

-- 6. RLS is enabled on every table --------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'schema_migrations' loop
    assert (select relrowsecurity from pg_class where oid = ('public.' || quote_ident(t))::regclass), 'RLS enabled on ' || t;
  end loop;
  assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'solutions' and 'anon' = any(roles)),
    'no anon policy on solutions';
end $$;

-- 7. Storage ----------------------------------------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000001');
insert into storage.objects (bucket_id, name) values ('screenshots', '30000000-0000-4000-8000-000000000001/home.png');
select pg_temp.logout();

select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare n int;
begin
  select count(*) into n from storage.objects; assert n = 0, 'client sees no objects';
  begin
    insert into storage.objects (bucket_id, name) values ('screenshots', '30000000-0000-4000-8000-000000000001/evil.png');
    raise exception 'expected 42501 from storage insert';
  exception when sqlstate '42501' then null;
  end;
end $$;
select pg_temp.logout();
