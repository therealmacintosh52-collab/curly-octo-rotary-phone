-- =============================================================================
-- 0004_storage.sql — private buckets for evidence screenshots and report PDFs
--
-- Object paths are <audit_id>/<file>. Only admins touch objects directly;
-- client views receive server-signed URLs in a later phase.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('screenshots', 'screenshots', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('reports',     'reports',     false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

create policy audit_files_admin_select on storage.objects for select to authenticated
  using (bucket_id in ('screenshots', 'reports') and public.is_admin());
create policy audit_files_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('screenshots', 'reports') and public.is_admin());
create policy audit_files_admin_update on storage.objects for update to authenticated
  using (bucket_id in ('screenshots', 'reports') and public.is_admin())
  with check (bucket_id in ('screenshots', 'reports') and public.is_admin());
create policy audit_files_admin_delete on storage.objects for delete to authenticated
  using (bucket_id in ('screenshots', 'reports') and public.is_admin());
