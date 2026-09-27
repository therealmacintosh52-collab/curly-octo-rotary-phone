-- =============================================================================
-- seed.sql — reference rows. Idempotent; safe to re-run.
-- Users come from Supabase Auth (the first one becomes admin), so nothing
-- user-related lives here.
-- =============================================================================

insert into public.agency_settings (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Your Agency')
on conflict (id) do nothing;
