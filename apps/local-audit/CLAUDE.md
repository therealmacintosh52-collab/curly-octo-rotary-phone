# Local Audit — working agreement for agents

Read `docs/MASTER_PLAN.md` first. It is the product spec. `docs/DECISIONS.md` is the
log of choices already made; do not re-decide them silently. Phase plans live in
`docs/phases/`.

## Rules (from the master plan §0)

1. **Plan before code.** Each phase starts with `docs/phases/phase-N.md`, then the build.
2. **Never invent data.** Every finding links to evidence (API response, crawled page,
   screenshot, timestamp). A data point that cannot be fetched is `UNAVAILABLE` with a
   reason. No plausible fill-ins, ever.
3. **Every external call goes through `src/lib/providers/*`** (retry + backoff, timeout,
   USD cost logging, raw-response caching in `raw_snapshots`, mock mode for tests).
4. **Tests are required** for the scoring engine, the revenue model and access control.
   Solutions must never leak to client views: `supabase/tests/01_access.sql` and
   `src/lib/reports/client-report.test.ts` guard it; keep both green.
5. **Commit at the end of each phase** with a summary; append to `docs/DECISIONS.md`.
6. **Ask before**: adding a paid API, changing the data model, or anything that changes
   what clients can see.

## Repo facts

- Package manager pnpm 10; Node 22. Scripts: `dev`, `build`, `lint`, `typecheck`
  (`next typegen && tsc --noEmit` — typegen must run first on Next 16), `test` (vitest),
  `db:test` (migrations + SQL tests on a local Postgres), `db:push` (apply migrations to
  Supabase with `SUPABASE_DB_URL`), `inngest:dev`.
- Next 16 App Router: `src/proxy.ts` is the middleware (not `middleware.ts`); page props
  use the generated `PageProps<"/route">` / `LayoutProps<"/route">` globals. Read
  `node_modules/next/dist/docs/` when an API looks unfamiliar; `next dev` regenerates
  `AGENTS.md`, which is why this file does not include it.
- Supabase: `src/lib/supabase/{server,client,admin}.ts`; hand-written `Database` types in
  `src/lib/db/types.ts` (update them with every migration). Auth gate: `src/lib/auth.ts`
  (`requireAdmin()`), applied in `src/app/admin/layout.tsx`.
- Anonymous report access is only `public.get_client_report(token)`. Never add an anon
  policy to any table, and never a non-admin policy to `solutions`.
- Providers: `src/lib/providers/core` is the pipeline; adapters return
  `ProviderResult<T>`; `PROVIDER_MODE=mock|record|live`; fixtures are synthetic and
  labeled. `providerStatus()` exposes booleans only, never values.
- Jobs: `src/inngest/functions/audit-run.ts` (Inngest v4: `triggers: [...]`), served at
  `/api/inngest`.
- Resolver: `src/lib/resolve` (inputs → entity → NAP comparison); persisted by
  `src/lib/audits/resolve-step.ts` through the `AuditRepo` interface (memory impl for tests).
- Checks: `src/lib/checks` (register under a category prefix; `runChecks()` turns outcomes
  into finding drafts); scoring weights in
  `src/lib/scoring/config.ts`; revenue defaults in `src/lib/revenue/defaults.ts`.

## Before you push

`pnpm lint && pnpm typecheck && pnpm test`, then `pnpm db:test` against a local
Postgres 16 (see README), then `pnpm build` with the placeholder public Supabase env.
CI (`.github/workflows/local-audit-ci.yml`) runs the same sequence.
