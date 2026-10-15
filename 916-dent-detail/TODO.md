# TODO — 916 Dent & Detail

`npm run check:owner` lists every placeholder still in code (41 lines at end of Phase 1).

## [OWNER] items: business facts (blockers for launch)
- [ ] Real business phone → `src/config/site.ts` `phone` (now the fictional (916) 555-0100), set `placeholder: false`
- [ ] Real inbox → `site.email` (now hello@example.com)
- [ ] Hours for Mon–Fri / Sat / Sun → `site.hours`
- [ ] Production domain → `NEXT_PUBLIC_SITE_URL` (canonical + OG URLs)
- [ ] Google review link (g.page/r/…) → `site.googleReviewUrl`
- [ ] Social profile URLs (Instagram, Facebook, TikTok, YouTube, Google) → `site.social`
- [ ] Legal business name if it differs from "916 Dent & Detail"

## [OWNER] items: prices and offers (never hardcoded; all in `src/config/pricing.ts`)
- [ ] "From" price per service (6) → `serviceFromPrice`
- [ ] Membership prices (Maintain / Protect / Showroom) → `memberships[].priceMonthly`
- [ ] Confirm or rewrite what each membership tier includes (current lists are proposals)
- [ ] Dealer per-panel wholesale price sheet (shown as a marker on /dealers)

## [OWNER] items: proof and claims to confirm
- [ ] 3 real customer reviews (with permission) for Reviews section and /reviews; NO invented reviews, no star ratings
- [ ] Real before/after job photos, 3 pairs (dent, swirls, interior) → replace `PanelArt` placeholders
- [ ] `[OWNER: confirm reclaim equipment & permits]`: eco section says low-water methods, runoff captured, kept out of storm drains, "the way Sacramento-area stormwater rules intend". Confirm each is true or tell us what to soften
- [ ] Confirm "COI on request" (certificate of insurance) for dealers
- [ ] Confirm "same-day on-lot" for dealers
- [ ] Confirm we will photograph hail damage / give an estimate to support insurance claims (Hail Fix card + FAQ)
- [ ] Confirm the 14-city service list (Sacramento, Elk Grove, Roseville, Folsom, Rancho Cordova, Citrus Heights, Natomas, West Sacramento, Davis, Carmichael, Granite Bay, El Dorado Hills, Lincoln, Rocklin)

## [OWNER] media (see handoff assessment for detail)
- [ ] Optional: a horizontal (16:9) version of the hero video for desktop (`brand/hero-video-wide.mp4`); the pipeline picks it up next phase
- [ ] Optional: higher-resolution source (1080w+) of the vertical video; the 720w frames are soft on large retina panels
- [ ] Optional: a re-render of the dent-pop moment (frames ~24-44 of the source show a white chip and a ghost ring)
- [ ] Optional: a flat/vector version of the D-mark (favicons at 16/32 px are limited by the 3D bevel source)

## Engineering follow-ups (Phase 1 leftovers)
- [ ] Mobile Lighthouse LCP median 2.6 s (simulated) vs target 2.5 s: options in handoff (variable Inter, HTTP/2 host, drop Inter 600)
- [ ] INP not measured (needs field data or a scripted interaction trace)
- [ ] Mobile frame set is 12.1 MB total; consider 540w q70 (~5.8 MB) if field data shows heavy users on cellular
- [x] Wire `track()` to GA4/Meta/Ads (Phase 6 done; needs the IDs below)

## Remaining phases (SPEC.md)
- [x] Phase 2: booking engine (/book): services → vehicle → photos → ZIP/travel fee from 95624 → availability → contact → Stripe deposit → confirmation; AI photo quote range; SMS/email automations. Built locally in mock mode; see the Phase 2 section below
- [x] Phase 3: CRM + /admin (Supabase, RLS), pipeline, tech view, memberships via Stripe, referrals, reports. Built locally in mock mode; see the Phase 3 section below
- [x] Phase 4: 916 Concierge assistant (site chat + Twilio SMS), tools, guardrails, missed-call text-back (built and tested in mock mode; live model behaviour NOT verified, see below)
- [x] Phase 5: dealer portal (/dealers accounts, bulk VIN submission, statements, net terms, leave-behind PDF). Built locally in mock mode; see the Phase 5 section below
- [x] Phase 6: SEO + local (9 service pages, 14 city pages, JSON-LD, sitemap/robots, MDX blog, tracking). Built locally; see the Phase 6 section below for owner items
- [ ] Phase 7: growth pack (/marketing markdown)
- [ ] Phase 8: tests, Lighthouse CI, axe, bot scenarios, seed data, setup README, deploy script

