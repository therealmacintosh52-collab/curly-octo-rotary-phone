# T-916-P2 handoff: Phase 2 booking engine (agent -> orchestrator)

Branch `claude/916-dent-detail-build`. Not pushed. Nothing deployed, no accounts created, no spend, nobody contacted.

## Built
- **Schema** `916-dent-detail/supabase/migrations/0001_init.sql`: 29 tables for all phases (customers, vehicles, jobs, job_photos w/ marketing_consent, quotes, invoices, payments, notes, techs, tech_availability, blackout_dates, admin_blocks, weather_flags, bookings, services, memberships, referral_codes/credits, leads w/ source+UTM, conversations/messages, dealers, dealer_users, dealer_vehicles, dealer_statements, events, notification_queue, stripe_events). RLS on every table: owner/admin all, tech own bookings/jobs/photos, dealer own rows, customers via signed tokens (no direct access), anon reads active services only. `bookings_no_overlap` exclusion constraint prevents double booking. `supabase/seed.sql` + `src/lib/db/seed.ts`.
- **Data layer** `src/lib/db`: typed `repo()`; Supabase implementation and seeded in-memory mock (optional `MOCK_DB_FILE`), chosen by env.
- **Pure logic** (`src/lib/{pricing,geo,availability,booking}`): pricing/duration, ZIP table (61 ZIPs, all 14 cities) + radius travel fee (unknown ZIP -> needs_review), availability engine (per-tech calendars, travel buffers, blackout, admin blocks, weather hold, DST-safe), state machine, deposit/reschedule policy, HMAC tokens.
- **Quote** `src/lib/quote`: Anthropic vision `claude-sonnet-5-5`, `output_config` JSON schema, injection-resistant prompt, zod + clamp + sanitized notes, deterministic mock, dents need photos.
- **UI** `/book` 8 steps, `/booking/[token]` reschedule/cancel. **API** 9 routes. **Automations** queue + `/api/cron/dispatch` + `vercel.json`, templates, quiet hours, `sendOnTheWay`, `scheduleAfterCompletion`. Meta CAPI call for booking_completed (closes P-025 follow-up).
- Docs: README Phase 2 section, TODO Phase 2 [OWNER] list, DECISIONS P2-001..013, `.env.example` additions.

## Evidence (run at the end, on the final tree)
```
$ npx tsc --noEmit            -> (no output, exit 0)
$ npm run lint                -> eslint . (no output, exit 0)
$ npx vitest run              -> Test Files  9 passed (9) / Tests  155 passed (155)
$ npm run build               -> ✓ Compiled successfully; routes: /book, /booking/[token], /api/{availability,booking,booking/[token],cron/dispatch,geo/zip,lead,photos,quote,stripe/webhook}
$ node scripts/book-flow.mjs http://localhost:3105 .shots/book   (mock mode, 390x844 mobile)
  22 "ok:" checks ... "All checks passed"
```
Playwright covers: required-photo gate, unknown-ZIP block, real slot pick, SMS consent unchecked by default, back keeps state, DEMO deposit, confirmation, `track()` events booking_started/quote_requested/booking_completed, draft cleared, reschedule, cancel, Space toggles checkbox, axe (wcag2a/aa/21aa) with 0 serious/critical on all steps and manage page, no console errors. I viewed the screenshots (`916-dent-detail/.shots/book/`, git-ignored) and fixed: stepper clipping the current step (now auto-centred), scrollable stepper not focusable (axe), header/CTA bar covering focused controls (scroll-margin).
Bugs found by tests/run and fixed: log redaction hid error detail; production `next start` crashed in mock mode for lack of `BOOKING_TOKEN_SECRET`; test-clock mistakes only.

## NOT verified
- Any live service: Supabase (SQL never executed against Postgres; migration only reviewed by eye, RLS not tested), Stripe Payment Element + webhook signature, Twilio, Resend, Google Calendar, real Anthropic vision call (only mocked SDK in tests; no key available), Meta CAPI live.
- Desktop and tablet were only screenshot-checked at one step (desktop step 1); the full flow was walked on mobile only.
- Real-device behavior: iPhone HEIC, camera capture, Safari date/keyboard quirks.
- Screen-reader testing by a human (axe + keyboard only).
- Cross-instance rate limiting and the in-memory mock store do not work across serverless instances (by design, mock only).
- ZIP lat/lng are from memory, approximate (+/- 1-2 mi); verify before relying on fee boundaries.
- All prices, durations, deposit, policy windows and SMS wording are placeholders.

## Risks / decisions for you
1. Placeholder prices show an [OWNER] marker on /book; `check:owner` will fail until replaced (intended).
2. Late deposit on a lapsed hold is auto-refunded (P2-006): confirm that is the policy you want.
3. Vercel Hobby cannot run a 5-minute cron; reminders need Pro or an external scheduler.
4. A2P 10DLC registration is required before real texts reliably deliver; consent text needs counsel review. Privacy/terms pages do not exist yet.
5. Claude API skill recommends server-side `fallbacks` for Sonnet 5.5 refusals; I did not enable the beta (refusal returns "needs review", no price). Revisit with a live key.
6. Shared-file touches: none to layout/sitemap/nav. I appended to `.env.example`, README, TODO, DECISIONS (the `git add` of those files may include other agents' uncommitted edits to them). `/booking/` should be added to robots disallow by the Phase 6 owner (page is already `noindex`). I accidentally staged `src/lib/seo/*` once and corrected it before any push; `src/lib/analytics*` are Phase 6 files and untouched.
7. Added beyond the brief: `/api/photos`, `/api/lead`, `src/app/booking/[token]`, `src/lib/booking/capi.ts`, `src/lib/attribution.ts` (site-wide capture is not wired since I did not touch layout; BookingFlow calls `captureAttribution()` on /book only, so first-touch is only as early as the first /book visit. Phase 6 could call it from the consent/tracking loader).

## Commits (mine only)
schema; steps 1-2; step 3; steps 5-6; step 4 UI; step 7 docs/CAPI/e2e script.
