# Local Audit — visibility & revenue-leak auditor

Admin pastes a business's website, Google Business Profile and Yelp links; a durable
job pulls every available data point; a rules + LLM engine turns it into a Client
Report (problems, evidence, $ ranges, no fixes) and an admin-only Solution Vault with
per-problem unlock. Spec: [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md). Decisions:
[`docs/DECISIONS.md`](docs/DECISIONS.md). Phase plans: [`docs/phases/`](docs/phases/).

**Status: Phase 0 (foundation) built.** Schema + RLS, admin auth, provider adapters
with mocks, Inngest job skeleton, cost meter, client-report shell, CI. No live calls
to any paid API yet.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · radix-ui · Supabase
(Postgres, Auth, Storage, RLS) · Inngest v4 · Anthropic SDK · Vercel.

## Run it

Requirements: Node 22, pnpm 10, psql (for `db:test`/`db:push`).

```bash
cd apps/local-audit
pnpm install
cp .env.example .env.local          # fill in Supabase keys (below)
pnpm dev                            # http://localhost:3000 → /login
pnpm inngest:dev                    # optional: Inngest dev server, discovers /api/inngest
```

### Supabase

1. Create a project at <https://supabase.com/dashboard>. Copy the **Project URL**,
   **publishable key** and **service role key** into `.env.local`.
2. Apply the migrations: `SUPABASE_DB_URL='<session pooler connection string>' pnpm db:push`
   (idempotent; records applied files in `public.schema_migrations`). Or paste
   `supabase/migrations/*.sql` in order, then `supabase/seed.sql`, into the SQL editor.
3. Authentication → URL configuration: Site URL = your app URL; add
   `<app>/auth/callback` and `http://localhost:3000/auth/callback` to Redirect URLs.
4. Authentication → Users → **Add user** (email + password, auto-confirm). The first
   profile created becomes `admin`. Sign in at `/login`; you land on `/admin`.

### Environment variables

| Variable | Needed | Where |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | now | Supabase → Project Settings → API |
| `SUPABASE_DB_URL` | `db:push` only | Supabase → Project Settings → Database |
| `NEXT_PUBLIC_APP_URL` | now | your Vercel URL |
| `PROVIDER_MODE` | now | `mock` / `record` / `live` |
| `AUDIT_COST_BUDGET_USD` | now | default 5 |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | production | <https://app.inngest.com> (or the Vercel integration) |
| `ANTHROPIC_API_KEY` | optional | <https://platform.claude.com> |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_PAGESPEED_API_KEY` | Phases 1–2 | <https://console.cloud.google.com> |
| `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | Phases 4–6 | <https://app.dataforseo.com/register> |
| `YELP_API_KEY` | Phase 3 | <https://www.yelp.com/developers/v3/manage_app> |

`/admin/settings/providers` shows which of these are set (booleans only) and the
logged API cost per provider and per audit.

## Tests

```bash
pnpm lint
pnpm typecheck        # next typegen && tsc --noEmit
pnpm test             # vitest: provider core, Anthropic adapter, checks, scoring, revenue model, client report schema, Inngest function
pnpm db:test          # migrations + supabase/tests/01_access.sql on a local Postgres 16
pnpm build
```

`db:test` needs a Postgres reachable at `PGHOST/PGPORT/PGUSER` (defaults
127.0.0.1 / 54329 / postgres). Without Docker, start one from the system binaries:

```bash
PGD=/tmp/pg16-local-audit
sudo -u postgres /usr/lib/postgresql/16/bin/initdb -D $PGD -A trust -U postgres
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl -D $PGD -o '-p 54329 -k /tmp -c listen_addresses=127.0.0.1' -l $PGD/log start
pnpm db:test
```

`01_access.sql` is the access-control test the master plan requires: admin sees all
solutions; a client sees none; the anon role cannot read any table; the report RPC
returns only revealed solutions, never audit inputs, costs or storage paths; the
first user bootstraps as admin exactly once; every table has RLS enabled.

## Where things live

```
src/app/admin/…                  admin area (requireAdmin): audits list, settings/providers
src/app/r/[token]/page.tsx       client report shell, via get_client_report() only
src/app/api/inngest/route.ts     Inngest serve handler
src/proxy.ts                     session refresh + login gate (Next 16 middleware)
src/lib/auth.ts                  getSession(), requireAdmin()
src/lib/db/types.ts              Database types (hand-maintained)
src/lib/providers/core/          call pipeline: cache → mode → retry → validate → snapshot → cost
src/lib/providers/<name>/        anthropic (live), google-places, pagespeed, dataforseo, yelp, social, website (typed stubs)
src/lib/providers/__fixtures__/  synthetic fixtures for mock mode
src/lib/checks/                  check registry, categories, first check (conversion.phone_click_to_call)
src/lib/scoring/                 weights + score computation
src/lib/revenue/                 assumptions + loss model
src/lib/reports/client-report.ts strict schema for the report payload
src/inngest/                     client, events, audit-run function
supabase/migrations/             0001 schema · 0002 RPCs · 0003 RLS · 0004 storage
supabase/tests/                  local Supabase stub + 01_access.sql
docs/                            MASTER_PLAN, DECISIONS, phases/
```

## Deploy (Vercel)

Import the repo, Root Directory `apps/local-audit`, framework Next.js, install
`pnpm install`, build `pnpm build`. Set the environment variables above with
`PROVIDER_MODE=live`. Add the Inngest integration (sets the two keys and registers
`/api/inngest`). Add the production URL to Supabase redirect URLs.
