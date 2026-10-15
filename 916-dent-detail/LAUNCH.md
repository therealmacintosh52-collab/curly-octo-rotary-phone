# LAUNCH.md: 916 Dent & Detail, final report (Phase 8)

Status: **built and tested locally in mock mode. Not deployed. No account was created, nothing was spent, nobody was contacted, no real message was sent, no real key exists.**
Branch `claude/916-dent-detail-build`. Setup steps for every key: [`README.md`](README.md). Security review: [`SECURITY.md`](SECURITY.md). Decisions: `DECISIONS.md` (P8-001..023).

## A. What works today (mock mode) vs what needs keys

"Mock" means the feature runs end to end against the in-memory demo database, a logged outbox instead of real SMS/email, and a labelled demo payment. Nothing is simulated silently: every mock path is labelled in the UI or the logs.

| Feature | Works with zero keys | What makes it real | Not verified live |
|---|---|---|---|
| Marketing site: scroll-scrub hero, services, 14 city pages, blog, pricing, reviews, FAQ, sitemap/robots/schema | yes, complete | `NEXT_PUBLIC_SITE_URL`, real photos/reviews/prices ([OWNER]) | real hosting/CDN |
| Booking `/book` (8 steps, real availability engine, travel fee by ZIP, referral code, reschedule/cancel links) | yes; deposit is a labelled DEMO confirm button | Supabase (persistence), Stripe (deposit), Resend/Twilio (messages) | Stripe Payment Element + webhook, real devices |
| AI photo quote | DEMO rule-based range, labelled | `ANTHROPIC_API_KEY` | live vision model |
| Reminders and automations (confirmation, 24 h, 2 h, on-the-way, review request, rebook) | queue + dispatcher work and are tested; messages go to the mock outbox | scheduler hitting `/api/cron/dispatch` (Vercel Pro or `docs/SCHEDULER.md`), Twilio, Resend | delivery |
| `/admin` (today route, pipeline, schedule, customers, quotes, invoices, memberships, referrals, reports, **needs-a-person inbox**) | yes, DEMO logins on mock data | Supabase auth + `npm run setup:admin`; Stripe for pay links/memberships | live auth, Stripe Checkout/Portal, real-device camera/signature |
| 916 Concierge, web chat | yes, offline scripted policy through the real tool executor and guardrails | `ANTHROPIC_API_KEY`; Twilio for the phone-verification code (mock code is refused when Supabase is live) | **live model behaviour** |
| Concierge by text (`/api/sms`), STOP/START/HELP, missed-call text-back, **explicit SMS reminder consent step** | yes (webhook, TwiML reply, opt-out, consent, quiet hours) | Twilio number + webhooks + A2P 10DLC | carrier delivery, signature on real traffic |
| Dealer portal (signup, approval, CSV bulk submit, status, add-ons, statements, net-terms invoices) | yes, DEMO dealer sign-in, mock invoices | Supabase; Stripe Invoicing + dealer webhook | live Stripe Invoicing, NHTSA VIN lookup |
| Dealer leave-behind PDF | yes, committed | `NEXT_PUBLIC_SITE_URL` then `npm run leave-behind` (the committed QR points at localhost; do not print yet) | printing |
| Analytics, Meta CAPI, Google Ads, consent banner | inert until IDs are set (events still reach `dataLayer`) | GA4 / Meta / Ads IDs | delivery |
| Google Calendar one-way push | built, unit tested against a stub (JWT, create/update/delete, failure handling) | service account + calendar ids | the live Google API |
| Transcript retention (180 days default) | yes, daily job tested | cron + `CONCIERGE_RETENTION_DAYS` | n/a |
| `/privacy`, `/terms` (SMS program disclosures) | yes, **templates marked "not legal advice"** | counsel review | n/a |
| `npm run deploy` | dry run only (prints the plan) | Vercel login + linked project | **never run for real** |

---

## B. Everything only the owner can supply ([OWNER] items, deduplicated)

