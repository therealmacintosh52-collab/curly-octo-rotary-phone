-- =============================================================================
-- 0003_rls.sql — row level security
--
-- Admins see and edit everything. Clients (logged-in, role = client) see only
-- their own profile row until a later phase links audits to client users.
-- The anon role has NO table access at all; the report goes through
-- public.get_client_report() (0002).
--
-- HARD RULE: solutions has no policy for anyone but admins. Do not add one.
-- =============================================================================

alter table public.profiles          enable row level security;
alter table public.businesses        enable row level security;
alter table public.audits            enable row level security;
alter table public.raw_snapshots     enable row level security;
alter table public.evidence          enable row level security;
alter table public.findings          enable row level security;
alter table public.solutions         enable row level security;
alter table public.competitors       enable row level security;
alter table public.ai_visibility     enable row level security;
alter table public.rank_grid         enable row level security;
alter table public.share_links       enable row level security;
alter table public.report_views      enable row level security;
alter table public.citations         enable row level security;
alter table public.social_profiles   enable row level security;
alter table public.backlink_metrics  enable row level security;
alter table public.brand_mentions    enable row level security;
alter table public.agency_settings   enable row level security;

-- profiles: self or admin ---------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_admin_write on public.profiles for insert to authenticated
  with check (public.is_admin());
create policy profiles_admin_delete on public.profiles for delete to authenticated
  using (public.is_admin());

-- Everything else: admin only ------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'businesses', 'audits', 'raw_snapshots', 'evidence', 'findings', 'competitors', 'ai_visibility',
    'rank_grid', 'share_links', 'report_views', 'citations', 'social_profiles', 'backlink_metrics',
    'brand_mentions', 'agency_settings']
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin', t);
  end loop;
end $$;

-- solutions: admin only, spelled out so the rule is visible in one place -----
create policy solutions_select_admin on public.solutions for select to authenticated
  using (public.is_admin());
create policy solutions_insert_admin on public.solutions for insert to authenticated
  with check (public.is_admin());
create policy solutions_update_admin on public.solutions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy solutions_delete_admin on public.solutions for delete to authenticated
  using (public.is_admin());

-- Grants ----------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
