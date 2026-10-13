-- =============================================================================
-- 0046 — Intel: the shop's fix library
--   A tech who solved a hard car writes it down once (trouble codes, symptoms,
--   tests, root cause, the fix, parts, labor hours); it comes up the next time
--   the same code shows on the same model, and turns into an estimate. Private
--   to the company: no moderation, reputation, sharing across shops or names
--   of who wrote it (the app shows "mine" only).
--   * fixes + fix_dtcs / fix_parts / fix_confirmations / fix_revisions /
--     fix_media (photos in the job-photos bucket under <company>/fixes/...).
--   * triggers: vote counts and net score, no voting on your own fix, a
--     revision snapshot (and version bump) whenever the content changes.
--   * RPCs (security definer; every write goes through them): save_fix,
--     delete_fix, add_fix_media, confirm_fix, unconfirm_fix, fix_detail,
--     fixes_filtered, rank_fixes (BayIntel's scoring: net x 10 + confirmations
--     + 5 exact year + 5 engine match + 3 per matched code; same make and model
--     within 3 model years), fix_estimate_lines (labor at the default shop rate
--     + the parts, for the estimate builder).
--   * Part prices are the shop's own notes: only returned to whoever may price.
-- Re-runnable. Reversal: drop the six tables and the functions.
-- =============================================================================

create table if not exists public.fixes (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  author_id          uuid references public.profiles (id) on delete set null,
  vehicle_id         uuid references public.vehicles (id) on delete set null,
  job_id             uuid references public.jobs (id) on delete set null,
  title              text not null check (length(title) between 8 and 140),
  year               integer not null check (year between 1949 and 2100),
  make               text not null check (length(make) between 1 and 60),
  model              text not null check (length(model) between 1 and 80),
  engine             text check (engine is null or length(engine) <= 80),
  mileage            integer check (mileage is null or mileage between 0 and 2000000),
  symptoms           text not null check (length(symptoms) between 10 and 4000),
  freeze_frame_notes text check (freeze_frame_notes is null or length(freeze_frame_notes) <= 2000),
  tests              jsonb not null default '[]'::jsonb,   -- [{test, result}]
  root_cause         text not null check (length(root_cause) between 5 and 2000),
  fix_description    text not null check (length(fix_description) between 10 and 6000),
  labor_hours        numeric(5, 2) check (labor_hours is null or labor_hours between 0 and 200),
  confirm_count      integer not null default 0,
  deny_count         integer not null default 0,
  net_score          integer not null default 0,
  version            integer not null default 1,
  search_tsv         tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(symptoms, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(root_cause, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(fix_description, '')), 'C')
  ) stored,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists fixes_company_idx on public.fixes (company_id, created_at desc);
create index if not exists fixes_key_idx on public.fixes (company_id, lower(make), lower(model), year);
create index if not exists fixes_search_idx on public.fixes using gin (search_tsv);