`npm run check:owner` prints every placeholder line still in the code; the list below is the same set grouped by who has to decide and where it goes.
**`npm run deploy` refuses to run until `check:owner` is clean** (the preflight is strict on purpose).

### B1. Business facts (blockers)
| Item | Where it goes |
|---|---|
| Real business phone (the current (916) 555-0100 is fictional) | `src/config/site.ts` `phone`, set `placeholder: false`; also the Twilio number (README step 5) |
| Real inbox | `site.email` |
| Hours Mon-Fri / Sat / Sun (the bot refuses to state hours until set) | `site.hours`, then add them to `src/lib/concierge/facts.ts` if you want the bot to answer |
| Production domain | Vercel domain + `NEXT_PUBLIC_SITE_URL` (README step 1) |
| Google review link (`g.page/r/…`) | `site.googleReviewUrl` (the post-job review text omits the line until set) |
| Social URLs: Instagram, Facebook, TikTok, YouTube, Google | `site.social` (feeds Organization.sameAs) |
| Legal business name if different from "916 Dent & Detail" | `site.name`, privacy/terms pages |
| The two technicians: real names, phones, weekly hours, blackout dates | Supabase `techs` / `tech_availability` (mock store: `bookingConfig.defaultWeekly`) |
| Confirm the 14-city list and the "We start from ZIP 95624" statement | `src/content/seo/cities/*`, `site.baseZip` |

### B2. Prices, durations and policies (never hardcoded in the UI; all config)
| Item | Where |
|---|---|
| "From" price for each of the 6 services | `src/config/pricing.ts` `serviceFromPrice`, `fixedPrices`, `dentPricing`, `addonPrices`, `detailSpread` |
| Then flip the flag so the demo-pricing markers disappear | `PRICES_ARE_PLACEHOLDERS = false` |
| Deposit amount, travel-fee tiers and radius, ZIP table additions (unknown ZIPs go to human review by design) | `depositAmount`, `travelFees` in pricing.ts; `src/lib/geo/zips.ts` |
| Durations by service x vehicle size, add-on minutes, multi-service savings | `src/config/booking.ts` |
| Cancellation / reschedule / deposit policy (48 h refund, 24 h credit, under 24 h kept, free change 24 h, closed inside 4 h, max 2) | `depositPolicy` in booking.ts (shown on /terms and /booking) |
| Membership monthly prices, what each tier includes, visits per month, rollover | `memberships[].priceMonthly`; `src/lib/memberships/index.ts` |
| Referral credit amount; whether the new-customer discount equals the referrer reward | `referralCredit` |
| Dealer per-panel wholesale rates (7 services, all empty today); per-dealer overrides | `dealerWholesale` in pricing.ts; `/admin/dealers/<id>`; template in `marketing/dealers/` |
| Dealer net terms (15 or 30 days, default 30) and who is approved | `dealerNetTerms`; `/admin/dealers/<id>` |

### B3. Proof and claims to confirm (nothing here is invented; each is marked in the site)
- 3 real customer reviews **with written permission** (no invented reviews, no star ratings, no aggregateRating schema).
- Real before/after job photos: 3 pairs (dent, swirls, interior) to replace the `PanelArt` placeholders; photos for service pages.
- Eco claims: confirm reclaim equipment and permits, or tell us what to soften (low-water methods, runoff captured, out of storm drains).
- Dealer claims: "same-day, on your lot" and "certificate of insurance on request": then set `claimsConfirmed.sameDay` / `.coi` in `src/content/dealers.ts`. Do not print "insured" until the COI exists.
- Hail Fix: that you will photograph hail damage and give an estimate that supports an insurance claim.
- Local facts to re-check before publishing: dated hail/heat/news items and every "map-check" place name listed in TODO.md (Phase 6).
- Per-city distance bands (near/mid/far) and drive notes are qualitative guesses: adjust to real drive times.

