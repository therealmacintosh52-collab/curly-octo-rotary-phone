-- =============================================================================
-- 0003_rls.sql — row level security
--
-- Rules:
--   * Owner/Admin: everything inside their company.
--   * Detailer: read reference data (dealerships, services, prices, profiles
--     of their company), create jobs for themselves, read/edit their own
--     uninvoiced jobs. No invoices, no payments, no audit log, no pricing edits.
--   * service_role (server-side admin client) bypasses RLS entirely.
--   * Nothing is ever hard-deleted from the app: no delete policies on jobs.
-- =============================================================================

alter table public.companies                 enable row level security;
alter table public.profiles                  enable row level security;
alter table public.dealerships               enable row level security;
alter table public.services                  enable row level security;
alter table public.dealership_service_prices enable row level security;
alter table public.jobs                      enable row level security;
alter table public.job_services              enable row level security;
alter table public.job_photos                enable row level security;
alter table public.invoices                  enable row level security;
alter table public.invoice_items             enable row level security;
alter table public.invoice_payments          enable row level security;
alter table public.invoice_submissions       enable row level security;
alter table public.vin_cache                 enable row level security;
alter table public.audit_log                 enable row level security;

-- companies -----------------------------------------------------------------
create policy companies_select on public.companies for select to authenticated
  using (id = public.current_company_id());
create policy companies_update on public.companies for update to authenticated
  using (id = public.current_company_id() and public.is_admin())
  with check (id = public.current_company_id());

-- profiles ------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (company_id = public.current_company_id());
-- Self-edit (name only, enforced by trigger) or admin edit within company.
create policy profiles_update on public.profiles for update to authenticated
  using (company_id = public.current_company_id() and (id = auth.uid() or public.is_admin()))
  with check (company_id = public.current_company_id());
-- Inserts happen through the auth.users trigger (security definer); no direct insert policy.

-- dealerships ---------------------------------------------------------------
create policy dealerships_select on public.dealerships for select to authenticated
  using (company_id = public.current_company_id());
create policy dealerships_admin on public.dealerships for all to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());

-- services & prices ---------------------------------------------------------
create policy services_select on public.services for select to authenticated
  using (company_id = public.current_company_id());
create policy services_admin on public.services for all to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());

create policy dsp_select on public.dealership_service_prices for select to authenticated
  using (company_id = public.current_company_id());
create policy dsp_admin on public.dealership_service_prices for all to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());

-- jobs ----------------------------------------------------------------------
-- Detailers see only their own jobs; admins see the whole company.
create policy jobs_select on public.jobs for select to authenticated
  using (company_id = public.current_company_id() and (public.is_admin() or detailer_id = auth.uid()));
-- Direct inserts are allowed (create_job RPC is preferred) but always as yourself unless admin.
create policy jobs_insert on public.jobs for insert to authenticated
  with check (company_id = public.current_company_id() and (public.is_admin() or detailer_id = auth.uid()));
-- Admins edit anything; detailers only their own uninvoiced jobs. Lock trigger guards invoiced rows.
create policy jobs_update on public.jobs for update to authenticated
  using (company_id = public.current_company_id()
         and (public.is_admin() or (detailer_id = auth.uid() and invoice_id is null and deleted_at is null)))
  with check (company_id = public.current_company_id()
         and (public.is_admin() or detailer_id = auth.uid()));
-- No delete policy: soft delete only.

-- job_services / job_photos: follow the parent job -------------------------
create policy job_services_select on public.job_services for select to authenticated
  using (company_id = public.current_company_id()
         and exists (select 1 from public.jobs j where j.id = job_id and (public.is_admin() or j.detailer_id = auth.uid())));
create policy job_services_write on public.job_services for all to authenticated
  using (company_id = public.current_company_id()
         and exists (select 1 from public.jobs j where j.id = job_id
                     and (public.is_admin() or (j.detailer_id = auth.uid() and j.invoice_id is null))))
  with check (company_id = public.current_company_id()
         and exists (select 1 from public.jobs j where j.id = job_id
                     and (public.is_admin() or (j.detailer_id = auth.uid() and j.invoice_id is null))));

create policy job_photos_select on public.job_photos for select to authenticated
  using (company_id = public.current_company_id()
         and exists (select 1 from public.jobs j where j.id = job_id and (public.is_admin() or j.detailer_id = auth.uid())));
create policy job_photos_insert on public.job_photos for insert to authenticated
  with check (company_id = public.current_company_id()
         and exists (select 1 from public.jobs j where j.id = job_id and (public.is_admin() or j.detailer_id = auth.uid())));
create policy job_photos_delete on public.job_photos for delete to authenticated
  using (company_id = public.current_company_id()
         and exists (select 1 from public.jobs j where j.id = job_id
                     and (public.is_admin() or (j.detailer_id = auth.uid() and j.invoice_id is null))));

-- invoices & friends: admin only --------------------------------------------
create policy invoices_admin on public.invoices for all to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());
create policy invoice_items_admin on public.invoice_items for select to authenticated
  using (company_id = public.current_company_id() and public.is_admin());
create policy invoice_payments_admin on public.invoice_payments for all to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());
create policy invoice_submissions_admin on public.invoice_submissions for all to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());

-- vin_cache: any signed-in member may read/write the shared cache ----------
create policy vin_cache_select on public.vin_cache for select to authenticated using (public.is_member());
create policy vin_cache_insert on public.vin_cache for insert to authenticated with check (public.is_member());
create policy vin_cache_update on public.vin_cache for update to authenticated using (public.is_member());

-- audit_log: admins read; writes only via the security-definer trigger ------
create policy audit_log_select on public.audit_log for select to authenticated
  using (company_id = public.current_company_id() and public.is_admin());

-- Table grants (Supabase grants these to authenticated by default on new
-- tables via default privileges; stated explicitly for clarity/local tests).
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
