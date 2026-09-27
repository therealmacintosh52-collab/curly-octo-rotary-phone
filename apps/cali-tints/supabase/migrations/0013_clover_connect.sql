-- =============================================================================
-- 0013 — Sign in with Clover (OAuth) + connection health
--   * clover_connections: one row per company with the OAuth tokens
--     (encrypted by the app before they get here), the merchant name, the
--     card-entry public key fetched from Clover, and health fields.
--     NO policies and NO grants to authenticated: only the service role
--     (server code) can read or write it. Never audited (tokens).
--   * companies: connected_at / merchant_name so the UI can show the state
--     without touching the secrets.
-- Re-runnable: every statement is guarded.
-- =============================================================================

create table if not exists public.clover_connections (
  company_id          uuid primary key references public.companies (id) on delete cascade,
  env                 text not null check (env in ('sandbox', 'production')),
  merchant_id         text not null,
  merchant_name       text,
  access_token_enc    text not null,
  refresh_token_enc   text,
  access_expires_at   timestamptz,
  refresh_expires_at  timestamptz,
  pakms_key           text,
  status              text not null default 'ok' check (status in ('ok', 'needs_reconnect')),
  last_ok_at          timestamptz,
  last_error          text,
  connected_by        uuid references public.profiles (id),
  connected_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.clover_connections enable row level security;
revoke all on public.clover_connections from authenticated, anon;
grant select, insert, update, delete on public.clover_connections to service_role;

alter table public.companies
  add column if not exists clover_connected_at  timestamptz,
  add column if not exists clover_merchant_name text;
