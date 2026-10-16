-- SQL tests for 0070: a manager's PIN approves a detailer's edit or delete of a job.
-- Users: ...001 owner, ...002 detailer, ...004 manager, ...005 admin. Dealership ...0101, service ...0201.

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, false);
  select set_config('role', 'authenticated', false);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', false);
  select set_config('request.jwt.claims', '', false);
$$;
-- The tables are closed to the app; the tests read them as the superuser.
create or replace function pg_temp.hash_of(p_user uuid) returns text language sql security definer as $$ select pin_hash from public.approval_pins where user_id = p_user $$;
create or replace function pg_temp.grant_row(p_grant uuid) returns jsonb language sql security definer as $$
  select to_jsonb(g) from public.pin_grants g where id = p_grant $$;
create or replace function pg_temp.attempts_of(p_user uuid) returns int language sql security definer as $$ select count(*)::int from public.pin_attempts where user_id = p_user $$;
create temp table pin_t (k text primary key, v text);
grant all on pin_t to authenticated;

-- A manager sets a PIN; a detailer cannot; the format is checked; only a hash is stored
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
begin
  assert (public.my_pin_status() ->> 'can_have_pin')::boolean and not (public.my_pin_status() ->> 'has_pin')::boolean, '0070: a manager can have a PIN';
  begin perform public.set_my_pin('12'); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  begin perform public.set_my_pin('12ab'); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  begin perform public.set_my_pin('1234567'); raise exception 'expected refused'; exception when sqlstate '22023' then null; end;
  perform public.set_my_pin('4821');
  assert (public.my_pin_status() ->> 'has_pin')::boolean, '0070: the PIN is saved';
  begin perform * from public.approval_pins; raise exception 'expected no access'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.logout();
do $$
begin
  assert pg_temp.hash_of('10000000-0000-4000-8000-000000000004') like '$2%' and pg_temp.hash_of('10000000-0000-4000-8000-000000000004') <> '4821', '0070: only a bcrypt hash is stored';
end $$;
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
begin
  assert not (public.my_pin_status() ->> 'can_have_pin')::boolean, '0070: a detailer cannot have a PIN';
  begin perform public.set_my_pin('1111'); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
  begin perform public.clear_pin('10000000-0000-4000-8000-000000000004'); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();