## Phase 6 (SEO + local): [OWNER] items
- [ ] Set `NEXT_PUBLIC_SITE_URL` before the production build (canonicals, sitemap, schema, RSS all derive from it)
- [ ] Tracking IDs: `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GADS_ID` (or `_GOOGLE_ADS_ID`) + `_LABEL_QUOTE/_BOOKING/_CALL`, `META_CAPI_ACCESS_TOKEN`. Banner and scripts stay off until one is set
- [ ] Privacy policy page + `NEXT_PUBLIC_PRIVACY_URL` (consent banner links to it). Have counsel review the banner wording and the CCPA/CPRA posture
- [x] Phase 2: `sendCapiEvent` is now called from `/api/booking/[token]` (action `capi`) with the browser `event_id`, gated on marketing consent (src/lib/booking/capi.ts)
- [ ] Confirm public statements on service pages: low-water methods / wash water kept out of storm drains; COI available on request; "we work in your garage/driveway"; no warranty claims were written
- [ ] Confirm we are happy to say Elk Grove is nearest our base (derived from base ZIP 95624) and that city pages print "We start from ZIP 95624" (src/lib/seo/travel.ts)
- [ ] Per-city `distance` bands (near/mid/far) and drive notes in `src/content/seo/cities/*.ts` are qualitative guesses; adjust to real drive times/travel tiers
- [ ] Sourced but dated, re-check before publishing: 2018 hail accumulation (up to 3 in), 2023-03-11 NWS warning (south/east of city), CBS hail report in Roseville/Citrus Heights/Natomas (year not seen), Natomas carport collapse, 2024 record triple-digit days, Intel layoffs 2025, Rocklin 2017 employer list, Sacramento stormwater commercial car-wash sheet
- [ ] Add real job photos to service pages (none used; no alt-text images yet)

### [OWNER] map-check before publishing (unsourced local items named on city pages; verify each exists/is described correctly)
- Sacramento: Midtown and East Sacramento street parking; Arden Fair; Auburn Boulevard dealer strip; tree-lined streets / shade
- Elk Grove: Old Town Elk Grove; Highway 99 commuter route
- Roseville: Blue Oaks Boulevard retail; Kaiser and Sutter hospitals as large employers
- Folsom: Folsom Lake; Historic Sutter Street; tech-campus commuter framing
- Rancho Cordova: Sunrise Boulevard corridor; Mather area; Cordova Town Center; Highway 50 position
- Citrus Heights: Sunrise Mall area; Greenback Lane; Auburn Boulevard; "older cars" framing
- Natomas: Natomas Marketplace; airport adjacency; I-5 / I-80; "newer subdivisions" framing
- West Sacramento: Raley Field; Port of West Sacramento; I-80 / Hwy 50; fleet/warehouse framing
- Davis: UC Davis; downtown; Mace Boulevard; cycling culture; Hanlees named only as a Chiles Road landmark
- Carmichael: Fair Oaks Boulevard; American River; mature trees / older neighborhoods; steep or narrow driveways
- Granite Bay: Folsom Lake; Douglas Boulevard; Eureka Road; higher-value car framing; garage size
- El Dorado Hills: Town Center; Highway 50; Serrano; hillside / gated-community framing
- Lincoln: Highway 65; Lincoln Crossing; Twelve Bridges; truck/SUV framing
- Rocklin: Quarry Park; Blue Oaks / Hwy 65; Sunset Boulevard; school-lot framing
- Auto malls named on dealer/city pages are public landmarks only (Roseville Automall on Automall Dr, Folsom auto mall off Hwy 50, Elk Grove Auto Mall, Automall Parkway in Rancho Cordova, Hanlees on Chiles Rd); no customer relationship is claimed