create table if not exists public.fix_dtcs (
  fix_id     uuid not null references public.fixes (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  code       text not null check (code ~ '^[PBCU][0-9A-F]{4}$'),
  primary key (fix_id, code)
);
create index if not exists fix_dtcs_code_idx on public.fix_dtcs (company_id, code);

create table if not exists public.fix_parts (
  id          uuid primary key default gen_random_uuid(),
  fix_id      uuid not null references public.fixes (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null check (length(name) between 1 and 120),
  part_number text check (part_number is null or length(part_number) <= 60),
  brand       text check (brand is null or length(brand) <= 60),
  quantity    numeric(8, 2) not null default 1 check (quantity > 0),
  unit_price  numeric(10, 2) check (unit_price is null or unit_price >= 0),
  sort        integer not null default 0
);
create index if not exists fix_parts_fix_idx on public.fix_parts (fix_id, sort);

create table if not exists public.fix_confirmations (
  id         uuid primary key default gen_random_uuid(),
  fix_id     uuid not null references public.fixes (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  verdict    text not null check (verdict in ('fixed', 'not_fixed')),
  note       text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (fix_id, user_id)
);

create table if not exists public.fix_revisions (
  id          uuid primary key default gen_random_uuid(),
  fix_id      uuid not null references public.fixes (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  version     integer not null,
  snapshot    jsonb not null,
  change_note text check (change_note is null or length(change_note) <= 300),
  created_at  timestamptz not null default now(),
  unique (fix_id, version)
);

create table if not exists public.fix_media (
  id           uuid primary key default gen_random_uuid(),
  fix_id       uuid not null references public.fixes (id) on delete cascade,
  company_id   uuid not null references public.companies (id) on delete cascade,
  storage_path text not null,
  caption      text check (caption is null or length(caption) <= 200),
  created_at   timestamptz not null default now()
);
create index if not exists fix_media_fix_idx on public.fix_media (fix_id);

drop trigger if exists set_updated_at on public.fixes;
create trigger set_updated_at before update on public.fixes for each row execute function public.tg_set_updated_at();
drop trigger if exists audit on public.fixes;
create trigger audit after insert or update or delete on public.fixes for each row execute function public.tg_audit();

-- Members of the company read; every write is an RPC.
do $$
declare t text;
begin
  foreach t in array array['fixes', 'fix_dtcs', 'fix_parts', 'fix_confirmations', 'fix_revisions', 'fix_media'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (company_id = public.current_company_id())', t || '_select', t);
  end loop;
end $$;

-- Select only, and never the part price: it reaches the app through the RPC JSON, for whoever may price (like job prices).
revoke all on public.fixes, public.fix_dtcs, public.fix_parts, public.fix_confirmations, public.fix_revisions, public.fix_media from anon, authenticated;
grant select on public.fixes, public.fix_dtcs, public.fix_confirmations, public.fix_revisions, public.fix_media to authenticated;
grant select (id, fix_id, company_id, name, part_number, brand, quantity, sort) on public.fix_parts to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public._recompute_fix_score(p_fix uuid) returns void
language sql security definer set search_path = public as $$
  update public.fixes f set
    confirm_count = (select count(*) from public.fix_confirmations c where c.fix_id = f.id and c.verdict = 'fixed'),
    deny_count    = (select count(*) from public.fix_confirmations c where c.fix_id = f.id and c.verdict = 'not_fixed'),
    net_score     = (select count(*) filter (where verdict = 'fixed') - count(*) filter (where verdict = 'not_fixed') from public.fix_confirmations c where c.fix_id = f.id)
  where f.id = p_fix
$$;
revoke execute on function public._recompute_fix_score(uuid) from public, anon, authenticated;

create or replace function public.tg_fix_confirmation_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._recompute_fix_score(coalesce(new.fix_id, old.fix_id));
  return null;
end $$;
drop trigger if exists fix_confirmation_change on public.fix_confirmations;
create trigger fix_confirmation_change after insert or update or delete on public.fix_confirmations for each row execute function public.tg_fix_confirmation_change();

create or replace function public.tg_fix_block_self_vote() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.fixes f where f.id = new.fix_id and f.author_id = new.user_id) then
    raise exception 'You cannot vote on your own fix' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists fix_block_self_vote on public.fix_confirmations;
create trigger fix_block_self_vote before insert or update on public.fix_confirmations for each row execute function public.tg_fix_block_self_vote();

-- The old row is kept (and the version bumped) whenever the content changes.
create or replace function public.tg_fix_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (old.title, old.symptoms, old.root_cause, old.fix_description, old.freeze_frame_notes, old.tests, old.labor_hours, old.mileage, old.engine, old.year, old.make, old.model)
     is distinct from
     (new.title, new.symptoms, new.root_cause, new.fix_description, new.freeze_frame_notes, new.tests, new.labor_hours, new.mileage, new.engine, new.year, new.make, new.model) then
    insert into public.fix_revisions (fix_id, company_id, version, snapshot) values (old.id, old.company_id, old.version, to_jsonb(old) - 'search_tsv');
    new.version := old.version + 1;
  end if;
  return new;
end $$;
drop trigger if exists fix_snapshot on public.fixes;
create trigger fix_snapshot before update on public.fixes for each row execute function public.tg_fix_snapshot();

-- ---------------------------------------------------------------------------
-- JSON builders (internal)
-- ---------------------------------------------------------------------------
create or replace function public._fix_summary(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', f.id, 'title', f.title, 'year', f.year, 'make', f.make, 'model', f.model, 'engine', f.engine, 'mileage', f.mileage,
    'root_cause', f.root_cause, 'labor_hours', f.labor_hours, 'confirm_count', f.confirm_count, 'deny_count', f.deny_count, 'net_score', f.net_score,
    'version', f.version, 'created_at', f.created_at, 'is_mine', f.author_id is not distinct from auth.uid(),
    'codes', coalesce((select jsonb_agg(d.code order by d.code) from public.fix_dtcs d where d.fix_id = f.id), '[]'::jsonb))
  from public.fixes f where f.id = p_id and f.company_id = public.current_company_id()
$$;
revoke execute on function public._fix_summary(uuid) from public, anon;
grant execute on function public._fix_summary(uuid) to authenticated;

create or replace function public._fix_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public._fix_summary(f.id) || jsonb_build_object(
    'vehicle_id', f.vehicle_id, 'job_id', f.job_id, 'symptoms', f.symptoms, 'freeze_frame_notes', f.freeze_frame_notes, 'tests', f.tests, 'fix_description', f.fix_description,
    'can_edit', (f.author_id is not distinct from auth.uid()) or public.is_admin(),
    'can_delete', public.is_owner_admin(),
    'my_vote', (select c.verdict from public.fix_confirmations c where c.fix_id = f.id and c.user_id = auth.uid()),
    'parts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'part_number', p.part_number, 'brand', p.brand, 'quantity', p.quantity,
                          'unit_price', case when public.can_price_jobs() then p.unit_price end) order by p.sort) from public.fix_parts p where p.fix_id = f.id), '[]'::jsonb),
    'media', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'storage_path', m.storage_path, 'caption', m.caption) order by m.created_at) from public.fix_media m where m.fix_id = f.id), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('verdict', c.verdict, 'note', c.note, 'created_at', c.created_at) order by c.created_at desc)
                         from public.fix_confirmations c where c.fix_id = f.id and c.note is not null), '[]'::jsonb),
    'revisions', coalesce((select jsonb_agg(jsonb_build_object('version', r.version, 'change_note', r.change_note, 'created_at', r.created_at) order by r.version desc)
                             from public.fix_revisions r where r.fix_id = f.id), '[]'::jsonb))
  from public.fixes f where f.id = p_id and f.company_id = public.current_company_id()