-- The detailer logs a job, then tries to edit it
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare j public.jobs; r jsonb; g uuid; j2 public.jobs;
begin
  j := public.create_job(jsonb_build_object('client_id', '20000000-0000-4000-8000-0000000000a1',
    'dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'PIN1', 'year', 2023, 'make', 'Mercedes-Benz', 'model', 'GLC 300', 'color', 'White',
    'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  insert into pin_t values ('job', j.id::text);

  -- no approval: refused (edit and delete)
  begin perform public.update_job(j.id, '{"notes":"x"}'::jsonb); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
  begin perform public.soft_delete_job(j.id, 'oops'); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
  -- a made-up approval: refused
  begin perform public.update_job(j.id, jsonb_build_object('notes', 'x', 'approval_grant', gen_random_uuid())); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;

  -- direct writes are closed
  update public.jobs set notes = 'sneaky' where id = j.id;
  assert (select notes from public.jobs where id = j.id) is distinct from 'sneaky', '0070: a detailer cannot update a job row directly';
  delete from public.job_services where job_id = j.id;
  assert (select count(*) from public.job_services where job_id = j.id) = 1, '0070: a detailer cannot delete job services directly';

  -- wrong PINs
  r := public.verify_manager_pin('0000');
  assert not (r ->> 'ok')::boolean and r ->> 'reason' = 'wrong', '0070: a wrong PIN is refused';
  r := public.verify_manager_pin('12');
  assert r ->> 'reason' = 'format', '0070: a bad format is refused';

  -- the right PIN gives one approval, which edits once
  r := public.verify_manager_pin('4821');
  assert (r ->> 'ok')::boolean and (r ->> 'grant') is not null, '0070: the right PIN gives an approval';
  g := (r ->> 'grant')::uuid;
  perform public.update_job(j.id, jsonb_build_object('notes', 'approved edit', 'approval_grant', g));
  assert (select notes from public.jobs where id = j.id) = 'approved edit', '0070: the approved edit is saved';
  begin perform public.update_job(j.id, jsonb_build_object('notes', 'again', 'approval_grant', g)); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
  insert into pin_t values ('grant', g::text);

  -- an approval also deletes (own job), once
  r := public.verify_manager_pin('4821');
  g := (r ->> 'grant')::uuid;
  perform public.soft_delete_job(j.id, 'duplicate', g);
  assert (select deleted_at from public.jobs where id = j.id) is not null, '0070: the approved delete is applied';
end $$;
select pg_temp.logout();
do $$
declare gr jsonb := pg_temp.grant_row((select v from pin_t where k = 'grant')::uuid);
begin
  assert gr ->> 'requested_by' = '10000000-0000-4000-8000-000000000002' and gr ->> 'approver_id' = '10000000-0000-4000-8000-000000000004' and gr ->> 'action' = 'edit' and gr ->> 'job_id' = (select v from pin_t where k = 'job'), '0070: the approval records who asked, who approved, what and which job: ' || gr::text;
end $$;

-- An approval belongs to the person who asked; managers need no PIN; restore stays admin-only
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare j public.jobs; g uuid; j2 public.jobs;
begin
  g := (public.verify_manager_pin('4821') ->> 'grant')::uuid;
  insert into pin_t values ('other_grant', g::text);
  j := public.create_job(jsonb_build_object('client_id', '20000000-0000-4000-8000-0000000000a2',
    'dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'PIN2', 'year', 2023, 'make', 'Mercedes-Benz', 'model', 'GLC 300', 'color', 'Black',
    'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))));
  insert into pin_t values ('job2', j.id::text);
  begin perform public.restore_job((select v from pin_t where k = 'job')::uuid); raise exception 'expected refused'; exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare j2 uuid := (select v from pin_t where k = 'job2')::uuid;
begin
  begin perform public.update_job(j2, jsonb_build_object('notes', 'stolen', 'approval_grant', (select v from pin_t where k = 'other_grant')::uuid)); exception when others then null; end;
  perform public.update_job(j2, '{"notes":"owner edit"}'::jsonb);
  assert (select notes from public.jobs where id = j2) = 'owner edit', '0070: an owner edits without a PIN';
end $$;
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000004');
do $$
declare j2 uuid := (select v from pin_t where k = 'job2')::uuid;
begin
  perform public.update_job(j2, '{"notes":"manager edit"}'::jsonb);
  assert (select notes from public.jobs where id = j2) = 'manager edit', '0070: a manager edits without a PIN';
  perform public.restore_job((select v from pin_t where k = 'job')::uuid);
  assert (select deleted_at from public.jobs where id = (select v from pin_t where k = 'job')::uuid) is null, '0070: a manager restores';
end $$;
select pg_temp.logout();

-- Another detailer's job cannot be deleted with an approval; the approval is bound to its holder
select pg_temp.login('10000000-0000-4000-8000-000000000001');
select set_config('app.t70_owner_job', (public.create_job(jsonb_build_object('client_id', '20000000-0000-4000-8000-0000000000a3',
    'dealership_id', '00000000-0000-4000-8000-000000000101', 'tag_number', 'PIN3', 'year', 2023, 'make', 'Mercedes-Benz', 'model', 'GLC 300', 'color', 'Red',
    'services', jsonb_build_array(jsonb_build_object('service_id', '00000000-0000-4000-8000-000000000201'))))).id::text, false);
select pg_temp.logout();
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare g uuid := (public.verify_manager_pin('4821') ->> 'grant')::uuid;
begin
  begin perform public.soft_delete_job(current_setting('app.t70_owner_job')::uuid, 'not mine', g); raise exception 'expected refused'; exception when sqlstate 'P0002' or sqlstate '42501' then null; end;
end $$;
select pg_temp.logout();

-- Lockout after five wrong PINs; a different detailer is not affected; a right PIN while locked is refused
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare r jsonb; i int;
begin
  for i in 1..5 loop r := public.verify_manager_pin('9999'); end loop;
  assert r ->> 'reason' in ('wrong', 'locked'), '0070: wrong PINs keep counting';
  r := public.verify_manager_pin('4821');
  assert not (r ->> 'ok')::boolean and r ->> 'reason' = 'locked', '0070: after five wrong PINs even the right PIN is locked out: ' || r::text;
end $$;
select pg_temp.logout();

-- The owner can reset a PIN
select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
begin
  assert (select count(*) from unnest(public.pin_holders())) = 1, '0070: the owner sees who has a PIN';
  perform public.clear_pin('10000000-0000-4000-8000-000000000004');
end $$;
select pg_temp.logout();
do $$
begin
  assert pg_temp.hash_of('10000000-0000-4000-8000-000000000004') is null, '0070: the owner reset clears the PIN';
end $$;
