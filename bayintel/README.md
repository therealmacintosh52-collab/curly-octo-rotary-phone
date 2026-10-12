# BayIntel

Mobile-first repair-intelligence platform for independent shops, mobile mechanics and serious DIYers. Think Identifix Direct-Hit plus a lightweight ProDemand, built only on legally sourced data, with a retrieval-grounded AI diagnostic layer on top.

The product name is a placeholder: change `APP_NAME` in `lib/config.ts` (and `public/manifest.webmanifest`).

## Stack

- Next.js 16 (App Router, server actions, route handlers), React 19, TypeScript, Tailwind 4, shadcn-style primitives in `components/ui`
- Supabase: Postgres + Auth + Storage, row-level security on every table
- Anthropic SDK for the AI assistant (structured output, server-side only)
- Stripe Checkout, Billing Portal and webhooks for plans
- Dark mode by default, 48px tap targets, bottom tab bar, native selects, camera capture

## Setup

1. Create a Supabase project. In the SQL editor (or `supabase db push`) run, in order:
   `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_storage.sql`, then `supabase/seed.sql` (185 generic DTC definitions + 20 SAMPLE fixes).
2. Auth → URL configuration: add `https://your-domain/auth/callback` to the redirect allow-list. Enable email/password (magic links work out of the box).
3. Copy `.env.example` to `.env.local` and fill in Supabase, `ANTHROPIC_API_KEY`, and Stripe keys/prices.
4. `npm install && npm run dev`.
5. Make yourself an admin/moderator once: `update public.profiles set role = 'admin' where id = '<your auth user id>';` Admin is never assignable from signup metadata or the settings page.
6. Stripe: create two recurring prices (Pro Tech, Shop per-seat) and put their ids in `STRIPE_PRICE_PRO_TECH` / `STRIPE_PRICE_SHOP`. Point a webhook at `/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.*`. Optionally create a 100%-off, duration-once coupon and set `STRIPE_COUPON_FREE_MONTH` so contributor free months are redeemed at checkout.

Scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (VIN, NHTSA parsing, complaint grouping, estimate math, AI guardrails) |
| `npm run db:check` | Applies migrations + seed + a smoke test to a throwaway local Postgres (needs the Postgres 15+ binaries) |
| `npm run db:types` | Same, then regenerates `lib/database.types.ts` with the Supabase CLI |

## Build order (each step is a working increment)

1. Auth, VIN decode (typed or camera barcode scan), Year/Make/Model selector, garage, vehicle dashboard: specs, recalls, complaints grouped by component with a per-year trend chart
2. DTC lookup: definition, confirmed fixes ranked for the vehicle + code, NHTSA complaints matched to the code's system
3. Confirmed Fixes: structured submission, "This fixed it" / "Didn't fix it", ranking by net confirmations, reputation, edit history, reports, moderation queue
4. AI diagnostic assistant: retrieval over our own database, ranked causes with confidence, cheapest-first test plan, citations, safety flags, hard guardrails
5. Estimates (lines, tax, PDF, customer share link) and repair orders (photos, notes, one-tap conversion to a Confirmed Fix)
6. Stripe tiers (Free / Pro Tech / Shop multi-seat) and contributor free months

## Architecture

```
app/                      routes (App Router)
  (auth)/login, signup    email/password + magic link
  (app)/garage, vehicles/[id], dtc, fixes, assistant, estimates, repair-orders, settings, more, admin/moderation
  api/vehicles/*          NHTSA calls (server-side only, cached)
  api/ai/diagnose         AI assistant endpoint (quota, retrieval, guardrails, persistence)
  api/stripe/*            checkout, portal, webhook
  share/estimate/[token]  public customer estimate
lib/providers/            provider adapter interfaces + NHTSA adapter + SAMPLE stubs
lib/ai/                   schema, retrieval, diagnosis runner, guardrails
lib/fixes, lib/dtc, lib/vehicles, lib/estimates   queries and pure helpers
supabase/migrations       schema, RLS, storage;  supabase/seed.sql
scripts/                  local Postgres validation harness
```

### Provider adapters

Every external source sits behind an interface in `lib/providers/types.ts` so licensed sources (MOTOR, CarMD, a labor guide) can be swapped in without UI changes. The registry is `lib/providers/index.ts`.