## Phase 2 (booking engine): [OWNER] items and follow-ups
Everything runs with zero keys (mock mode). Items below turn it into the real thing.
- [ ] Real prices: `src/config/pricing.ts` (`fixedPrices`, `dentPricing`, `addonPrices`, `depositAmount`, `travelFees`, `detailSpread`), then set `PRICES_ARE_PLACEHOLDERS = false`. Every number there is a placeholder; the UI shows an [OWNER] demo-pricing marker until you do
- [ ] Real durations by service and vehicle size: `src/config/booking.ts` (`durations`, `dentMinutes`, `multiServiceSavingsMin`, add-on minutes)
- [ ] Deposit and change policy windows (48h refund / 24h credit / under 24h kept, reschedule free 24h, closed inside 4h, max 2): `depositPolicy` in `src/config/booking.ts`. Have counsel check the wording before launch
- [ ] Tech names, real weekly hours (Supabase `tech_availability`; the mock store uses `bookingConfig.defaultWeekly`), blackout dates, admin blocks
- [ ] Travel radius: free radius, fee tiers and max service distance in `travelFees`; ZIP centroids in `src/lib/geo/zips.ts` are approximate (+/- 1-2 mi). Add ZIPs you serve that are missing (unknown ZIPs go to human review by design)
- [ ] Supabase: create project, run `supabase/migrations/0001_init.sql` then `supabase/seed.sql`, create PRIVATE storage bucket (`SUPABASE_PHOTOS_BUCKET`), create owner login + `profiles` row with role `owner`
- [ ] Set `BOOKING_TOKEN_SECRET` (random 32+ chars) and `CRON_SECRET`
- [ ] Stripe: keys + webhook endpoint `/api/stripe/webhook` (event `payment_intent.succeeded`); test with Stripe test mode before live
- [ ] Twilio: number or Messaging Service, A2P 10DLC brand + campaign registration (US carriers filter unregistered texting). Opt-in wording is `SMS_CONSENT_TEXT` in `src/config/booking.ts`; have counsel review it. Twilio handles STOP/HELP automatically for its numbers; also forward inbound STOP to `isStopKeyword` + set `customers.sms_opt_out_at` (Phase 4 inbound webhook)
- [ ] Resend: verify sending domain, set `EMAIL_FROM`
- [ ] Anthropic key for real photo quotes (model `claude-sonnet-5-5`). Without it the quote is a labelled DEMO rule-based range
- [ ] Vercel cron: `vercel.json` runs `/api/cron/dispatch` every 5 minutes. Hobby plans only allow daily crons: use Pro, or point an external scheduler at the URL with `Authorization: Bearer $CRON_SECRET`
- [ ] Google review link (`site.googleReviewUrl`) is used by the post-job message; the review line is omitted until it is set
- [ ] Optional: Google Calendar sync env keys (write-only sync); not verified against the live API
- [ ] Privacy policy and terms pages; the SMS consent text should link to them once they exist
- [ ] Upstash Redis env (`UPSTASH_REDIS_REST_URL/TOKEN`) so rate limits work across serverless instances (in-memory limiter is per instance)
- [ ] Phase 3 hooks ready: `sendOnTheWay(bookingId, {etaMinutes})`, `scheduleAfterCompletion(bookingId)` in `src/lib/notify`, and `transition()` in `src/lib/booking/state.ts`
- [ ] Add `/booking/` to robots disallow (page is `noindex` already; robots.ts belongs to Phase 6)