### B4. Media
- Optional but recommended: a 16:9 `brand/hero-video-wide.mp4` for desktop, a 1080w+ source of the vertical video (the 720w frames are soft on large retina panels), a re-render of the dent-pop moment (frames ~24-44 show a white chip and a ghost ring), and a flat/vector D-mark (16/32 px favicons are limited by the 3D bevel).
- After changing any: `npm run media`, rebuild, re-run `npm run lhci`.

### B5. Counsel review (nothing below is legal advice; all drafted as templates)
- `/privacy` and `/terms` (templates, marked as such on the page), then remove the notice in `src/components/LegalPage.tsx`.
- SMS consent wording in three places that must stay consistent: `SMS_CONSENT_TEXT` (booking form), `CONCIERGE_SMS_CONSENT_QUESTION` (chat/text opt-in) and the `/terms#sms` section; plus Twilio's opt-out/HELP wording. This is also what the A2P 10DLC campaign cites.
- Deposit/cancellation policy wording, dealer net-terms wording, limitation of liability and any warranty (none is claimed anywhere).
- Retention periods (chat transcripts default 180 days; job/invoice records), CCPA/CPRA posture, cookie banner wording, the words technicians say aloud for job-photo marketing consent.
- Business licenses, insurance, and whether the state Bureau of Automotive Repair applies to paintless dent repair (open question from the growth pack).

### B6. Accounts, keys and decisions
- Accounts (owner creates; nothing here created any): Vercel (Pro or an external scheduler), Supabase, Stripe (test, then live; 3 webhooks; customer portal), Twilio (number + **A2P 10DLC**), Resend (+ DNS), Anthropic (+ spend limit), and optionally GA4 / Meta / Google Ads / Google Calendar / Upstash. Exact steps: README "Setup guide".
- Decisions: keep SMS phone-verification for web-chat bookings (cost + friction) or make web chat quote-only; owner text alerts include the customer's phone and a 240-character excerpt (acceptable?); GBP primary category (dent vs detailing), whether any directory may show an address, dealer tiers and trial offer, ad budgets and kill thresholds, LSA for detailing only (growth pack D1-D6).
- Real-device checks (cannot be done here): iPhone Safari and Android Chrome camera capture and HEIC, tap-to-navigate, Add to Home Screen, signature with a finger, offline outbox in a garage, a human screen-reader pass.

---

## C. Verification, with the real numbers

Everything below ran in this sandbox against the **production build in mock mode**. "Verified live" appears nowhere in this table because nothing live exists.
`npm run verify` (tsc, eslint, 599 unit/bot tests, build, `check:seo`, `check:owner`, 134 Playwright tests, axe) exited 0 on the last full run (twice in a row on the final tree).

