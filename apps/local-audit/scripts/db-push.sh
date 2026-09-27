#!/usr/bin/env bash
# Apply the migrations that are missing from a Postgres database (Supabase).
#
#   SUPABASE_DB_URL=postgres://... pnpm db:push            # apply what is missing
#   SUPABASE_DB_URL=postgres://... pnpm db:push --dry-run  # only list what would run
#
# Safe to repeat: applied files are recorded in public.schema_migrations.
# Each migration runs in its own transaction; the script stops on the first error.
# Requires psql. The connection string is never printed.
set -euo pipefail
cd "$(dirname "$0")/../supabase"

URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [[ -z "$URL" ]]; then
  echo "db-push: set SUPABASE_DB_URL (Supabase → Project Settings → Database → Connection string, session pooler)." >&2
  exit 2
fi
DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1
# "already exists, skipping" notices are expected; only show real warnings.
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

q() { psql "$URL" -X -v ON_ERROR_STOP=1 -qAt -c "$1"; }

q "create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());" >/dev/null

# Bootstrap: a database that was migrated before this table existed. Probe one
# object per migration so nothing is applied twice.
if [[ "$(q "select count(*) from public.schema_migrations")" == "0" ]]; then
  q "
  with present(name, ok) as (values
    ('0001_schema.sql',    to_regclass('public.audits') is not null),
    ('0002_functions.sql', to_regprocedure('public.get_client_report(text)') is not null),
    ('0003_rls.sql',       exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'solutions')),
    ('0004_storage.sql',   to_regclass('storage.buckets') is not null and exists (select 1 from storage.buckets where id = 'screenshots'))
  )
  insert into public.schema_migrations (name) select name from present where ok on conflict do nothing;" >/dev/null
  n="$(q "select count(*) from public.schema_migrations")"
  [[ "$n" != "0" ]] && echo "db-push: existing database, $n migration(s) detected as already applied"
fi

applied=0
for f in migrations/*.sql; do
  name="$(basename "$f")"
  if [[ "$(q "select 1 from public.schema_migrations where name = '$name'")" == "1" ]]; then
    echo "  skip     $name"
    continue
  fi
  if [[ $DRY == 1 ]]; then
    echo "  pending  $name"
    continue
  fi
  psql "$URL" -X -v ON_ERROR_STOP=1 -q --single-transaction -f "$f" >/dev/null
  q "insert into public.schema_migrations (name) values ('$name')" >/dev/null
  echo "  applied  $name"
  applied=$((applied + 1))
done

if [[ $DRY == 1 ]]; then echo "db-push: dry run, nothing changed."; else echo "db-push: $applied migration(s) applied."; fi