| Interface | Phase 1 implementation | Label |
| --- | --- | --- |
| `VehicleDataProvider` (decodeVin, getRecalls, getComplaints, getMakes, getModels) | NHTSA vPIC + recalls + complaints APIs | NHTSA |
| `LaborProvider` | `sampleLaborProvider` stub | SAMPLE |
| `RepairInfoProvider` (TSBs / procedures) | `sampleRepairInfoProvider` stub | SAMPLE |
| `MaintenanceProvider` | `sampleMaintenanceProvider` stub | SAMPLE |

All third-party calls run server-side and are cached in `provider_cache` (24h TTL for NHTSA, 7 days for make/model lists) through the service-role client. Without `SUPABASE_SERVICE_ROLE_KEY` the cache falls back to process memory.

NHTSA date formats: the recalls API returns `dd/mm/yyyy` and the complaints API `mm/dd/yyyy`; `lib/providers/nhtsa-parse.ts` parses each accordingly and swaps the order when a reading is impossible. This was implemented from documented samples, not against the live API (the build sandbox could not reach nhtsa.gov), so verify the first real responses.

### Data model

`vehicles, shops, profiles, dtc_codes, fixes, fix_dtcs, fix_parts, fix_confirmations, fix_media, repair_orders, estimates, estimate_lines, ai_sessions, ai_messages, provider_cache, moderation_queue, subscriptions` plus `fix_revisions` (edit history) and `repair_order_media`.

Key database logic (all in `0001_schema.sql`):

- `rank_fixes(make, model, year, engine, codes[])`: same make/model within ±3 model years, score = net confirmations × 10 + confirmations + exact-year and engine bonuses + matched-code bonus
- `search_fixes(query)`: weighted full-text search (title > symptoms/root cause > fix)
- Triggers maintain `confirm_count / deny_count / net_score`, contributor reputation (+2 per "fixed", −1 per "didn't fix", +1 per confirmation given, +1 per approved fix), block self-confirmation, snapshot each edit into `fix_revisions`, and queue every new community fix for moderation (authors with negative reputation are held as `pending`)
- A fix becomes **Verified** at 3 net confirmations and grants the author one free month (`profiles.free_months_earned`), redeemed at Stripe checkout
- `consume_ai_query(limit)` enforces the monthly free-tier quota atomically
- SAMPLE fixes carry `seed_confirm_count / seed_deny_count` so their illustrative scores survive real votes

Roles: `diy`, `technician`, `shop_owner`, `admin` (admin = moderator). A shop subscription entitles every profile with that `shop_id`.

### AI assistant

`POST /api/ai/diagnose` → quota check → `lib/ai/retrieval.ts` gathers context docs (ranked fixes for the vehicle and codes, fixes for the codes on other vehicles, symptom search, DTC definitions, cached NHTSA recalls and system-matched complaints, provider stub articles) → `lib/ai/diagnose.ts` calls Claude with a strict system prompt and a Zod-enforced structured output (`claude-opus-5-5` by default, `AI_MODEL` to change; server-side refusal fallbacks enabled).

Hard rules are enforced twice: in the prompt, and in `lib/ai/guardrails.ts`, which scrubs torque specs, fluid capacities, pinouts, connector ids, gaps/clearances and pressure/voltage/resistance specs from the output, replacing them with "Not in database — verify in OEM service information." Citations are validated against the retrieved set (unknown ids are dropped), and safety systems (brakes, SRS, steering, EV high voltage, pressurized fuel) are flagged deterministically from the input and output in addition to the model's own flags. Every message is stored in `ai_sessions / ai_messages` with the citations used.

## Legal guardrails

- No scraping or reproduction of ALLDATA, Mitchell/ProDemand, Identifix or OEM service manual content. The fix form says so; the terms prohibit it; moderation enforces it.
- Users grant a license to the fixes they submit (`/terms` §2). All information is advisory and must be verified against OEM data (every page footer, the AI output, the estimate document).
- Every data point carries a source label through `SourceBadge`: NHTSA / Community-verified / Owner-reported / Licensed / Sample. Sample rows are never presented as real repair information and their part numbers are `SAMPLE-…` placeholders.
- The AI never generates torque specs, capacities, pinouts, connector ids or calibration values.

## What is deliberately not done yet

- Labor hours are entered manually; the `LaborProvider` lookup returns SAMPLE values until a licensed guide is connected.
- Shop invites: a shop owner currently assigns `profiles.shop_id` in the database.
- PDF export runs client-side (jsPDF); a server-rendered PDF for email delivery is a follow-up.
- The build sandbox could not reach NHTSA or Stripe, so the adapters were tested against recorded payload shapes and unit tests, not live calls.