$$;
revoke execute on function public._fix_json(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Writes
-- ---------------------------------------------------------------------------
-- p: {id?, vehicle_id?, job_id?, title, year, make, model, engine?, mileage?, symptoms, codes[], freeze_frame_notes?,
--     tests[{test,result}], root_cause, fix_description, labor_hours?, parts[{name, part_number?, brand?, quantity?, unit_price?}], change_note?}
create or replace function public.save_fix(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.current_company_id();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_f public.fixes;
  v_codes text[];
  v_veh uuid := nullif(p ->> 'vehicle_id', '')::uuid;
  v_job uuid := nullif(p ->> 'job_id', '')::uuid;
  v_old_version int;
  v_old_parts jsonb;
begin
  if v_company is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct upper(trim(c))), '{}') into v_codes from jsonb_array_elements_text(coalesce(p -> 'codes', '[]'::jsonb)) c;
  if exists (select 1 from unnest(v_codes) c where c !~ '^[PBCU][0-9A-F]{4}$') then raise exception 'Trouble codes look like P0300' using errcode = '22023'; end if;
  if cardinality(v_codes) > 20 then raise exception 'At most 20 codes' using errcode = '22023'; end if;
  if v_veh is not null and not exists (select 1 from public.vehicles v where v.id = v_veh and v.company_id = v_company) then raise exception 'Unknown vehicle' using errcode = '22023'; end if;
  if v_job is not null and not exists (select 1 from public.jobs j where j.id = v_job and j.company_id = v_company) then raise exception 'Unknown job' using errcode = '22023'; end if;

  if v_id is null then
    insert into public.fixes (company_id, author_id, vehicle_id, job_id, title, year, make, model, engine, mileage, symptoms, freeze_frame_notes, tests, root_cause, fix_description, labor_hours)
    values (v_company, auth.uid(), v_veh, v_job, trim(p ->> 'title'), (p ->> 'year')::int, trim(p ->> 'make'), trim(p ->> 'model'), nullif(trim(coalesce(p ->> 'engine', '')), ''),
            nullif(p ->> 'mileage', '')::int, trim(p ->> 'symptoms'), nullif(trim(coalesce(p ->> 'freeze_frame_notes', '')), ''), coalesce(p -> 'tests', '[]'::jsonb),
            trim(p ->> 'root_cause'), trim(p ->> 'fix_description'), nullif(p ->> 'labor_hours', '')::numeric)
    returning * into v_f;
  else
    select * into v_f from public.fixes where id = v_id and company_id = v_company;
    if not found then raise exception 'Fix not found' using errcode = 'P0002'; end if;
    if not (public.is_admin() or v_f.author_id is not distinct from auth.uid()) then raise exception 'Only the author or an admin can edit this fix' using errcode = '42501'; end if;
    v_old_version := v_f.version;
    update public.fixes set
      vehicle_id = v_veh, job_id = coalesce(v_job, job_id), title = trim(p ->> 'title'), year = (p ->> 'year')::int, make = trim(p ->> 'make'), model = trim(p ->> 'model'),
      engine = nullif(trim(coalesce(p ->> 'engine', '')), ''), mileage = nullif(p ->> 'mileage', '')::int, symptoms = trim(p ->> 'symptoms'),
      freeze_frame_notes = nullif(trim(coalesce(p ->> 'freeze_frame_notes', '')), ''), tests = coalesce(p -> 'tests', '[]'::jsonb),
      root_cause = trim(p ->> 'root_cause'), fix_description = trim(p ->> 'fix_description'), labor_hours = nullif(p ->> 'labor_hours', '')::numeric
    where id = v_id returning * into v_f;
    if v_f.version > v_old_version and nullif(trim(coalesce(p ->> 'change_note', '')), '') is not null then
      update public.fix_revisions set change_note = left(trim(p ->> 'change_note'), 300) where fix_id = v_f.id and version = v_old_version;
    end if;
  end if;

  delete from public.fix_dtcs where fix_id = v_f.id;
  insert into public.fix_dtcs (fix_id, company_id, code) select v_f.id, v_company, c from unnest(v_codes) c;
  -- whoever may not price keeps the prices already on the parts they re-save
  select coalesce(jsonb_agg(to_jsonb(op)), '[]'::jsonb) into v_old_parts from public.fix_parts op where op.fix_id = v_f.id;
  delete from public.fix_parts where fix_id = v_f.id;
  insert into public.fix_parts (fix_id, company_id, name, part_number, brand, quantity, unit_price, sort)
  select v_f.id, v_company, trim(x.part ->> 'name'), nullif(trim(coalesce(x.part ->> 'part_number', '')), ''), nullif(trim(coalesce(x.part ->> 'brand', '')), ''),
         coalesce(nullif(x.part ->> 'quantity', '')::numeric, 1),
         case when public.can_price_jobs() then nullif(x.part ->> 'unit_price', '')::numeric
              else (select (o ->> 'unit_price')::numeric from jsonb_array_elements(v_old_parts) o
                     where o ->> 'name' = trim(x.part ->> 'name') and coalesce(o ->> 'part_number', '') = coalesce(nullif(trim(coalesce(x.part ->> 'part_number', '')), ''), '') limit 1) end,
         (x.i - 1)::int
  from jsonb_array_elements(coalesce(p -> 'parts', '[]'::jsonb)) with ordinality as x(part, i)
  where trim(coalesce(x.part ->> 'name', '')) <> '';
  return public._fix_json(v_f.id);
