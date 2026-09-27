# Phase 0 — Foundation

Written 2026-09-27, before the build, per master plan §0 rule 1; the verification
log at the end was filled in after.

## Goal (master plan §6)

Repo, Next.js, Supabase, auth (admin role), env config, provider adapter pattern
with mocks, CI running tests. Done when `pnpm test` passes and an admin can log in.

The owner asked that every module of the pipeline (including social media,
backlinks, citations and brand mentions) be represented from the start, so Phase 0
also lays down the tables, adapters, check categories and job steps for all eleven
pipeline steps. Logic for each arrives in its own phase.

## Scope

| Area | Built in Phase 0 |
|---|---|
| Scaffold | `apps/local-audit`: Next 16.3.6, React 19.3, Tailwind v4, radix-ui, vitest 5, eslint 9, pnpm 10; conventions copied from `apps/cali-tints` |
| Data model | All §3 tables + `citations`, `social_profiles`, `backlink_metrics`, `brand_mentions`, `agency_settings`, `raw_snapshots.cache_key` (D-007); enums; indexes; triggers for `updated_at`, first-user-admin bootstrap, reveal guard, cost roll-up |
| Access control | RLS on every table; admin-only everywhere; `solutions` admin-only with no other policy; anon has zero table grants; `get_client_report(token)` RPC is the only anon path; `reveal_solution` / `reveal_audit_solutions` admin RPCs; `01_access.sql` |
| Auth | Supabase email/password; `/login`, `/auth/callback`, `/auth/reset`, `/no-access`; `requireAdmin()` on `/admin/*` |
| Providers | Core pipeline (cache → mode → configured → retry → validate → snapshot → cost log); Anthropic adapter (live, `claude-opus-5`, `messages.create` + `messages.parse`); typed stubs + fixtures for Google Places, PageSpeed, DataForSEO (serp, labs, backlinks, ai optimization), Yelp, social, website; `providerStatus()`; `/admin/settings/providers` with the cost meter |
| Analysis scaffolds | Check registry with 16 categories and one real check; scoring weights + computation; revenue-loss model + defaults with sources |
| Jobs | Inngest v4 client, `audit/requested` event, `audit-run` function (mark running → collect placeholder → mark finished, `onFailure` marks failed), `/api/inngest` |
| Views | `/admin` audits list, `/admin/settings/providers`, `/r/[token]` report shell with a strict payload schema |
| CI | `.github/workflows/local-audit-ci.yml`: lint → typegen+tsc → vitest → SQL tests on postgres:16 → build |

## Decisions needed / made

All recorded in `docs/DECISIONS.md` (D-001…D-011). Two the owner should note:

- **D-007** adds five tables and one column beyond the master plan's data model.
- **D-003** keeps logged-in `client` accounts blind until an audit→user link exists;
  clients use share links for now.

## Env vars and accounts to create

| Variable | Phase | Where to get it | Sign up |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | 0 | Project Settings → API | <https://supabase.com/dashboard/sign-up> |
| `SUPABASE_DB_URL` | 0 (`db:push` only) | Project Settings → Database → Connection string (session pooler) | same |
| `NEXT_PUBLIC_APP_URL` | 0 | Vercel project URL (Root Directory `apps/local-audit`) | <https://vercel.com/signup> |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | 0 (production) | Inngest app → Keys, or the Vercel integration | <https://app.inngest.com/sign-up> |
| `ANTHROPIC_API_KEY` | 0 (optional; mock mode without it) | Console → API keys | <https://platform.claude.com/> |
| `GOOGLE_PLACES_API_KEY` | 1 | Google Cloud → enable Places API (New) → Credentials | <https://console.cloud.google.com/> |
| `GOOGLE_PAGESPEED_API_KEY` | 2 | same project → enable PageSpeed Insights API | same |
| `YELP_API_KEY` | 3 | Yelp Fusion / Places → Manage App (check the commercial licence) | <https://www.yelp.com/developers/v3/manage_app> |
| `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | 4–6 | Dashboard → API Access | <https://app.dataforseo.com/register> |
| `PROVIDER_MODE` | 0 | `mock` (tests, first run) · `record` (dev) · `live` (prod) | — |
| `AUDIT_COST_BUDGET_USD` | 0 | default 5.00 | — |

No paid API is called in Phase 0. Adding one later is a per-phase ask (rule 6).

## Verification log (2026-09-27, in the build container)

| Step | Result |
|---|---|
| `pnpm install` | ok, lockfile committed |
| `pnpm lint` | 0 problems |
| `pnpm typecheck` (`next typegen && tsc --noEmit`) | 0 errors |
| `pnpm test` (vitest) | 10 files, 61 tests passed: provider core (cache key, retry, pipeline), Anthropic adapter (cost math, refusal/truncation mapping, 429 retry, parse path, fixture validation), stub adapters + status, checks registry + first check, scoring, revenue model, client-report schema + loader, Inngest function via `@inngest/test` |
| `pnpm db:test` on local Postgres 16 | migrations 0001–0004 + seed applied; `01_access.sql` passed (roles, bootstrap-once, admin/client/anon matrix, RPC projection and leak sentinels, cost roll-up, RLS-on-every-table, storage) |
| `pnpm build` (placeholder public Supabase env, `PROVIDER_MODE=mock`) | ok: 10 routes (`/`, `/admin`, `/admin/settings/providers`, `/api/inngest`, `/auth/callback`, `/auth/reset`, `/login`, `/no-access`, `/r/[token]`, `/_not-found`) + proxy |

## Left to the owner (not possible from the build container: Supabase, Inngest and Vercel hosts are blocked by the environment's network policy)

1. Create the Supabase project; paste the three keys into `.env.local` / Vercel.
2. `SUPABASE_DB_URL=… pnpm db:push` (4 migrations + seed).
3. Supabase → Authentication → Users → Add user. The first profile becomes admin.
4. `pnpm dev` → `/login` → `/admin` → `/admin/settings/providers`. That is the
   "admin can log in" exit criterion.
5. Create the Vercel project (Root Directory `apps/local-audit`) and the Inngest app.

## Exit criteria

- [x] `pnpm test` green locally and in CI
- [x] `pnpm db:test` green locally and in CI
- [ ] Admin login on a real Supabase project (owner step 4 above)
