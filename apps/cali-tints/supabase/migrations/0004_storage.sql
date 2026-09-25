-- =============================================================================
-- 0004_storage.sql — private buckets + object policies
--
-- Paths are `<company_id>/<...>` so a policy can scope by the first folder.
--   job-photos:               <company_id>/<job_id>/<uuid>.jpg
--   logos:                    <company_id>/logo.<ext>
--   submission-confirmations: <company_id>/<invoice_id>/<uuid>.<ext>
-- Files are read through short-lived signed URLs created server-side.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('job-photos', 'job-photos', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('logos', 'logos', false, 2097152, array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('submission-confirmations', 'submission-confirmations', false, 10485760,
     array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Helper: first path segment must equal the caller's company.
create or replace function public.storage_path_company(p_name text)
returns uuid language sql immutable as $$
  select nullif(split_part(p_name, '/', 1), '')::uuid
$$;

-- job-photos: members of the company read; members write into their company folder.
create policy "job-photos read" on storage.objects for select to authenticated
  using (bucket_id = 'job-photos' and public.storage_path_company(name) = public.current_company_id());
create policy "job-photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'job-photos' and public.storage_path_company(name) = public.current_company_id());
create policy "job-photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'job-photos' and public.storage_path_company(name) = public.current_company_id() and public.is_admin());

-- logos: everyone in the company reads; admins write.
create policy "logos read" on storage.objects for select to authenticated
  using (bucket_id = 'logos' and public.storage_path_company(name) = public.current_company_id());
create policy "logos write" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.storage_path_company(name) = public.current_company_id() and public.is_admin());
create policy "logos update" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.storage_path_company(name) = public.current_company_id() and public.is_admin());
create policy "logos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.storage_path_company(name) = public.current_company_id() and public.is_admin());

-- submission confirmations: admins only.
create policy "confirmations read" on storage.objects for select to authenticated
  using (bucket_id = 'submission-confirmations' and public.storage_path_company(name) = public.current_company_id() and public.is_admin());
create policy "confirmations insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'submission-confirmations' and public.storage_path_company(name) = public.current_company_id() and public.is_admin());
