# Quantum Growth OS: project guide

Read this file first in every session. The workflow rules in Part 2 are mandatory. The spec in Part 1 is
the source of truth and is pasted unedited (only the one-time closing line "Start now with Phase 0..." is left out so no later session re-runs Phase 0). Part 3 is the live status. Part 4 is the decisions log.

State lives here: tick a phase only when its CLOSE step is done. Manual to-dos live in `docs/MANUAL-TODOS.md`.

---

# Part 1: The spec (verbatim, as given)

Build "Quantum Growth OS": the complete back-office and fulfillment platform for my one-person local-marketing agency, Quantum Growth. It must let me deliver EVERY service my public site sells, take payment, onboard clients, and track every third-party cost per client. I run everything from my PHONE (no computer), so every screen must be mobile-first and every recurring task automated, with a human approval queue instead of manual work.

## MODEL + WORKFLOW RULES (follow strictly — this controls my usage costs)
- This project runs on the `opusplan` model setting: Opus in plan mode, Sonnet in execution.
- EVERY phase follows this loop:
  1. PLAN (plan mode, Opus):
     - Read CLAUDE.md and the decisions log.
     - Produce a written plan for the current phase only: schema changes, files to create/edit, integrations, tests, risks, and the manual steps I'll need to do.
     - Keep each plan small enough to finish in one execution run. If a phase is too big, split it into sub-phases (e.g. 1a, 1b) and plan only the first.
     - Do NOT write code in plan mode.
  2. WAIT for my approval of the plan.
  3. EXECUTE (Sonnet): implement exactly the approved plan. No architecture changes during execution.
  4. If execution reveals the plan was wrong (wrong schema, missing integration, design flaw), STOP, explain the problem in 3 lines, and tell me to re-enter plan mode. Do not redesign on Sonnet.
  5. CLOSE: run tests, deploy a preview, update CLAUDE.md + decisions log, and list my manual to-dos. Then stop.
- Use subagents for repetitive work (searching the codebase, reading docs, running tests, generating fixtures). Keep architecture decisions in the main thread.
- Keep context lean: summarize finished phases in CLAUDE.md instead of re-reading old files; read only the files the current plan touches.

## Phase 0 — Project setup (do this first, then stop)
- Create `.claude/settings.json` in the repo:
  {
    "model": "opusplan",
    "env": { "CLAUDE_CODE_SUBAGENT_MODEL": "haiku" }
  }
- Create CLAUDE.md containing: this full spec, the MODEL + WORKFLOW RULES above (verbatim), the phase list with status checkboxes, and an empty decisions log.
- Create the monorepo skeleton, .env.example, and a README explaining how to resume work from the phone.

## What I sell (source of truth — encode as a plan-config file, not hardcoded)
- Starter $79/mo (or $711/yr) + $699 one-time build:
  - 25-page site on the client's domain.
  - Business email setup: 2 Google Workspace mailboxes, billed to the CLIENT directly by Google.
  - Social profiles set up; hosting/SSL/backups/security; unlimited text edits.
  - Free NFC/QR tap-to-review plate.
- Local $299/mo ($2,691/yr), no build fee. Everything in Starter, plus:
  - Google Business Profile managed; 8 social posts/mo (GBP, Facebook, Instagram).
  - Citations on 40+ directories, ordered only after the first payment clears.
  - AI-search visibility (schema, llms.txt, FAQ); always-on review generation.
  - Monthly report from Google's own data; monthly refresh of hours/photos/specials.
- Growth $599/mo ($5,391/yr). Everything in Local, plus:
  - 16 posts/mo; reviews and job photos reshared as social proof.
  - Local authority link tracking; 2 new pages/mo.
  - Follow-up campaigns for stale quotes; CRM setup (HubSpot free tier default).
  - Same-week changes; quarterly design refresh.
- Market Leader $999/mo ($8,991/yr). Everything in Growth, plus:
  - 24 posts/mo incl. video scripts and seasonal campaigns; AI ad copy.
  - A city page for every town served.
  - Google/Meta ads or LSA managed (ad spend paid by the client directly to Google/Meta).
  - Missed-call text-back.
  - AI receptionist: 400 minutes/mo included, then $0.25/min overage billed through Stripe metered usage.
  - Same-day changes; quarterly strategy review.
