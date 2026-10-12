#!/usr/bin/env bash
# Applies the migrations + seed to a throwaway local Postgres (with minimal auth/storage shims)
# so schema errors surface before they reach Supabase. Requires the postgres 15+ binaries.
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
DATA=$(mktemp -d)
PORT=${PGPORT_CHECK:-55432}
if [ "$(id -u)" = "0" ]; then
  chown -R nobody "$DATA"; RUNAS="su nobody -s /bin/bash -c"
else
  RUNAS="bash -c"
fi
cleanup() { $RUNAS "'$PGBIN/pg_ctl' -D '$DATA' stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
$RUNAS "'$PGBIN/initdb' -D '$DATA' -A trust -U postgres >/dev/null"
$RUNAS "'$PGBIN/pg_ctl' -D '$DATA' -o '-p $PORT -k /tmp -c listen_addresses=' -l /tmp/bayintel-pg.log -w start >/dev/null"
export PGHOST=/tmp PGPORT=$PORT PGUSER=postgres
psql -v ON_ERROR_STOP=1 -q -c "create database bayintel_check"
export PGDATABASE=bayintel_check
psql -v ON_ERROR_STOP=1 -q -f scripts/supabase-shim.sql
for f in supabase/migrations/*.sql; do echo "== $f"; psql -v ON_ERROR_STOP=1 -q -f "$f"; done
echo "== supabase/seed.sql"; psql -v ON_ERROR_STOP=1 -q -f supabase/seed.sql
echo "== smoke"; psql -v ON_ERROR_STOP=1 -q -f scripts/db-smoke.sql
if [ "${GEN_TYPES:-0}" = "1" ]; then
  echo "== generating lib/database.types.ts"
  npx -y supabase@2 gen types typescript --db-url "postgresql://postgres@localhost:$PORT/$PGDATABASE?host=/tmp" --schema public > lib/database.types.ts
fi
echo "DB check passed"