## Phase 4 (916 Concierge): [OWNER] items and follow-ups
Everything runs with zero keys. The items below make it real; the first one matters most.
- [ ] **Run the live scenarios and read real transcripts before launch.** `BOT_LIVE=1 ANTHROPIC_API_KEY=... npx vitest run tests/bot/scenarios.test.ts`, then chat with it yourself for an hour. Every bot test so far uses the offline mock policy, which proves the server-side enforcement, not live model behaviour.
- [ ] Add `ANTHROPIC_API_KEY`; watch `cacheRead` in `concierge.usage` events go non-zero from the second message on to confirm prompt caching; tune `CONCIERGE_MAX_COST_USD` (default $0.50 per conversation) from real cost.
- [ ] Set `OWNER_ALERT_PHONES` (E.164, comma separated). Without it escalations are only logged and visible in the inbox query.
- [ ] Run `supabase/migrations/0003_concierge.sql` (after 0001; adds conversation state/escalation columns, `leads.source` chat/sms, `customer_memory`, a unique index for webhook dedupe). Never executed against Postgres by the agent: review it, run it, then try one SMS and one web chat end to end.
- [ ] Twilio: follow "Twilio console wiring" in README (SMS webhook, optional voice webhook, `NEXT_PUBLIC_SITE_URL` or `TWILIO_WEBHOOK_BASE_URL`), keep Twilio opt-out handling on, A2P 10DLC registration. Test STOP and HELP from a real phone.
- [ ] Phone verification for web chat uses SMS codes (cost + nuisance); decide whether to keep web bookings behind it (current) or let the bot only quote on web and book by SMS.
- [ ] SMS reminder consent is never inferred from chat (bot bookings get email confirmations; SMS only inside the conversation itself). Decide if you want an explicit "text me reminders" yes/no step in the bot flow; wording must be counsel-reviewed (`SMS_CONSENT_TEXT`).
- [ ] Confirm the customer-facing facts in `src/lib/concierge/facts.ts`: paint-safety and body-shop wording, water/power wording (taken from the published mobile-detailing post: access to the car; tap/outlet helpful, not required), "credited to the final invoice". The business phone is only offered once `site.phone.placeholder` is false.
- [ ] Hours are not known (`site.hours` null), so the bot never states hours. Set them and add them to the facts if you want it to answer.
- [ ] Add a retention job for `messages` / `conversations` (transcripts are customer PII), e.g. delete or anonymise after N months.
- [ ] Upstash Redis env so chat/SMS/verify rate limits work across serverless instances (the in-memory limiter, IP abuse ledger and per-conversation lock are per instance).
- [ ] Phase 3: show the needs-human inbox (`listNeedsHuman`, `conversationTranscript`, `resumeConversation` in `src/lib/concierge/state.ts`) and include `chat` / `sms` in lead-source reports.
- [ ] Enable server-side `fallbacks` for model refusals once you have live access (currently a refusal hands the chat to a human).
- [ ] Instagram / Facebook DMs: contract and stub in `src/lib/concierge/adapters/meta.ts`; needs a Meta app + webhook route.
- [ ] Owner decision: owner text alerts include the customer's phone and a 240-char excerpt of what they said. Confirm that is acceptable.

