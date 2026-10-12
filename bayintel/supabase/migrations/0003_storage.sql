-- Storage buckets for fix photos (public) and repair-order photos (private).
insert into storage.buckets (id, name, public)
values ('fix-media', 'fix-media', true), ('ro-media', 'ro-media', false)
on conflict (id) do nothing;

create policy "fix media public read" on storage.objects for select using (bucket_id = 'fix-media');
create policy "fix media owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'fix-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fix media owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'fix-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ro media owner read" on storage.objects for select to authenticated
  using (bucket_id = 'ro-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ro media owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'ro-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ro media owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'ro-media' and (storage.foldername(name))[1] = auth.uid()::text);
