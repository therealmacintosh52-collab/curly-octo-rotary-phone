# T-916-P5 handoff: Phase 5 dealer portal (agent -> orchestrator)

Branch `claude/916-dent-detail-build`. Not pushed. Nothing deployed, no accounts created, no spend, nobody contacted. Everything runs in mock mode with zero keys. No price exists in code: every wholesale rate is a null [OWNER] placeholder and the UI says "Request wholesale sheet".

## Built (all under 916-dent-detail/)
- **Landing `/dealers`** (SSR): hero, four value cards with visible [OWNER] markers on the two soft claims (same-day, COI), per-panel rate table (all "Request wholesale sheet"), how it works (the existing GSAP `steps` motion via `SectionMotion`), who we serve (dealers, fleets, rental lots, body shops), portal features, wholesale-sheet form (-> lead, source=dealer, no auto reply), 9 FAQs with FAQPage + BreadcrumbList JSON-LD (`lib/seo`), title "Dealership Recon & Dent Repair Sacramento | 916 Dent & Detail", sitemap gets `/dealers/signup`. Copy states no numbers (research found none).
- **Accounts**: `/dealers/signup` (business, optional license #, contact, lots, AP email, volume, net-terms request) -> pending -> owner approval; `/dealers/signin` (DEMO email-only login in mock mode, Supabase email+password live); signed `dd_dealer` cookie; dashboard `/dealers/dashboard`.
- **Bulk submission**: single form or CSV paste/upload/template download (`/api/dealers/template`). VIN length, I/O/Q, ISO check digit, in-file and open-vehicle dedupe, per-row error report BEFORE saving, offline year/make hint from the VIN, vPIC decode only when Supabase is live, multi-photo drag/drop per vehicle (client downscale, magic-byte check). Each car creates `vehicles` + `jobs` (dealer-linked) + `dealer_vehicles`.
- **Status + add-ons**: list and 4-column board, search by stock#/VIN/make, status stepper, before/after photos (from `job_photos`), history (events table), owner add-on proposals (priced by the owner) with dealer approve/decline + email via `lib/email` (logged in mock).
- **Billing**: monthly statements (aggregation, PDF via pdf-lib), net-15/30 invoices (Stripe Invoicing live `send_invoice` + finalize; `in_mock_*` record + in-portal stub page in mock), balance + aging buckets for the dealer, owner marks paid/void, `/api/cron/statements` + `vercel.json` entry (1st of month 14:00 UTC), separate `/api/dealers/stripe-webhook` (`invoice.paid`, `invoice.voided`).
- **Owner screens** `src/app/admin/dealers/**` (thin, server actions -> `src/lib/dealers`): approve/reject/pause, net terms, per-dealer rates, schedule/start/finish cars, price cars, propose/price add-ons, build statements, issue invoice, mark paid, void, run last month.
- **Leave-behind** `npm run leave-behind` -> `public/dealers/leave-behind.pdf` (committed, 1 page Letter, 183 KB), `/dealers/leave-behind` redirects to it.
- Schema `supabase/migrations/0004_dealers.sql` (additive; never touched 0001).

## Evidence (final tree, last run)
```
$ npx tsc --noEmit                  -> (no output) tsc exit=0
$ eslint (all P5 paths)             -> (no output) exit=0     [npm run lint: 0 errors; 3 warnings in other phases' files]
$ npx vitest run tests/unit/dealers -> Test Files 6 passed (6) / Tests 75 passed (75)
$ npx vitest run                    -> Test Files 38 passed (38) / Tests 469 passed (469)
$ NEXT_DIST_DIR=.next-p5 npm run build -> check-similarity: OK / ✓ Compiled successfully / routes incl.
    ○ /dealers  ƒ /dealers/dashboard{,/billing,/billing/invoices/[id],/submit,/vehicles,/vehicles/[id]}  ƒ /dealers/signin  ƒ /dealers/signup
    ƒ /dealers/leave-behind  ƒ /admin/dealers  ƒ /admin/dealers/[id]  ƒ /api/cron/statements  ƒ /api/dealers/{auth/*,photo,sheet-request,statements/[id]/pdf,stripe-webhook,template,vehicles...}
$ node scripts/dealers-flow.mjs http://localhost:3105 (production build, zero keys, ADMIN_DEMO_LOGIN=1) -> 55 "ok:" lines, "All checks passed", exit=0
$ node scripts/check-seo.mjs --no-build --base=http://localhost:3107 -> pages crawled: 59 ... [check:seo] OK
$ migration check (PGlite, 0001..0004 + Supabase stubs): applied 0001..0004; ok: duplicate open VIN refused; ok: cancelled VIN can be resubmitted;
    ok: one statement per dealer per month; ok: bogus vehicle status refused; ok: dealer cannot update vehicle rows (no update policy);
    ok: dealer cannot insert a priced vehicle; ok: dealer can insert a plain submitted vehicle
$ leave-behind: pdffonts -> Michroma-Regular, Inter-Regular, Inter-SemiBold (embedded: yes); pdfinfo -> 1 page, 612 x 792 pts (letter); QR decoded back from the rendered PNG:
    http://localhost:3000/dealers/signup?utm_source=leave_behind&utm_medium=print
```
`scripts/dealers-flow.mjs` walks: landing (title, one h1, no `$` on the page, JSON-LD, sitemap, sheet form) -> signup validation -> pending (submit blocked, API 403) -> owner demo login -> approve with Net 30 -> CSV with 5 rows (2 ok, duplicate VIN, bad check digit, unknown service all reported per row) -> 3-photo batch upload -> single-vehicle form with live VIN check -> list/search/board -> owner schedules/starts/prices/finishes, proposes an $85 add-on -> dealer approves it -> audit trail -> statement ($300 + $85 + $150.50 = $535.50) -> Net-30 mock invoice -> statement PDF download (valid, anonymous request 401) -> invoice stub page -> owner marks paid -> balance $0.00; desktop spot checks; axe (wcag2a/aa/21aa/22aa) on landing, signup (with errors), pending dashboard, submit (preview, result, desktop), board, vehicle detail, billing, invoice, signin, admin/dealers and admin dealer detail: 0 serious/critical; no console/page errors. Screenshots (VIEWED) in `916-dent-detail/.shots/dealers/` (git-ignored).

Bugs found by viewing/running and fixed: single-form `e.currentTarget.reset()` crash after an await (page error), nested `<main>` in the portal layout, scrollable tables not keyboard-focusable (axe), mobile price/billing tables wrapping or hiding the PDF button, tab bar clipping "Billing", statement PDF stock# overlapping the vehicle column + duplicate VIN text + wasted page space, leave-behind QR overflowing the footer band and the COI line hidden behind it (layout re-spaced, QR decode-verified), pdf-lib could not embed woff2 (converted to TTF with `wawoff2`), audit trail ordering for same-millisecond events, `check:seo` caught a 307 internal link and a 156-char meta description.

## NOT verified
- Live Supabase: `0004_dealers.sql` was applied only on PGlite with hand-written auth/role stubs; live Supabase Auth sign-up/sign-in (`auth.admin.createUser`, `signInWithPassword`), the `profiles` trigger interplay, RLS with real JWTs, and the private-bucket upload/download path were never run.
- Live Stripe Invoicing (`invoices.create`/`invoiceItems.create`/`finalizeInvoice`/`pay out of band`/`voidInvoice`, customer creation, hosted URL, the dealer webhook signature) never run; only the mock path is tested. Written against the stripe@23 types, which compile.
- NHTSA vPIC decode: unit-tested with an injected fetch only, never called for real.
- Real email delivery (Resend), real phones (iOS camera/HEIC, Safari date input), screen-reader testing by a person.
- The leave-behind was only viewed as a PNG render and checked with `pdffonts`; never printed on paper (ink coverage, margins on a real printer). The committed PDF's QR points at localhost because `NEXT_PUBLIC_SITE_URL` is unset: regenerate before printing.
- Statement PDF uses Helvetica (not Michroma/Inter) and has no logo.
- One flaky run: twice (right after restarting a dev server mid-session) the add-on approval did not show in the history and the balance missed the $85; 9 later runs (dev and production build, with and without debug logging) all passed. I could not reproduce it or find a cause; suspect two overlapping dev servers sharing a dist dir. Worth one more look if it recurs.
- Concurrency: add-on decisions and statement building are read-modify-write (fine for the mock and for low volume; there is no row lock or transaction on Supabase).

## Risks / decisions for you
1. **requireOwner()**: Phase 3 has no function by that name. `src/lib/dealers/owner-guard.ts` adapts `requireStaff()`/`getSession()` (owner + admin). If Phase 3 later exports `requireOwner`, re-export it there. Admin pages sit in `AdminShell` (imports `../_ui/*`, `@/lib/auth/*`): a Phase 3 refactor of those will need a one-line fix in `src/app/admin/dealers/{layout,page,[id]/page}.tsx`.
2. **Shared-file touches** (all additive): `src/lib/db/types.ts` (optional dealer/vehicle/statement/invoice fields, wider status unions; my commit may carry Phase 3's uncommitted lines in that file), `src/config/pricing.ts` (dealer block at the end), `vercel.json`, `src/app/sitemap.ts`, `package.json` (+pdf-lib, @pdf-lib/fontkit, qrcode, wawoff2, @types/qrcode; script `leave-behind`), `.env.example`, README/TODO/DECISIONS (appended; P5-001..013). `src/lib/dealers/catalog.ts` imports `../../config/pricing.ts` (relative, with extension) so the Node script can load it. Phase 3 also committed my `dashboard/layout.tsx` edit inside their commit 91bb529.
3. **Stripe webhooks**: Phase 3's `/api/admin/stripe/webhook` also subscribes to `invoice.paid`. If both are configured, make sure it ignores dealer invoice ids (or drop that event from it); my endpoint is `/api/dealers/stripe-webhook` with `STRIPE_DEALER_WEBHOOK_SECRET`.
4. **DEMO dealer sign-in** is email-only (anyone who knows an email gets in) so it is OFF in production unless `DEALERS_DEMO_LOGIN=1` or `ADMIN_DEMO_LOGIN=1`, and never with Supabase keys. In production with no keys, signup/signin show "not switched on yet".
5. **Invoices are not auto-emailed by Stripe** (finalized `send_invoice`); our own email with the portal link goes to the AP address when the owner clicks Issue. Unapproved dealers are "due on receipt" = 1 day in Stripe. Say if you want auto-issue from the cron or ACH/card auto-pay.
6. **Cars with no price are left off statements** and reported to the owner (never $0). With all rates null today, the owner must price each car (or set a per-dealer rate sheet) before billing.
7. **Techs cannot yet propose add-ons from the tech view**; `proposeAddon(..., by: 'tech')` is ready for Phase 3's tech screen. Tech before/after photos reach dealers once Phase 3 writes `job_photos` (kind before/after) for the dealer's job.
8. `/dealers/dashboard` is `noindex` by metadata, not by robots.txt (Phase 6 file, untouched).

## Commits (mine only)
691a46f core libs + schema + tests; cc3ebf2 pages/APIs/admin; 748c4d0 leave-behind + sitemap; c876f60 e2e script + fixes; f573b4c security tests/docs. Owner decisions needed: items in TODO.md "Phase 5" (rates, COI + same-day confirmation, net-terms policy, NEXT_PUBLIC_SITE_URL, secrets).