- Website-only: $400 if decided on the call / $599 later, then $29/mo hosting; text edits free for the first 30 days only.
- Visibility Audit $499. Strategy consulting $175/hr.
- Apps:
  - Starter App $699.99 + $49/mo.
  - Business App $999 + $99/mo.
  - Custom from $1,499.99, after a $499 scoping session.
  - App Store + Play listing $499 + $25/mo; store fees paid by the client.
- Early-exit rule for free-build plans: unearned build is $600 in months 1–2, $400 in months 3–4, $200 in months 5–6, $0 after. Annual plans are non-refundable.
- Paid directly by the client, never through us: domain, Google Workspace, ad spend, App Store/Play fees.

## Ground rules
- Stack: Next.js (App Router, TypeScript), Supabase (Postgres, auth, storage, row-level security), Tailwind.
- Hosting: the admin and portal run on Vercel Pro. Client sites are static builds on Cloudflare Pages, behind a HostingProvider interface so I can switch providers later.
- Multi-tenant: every table is scoped by client_id with row-level security. Separate apps: /admin (me) and /portal (clients).
- Every third-party integration sits behind an interface with a MANUAL MODE fallback that generates the content plus a step checklist for me, so nothing blocks on API approval.
- Every account is created in the CLIENT's name; I am added as a manager. Never store client passwords. Store only who owns what and how access was granted.
- Secrets live only in env vars; every key goes in .env.example with a note on where to get it.
- Compliance is built in:
  - SMS: A2P 10DLC registration per client brand; TCPA opt-in records; STOP/HELP handling.
  - AI receptionist: recording disclosure at the start of every call (California all-party consent).
  - Reviews: requests go to ALL customers, never filtered by sentiment.
  - Generated sites: WCAG 2.1 AA.

## Phase 1 — Sell, pay, onboard
1. Public intake funnel (mobile, multi-step, saves progress, resumable by link):
   - Step 1, Lead: name, phone, email, business name, town, and what would help most (website / app / more customers / business is a mess / not sure).
   - Step 2, Business facts:
     - Legal name, DBA, EIN (optional, labeled "needed for text messaging registration").
     - Exact name/address/phone, service-area towns, hours, year founded.
     - Licenses, insurance, services with price ranges, top 3 competitors.
   - Step 3, Brand: logo, colors, 10–30 work photos, team photos, testimonials, FAQs, tone, and Spanish version yes/no.
   - Step 4, Access — each item with a step-by-step how-to screen:
     - Google Business Profile manager invite (or "I don't have one").
     - Domain registrar user invite, or where the domain is registered.
     - Existing website login, if migrating.
     - Meta Business partner access.
     - Google Ads link (Market Leader only).
     - Apple/Google developer accounts (app clients only).
   - Step 5, Messaging consent: customer-list CSV plus an attestation of how consent was obtained; call-forwarding setup guide; approval of the AI receptionist greeting and disclosure.
   - Step 6, Agreement:
     - Plan summary, early-exit schedule, receptionist cap and overage rate.
     - The "paid directly by you" list.
     - Required Terms checkbox, then Stripe Checkout.
2. Stripe:
   - Products/prices for every item above, monthly + annual.
   - Checkout with required terms consent; card + ACH; Customer Portal; webhooks syncing subscription state.
   - Auto-generate the early-exit invoice on cancellation.
   - Metered receptionist overage at $0.25/min.
   - Admin action to text the client a pay link.
3. Client requirements tracker:
   - A per-client checklist generated from their plan, showing what's missing to deliver each promise.
   - Auto-reminder SMS/email every 3 days for missing items.
   - Each service stays "blocked" until its inputs arrive.
4. Admin today view: new leads, unpaid invoices, blocked onboarding items, approval queue, and SLA timers per plan.
5. Offboarding: one click exports the client's site as a zip, plus an ownership handover report.

## Phase 2 — Cost ledger + vendor setup
- Per-client cost ledger: every third-party charge tagged with client_id — SMS segments, phone numbers, 10DLC fees, receptionist minutes, citation credits, rank-scan credits, LLM tokens, hosting share. Pull from vendor APIs where possible, otherwise log manually.
- Margin dashboard per client and per plan; alert me when any client's costs exceed 25% of revenue.
- Vendor config screens: Twilio (ISV setup registering each client brand + campaign), Retell, BrightLocal, Local Falcon, Anthropic API, Google APIs, Meta.