| Target | Measured | Verdict |
|---|---|---|
| TypeScript strict, ESLint | 0 errors (3 pre-existing warnings: two unused vars in a QA script, one `<img>` in the tech photo preview) | pass |
| Unit + bot tests (`npm test`) | **599 passed in 52 files** (`npm run test:bot`: 29 passed = the 15 scenarios + 13 adversarial cases + 1 check that documents the expected behaviours) | pass |
| Playwright e2e (`npm run test:e2e`) | **134 tests: 132 passed, 2 skipped by design** (the desktop-only and mobile-only keyboard tests skip on the other project) (67 per project: mobile 390x844, desktop 1440x900): full booking incl. unknown/in-area ZIP, referral code, mock deposit, reschedule, cancel; skip-link; widget open/ask/photo/slots/verify/deposit handoff; SMS webhook via request fixture incl. STOP/START/HELP, replay, injection; admin smoke and role limits; dealer smoke; SEO smoke (head, schema, robots, sitemap resolves, 404, redirects, headers, no-JS); keyboard passes; console cleanliness; INP proxy | pass |
| axe (WCAG 2.0/2.1/2.2 A+AA + best practice) | **0 serious/critical** on 18 public route classes, 13 admin screens and 4 dealer pages (both projects, in e2e) and on 16 routes x 3 contexts (mobile, desktop, reduced motion) via `npm run axe`: 48 audits, **0 violations of any impact** after the `/pricing` landmark fix | pass |
| Keyboard-only | booking flow (skip link, service toggle, step focus, vehicle step, focus rings), desktop nav order + Enter, mobile menu open/Escape/focus return, chat dialog focus trap | pass (found and fixed two real bugs, below) |
| Console | no console errors, page errors or failed first-party requests on 13 key routes | pass |
| Lighthouse mobile (LHCI: 6 URLs x 3 runs, Lighthouse default mobile emulation = simulated slow 4G + 4x CPU, median, idle machine), final build | performance **95-98** on all six; accessibility **100**, best practices **100**, SEO **100** on all six; CLS **0** on all six; TBT **78-144 ms** (limit 300) | pass |
| Lighthouse LCP <= 2.5 s | **home 2285 ms, /book 2121 ms: pass. /services/... 2535, /areas/folsom 2602, /dealers 2602, /blog/... 2555 ms: FAIL by 35-100 ms** in the last run; earlier runs of the same build put each of these pages between 2.04 and 2.73 s (per-page medians flip across the 2.5 s line from run to run) | **target NOT met reliably** (see below) |
| INP lab proxy (scripted trace, Event Timing API, median of 3 runs, 4x CPU on mobile) | worst page median **mobile 144-176 ms across the last two full runs** (home 88-96, /book 144-176, /dealers 48-72, service page 56), **desktop 88-120 ms**; before the Phase 8 fixes 192-264 ms. /book is the one near the limit (single runs reach 216 ms) | pass as a lab proxy; field INP is unmeasured |
| Bot scenarios | 15 scenarios + 13 adversarial cases pass **against the offline scripted policy** through the real tool executor, guardrails, authorization, filters and cost cap | plumbing and server-side enforcement verified; **live model behaviour UNVERIFIED** |
| RLS / migrations | migrations 0001-0005 + `seed.sql` apply cleanly on an in-memory Postgres (PGlite); 29 role assertions for anon, stranger, owner, admin, 2 techs, 2 dealers pass; 5 of them fail without `0005` | pass on PGlite; **Supabase itself UNVERIFIED** |
| Security | secrets scan clean (tree + history); `npm audit --omit=dev`: **0 vulnerabilities**; 22 advisories exist only in dev tooling (lint, Lighthouse, LHCI); 12 findings fixed, 9 open (all owner decisions or need live infrastructure): `SECURITY.md` | see SECURITY.md |
| Pre-existing bugs the tests found and the fixes | invoice numbering could never run on Supabase (migration 0002), duplicate job on concurrent payment confirmation, cross-tenant dealer photo read policy, the skip link reset the booking to step 1 and stole focus, booking step headings never took focus, two robots meta tags on 404, availability engine threw on NaN durations, Saturday hours differed between `seed.sql` and config | fixed, each with a test |
| Owner placeholders (`npm run check:owner`) | **172 lines still in code** (the launch checklist, section B). `npm run deploy` refuses to deploy until it is 0 | expected |

