# T-916-P8 handoff: Phase 8 QA + integration + launch pack (agent -> orchestrator)

Branch `claude/916-dent-detail-build`. **Not pushed.** Nothing deployed, no account created, no spend, nobody contacted, no real message sent, no key exists. `npm run deploy` was only ever run as a dry run.
Read first: `916-dent-detail/LAUNCH.md` (what is live, [OWNER] list, verification table, checklist, rollback), `SECURITY.md`, `README.md` (numbered setup for every key), `DECISIONS.md` P8-001..023.

## Built
1. **Integration gaps (a-j):** needs-human inbox `/admin/inbox` (+reply by SMS, resolve); `chat`/`sms` lead sources in reports/pipeline; deterministic server-appended SMS consent step (only `REMIND ME` counts, stored with timestamp + wording); transcript retention job + cron route + `vercel.json`; Stripe webhooks ignore each other's invoices (per-endpoint dedupe); referral code field in `/book`; single `requireOwner`; robots/noindex checks; tsconfig/.gitignore cleanup (AGENTS.md kept, committed); `/privacy` + `/terms` templates (SMS program disclosures, "not legal advice", no compliance claims), linked from footer and consent text.
2. **Tests:** Playwright config (production build, mock mode, mobile + desktop, Chromium from `/opt/pw-browsers`), 9 spec files / 134 tests, extra vitest edge cases (pricing/duration sweeps, availability boundaries, booking races), GCal sync tests, setup/deploy/seed tests, executable RLS test on PGlite, `npm run verify`.
3. **Quality:** `lighthouserc.json` + `npm run lhci` (+ median report), INP trace, axe on every route class + admin + dealer, perf work, CLS fix.
4. **Security:** `SECURITY.md` (12 fixed, 9 open), migration `0005_security_fixes.sql`, domain-separated tokens, strict dealer Origin, upload Content-Length, security headers.
5. **Seed + setup:** `npm run seed [-- --demo]`, `supabase/seed.sql` (production-safe, coherent) + `seed-demo.sql`, `npm run setup:admin`, `npm run doctor`, README rewrite (old README is `docs/REFERENCE.md`), `docs/SCHEDULER.md`, `npm run deploy` (dry run default).
6. **Report:** `LAUNCH.md`, TODO/DECISIONS appended.

## Verification (quoted)
```
$ npm run verify            # last run, final tree
======== verify summary ========
pass     typecheck      8.8s
pass     lint          28.2s
pass     unit          17.6s        Test Files 52 passed (52) / Tests 599 passed (599)
pass     build         17.4s
pass     seo            3.4s
report   owner          0.1s        172 owner placeholder line(s) remain.
pass     e2e          545.9s        134 tests: 132 passed, 2 skipped by design
pass     axe          204.9s        serious/critical violations: 0   (16 routes x 3 contexts, all "violations: none")
verify OK

$ npm run test:bot          Test Files 2 passed | Tests 29 passed (15 scenarios + 13 adversarial + 1 documentation check), OFFLINE mock policy
$ npm audit --omit=dev      found 0 vulnerabilities      (22 advisories in dev tooling only)

$ npm run lhci   (final build; 6 URLs x 3 runs; median; Lighthouse default mobile = simulated slow 4G + 4x CPU)
 url                                          perf a11y bp  seo  LCP ms  CLS  TBT ms
 /                                             98   100  100  100   2285   0    96
 /services/paintless-dent-repair               95   100  100  100   2535   0   144   <- LCP over 2500
 /areas/folsom                                 97   100  100  100   2602   0    89   <- LCP over 2500
 /book                                         96   100  100  100   2121   0    78
 /dealers                                      97   100  100  100   2602   0    85   <- LCP over 2500
 /blog/can-every-dent-be-fixed-without-paint   97   100  100  100   2555   0   104   <- LCP over 2500
 before Phase 8: / perf 87, LCP 3140, TBT 286; /book CLS 0.097.   Same build, other LHCI sessions: per-page LCP medians between 2.04 and 2.73 s.

INP lab proxy (Event Timing, 4x CPU mobile, median of 3): worst page median mobile 144-176 ms, desktop 88-120 ms (was 192-264 ms).
```
**Honest status of the Lighthouse LCP target:** met on home and /book; on the four content pages it sits at 2.5-2.7 s median and flips across the line between runs (Lantern includes every request started before first paint, ~150 KB gz of framework JS sets the floor; real LCP is ~0.2 s). Details and everything tried (variable Inter: bigger; inlineCss: worse; COOP header: worse, removed) are in LAUNCH.md C and DECISIONS P8-013. Not hidden, not forced.