## Phase 3 — Visibility Audit engine (free check + $499 audit)
- Input: business + town, or a website / GBP / Yelp URL.
- Checks:
  - Site: PageSpeed Insights API, mobile, SSL, schema validity, titles/meta.
  - GBP completeness: categories, photos, posts, review count, review velocity, response rate.
  - Competition: top-3 map-pack competitors and their gaps.
  - Listings: NAP consistency and citation presence.
  - AI-search readiness.
- Versions:
  - Free: problems + estimated lost calls/revenue, with assumptions shown.
  - Paid: the full fix plan.
  - Internal: maps each fix to the plan that delivers it.
- Output: a branded PDF plus a shareable link.

## Phase 4 — Site engine
- Generate a 25-page site from intake JSON: home, about, contact, quote form, service pages, service×city pages, FAQ, reviews, gallery, blog, and an optional Spanish version.
- Include schema, sitemap, robots, and llms.txt. Use 4–5 distinct industry themes; the result must not look templated.
- AI drafts the copy; I approve on my phone; then deploy to the client's domain, with DNS instructions for their registrar.
- Uptime + SSL monitoring and nightly backups.
- Edit requests (portal or SMS) → AI draft → my approval → redeploy, with turnaround tracked against the plan's SLA.
- Tap-to-review plate: per-client short link, QR code, NFC URL, and a print-ready file.

## Phase 5 — GBP, citations, reviews
- GBP: post scheduler, photos, Q&A, AI review-reply drafts (approve to send), monthly refresh. Business Profile APIs with manual fallback.
- Citations: push NAP to BrightLocal Citation Builder; tracker for 40+ directories showing status, live URL, and NAP match. Order only after the first payment clears.
- Reviews: SMS/email request sequences to consented customers only, a review widget, new-review alerts, and monthly velocity stats.

## Phase 6 — Content + social
- Monthly calendar sized by plan (8/16/24 posts): AI drafts posts + image prompts from client photos → approval queue → publish via Meta Graph API and GBP (manual fallback).
- Reshares of 5-star reviews and finished-work photos, plus 2 new pages/month proposals (Growth+).
- Seasonal campaigns, ad copy, and video scripts (Market Leader).

## Phase 7 — Conversion stack
- Missed-call text-back on a Twilio number in the client's name.
- AI receptionist via Retell:
  - Answers FAQs from client data and books into the client's calendar.
  - Plays the recording disclosure at call start.
  - Texts the client a transcript + summary.
  - Meters minutes against the 400-minute cap and reports overage to Stripe.
- AI website chat widget; follow-up sequences; HubSpot sync behind a CRM interface; call tracking; GA4 + Search Console checklist.

## Phase 8 — Reporting + rank tracking
- Monthly auto-report on the 1st: GBP Performance API (calls, directions, website clicks), GA4 form submissions, reviews gained, posts published, and a Local Falcon geo-grid snapshot. Delivered as PDF + portal view, texted to the client.
- Quarterly strategy review deck (Market Leader).

## Phase 9 — Apps
- PWA templates: booking, ordering, loyalty, quote request, customer accounts/history, photo-send to customer. Installable, works offline, client-branded.
- Capacitor wrapper with genuine native features (push notifications, camera) for App Store/Play submission under the client's developer accounts; store-listing asset generator.

## Phase 10 — Paid ads (Market Leader / add-on)
- Google Ads + Meta campaign templates by industry, ad landing pages, spend/results dashboard, LSA checklist. Manual mode until API access is approved. Ad spend always goes on the client's own ad account.

---

# Part 2: MODEL + WORKFLOW RULES (verbatim, mandatory)