## Phase 3 (CRM + /admin): [OWNER] items and follow-ups
Everything runs with zero keys (DEMO login on mock data). To make it real:
- [ ] Run `supabase/migrations/0002_admin.sql` after 0001 (never executed against Postgres by the build agent; review it, then run the SQL checks in `tests/rls/rls-intent.md`)
- [ ] Owner login: set `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, URL, `ADMIN_SESSION_SECRET`, and `ADMIN_EMAILS` (first sign-in by that email creates the owner profile). Techs: create the Supabase user, a `techs` row, and a `profiles` row with role `tech` and `tech_id`. Supabase Auth: add `<site>/admin/auth/callback` to the redirect URLs
- [ ] Never set `ADMIN_DEMO_LOGIN=1` on the real site (it is ignored when Supabase is configured, but keep it unset)
- [ ] Membership prices (`memberships[].priceMonthly`), visits per month and rollover (`src/lib/memberships/index.ts`), what a member visit costs on the invoice
- [ ] `referralCredit` amount (config/pricing.ts) and whether the new-customer discount should be the same as the referrer's reward
- [ ] Stripe: second webhook endpoint `/api/admin/stripe/webhook` with the 5 events listed in `.env.example`; enable the Billing Portal in the Stripe dashboard; test pay links and a subscription in test mode
- [ ] Stripe Terminal: needs hardware + `STRIPE_TERMINAL_LOCATION_ID`; the reader screen is NOT built (only the token and card_present intent routes)
- [ ] Phase 4: wrap the chat launcher in `PublicOnly` (root layout) so it does not render on /admin; `await primeSettings()` before `computeDuration` in `concierge/tools.ts`
- [ ] Real-device checks: iPhone Safari/Android Chrome camera capture, tap-to-navigate, Add to Home Screen, signature pad with a finger, offline outbox in a garage
- [ ] Privacy: job photos with `marketing_consent` are only a flag; nothing publishes them. Decide the consent wording the techs say aloud
- [ ] Reviews: "Reviewed" is set by hand in the pipeline (no Google API); reviews/week counts those

## Phase 5 (dealer portal /dealers): [OWNER] items and follow-ups
Everything runs with zero keys (DEMO dealer sign-in, mock Stripe invoices, mock emails). Items below turn it into the real thing.
- [ ] Wholesale rates: `dealerWholesale` in `src/config/pricing.ts` (7 services, all null today; the landing page, the PDF and every dealer screen say "Request wholesale sheet" until set). Per-dealer overrides: /admin/dealers/<id> "Wholesale rates for this dealer". Use `marketing/dealers/wholesale-price-sheet-template.md` to decide them. A car with no rate and no hand-set price is held OFF the statement (never billed at $0)
- [ ] Confirm "same-day, on your lot" and "certificate of insurance on request", then set `claimsConfirmed.sameDay` / `.coi` to true in `src/content/dealers.ts` (removes the [OWNER] markers on /dealers and on the leave-behind PDF). Do not print "insured" until the COI is real
- [ ] Net terms: `dealerNetTerms` (15 / 30 days, default 30) in `config/pricing.ts`. The owner approves each dealer by hand on /admin/dealers/<id>; unapproved dealers are invoiced "due on receipt" (1 day in Stripe). Have counsel check the terms wording before launch
- [ ] Apply `supabase/migrations/0004_dealers.sql` (after 0001/0002/0003) to the real Supabase project. It applies cleanly after 0001-0003 on an in-memory Postgres (PGlite with Supabase stubs; `tests/unit/dealers/migration-0004.check.mjs`) but has never run against real Supabase
- [ ] Set `DEALER_SESSION_SECRET` (random 32+ chars; falls back to `BOOKING_TOKEN_SECRET`). Live dealer sign-in needs `NEXT_PUBLIC_SUPABASE_ANON_KEY` + service role; Supabase email/password users are created server-side (email confirmation is skipped: the owner's approval is the gate)
- [ ] Stripe Invoicing (live): `STRIPE_SECRET_KEY`. Add `/api/dealers/stripe-webhook` as a SEPARATE webhook endpoint (events `invoice.paid`, `invoice.voided`), secret in `STRIPE_DEALER_WEBHOOK_SECRET`. Invoices are finalized with `send_invoice` but Stripe does not email them until you send them from the Stripe dashboard; our own "invoice ready" email goes to the dealer's AP address. Test in Stripe test mode first
- [ ] Phase 3's `/api/admin/stripe/webhook` also listens to `invoice.paid`: confirm it ignores invoices whose Stripe id belongs to a dealer invoice (or unsubscribe it from that event) so a dealer payment is not handled twice
- [ ] Cron: `vercel.json` runs `/api/cron/statements` on the 1st of the month at 14:00 UTC (needs `CRON_SECRET`). `?month=YYYY-MM` re-runs a month. It builds statements only; invoices are issued by the owner
- [ ] `OWNER_ALERT_EMAILS` (comma list) gets "new dealer account", "add-on needs a price", "add-on approved/declined", "vehicles submitted" emails. Empty = logged only
- [ ] Leave-behind: set `NEXT_PUBLIC_SITE_URL`, run `npm run leave-behind`, commit `public/dealers/leave-behind.pdf`. Phone/email print as hand-write blanks until `site.phone.placeholder` / `site.email.placeholder` are false. Hand-write the rates (blanks) or fill `dealerWholesale` first
- [ ] NHTSA vPIC decode (year/make/model from VIN) only runs when Supabase is live; offline mode fills year and a conservative make hint only
- [ ] Follow-ups: technicians cannot yet propose add-ons from the tech view (the owner proposes on /admin/dealers/<id>; `proposeAddon(..., by: 'tech')` is ready for Phase 3's tech screen); tech before/after photos appear to dealers when Phase 3 writes `job_photos` rows (kind before/after) for the dealer's job; ACH/card-on-file auto-pay is not built (Stripe hosted invoice only); robots.txt has no `/dealers/dashboard` disallow (the pages are `noindex`)
