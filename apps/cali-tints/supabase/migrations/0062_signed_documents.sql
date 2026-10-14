-- =============================================================================
-- 0062 — Frozen signed copies
--   * ro_documents: the PDF of an approval or of the final invoice, frozen the moment
--     it is signed (never regenerated), with its SHA-256; insert-only
--   * private bucket signed-docs (the server's admin client writes and reads it)
--   * signed_documents(p_estimate): the shop copies on one visit, for staff
--   * document_path_for(p_id): the stored path, for staff only (the download route)
-- Re-runnable.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signed-docs', 'signed-docs', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create table if not exists public.ro_documents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  estimate_id uuid references public.estimates (id) on delete set null,
  job_id      uuid references public.jobs (id) on delete set null,
  kind        text not null check (kind in ('estimate', 'supplement', 'invoice')),
  source_id   uuid not null,
  path        text not null,
  sha256      text not null,
  byte_size   integer not null check (byte_size > 0),
  created_at  timestamptz not null default now(),
  unique (company_id, kind, source_id)
);
create index if not exists ro_documents_estimate_idx on public.ro_documents (estimate_id);
create index if not exists ro_documents_job_idx on public.ro_documents (job_id);
alter table public.ro_documents enable row level security;
drop policy if exists ro_documents_select on public.ro_documents;
create policy ro_documents_select on public.ro_documents for select to authenticated using (company_id = public.current_company_id() and public.is_admin());
revoke all on public.ro_documents from authenticated, anon;
grant select on public.ro_documents to authenticated;

-- A frozen copy is never changed or removed
create or replace function public.tg_ro_documents_frozen() returns trigger language plpgsql as $$
begin
  raise exception 'A signed copy is frozen: it cannot be changed or removed' using errcode = 'P0001';
end $$;
drop trigger if exists ro_documents_frozen on public.ro_documents;
create trigger ro_documents_frozen before update or delete on public.ro_documents for each row execute function public.tg_ro_documents_frozen();

create or replace function public.signed_documents(p_estimate uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_admin() then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'created_at', d.created_at, 'sha256', d.sha256, 'byte_size', d.byte_size) order by d.created_at)
    from public.ro_documents d
    where d.company_id = public.current_company_id()
      and (d.estimate_id = p_estimate or d.job_id = (select e.job_id from public.estimates e where e.id = p_estimate and e.job_id is not null))
  ), '[]'::jsonb) end;
$$;
create or replace function public.document_path_for(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select d.path from public.ro_documents d where d.id = p_id and d.company_id = public.current_company_id() and public.is_admin();
$$;
revoke execute on function public.signed_documents(uuid), public.document_path_for(uuid) from public, anon;
grant execute on function public.signed_documents(uuid), public.document_path_for(uuid) to authenticated;