end $$;
grant execute on function public.save_fix(jsonb) to authenticated;

-- The owner or an admin; the photo files go afterwards (the app removes the returned paths).
create or replace function public.delete_fix(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_paths jsonb;
begin
  if not public.is_owner_admin() or not exists (select 1 from public.fixes where id = p_id and company_id = public.current_company_id()) then
    raise exception 'You cannot remove this fix' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(storage_path), '[]'::jsonb) into v_paths from public.fix_media where fix_id = p_id;
  delete from public.fixes where id = p_id;
  return jsonb_build_object('id', p_id, 'paths', v_paths);
end $$;
grant execute on function public.delete_fix(uuid) to authenticated;

-- Photos already uploaded to <company>/fixes/<fix>/...; the author or an admin registers them.
create or replace function public.add_fix_media(p_fix uuid, p_paths jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_f public.fixes; v_prefix text;
begin
  select * into v_f from public.fixes where id = p_fix and company_id = public.current_company_id();
  if not found or not (public.is_admin() or v_f.author_id is not distinct from auth.uid()) then raise exception 'You cannot add photos here' using errcode = '42501'; end if;
  v_prefix := v_f.company_id::text || '/fixes/' || v_f.id::text || '/';
  if exists (select 1 from jsonb_array_elements_text(p_paths) x where left(x, length(v_prefix)) <> v_prefix) then raise exception 'Bad photo path' using errcode = '22023'; end if;
  insert into public.fix_media (fix_id, company_id, storage_path) select p_fix, v_f.company_id, x from jsonb_array_elements_text(p_paths) x
  where (select count(*) from public.fix_media where fix_id = p_fix) < 12;
  return public._fix_json(p_fix);
end $$;
grant execute on function public.add_fix_media(uuid, jsonb) to authenticated;

create or replace function public.remove_fix_media(p_media uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_m public.fix_media; v_f public.fixes;
begin
  select * into v_m from public.fix_media where id = p_media and company_id = public.current_company_id();
  if not found then raise exception 'Photo not found' using errcode = 'P0002'; end if;
  select * into v_f from public.fixes where id = v_m.fix_id;
  if not (public.is_admin() or v_f.author_id is not distinct from auth.uid()) then raise exception 'You cannot remove this photo' using errcode = '42501'; end if;
  delete from public.fix_media where id = p_media;
  return jsonb_build_object('id', p_media, 'path', v_m.storage_path);
end $$;
grant execute on function public.remove_fix_media(uuid) to authenticated;

create or replace function public.confirm_fix(p_id uuid, p_verdict text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_verdict not in ('fixed', 'not_fixed') then raise exception 'Verdict is fixed or not_fixed' using errcode = '22023'; end if;
  if not exists (select 1 from public.fixes where id = p_id and company_id = public.current_company_id()) then raise exception 'Fix not found' using errcode = 'P0002'; end if;
  insert into public.fix_confirmations (fix_id, company_id, user_id, verdict, note) values (p_id, public.current_company_id(), auth.uid(), p_verdict, nullif(trim(coalesce(p_note, '')), ''))
  on conflict (fix_id, user_id) do update set verdict = excluded.verdict, note = excluded.note;
  return public._fix_json(p_id);
end $$;
grant execute on function public.confirm_fix(uuid, text, text) to authenticated;

create or replace function public.unconfirm_fix(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.fixes where id = p_id and company_id = public.current_company_id()) then raise exception 'Fix not found' using errcode = 'P0002'; end if;
  delete from public.fix_confirmations where fix_id = p_id and user_id = auth.uid();
  return public._fix_json(p_id);
end $$;
grant execute on function public.unconfirm_fix(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------
create or replace function public.fix_detail(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select public._fix_json(p_id)
$$;
grant execute on function public.fix_detail(uuid) to authenticated;

-- Search (websearch syntax), filter by any of the codes, "mine"; newest first when there is no search.
create or replace function public.fixes_filtered(p_q text default null, p_codes text[] default null, p_mine boolean default false, p_limit int default 50, p_offset int default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._fix_summary(x.id) order by x.rank desc, x.created_at desc), '[]'::jsonb)
  from (
    select f.id, f.created_at,
           case when nullif(trim(coalesce(p_q, '')), '') is null then 0 else ts_rank(f.search_tsv, websearch_to_tsquery('english', p_q)) end as rank
      from public.fixes f
     where f.company_id = public.current_company_id()
       and (nullif(trim(coalesce(p_q, '')), '') is null or f.search_tsv @@ websearch_to_tsquery('english', p_q))
       and (p_codes is null or cardinality(p_codes) = 0 or exists (select 1 from public.fix_dtcs d where d.fix_id = f.id and d.code = any (p_codes)))
       and (not coalesce(p_mine, false) or f.author_id is not distinct from auth.uid())
     order by rank desc, f.created_at desc
     limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
  ) x
$$;
grant execute on function public.fixes_filtered(text, text[], boolean, int, int) to authenticated;

-- The shop's fixes for a car (and optionally codes), best first.
create or replace function public.rank_fixes(p_make text, p_model text, p_year int, p_engine text default null, p_codes text[] default null, p_limit int default 25)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._fix_summary(x.id) || jsonb_build_object('rank_score', x.score, 'match_level', x.lvl, 'matched_codes', to_jsonb(x.matched)) order by x.score desc, x.confirm_count desc, x.created_at desc), '[]'::jsonb)
  from (
    select c.id, c.confirm_count, c.created_at, c.matched,
           (c.net_score * 10 + c.confirm_count + (case when c.exact_year then 5 else 0 end) + (case when c.engine_match then 5 else 0 end)
            + (case when p_codes is null or cardinality(p_codes) = 0 then 0 else cardinality(c.matched) * 3 end))::numeric as score,
           case when c.exact_year and (p_engine is null or c.engine_match) then 'exact' when c.exact_year then 'same_year' else 'near_year' end as lvl
      from (
        select f.id, f.net_score, f.confirm_count, f.created_at,
               (f.year = p_year) as exact_year,
               (p_engine is not null and f.engine is not null and lower(f.engine) like '%' || lower(split_part(p_engine, ' ', 1)) || '%') as engine_match,
               coalesce((select array_agg(d.code order by d.code) from public.fix_dtcs d where d.fix_id = f.id and (p_codes is null or cardinality(p_codes) = 0 or d.code = any (p_codes))), '{}') as matched
          from public.fixes f
         where f.company_id = public.current_company_id()
           and lower(f.make) = lower(p_make) and lower(f.model) = lower(p_model) and abs(f.year - p_year) <= 3
      ) c
     where (p_codes is null or cardinality(p_codes) = 0 or cardinality(c.matched) > 0)
     order by 5 desc, c.confirm_count desc
     limit greatest(1, least(coalesce(p_limit, 25), 100))
  ) x
$$;
grant execute on function public.rank_fixes(text, text, int, text, text[], int) to authenticated;

-- The shop's fixes for any of the codes, across cars, best first (the Codes screen without a car).
create or replace function public.fixes_for_codes(p_codes text[], p_limit int default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._fix_summary(x.id) order by x.net_score desc, x.confirm_count desc, x.created_at desc), '[]'::jsonb)
  from (select f.id, f.net_score, f.confirm_count, f.created_at from public.fixes f
         where f.company_id = public.current_company_id() and exists (select 1 from public.fix_dtcs d where d.fix_id = f.id and d.code = any (coalesce(p_codes, '{}')))
         order by f.net_score desc, f.confirm_count desc, f.created_at desc limit greatest(1, least(coalesce(p_limit, 30), 100))) x
$$;
grant execute on function public.fixes_for_codes(text[], int) to authenticated;

-- Estimate lines for the builder: labor at the default shop rate, then the parts. Whoever may price asks; the advisor edits freely.
create or replace function public.fix_estimate_lines(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_f public.fixes; v_rate numeric; v_lines jsonb := '[]'::jsonb;
begin
  if not public.can_price_jobs() then raise exception 'Estimates are for the owner, an admin or an advisor' using errcode = '42501'; end if;
  select * into v_f from public.fixes where id = p_id and company_id = public.current_company_id();
  if not found then raise exception 'Fix not found' using errcode = 'P0002'; end if;
  select rate into v_rate from public.labor_rates where company_id = v_f.company_id and is_default and active;
  if v_f.labor_hours is not null and v_f.labor_hours > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('line_type', 'labor', 'label', v_f.title, 'hours', v_f.labor_hours, 'rate', v_rate));
  end if;
  select v_lines || coalesce(jsonb_agg(jsonb_build_object('line_type', 'part', 'label', p.name, 'part_number', p.part_number, 'qty', p.quantity, 'price', p.unit_price) order by p.sort), '[]'::jsonb)
    into v_lines from public.fix_parts p where p.fix_id = p_id;
  return jsonb_build_object('fix_id', p_id, 'title', v_f.title, 'lines', v_lines);
end $$;
grant execute on function public.fix_estimate_lines(uuid) to authenticated;
