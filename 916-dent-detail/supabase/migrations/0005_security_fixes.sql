-- 916 Dent & Detail: Phase 8 security fixes. Additive only: 0001-0004 are never edited. Run AFTER 0004.
-- Every fix below has a failing-then-passing assertion in tests/unit/rls-pglite.test.ts (runs all migrations on PGlite).
-- Found by the Phase 8 RLS review; see SECURITY.md for the list and what is still open.

-- ------------------------------------------------------------------ 1. dealers: no cross-tenant photo read, no pre-set staff fields
-- 0004's insert policy let a dealer set job_id on their own vehicle row. job_photos_dealer_read grants a dealer the before/after
-- photos of every job referenced by THEIR dealer_vehicles rows, so pointing a vehicle at another customer's job id (guessing a
-- UUID is hard, but ids appear in URLs and emails) would have exposed that job's photos. job_id is staff/server-owned.
drop policy if exists dealer_vehicles_member_insert on public.dealer_vehicles;
create policy dealer_vehicles_member_insert on public.dealer_vehicles for insert to authenticated
  with check (
    dealer_id in (select public.my_dealer_ids())
    and status = 'submitted'
    and price is null and price_source is null
    and statement_id is null and invoice_id is null
    and job_id is null
    and scheduled_at is null and done_at is null
    and addon_approvals = '[]'::jsonb
  );

-- ------------------------------------------------------------------ 2. one job per booking
-- The Stripe webhook and the customer's own "verify payment" call arrive together; the app now confirms with a compare-and-set,
-- and the database refuses a second job for the same booking as a backstop.
do $$
begin
  if exists (select 1 from public.jobs where booking_id is not null group by booking_id having count(*) > 1) then
    raise warning 'jobs_one_per_booking was NOT created: some booking already has several jobs. Merge or delete the extras, then run: create unique index jobs_one_per_booking on public.jobs (booking_id) where booking_id is not null;';
  else
    create unique index if not exists jobs_one_per_booking on public.jobs (booking_id) where booking_id is not null;
  end if;
end $$;

-- ------------------------------------------------------------------ 3. technicians: legal status moves only
-- 0002 limited WHICH statuses a tech may set, not FROM which. Through direct (RLS) access a tech could move a cancelled, expired or
-- completed booking back to in_progress. The app's state machine forbids that; now the database does too.
create or replace function public.limit_tech_columns() returns trigger language plpgsql security definer set search_path = public as $$
declare allowed text[];
begin
  if auth.uid() is null or public.is_staff() then return new; end if;
  if tg_table_name = 'bookings' then
    allowed := array['status','updated_at'];
    if new.status is distinct from old.status then
      if new.status not in ('on_the_way','in_progress','completed','no_show') then
        raise exception 'technicians may only move a booking to on_the_way, in_progress, completed or no_show';
      end if;
      if old.status not in ('confirmed','on_the_way','in_progress') then
        raise exception 'technicians cannot change a booking that is %', old.status;
      end if;
    end if;
  elsif tg_table_name = 'jobs' then
    allowed := array['stage','started_at','finished_at','summary','signature_path','line_items','on_my_way_at','eta_minutes','updated_at'];
  else
    return new;
  end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'technicians cannot change fields outside the tech view on %', tg_table_name;
  end if;
  return new;
end $$;

-- ------------------------------------------------------------------ 4. smaller API surface
-- The RLS helper functions are SECURITY DEFINER and Supabase exposes public functions as /rpc endpoints. They are only needed by
-- signed-in users evaluating policies (and by the service role), so the anonymous role loses EXECUTE.
revoke all on function public.is_staff() from public, anon;
revoke all on function public.current_role_name() from public, anon;
revoke all on function public.my_tech_id() from public, anon;
revoke all on function public.my_dealer_ids() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.current_role_name() to authenticated, service_role;
grant execute on function public.my_tech_id() to authenticated, service_role;
grant execute on function public.my_dealer_ids() to authenticated, service_role;

-- ------------------------------------------------------------------ 5. invoice numbers (bug, found by running 0002 on a real Postgres engine in Phase 8)
-- 0002's next_invoice_number(year integer) used the parameter name `year` for a column of the same name: PostgreSQL rejects it with
-- 'column reference "year" is ambiguous' on EVERY call, so on Supabase no invoice could ever be numbered (src/lib/db/supabase.ts
-- calls it through rpc with { year }). Same signature (so the rpc call is unchanged); the variable wins inside the body and the conflict
-- target is the primary-key constraint instead of the ambiguous column name.
create or replace function public.next_invoice_number(year integer) returns text
  language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare n integer;
begin
  insert into public.invoice_counters as c (year, last) values (year, 1)
    on conflict on constraint invoice_counters_pkey do update set last = c.last + 1
    returning c.last into n;
  return 'INV-' || year || '-' || lpad(n::text, 4, '0');
end $$;
revoke all on function public.next_invoice_number(integer) from public, anon, authenticated;
grant execute on function public.next_invoice_number(integer) to service_role;

-- ------------------------------------------------------------------ 6. photo bucket: private, images only, size-capped
-- Skipped outside Supabase (no storage schema). If you use a bucket name other than "photos", set SUPABASE_PHOTOS_BUCKET and run the same
-- statement for that name. No storage.objects policies are created on purpose: with none, only the service role can read or write.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