## MODEL + WORKFLOW RULES (follow strictly — this controls my usage costs)
- This project runs on the `opusplan` model setting: Opus in plan mode, Sonnet in execution.
- EVERY phase follows this loop:
  1. PLAN (plan mode, Opus):
     - Read CLAUDE.md and the decisions log.
     - Produce a written plan for the current phase only: schema changes, files to create/edit, integrations, tests, risks, and the manual steps I'll need to do.
     - Keep each plan small enough to finish in one execution run. If a phase is too big, split it into sub-phases (e.g. 1a, 1b) and plan only the first.
     - Do NOT write code in plan mode.
  2. WAIT for my approval of the plan.
  3. EXECUTE (Sonnet): implement exactly the approved plan. No architecture changes during execution.
  4. If execution reveals the plan was wrong (wrong schema, missing integration, design flaw), STOP, explain the problem in 3 lines, and tell me to re-enter plan mode. Do not redesign on Sonnet.
  5. CLOSE: run tests, deploy a preview, update CLAUDE.md + decisions log, and list my manual to-dos. Then stop.
- Use subagents for repetitive work (searching the codebase, reading docs, running tests, generating fixtures). Keep architecture decisions in the main thread.
- Keep context lean: summarize finished phases in CLAUDE.md instead of re-reading old files; read only the files the current plan touches.

---

# Part 3: Phase status

Tick a box only after the phase's CLOSE step (tests run, preview deployed where an app exists, this file and the
decisions log updated, manual to-dos listed).

- [x] Phase 0: Project setup
- [ ] Phase 1: Sell, pay, onboard. **Too big, will be split.** Proposed: 1a foundation, 1b intake funnel, 1c Stripe, 1d requirements tracker, today view and offboarding.
- [ ] Phase 2: Cost ledger + vendor setup
- [ ] Phase 3: Visibility Audit engine (free check + $499 audit)
- [ ] Phase 4: Site engine
- [ ] Phase 5: GBP, citations, reviews
- [ ] Phase 6: Content + social
- [ ] Phase 7: Conversion stack
- [ ] Phase 8: Reporting + rank tracking
- [ ] Phase 9: Apps
- [ ] Phase 10: Paid ads (Market Leader / add-on)

Finished-phase summaries (replace re-reading old files; keep each to a few lines):

- Phase 0: repo scaffolding only. Settings at repo root `.claude/settings.json`; this folder holds the skeleton
  (`apps/admin`, `apps/portal`, `packages/{plan-config,db,integrations}`, `supabase/migrations`, `docs`), `.env.example`,
  pnpm workspace config. No app code, no schema.

---

# Part 4: Decisions log

Empty by design. Add one entry per decision, newest last, in this format:

```
## D-NNN: short title (Phase X, YYYY-MM-DD)
- Decision:
- Why:
- Alternatives rejected:
- Consequences / what it locks in:
```

(No entries yet.)

---

# Part 5: Open items before Phase 1 planning

Not decisions. Questions found by checking the spec against the live public page. Resolve in the Phase 1 plan.

- **AI receptionist cap and overage are not on the public page.** The card says "AI receptionist that answers your
  calls". The agreement step discloses 400 minutes and $0.25/min, but a buyer reading the page sees no limit.
- **"Paid directly by the client" is mostly not on the page.** Domain, Google Workspace and ad spend are not mentioned; only store fees are.
- **Local authority links.** The page promises links built (chamber, suppliers, sponsorships). The spec only tracks them. Who builds them?
- **CRM.** The page names GoHighLevel. The spec's default is HubSpot's free tier and the CRM interface has no GHL adapter.
  Salesforce and industry CRMs are on the add-on line.
- **"Every service" is not yet true of the phase list.** About 25 of the 84 services on the page have no module:
  e-commerce, sales funnels, membership sites, migrations, malware cleanup, multi-location, keyword and voice-search work,
  penalty and suspension recovery, heatmaps, retargeting, newsletters, professional photos, short-form video production,
  custom apps, internal tools. Proposal: a generic service catalog plus manual-job template (checklist, cost tag, approval
  queue) in the Phase 1a plan.
- **PII.** Intake collects EINs, customer lists and call transcripts. Phase 1a needs a retention policy and column-level
  encryption, not just row-level security.
- **Phase 0 choices not yet logged** (the decisions log was required to be empty): project lives in this repo under
  `quantum-growth-os/` with settings at the repo root; pnpm workspaces; short pointer `CLAUDE.md` at the repo root;
  folder-scoped `.gitignore`; `RESEND_API_KEY` added to `.env.example` (spec names no email provider). Log these at the
  start of Phase 1 planning.
