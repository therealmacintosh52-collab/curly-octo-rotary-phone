#!/usr/bin/env bash
# Applies the migrations to a throwaway database on a local Postgres and runs
# the SQL test files. Usage:
#   PGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres supabase/tests/run.sh
# Requires psql. Uses the stub in tests/local/ instead of a real Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-54329}"
export PGUSER="${PGUSER:-postgres}"
DB="${TEST_DB:-cali_tints_test}"

psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"

run() { psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1" >/dev/null && echo "  ok  $1"; }

echo "Stub + migrations"
run tests/local/00_stub_supabase.sql
for f in migrations/*.sql; do run "$f"; done
run seed.sql

echo "Tests"
for f in tests/[0-9]*.sql; do run "$f"; done
echo "All SQL tests passed."