### Lighthouse: what moved, what did not
Home page, mobile, median of 3 (LHCI, same machine, idle), **before -> after**: performance 87 -> 98, LCP 3140 -> 2285 ms, TBT 286 -> 96 ms, CLS 0 -> 0. `/book`: CLS 0.097 -> 0, performance 93 -> 96. Other pages were already at 94-98.
Changes that did it: `content-visibility:auto` on below-the-fold sections and the footer (with a ScrollTrigger refresh so scroll animations keep their positions: checked identical with and without it), focus and scroll-lock work moved one frame off the click path, booking draft saving debounced, the chat panel script pre-fetched after the first scroll, smooth scrolling not loaded on form pages, the booking form's first step rendered on the server instead of a "Loading..." line.
Two things that made it WORSE and were removed: a `Cross-Origin-Opener-Policy` header (content-page lab LCP median 2.05 s -> 2.63 s in an 8-run A/B) and Next's `inlineCss` (first paint +100 ms). A variable Inter font was evaluated and rejected (the Latin file is 48 KB; the two current subsets total 30.6 KB).
**Why LCP still misses on four content pages:** Lighthouse estimates LCP by simulating every request that started before the page's first paint. About 150 KB gzip of framework JavaScript (react-dom 71 KB, Next client 36 KB) plus 41 KB of fonts and 12 KB of CSS therefore set a floor of roughly 2.1-2.7 s on a simulated 1.6 Mbps link, and whether the first paint lands a few milliseconds before or after those script requests start flips the estimate by ~0.5 s (the same build alternates between about 2.05 and 2.65 s from one run to the next). The real, unthrottled LCP of these pages is about 0.2 s. Getting under 2.5 s reliably would need a smaller framework payload (not available from application code) or deferring hydration scripts (a different architecture). The honest status: **LCP <= 2.5 s is met on the home page and /book, and borderline-missed (by up to ~0.1 s, sometimes met) on the others**. Re-measure on the real deployment: real hosting, TLS and CDN change these numbers.

