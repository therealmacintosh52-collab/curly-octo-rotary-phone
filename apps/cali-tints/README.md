# Cali Tints — dealership detailing job log & invoicing

A mobile-first, offline-capable PWA that replaces handwritten invoices for a detailing vendor working inside Mercedes-Benz dealerships.

- **Detailers** log a car from the lot in seconds: key tag, scan the VIN, tap services, Save & next. Works with no signal; jobs sync when it returns.
- **The owner** generates a professional invoice for any date range (or one per RO/PO) in one click, emails it with PDF + CSV attachments, tracks submission, partial payments and overdue balances, and keeps every record searchable forever.

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
| Quick job entry `/jobs/new` | Big tag input, VIN camera scan (Code 39/128, QR, DataMatrix, PDF417) → NHTSA decode with cache, Mercedes model list + free text, service chips with priced overrides (reason required), 7-day duplicate warning, Save & next |
| Offline | Jobs queue in IndexedDB and sync when online (idempotent on a client id, so retries never duplicate). `/jobs/outbox` shows the queue with retry/discard. App shell is cached by a service worker |
| Job history `/jobs` | Search tag/VIN/model/RO, filter by service, dealership, detailer, dates, invoiced status; detail page with photos, edit sheet, soft delete/restore and a per-field audit timeline |
| Double-billing guard | At entry, the 7-day duplicate prompt says if the earlier job is already on an invoice. At invoice time every candidate job is checked for the same VIN (or tag at that dealer) within 30 days, against live invoices and the batch itself, with a red flag when the service is the same; the owner excludes it or marks it OK with a note that is audited and stops future flags |
| Invoicing `/invoices` | Batch (date range) or per-job (one invoice per RO/PO, bulk zip) modes; auto-numbered; branded and print-ready PDF, CSV, Excel; submit by email (Resend) with full send history; manual mark-as-submitted with confirmation upload; partial payments; void |
| Dashboard `/` | Week/month cars & revenue, uninvoiced, outstanding, average days to payment, overdue reminders (configurable), revenue per day, by service, by detailer |
| Settings `/settings` | Company profile + logo, invoicing defaults, dealerships (AP contacts, submission method, invoice mode, terms/tax overrides), services grouped by category (seeded with the real menu: PDI $60, Sold $20, Used $200, Service Loaner Detail $125, Touch Up Detail $20–40, Tint Removal $40, Paint Correction $250; a service can carry a quoted range inside which no override reason is needed) + per-dealership price grid, users (password or email invite, roles, reset), full CSV export |
| Roles | **Owner/Admin**: everything. **Detailer**: log and view own jobs only, no pricing edits, no invoices. Enforced by Postgres RLS, not just the UI |

## Project layout

