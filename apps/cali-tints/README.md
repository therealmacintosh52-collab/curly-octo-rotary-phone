# Cali Tints — jobs by the day, one invoice a month

A mobile-first, offline-capable PWA that replaces handwritten invoices for a detailing vendor working inside Mercedes-Benz dealerships.

- **Log every car.** A job takes seconds from the lot (stock number, scan the VIN, tap services, photos, Save). Works with no signal; it syncs when the device is back online.
- **One invoice per dealership per month.** On the 1st, every job from the month becomes one invoice per dealership, numbered, emailed to the dealership's AP contact and (when connected) sent to QuickBooks. Nobody makes invoices by hand.
- **Get paid.** Record the check, ACH or card payment when it arrives. Partial payments and overdue reminders are built in.

Stack: Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · shadcn-style UI on Radix · Supabase (Postgres, Auth, Storage, RLS) · Resend · Vercel.

---

## Contents

1. [Features](#features)
2. [Project layout](#project-layout)
3. [Local setup](#local-setup)
4. [Supabase setup](#supabase-setup)
5. [First sign-in and demo data](#first-sign-in-and-demo-data)
6. [Guest preview](#guest-preview-share-a-link-no-login)
7. [Email (Resend)](#email-resend)
7. [Deploy to Vercel](#deploy-to-vercel)
8. [PWA & offline](#pwa--offline)
9. [Data model & security](#data-model--security)
10. [Tests](#tests)
11. [CSV / DMS integration contract](#csv--dms-integration-contract)
12. [Operations notes](#operations-notes)

---

## Features

| Area | What it does |
|---|---|
| New job `/jobs/new` | Big stock number input, VIN camera scan (Code 39/128, QR, DataMatrix, PDF417) → NHTSA decode with cache, Mercedes model list + free text, Make has an **Other** you type in, service chips (the owner sees prices and can override them with a reason), **Other** asks what was done and puts that on the invoice line, 7-day duplicate warning, before/after photos. **Save & next** saves the job; the success card offers **Open job** |
| Offline | Jobs queue in IndexedDB with their compressed photos and sync when online (idempotent on a client id, so retries never duplicate). `/jobs/outbox` shows the queue with retry/discard. App shell is cached by a service worker |
| Jobs `/jobs` | Every car logged, newest first under day headers. Search stock number/VIN/model/service/dealership, or a date (`9/27`, `sep 27`, `september`, `yesterday`, `last week`), or scan the VIN barcode on the car; filter by dealership, detailer, service, dates; **All · Not invoiced · Invoiced · Archive**. Detailers see their own jobs. A job page shows the car, services, photos and where it stands (logged → on the month's invoice → paid); **Edit job** and **Delete job** while it is not on an invoice; deleted jobs sit in the Archive and can be restored |
| Monthly invoices `/invoices` | Owner only. On the 1st the daily job (`/api/cron/daily`, `close_month()`) turns every dealership's jobs from the month into one invoice: numbered, lines snapshotted, jobs locked. With **Email each month's invoice automatically** on (Settings, default on) it is emailed to the dealership's AP contact right away; otherwise it waits as Not sent. **This month so far** shows each dealership's running count and total with **Invoice now** to close one early. Search by number, dealership, a stock number on it or a month; **All · Unpaid (Not sent / Sent / Partial) · Overdue · Paid · Void · Archive**; **Send invoices** emails any unsent ones (see the email first). `/invoices/new` re-invoices jobs left behind by a voided invoice, with the VIN/tag double-billing check |
| Invoice page | One dealership, one month: every car and service line, subtotal/tax/total, where it stands (logged → sent → paid). **Add payment** records the check, ACH, card or cash that arrived. Branded and print-ready PDF, CSV, Excel; submit by email (Resend) with full send history; manual mark-as-submitted with confirmation upload; partial payments; void (jobs go back to Not invoiced) |
| Dashboard `/` | **Owner**: cars detailed today by service (a normal day is about 3 Used, 2 PDI, 4 Sold), this week and month, **Unpaid** (still to collect, this month so far, not sent yet, sent and unpaid), collected, overdue reminders (configurable), and **Income** for any date range; **Breakdown** shows one month at a time by service and by week. **Admin / manager**: the whole team's day, counts only (today by service, this week, this month, cars per detailer, today's cars, the last 30 days). Every number opens the Jobs list filtered to the cars behind it |
| Settings `/settings` | Company profile + logo, monthly invoicing (email automatically, **Run month close** now), dealerships (AP contacts, submission method, tax overrides), services grouped by category (seeded with the real menu: PDI $60, Sold $20, Used $200, Service Loaner Detail $125, Touch Up Detail $20–40, Tint Removal $40, Paint Correction about $50 ($40–60); a service can carry a quoted range inside which no override reason is needed) + per-dealership price grid, users (password or email invite, roles, reset), full CSV export |
| Roles | **Owner**: everything, and the only one who sees money. **Admin**: settings, users, every job, no money. **Manager**: every job, no money, no settings. **Detailer**: log cars, see and fix their own. Enforced by Postgres RLS and column privileges (migration `0029`): invoices, payments and the price list are owner-only at the database, `services.default_price` and `job_services.price` are unreadable by app users (the owner reads them through `service_prices_v` / `job_service_prices_v`), the money RPCs refuse everyone else, and a non-owner's price is ignored on save (list price used). "Other" logged by a non-owner is flagged **Needs a price** for the owner |

## Project layout

```
apps/cali-tints
├── supabase/
│   ├── migrations/      0001 schema · 0002 functions/RPCs · 0003 RLS · 0004 storage · 0005 double-billing guard · … · 0015 one car, one invoice · 0016 search by service · 0017–0026 today by service, paint correction, week, "Other" label, archive, detailer dashboard, manager role, guide · 0027 removes the Terminal and Clover · 0028 jobs by the day, one invoice a month · 0029 only the owner sees money
│   ├── seed.sql         company, 2 dealerships, 8 services, price overrides
│   └── tests/           SQL test suite runnable on plain Postgres (run.sh)
├── scripts/seed-demo.mjs   demo users + 60 days of jobs + invoices (uses the real RPCs)
├── public/sw.js         service worker (app shell cache)
└── src/
    ├── app/             routes: (app)/… authenticated, login, auth/*, api/*, dev/preview/* (dev only)
    ├── components/      ui/ (primitives) · jobs/ · invoices/ · dashboard/ · settings/ · offline/ · pwa/
    └── lib/             supabase clients · auth · vin · money · csv · dates · offline (idb) · invoices (pdf/csv/xlsx/email)
```

## Local setup

Requirements: Node 20.9+ (22 recommended), pnpm 10.

```bash
cd apps/cali-tints
pnpm install
cp .env.example .env.local     # fill in Supabase keys (see below)
pnpm dev                       # http://localhost:3000
```

UI previews with fixture data (no Supabase needed, dev only): `/dev/preview` (new job form), `/dev/preview/jobs` (the list) and `/dev/preview/job/<id>`, `/dev/preview/invoices` (the monthly list) and `/dev/preview/invoice/<id>`, `/dev/preview/dashboard` (`?as=team`, `?as=detailer`), `/dev/preview/settings`.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com). Note the **Project URL**, **publishable key** (`sb_publishable_…`; the legacy `anon` JWT also works) and **service role / secret key** from *Project Settings → API*.
2. Apply the migrations, then the seed. Either:
   - **`pnpm db:push`** with `SUPABASE_DB_URL` set (Project Settings → Database → Connection string, session pooler): applies whatever is missing from `supabase/migrations/` and records it in `public.schema_migrations`. Safe to run again after every update; on a project that predates the tracking table the first run detects what is already there. `pnpm db:push --dry-run` lists what would run. Then run `supabase/seed.sql` once (SQL editor or `psql "$SUPABASE_DB_URL" -f supabase/seed.sql`).
   - **SQL editor**: paste each `supabase/migrations/*.sql` **in order**, then `supabase/seed.sql`. Files from `0008` on can be pasted again without harm.
   - **Supabase CLI**: `supabase link --project-ref <ref>` then `supabase db push` (migrations live in the standard folder) and run `seed.sql` via `supabase db query -f supabase/seed.sql` or the SQL editor.
3. Storage buckets (`job-photos`, `logos`, `submission-confirmations`) are created by migration `0004`, private, with policies scoped to the company folder.
4. *Authentication → URL configuration*: set **Site URL** to your deployment URL and add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`) to **Redirect URLs**. Invites use `/auth/callback?next=/auth/reset`.
5. *Authentication → Providers → Email*: keep email/password enabled. Disable public sign-ups if you like; accounts are created from Settings → Users (the trigger attaches every new auth user to the company).
6. Edit the seeded company in `supabase/seed.sql` (name, address, EIN, dealerships) before running it, or change everything later in Settings.

Environment variables (`.env.local` locally, Vercel project settings in production):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public key (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only: create/invite users, reset passwords, seed script |
| `NEXT_PUBLIC_APP_URL` | Public URL, used in invite redirects and email footer |
| `RESEND_API_KEY`, `EMAIL_FROM` | Invoice emails (see below) |
| `SEED_*` | Demo credentials for `pnpm seed:demo` |

## First sign-in and demo data

**Option A — demo data (recommended for evaluation)**

```bash
pnpm seed:demo
```

Creates `owner@demo.calitints.app` / `demo-owner-123` (owner), two detailers (`marco@…`, `dee@…` / `demo-detailer-123`), ~250 jobs over the last 60 days across both dealerships, one paid invoice, one partially paid, several per-job Irvine invoices (some overdue) and a pile of uninvoiced recent jobs. It signs in as the owner and calls the same RPCs the app uses. Re-running is safe (skips jobs if any exist).

**Option B — real install**

Create the owner in *Supabase → Authentication → Users → Add user* (email + password, auto-confirm). With exactly one company and no profiles yet, the first user is automatically made **owner**. Sign in at `/login`, then add detailers from *Settings → Users*:

- **Set a password** — for detailers without email access on the lot; you hand them the credentials.

**How it works (`/guide`).** A role-aware guide to every screen: what to type or tap and what comes out. Offered once on first sign-in (migration `0026`, `profiles.guide_seen_at`; "Skip for now" also marks it) and always reachable from the ? in the top bar. The guest preview has a role picker.

**What a detailer sees.** Three tabs: their own **Dashboard** (today's cars by service, this week, this month, their cars per day for the last 30 days, and today's cars; no money, no one else's work; migration `0023`, `my_dashboard()`), **New job**, and **Jobs** limited to the cars they logged. Settings and Invoices are hidden, redirect to their dashboard if typed, and are blocked at the database. **manager** and **admin** get the team dashboard (`team_dashboard()`, counts only) and every job; admins also get Settings. Money (prices, totals, income, invoices) is the owner's alone.
- **Email an invite** — Supabase sends a link; they choose a password at `/auth/reset`.

## Guest preview (share a link, no login)

Set `DEMO_ACCESS_KEY` to a long random string (`openssl rand -hex 24`) on a deployment and share `https://<host>/demo?key=<that-string>`. Whoever opens it gets a 30-day cookie and sees the whole app — dashboard, job entry (VIN scan works), history, invoices, settings — running on **sample data with no database and no login**. Nothing is saved, pages are `noindex`, and without the key the deployment shows only the "enter access key" page. Every app URL is rewritten to its fixture twin, so navigation feels real.

Safest setup: a separate Vercel project for the demo with only `DEMO_ACCESS_KEY` set (no Supabase keys at all), and the real deployment without `DEMO_ACCESS_KEY`. Rotate the key to revoke every shared link at once.

## Email (Resend)

1. Create a [Resend](https://resend.com) account, verify your sending domain, create an API key.
2. Set `RESEND_API_KEY` and `EMAIL_FROM="Cali Tints Billing <billing@yourdomain.com>"`.
3. On an invoice, **Submit by email** sends the branded PDF + CSV to the dealership's AP emails (Settings → Dealerships), CCs the company billing email, records recipients + message id, and marks the invoice *Submitted*. **Resend** repeats it; every attempt (including failures) is in the submission history.

Without a key the action fails with a clear message; **Mark as submitted** (portal/paper) still works.

## Deploy to Vercel

1. Import the repo in Vercel. Set **Root Directory** to `apps/cali-tints` (Framework: Next.js, Install: `pnpm install`, Build: `pnpm build`).
2. Add the environment variables above. `NEXT_PUBLIC_APP_URL` = your production URL.
3. Deploy. Add the production URL to Supabase *Redirect URLs*.
4. PDF and Excel generation run in Node serverless functions (`/api/invoices/*`); the bulk zip route allows up to 60 s.

## PWA & offline

- Installable: Chrome/Android shows an install nudge; on iOS use *Share → Add to Home Screen*. `start_url` is `/jobs/new`.
- `public/sw.js` caches the app shell (`/jobs/new`, `/jobs/outbox`, `/offline`, static assets) with a network-first policy for pages so online users never see stale data. API, auth and Supabase traffic are never cached. Bump `VERSION` in `sw.js` to force clients to refresh caches.
- Cars saved offline sit in IndexedDB (`outbox`) with their compressed photos; the sync loop runs on reconnect, on tab focus, every 30 s while anything is queued, and right after each save. `create_job` is idempotent on `client_id`, so a retry after a dropped response cannot create a duplicate car or a second invoice.
- The offline duplicate check uses the last 7 days of jobs cached on the device plus the outbox; the online check (`find_duplicate_jobs`) sees the whole company.
- The service worker is only registered in production builds so local dev never serves from cache.

## Data model & security

Deviations from the brief and why:

- `profiles` (1:1 with `auth.users`) instead of `users`; role, company and active flag live there. A trigger creates the row on sign-up from the invite metadata.
- `invoice_items` is an **immutable snapshot** of every billed line. Editing or voiding a job later can never change an invoice that was sent. PDFs/CSVs re-render from this table, so any past invoice can be re-downloaded identically.
- `invoice_payments` (partial payments; a trigger rolls up `amount_paid`, `paid_at`, status `partial`/`paid`) and `invoice_submissions` (email attempts with message ids, portal/paper confirmations) replace single columns.
- **Jobs by the day, one invoice a month** (migration `0028`). `create_job` inserts the car (`jobs` + `job_services`); `companies.auto_invoice` is off, so nothing is invoiced on save. `close_month(company, through)` (service role, run by the daily cron) groups every uninvoiced job performed before the current month by dealership and calendar month and calls `_create_invoice_from_jobs` for each: numbered, lines snapshotted, jobs locked, period = that month. `invoice_now(dealership)` closes one dealership through today. `jobs_filtered` is the Jobs list (search, dealership, detailer, service, dates, status, paging; no money); `invoices_filtered` the Invoices list. `0015`'s one-car machinery (`edit_invoice_car`, `delete_invoice_car`) stays for one-car invoices.
- `jobs.client_id` = offline idempotency key. `jobs` are soft-deleted only; a trigger rejects hard deletes and locks any job that is on a non-void invoice.
- `dealerships` carry AP contact/emails, `submission_method`, and an optional tax override. Invoices carry no payment terms; the `payment_terms` columns stay in the schema unused. `invoice_mode` (`batch` | `per_job`) stays in the schema for the legacy builder at `/invoices/new` but no longer changes invoicing.
- `services.category` (`new` | `used` | `service` | `addon`) groups the price list the way the dealer buys the work; `jobs.dup_reviewed_*` records an owner's "OK to bill" decision on a flagged job; `find_invoice_conflicts()` powers the guard and `generate_*` accept `p_exclude`.
- `vin_cache` shares NHTSA decodes; `audit_log` is written by triggers on every business table (who/what/when + changed columns).
- Invoice numbers come from `companies.next_invoice_number` under a row lock inside `_create_invoice_from_jobs`, so they are gap-free and never collide.

RLS summary: every table is scoped to the caller's company via `current_company_id()`. Owners/admins get full access; detailers can read reference data, insert cars as themselves, read the invoices and lines that carry their own cars, and edit those only through `edit_invoice_car` while unsent and unpaid; payments, submissions and the audit log are admin-only. Storage policies scope every object to `<company_id>/…`. The service-role key is used only server-side for user management and the seed script.

## Design system

One source of truth: `src/app/globals.css`.

- **Tokens**: colour, radius, elevation and motion live as CSS variables on `:root` (dark, the default) and `[data-theme="light"]`, mapped into Tailwind via `@theme inline`. Components only use token classes (`bg-card`, `text-subtle`, `border-border-strong`, `bg-accent-soft` …), never raw hex.
- **Type scale**: `text-display / text-title / text-heading / text-body / text-body-sm / text-label / text-caption / text-stat`. Labels are 13px sentence case; numbers use tabular figures.
- **Spacing**: 4px base, 8px grid, 16px page gutter on phones and 32px on desktop. Controls are 44px tall on touch, 36px in dense desktop tables.
- **Motion** (`src/components/motion/*`): 150–250 ms, ease-out in, ease-in out, transform and opacity only. Page enter (`FadeIn` in `template.tsx`), staggered lists (`StaggerItem`), springing numbers (`CountUp`), a CSS sliding indicator for nav and segmented controls. `MotionConfig reducedMotion="user"` plus a global `prefers-reduced-motion` rule collapse everything to instant.
- **States**: every route group has `loading.tsx` skeletons and an `error.tsx`; lists use `EmptyState`.
- **Performance rules**: recharts and the VIN scanner load on demand; the Supabase SDK loads only when syncing, saving or signing out; Geist Sans is the only web font (mono is the system stack).

## Tests

```bash
pnpm lint          # eslint (Next + React compiler rules)
pnpm typecheck     # tsc
pnpm test          # vitest: VIN check digit/extraction, money, CSV, date presets, PDF/XLSX/CSV/email renderers
pnpm db:test       # migrations + RLS/RPC/trigger tests on a local Postgres 16 (PGHOST/PGPORT/PGUSER env)
pnpm build
```

`supabase/tests/run.sh` creates a throwaway database, installs a small stub of Supabase's `auth`/`storage` schemas, applies the migrations and seed, then runs `tests/01_flows.sql`, which asserts detailer isolation, idempotent `create_job`, price override rules, invoice generation/locking, payment status transitions, void/unlock, per-job grouping, dashboard stats, storage path policies, and (0015) car-is-invoice: auto-invoicing for detailers and retries, the backfill, edit/delete rules, the filtered list and detailer read access. CI (`.github/workflows/cali-tints-ci.yml`) runs all of the above.

## CSV / DMS integration contract

Per-invoice CSV (`/api/invoices/{id}/csv`, also attached to emails) and the *Invoice line items* export share the same columns, in this fixed order:

`Invoice Number, Invoice Date, Period Start, Period End, Vendor, Vendor EIN, Dealership, Dealership Address, Line, Service Date, Stock Number, VIN, Year, Make, Model, Color, RO/PO, Service, Detailer, Amount, Invoice Subtotal, Invoice Tax, Invoice Total, Payment Terms, Status`

Rules: UTF-8 with BOM, CRLF, RFC 4180 quoting, dates as `yyyy-mm-dd`, amounts with two decimals, one row per service line. New columns are only ever appended. A future DMS/AP integration can consume this file unchanged or read `invoice_items` directly.

## Operations notes

- **Locked jobs**: a job on an invoice cannot be edited. Void the invoice (only if no payments are recorded) to unlock its jobs; the next month close picks them up again, or `/invoices/new` re-invoices them now.
- **Month close**: Vercel Cron calls `/api/cron/daily` at 7am Pacific with `CRON_SECRET`; it is idempotent, so **Run month close** in Settings → Company is safe any time (first-day setup, a missed cron). Hobby plans run crons once a day at most, which is all this needs.
- **Tax**: company default is 0 %; set per dealership if a dealer requires it. Rates are fractional in the database (`0.0775`), percentages in the UI.
- **Timezone**: `companies.timezone` decides which calendar day a job belongs to for invoice periods and the dashboard.
- **Logo**: upload in Settings → Company; the PDF uses it (grayscale bundled mark on the print variant).
- **Data ownership**: Settings → Export downloads every table as CSV at any time.