### Still UNVERIFIED (everything that needs something live)
- Every live integration: Supabase (SQL ran on PGlite only; RLS, Auth, Storage, PostgREST), Stripe (Payment Element, the three webhooks, Checkout, Portal, Invoicing, Terminal), Twilio (SMS, signature on real traffic, voice webhooks, A2P 10DLC), Resend delivery, Anthropic (photo quotes, **the Concierge's behaviour and prompt caching**), GA4 / Meta CAPI / Google Ads, Google Calendar, Upstash, Vercel cron.
- Real devices (iPhone Safari / Android Chrome camera and HEIC, tap-to-navigate, Add to Home Screen, signature with a finger, offline outbox) and a human screen-reader pass.
- Real-world performance: field INP/LCP/CLS, real hosting; the dealer leave-behind on paper.
- Anything legal: the privacy policy, terms and SMS wording are templates a lawyer has not seen.


---

## D. Launch checklist, in order (owner time is the human minutes; waiting time is elapsed days)

| # | Step | Owner time | Notes |
|---|---|---|---|
| 1 | Decide domain, buy it; create Vercel + GitHub-to-Vercel link | 30 min | README 1 |
| 2 | **Start A2P 10DLC registration** (needs the live domain, privacy and terms URLs) | 45 min + 1-3 wk wait | do this first: it is the longest wait. Use the template pages only after counsel review, or register with a clearly-final text |
| 3 | Fill the B1 business facts and B2 prices in code; commit | 90 min | `npm run check:owner` shows what is left |
| 4 | Counsel reviews privacy/terms/SMS wording/deposit policy; apply edits; remove template notice | 1 h of yours + counsel's time | B5 |
| 5 | Supabase project, 5 migrations, seed, bucket check, auth URLs, secrets | 45 min | README 2; `npm run doctor` LIVE |
| 6 | `npm run setup:admin -- --email you@…`; create technicians + profiles | 30 min | README 2.8, 3 |
| 7 | Stripe test mode: keys, 3 webhooks, portal; one test booking with 4242 card; check 3 endpoints delivered | 45 min | README 4 |
| 8 | Resend domain + DNS; Anthropic key + spend limit | 30 min | README 6, 7 |
| 9 | Twilio number, SMS + voice webhooks (STOP/START/HELP from a real phone) | 30 min | README 5; texts only deliver once 10DLC is approved |
| 10 | Scheduler: Vercel Pro or GitHub Actions / cron-job.org; `curl` each endpoint once | 20 min | docs/SCHEDULER.md |
| 11 | **Read live bot transcripts for an hour**: `BOT_LIVE=1 … tests/bot/scenarios.test.ts`, then chat and text it yourself; tune facts/prompt | 90 min | all automated bot tests used the offline policy |
| 12 | Real photos, 3 reviews with permission, hero upgrades (optional), real-device checks | 2-4 h | B3, B4 |
| 13 | `npm run doctor -- --production` then `npm run deploy` (dry run), then `npm run deploy -- --yes` | 20 min | preflight stops on any placeholder or failure |
| 14 | Switch Stripe to live keys + 3 live webhook endpoints; one real $ booking, refund it | 30 min | keep the test endpoints until verified |
| 15 | Submit sitemap in Search Console; claim/verify Google Business Profile; run the growth pack (`/marketing`) | 2 h | growth pack is manual by design (nothing posts or sends itself) |
| 16 | Print the dealer leave-behind **after** `NEXT_PUBLIC_SITE_URL` is set and `npm run leave-behind` was re-run | 15 min | the committed PDF's QR points at localhost until then |

Total owner hands-on time is roughly 12-16 hours spread over the 1-3 weeks A2P approval takes.

---

## E. Day 1 monitoring and rollback

**First hour after go-live**
1. Home, `/book`, `/dealers`, `/admin/login` load over https; `/robots.txt` and `/sitemap.xml` show the real domain.
2. Make one real booking end to end with a live card (smallest deposit); confirm the email and text arrived, the booking is in `/admin/schedule`, then refund it (cancel > 48 h ahead refunds automatically).
3. Text the number from a phone you own: reply STOP, START, HELP. Chat on the site once and try "REMIND ME".
4. Stripe dashboard > Developers > Webhooks: three endpoints, recent deliveries all 2xx.
5. Cron: server logs show a `notify.dispatch` line every ~5 minutes.

**Every day for the first week** (10 minutes)
- `/admin` home "Needs attention" and `/admin/inbox` (chats waiting for a person); answer within the hour during hours.
- Vercel > Logs, filter `error`; Supabase > Logs; Stripe > Webhooks failures; Twilio > Messaging > Insights (delivery errors 30007/30034 mean 10DLC filtering).
- Resend > Emails: bounces/complaints. Anthropic console: spend vs the limit you set; `concierge.usage` events for cost per chat.
- Look at 5 real chat transcripts per day in the inbox for off-brand or wrong answers; fix `facts.ts`/prompt.

**What "broken" looks like and what to do**
| Symptom | First action |
|---|---|
| Bookings fail at the deposit step | Stripe keys/mode mismatch (`npm run doctor`); fall back: take bookings by phone, `/admin/schedule/new` books manually |
| No reminders / holds never expire | scheduler not hitting `/api/cron/dispatch` (docs/SCHEDULER.md) |
| Texts not delivered | 10DLC not approved or number blocked; emails still go out |
| Bot says something wrong | Pause the launcher: set `ANTHROPIC_API_KEY` empty in Vercel and redeploy (falls back to the labelled offline policy) or remove `<ConciergeLauncher />` from `src/app/layout.tsx`; web chat bookings can also be disabled by not setting up Twilio verification |
| Admin cannot sign in | Supabase redirect URL missing `/admin/auth/callback`; or use `setup:admin --password` |

**Rollback**
- Code: Vercel > Deployments > pick the last good deployment > **Promote to Production** (instant, no rebuild). Or `vercel rollback`.
- Database: migrations are additive and never edited; there is no automatic down-migration. Before applying any new migration take a Supabase backup (Database > Backups; point-in-time recovery is a paid add-on). To undo `0005`, drop the policy/index it created by name (listed in its header comments) rather than restoring.
- Secrets: rotate a leaked key in its own dashboard, update Vercel, redeploy. Changing `BOOKING_TOKEN_SECRET` invalidates all issued booking links and chat sessions.
- Messaging kill switch: Twilio Console > number > remove the Messaging webhook URL (inbound stops), and unset `TWILIO_*` in Vercel (outbound falls back to logged mock).