```
apps/cali-tints
├── supabase/
│   ├── migrations/      0001 schema · 0002 functions/RPCs · 0003 RLS · 0004 storage · 0005 double-billing guard + service categories
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

UI previews with fixture data (no Supabase needed, dev only): `/dev/preview` (job form), `/dev/preview/jobs`, `/dev/preview/invoice`, `/dev/preview/dashboard`, `/dev/preview/settings`.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com). Note the **Project URL**, **publishable key** (`sb_publishable_…`; the legacy `anon` JWT also works) and **service role / secret key** from *Project Settings → API*.
2. Apply the migrations **in order**, then the seed. Either:
   - **SQL editor**: paste `supabase/migrations/0001_schema.sql`, run; repeat for `0002`, `0003`, `0004`, then `supabase/seed.sql`.
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
- Jobs saved offline sit in IndexedDB (`outbox`) with their compressed photos; the sync loop runs on reconnect, on tab focus, every 30 s while anything is queued, and right after each save. `create_job` is idempotent on `client_id`, so a retry after a dropped response cannot create a duplicate.
- The offline duplicate check uses the last 7 days of jobs cached on the device plus the outbox; the online check (`find_duplicate_jobs`) sees the whole company.
- The service worker is only registered in production builds so local dev never serves from cache.

## Data model & security

Deviations from the brief and why:

- `profiles` (1:1 with `auth.users`) instead of `users`; role, company and active flag live there. A trigger creates the row on sign-up from the invite metadata.
- `invoice_items` is an **immutable snapshot** of every billed line. Editing or voiding a job later can never change an invoice that was sent. PDFs/CSVs re-render from this table, so any past invoice can be re-downloaded identically.
- `invoice_payments` (partial payments; a trigger rolls up `amount_paid`, `paid_at`, status `partial`/`paid`) and `invoice_submissions` (email attempts with message ids, portal/paper confirmations) replace single columns.
- `jobs.client_id` = offline idempotency key. `jobs` are soft-deleted only; a trigger rejects hard deletes and locks any job that is on a non-void invoice.
- `dealerships` carry AP contact/emails, `submission_method`, `invoice_mode` (`batch` | `per_job`), and optional terms/tax overrides. In per-job mode each job gets its own invoice; jobs that share an RO/PO number are grouped (RO/PO is optional at entry).
- `services.category` (`new` | `used` | `service` | `addon`) groups the price list the way the dealer buys the work; `jobs.dup_reviewed_*` records an owner's "OK to bill" decision on a flagged job; `find_invoice_conflicts()` powers the guard and `generate_*` accept `p_exclude`.
- `vin_cache` shares NHTSA decodes; `audit_log` is written by triggers on every business table (who/what/when + changed columns).
- Invoice numbers come from `companies.next_invoice_number` under a row lock inside `generate_invoice` / `generate_per_job_invoices`, so they are gap-free and never collide.

RLS summary: every table is scoped to the caller's company via `current_company_id()`. Owners/admins get full access; detailers can read reference data, insert jobs as themselves, and read/edit only their own uninvoiced jobs; invoices, payments, submissions and the audit log are admin-only. Storage policies scope every object to `<company_id>/…`. The service-role key is used only server-side for user management and the seed script.

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

`supabase/tests/run.sh` creates a throwaway database, installs a small stub of Supabase's `auth`/`storage` schemas, applies the migrations and seed, then runs `tests/01_flows.sql`, which asserts detailer isolation, idempotent `create_job`, price override rules, invoice generation/locking, payment status transitions, void/unlock, per-job grouping, dashboard stats and storage path policies. CI (`.github/workflows/cali-tints-ci.yml`) runs all of the above.

## CSV / DMS integration contract

Per-invoice CSV (`/api/invoices/{id}/csv`, also attached to emails) and the *Invoice line items* export share the same columns, in this fixed order:

`Invoice Number, Invoice Date, Period Start, Period End, Vendor, Vendor EIN, Dealership, Dealership Address, Line, Service Date, Key Tag, VIN, Year, Make, Model, Color, RO/PO, Service, Detailer, Amount, Invoice Subtotal, Invoice Tax, Invoice Total, Payment Terms, Status`

Rules: UTF-8 with BOM, CRLF, RFC 4180 quoting, dates as `yyyy-mm-dd`, amounts with two decimals, one row per service line. New columns are only ever appended. A future DMS/AP integration can consume this file unchanged or read `invoice_items` directly.

## Operations notes

- **Locked jobs**: a job on a draft/submitted/paid invoice cannot be edited. Void the invoice (only if no payments are recorded) to unlock its jobs, then re-generate.
- **Tax**: company default is 0 %; set per dealership if a dealer requires it. Rates are fractional in the database (`0.0775`), percentages in the UI.
- **Timezone**: `companies.timezone` decides which calendar day a job belongs to for invoice periods and the dashboard.
- **Logo**: upload in Settings → Company; the PDF uses it (grayscale bundled mark on the print variant).
- **Data ownership**: Settings → Export downloads every table as CSV at any time.
