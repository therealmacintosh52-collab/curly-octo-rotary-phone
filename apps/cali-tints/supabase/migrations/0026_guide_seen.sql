-- =============================================================================
-- 0026 — First sign-in guide
--   profiles.guide_seen_at: when the person first opened "How it works".
--   Null means they have not yet, so the app offers the guide once on
--   sign-in. Each person may set it on their own row (profiles_update).
-- Re-runnable.
-- =============================================================================

alter table public.profiles add column if not exists guide_seen_at timestamptz;
