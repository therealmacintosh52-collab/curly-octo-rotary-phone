# Decisions

Running log. One entry per decision that a future reader might want to revisit.
Format: id, date, decision, why, what it rules out.

## D-001 · 2026-09-27 · Location and name
Built at `apps/local-audit` in the existing monorepo (own `pnpm-lock.yaml`, no root workspace), not in a fresh repository. The sibling `apps/cali-tints` already proved the toolchain (pnpm 10, Next 16.3.6, React 19.3, Tailwind v4, radix-ui, vitest 5, eslint 9 flat config, SQL tests on plain Postgres, GitHub Actions with a postgres:16 service), so the scaffold copies its conventions instead of re-deciding them. Confirmed with the owner.

## D-002 · 2026-09-27 · Inngest for background jobs
Inngest (v4 API) over Trigger.dev. Vercel-native, `step.run` checkpoints fit the "each step checkpointed + progress reported" requirement, free dev server. v4 notes: `createFunction({ id, triggers: [{ event }], ... }, handler)`, `serve` from `inngest/next`; `EventSchemas` no longer exists, so events are validated with zod inside the function. Playwright steps will run in a separate worker when Phase 2 needs them.

## D-003 · 2026-09-27 · Single-tenant roles
`profiles.role in ('admin', 'client')`, no companies/tenants table. The first user created when `profiles` is empty becomes `admin`; the bootstrap fires exactly once (tested). `client` accounts see only their own profile row until a later phase adds an `audits.client_user_id` link (data-model change → ask first). White-label multi-agency is Phase 10+.

## D-004 · 2026-09-27 · Claude via the official SDK
`@anthropic-ai/sdk`, model `claude-opus-5`, `messages.create` for text and `messages.parse` + `zodOutputFormat` for structured JSON. No `thinking` parameter (adaptive is the default on this model); `output_config.effort` exposed. The SDK client runs with `maxRetries: 0` so the provider core is the single owner of retries and logging. Cost is computed from `response.usage` with a pricing table (input $5/MTok, output $25/MTok, cache write 1.25×, cache read 0.1×) marked `verified: false` and dated; usage is stored with every snapshot so costs can be recomputed. Not yet: streaming for long outputs, server-side refusal fallbacks, prompt-cache breakpoints. They land with the analysis prompts in Phase 7.

## D-005 · 2026-09-27 · The UNAVAILABLE contract
Adapters never throw for availability problems and never return invented values. Every call returns `{ ok: true, data, meta }` or `{ ok: false, kind: "UNAVAILABLE", reason, message, retryable, meta }` with reasons `not_configured | no_fixture | timeout | network | rate_limited | http_error | parse_failed | refusal | truncated | not_implemented`. The scoring engine will treat UNAVAILABLE as "not assessed", never as a value. Only programmer errors propagate.

## D-006 · 2026-09-27 · Anonymous access is one RPC
Share-link viewers reach the audit only through `public.get_client_report(token)`: security definer, explicit column projection, `is_revealed = true` filter in exactly one place, view counting as a side effect. The `anon` role has no table grants and no policies at all; `solutions` additionally has no policy for anyone but admins. Rejected alternative: RLS keyed on a request header holding the token — one mistaken `using (true)` on any of six tables leaks the vault, and it cannot bump view counts. `01_access.sql` and `client-report.test.ts` are the two halves of the leak test.

## D-007 · 2026-09-27 · Additions to the master-plan data model
Added beyond §3, with the owner's approval through the Phase 0 plan: `citations`, `social_profiles`, `backlink_metrics`, `brand_mentions` (steps 5 and 8 need real tables, not blobs), `agency_settings` (white-label, single row), and `raw_snapshots.cache_key` (indexed; the adapter cache lookup needs a column to match on). No table from §3 was renamed or dropped.

## D-008 · 2026-09-27 · `typecheck = next typegen && tsc --noEmit`
Next 16 generates the global `PageProps` / `LayoutProps` / `RouteContext` types into `.next/types` at build time. Running `tsc` first fails with 20+ "Cannot find name" errors, which is exactly what has kept the sibling app's CI red. Typegen first, then tsc.

## D-009 · 2026-09-27 · Provider modes and fixtures
`PROVIDER_MODE = mock | record | live`. Tests and vitest default to `mock`; everything else defaults to `live`; `record` is refused in production. Fixtures under `src/lib/providers/__fixtures__/<provider>/` are synthetic and say so in a `note` field; a fixture written by record mode carries `recorded_at`. A missing fixture in mock mode is `UNAVAILABLE no_fixture`, never a made-up response.

## D-010 · 2026-09-27 · Docs live with the app; CLAUDE.md is standalone
`apps/local-audit/docs/` holds MASTER_PLAN, DECISIONS and the phase plans, because the repository hosts other projects. `CLAUDE.md` does not `@include AGENTS.md`: `next dev` rewrites `AGENTS.md` on every start, and the working agreement must not depend on that.

## D-011 · 2026-09-27 · Scoring and revenue scaffolds
Category score = 100 − severity penalties (critical 40, high 20, medium 10, low 4), floored at 0; headline Visibility and Conversion scores are weighted means over assessed categories only, weights in `src/lib/scoring/config.ts`. The revenue model implements §4 step 10 verbatim with low/mid/high ranges and an ad-equivalent value; defaults live in `src/lib/revenue/defaults.ts` with source URLs and `verified: false` until someone re-checks them. Both are pinned by unit tests and will be tuned, not restructured, in Phase 7.
