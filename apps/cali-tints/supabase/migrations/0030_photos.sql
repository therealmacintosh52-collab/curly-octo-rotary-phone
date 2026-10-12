-- =============================================================================
-- 0030 — Photos on every job
--   * job_photos.client_id: the id the device gave the photo, so a retried
--     upload (offline sync) never registers the same photo twice.
--   * Photos cannot be added to a deleted job.
--   * A detailer may remove the file of their own open job's photo, not only
--     the row (the storage policy used to require an admin).
-- Re-runnable.
-- =============================================================================

alter table public.job_photos add column if not exists client_id uuid;
create unique index if not exists job_photos_job_client_idx on public.job_photos (job_id, client_id) where client_id is not null;

drop policy if exists job_photos_insert on public.job_photos;
create policy job_photos_insert on public.job_photos for insert to authenticated
  with check (company_id = public.current_company_id()
         and exists (select 1 from public.jobs j where j.id = job_id and j.deleted_at is null
                     and (public.is_admin() or j.detailer_id = auth.uid())));

-- storage path: <company_id>/<job_id>/<file>
create or replace function public.storage_path_job(p_name text)
returns uuid language sql immutable as $$
  select case when split_part(p_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 2)::uuid end
$$;

drop policy if exists "job-photos delete" on storage.objects;
create policy "job-photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'job-photos' and public.storage_path_company(name) = public.current_company_id()
         and (public.is_admin()
              or exists (select 1 from public.jobs j where j.id = public.storage_path_job(name)
                         and j.detailer_id = auth.uid() and j.invoice_id is null)));