## Real bugs the new tests found (all fixed, each with a test)
- **Migration 0002 `next_invoice_number` fails on every call on Postgres ("column reference year is ambiguous")**: no invoice could be numbered on Supabase. Found only by running the migrations on PGlite. Fixed in 0005.
- Concurrent Stripe webhook + customer verify created **two jobs** per booking (compare-and-set + unique index).
- Dealer insert policy let a dealer set `job_id` and read another customer's before/after photos (0005).
- Skip link on `/book` fired `popstate` and reset the form to step 1 and stole focus; step headings never took focus on step changes (guard accidentally disabled it).
- Technician could revive a cancelled booking through direct RLS access; anon could call the RLS helper RPCs (0005).
- `seed.sql` had Saturday to 17:00 vs 15:00 in config; two robots metas on the 404; availability engine threw on NaN duration.

## NOT verified (read this)
Everything live: Supabase (RLS verified on PGlite only; confirm the `photos` bucket is private on the real project), Stripe (3 webhooks, Payment Element, Portal, Invoicing), Twilio (signature, STOP/HELP on real traffic, voice webhooks, **A2P 10DLC not started**), Resend deliverability, **live Anthropic behaviour of the Concierge and the photo quote (all 29 bot tests use the offline policy)**, GA4/Meta/Ads, Google Calendar against Google, Vercel crons. Real devices (camera, signature, offline outbox), a human screen-reader pass, field performance, printing the leave-behind (its QR still says localhost until `NEXT_PUBLIC_SITE_URL` is set and `npm run leave-behind` is re-run). Legal pages are templates a lawyer has not read.

## Risks / decisions for you
1. **Counsel** must review `/privacy`, `/terms`, the SMS wording (3 places: `SMS_CONSENT_TEXT`, `CONCIERGE_SMS_CONSENT_QUESTION`, `/terms#sms`), deposit/cancel policy, net terms, retention (180-day default).
2. `npm run deploy -- --yes` will refuse until `check:owner` is 0 (172 placeholder lines today): intended.
3. Vercel Hobby cannot run the 5/10-minute crons: Pro or `docs/SCHEDULER.md`.
4. Dev dependencies added: `@electric-sql/pglite`, `@lhci/cli` (22 audit advisories, all dev tooling; production tree clean).
5. `content-visibility:auto` now on below-the-fold sections and the footer: full-page screenshot tools show those sections blank unless scrolled through (tooling artifact only; behaviour compared with and without it was identical). `scripts/shots.mjs` full-page captures may need a scroll-through.
6. Token HMACs are now domain-separated: any token issued by an earlier build would be invalid (none exist; nothing is deployed).
7. Open security items needing your decision are O-01..O-09 in `SECURITY.md` (CSP report-only first, Supabase Auth sign-up/MFA, Upstash for rate limits).
8. Housekeeping: I ran `npx vercel --version` once (npx cached the CLI package; no login, no deploy). I killed leftover `next-server` processes of my own only.

## Commits (mine, this phase)
dd86264 step 1 integration gaps; 280ec75 step 2 tests + fixes; 87a9430 steps 3-5; bb3bfa6 COOP/CLS + docs; plus the final docs/handoff commit.
