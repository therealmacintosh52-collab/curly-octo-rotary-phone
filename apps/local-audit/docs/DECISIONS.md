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

## D-012 · 2026-09-28 · Phase 1 turns on the first paid calls
With the owner's go-ahead for Phase 1: Google Places API (New) Text Search and Place Details (Pro field masks, no reviews/photos yet) and Yelp Fusion business details are live behind their keys. Cost per call is logged from a table in each adapter (`PLACES_COST_USD`, `YELP_COST_USD`, all `verified: false` with the pricing URL and date) until an invoice confirms the numbers. Text Search already returns the Pro fields, so Place Details is only called when a link carried a place id; that halves the Google cost of a typical resolve. PageSpeed, DataForSEO and the social adapter stay stubs.

## D-013 · 2026-09-28 · Plain-fetch website reads in Phase 1
The website adapter now fetches for real: manual redirect following (chain recorded, https preferred, http fallback only when TLS refuses the connection), identified `LocalAuditBot` user agent, `robots.txt` honored with longest-match semantics, 403/429/503 reported as `blocked` and never retried around, body capped at 2 MB. Phase 1 reads only the home page and a linked contact page to extract NAP; the Playwright crawler in Phase 2 will replace `fetchPage` behind the same signature.

## D-014 · 2026-09-28 · How a Google match is trusted
A Maps link never identifies a business on its own (feature ids and cids are not accepted by the Places API), so every GBP input ends in Text Search. Candidates are scored: exact normalized name +3 (containment +2), pin within 150 m of the link's coordinates +3 (within 1 km +1), website host equals the canonical domain +3, phone equals the website's +2, place id match +10. A candidate is trusted at 3 when nothing else is known and at 4 when a website or coordinates are on file. Anything below is `identity_nap.gbp_not_found`, a critical finding, with the best candidate and its score in the resolution log. Rejected alternative: taking Google's first result, which silently audits the wrong business.

## D-015 · 2026-09-28 · Where the resolution summary lives
No column was added. Per-source facts and UNAVAILABLE outcomes are `evidence` rows with a JSON excerpt (`source`, `name`, `phone`, `address`, …), which is what the master plan asks for anyway (every fact traceable to evidence). The check-run summary (passed, unavailable, assessed categories, resolution digest) is stored under `audits.scores.checks`; `scores` will also hold the category scores from Phase 7. Adding an `audits.resolution` column stays an option if the JSON in `scores` gets crowded.

## D-016 · 2026-09-28 · The crawler parses static HTML with cheerio; Playwright rendering is opt-in and deferred
Phase 2 crawls with plain fetches through the website provider and parses with cheerio (`src/lib/crawl/page-analysis.ts`). Reasons: every page lands in `raw_snapshots` as evidence for free, the crawl runs inside a Vercel function and the Inngest step budget, and the deterministic checks need the HTML Google's first pass sees anyway. Rendering the home page with Playwright (screenshots, JavaScript-dependent-content detection, `CRAWLER_RENDERER=playwright`) stays in the plan but needs a worker that can run Chromium (Fly/Railway container or a Browserless-style service). That is a hosting decision with a monthly cost, so it is D-017 and waits for the owner. Until then `technical_seo.js_dependent_content` returns `unavailable` and no screenshot evidence is stored.

## D-017 · 2026-09-28 · Open: where the browser runs
Options for the rendered crawl and screenshots: (a) a small always-on container running Playwright behind the Inngest worker, (b) a hosted browser API (Browserless, Browserbase) called from the Vercel function, (c) skip rendering and rely on PageSpeed's Lighthouse screenshots (`final-screenshot` audit, thumbnail quality only). Recommendation: (b) for the first paying audits, (a) once volume justifies it. Not decided; nothing in Phase 2 depends on it.

## D-018 · 2026-09-28 · PageSpeed Insights needs a key
The keyless PageSpeed endpoint shares a global quota and answered 429 on every attempt from the build container (2026-09-28). `GOOGLE_PAGESPEED_API_KEY` is required; the API is free within Google's per-project quota (25,000 queries/day at the time of writing). With no key the adapter reports `UNAVAILABLE not_configured`, the six PSI-driven checks return `unavailable`, and the audit page shows the gap rather than a number.

## D-019 · 2026-09-28 · Check severity policy and headlines
Every website check declares a fixed severity and 0–100 impact (`src/lib/checks/website/*.ts`); a check may lower or raise its own severity from the measured value (an oversized-image finding is `high` above 1.5 MB total, `medium` below). Checks that cannot judge (no PageSpeed data, no images, no service pages) return `unavailable` and never a pass, so the pass list is honest. A check has two headlines: `title` says what is verified and appears in the pass list; `problem` states the failure and becomes the finding's title. Informational items (chat widget, llms.txt, blog) are `low` with impact ≤ 25 so the scores are driven by what costs money. The 100 − penalty scoring saturates at 0 for a site with twenty technical findings; that is accepted until Phase 7 re-tunes the weights with real audits.

## D-020 · 2026-09-28 · `audits.scores` holds step summaries and scores
`mergeScores()` merges keys into `audits.scores`: `checks` (Phase 1 run), `crawl` (crawl summary, page list), `pagespeed` (mobile/desktop summaries or the UNAVAILABLE reason), `checks_website` (passed/unavailable/assessed), `categories`, `visibility`, `conversion`, `assessed`. The admin page parses it with a tolerant zod schema so older audits still render. If this grows past a few kilobytes per audit it moves to a `audit_summaries` table (data-model change, owner approval).
