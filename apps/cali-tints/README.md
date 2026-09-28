# Cali Tints — every car is an invoice

A mobile-first, offline-capable PWA that replaces handwritten invoices for a detailing vendor working inside Mercedes-Benz dealerships.

- **A car is an invoice.** Log a car from the lot in seconds (key tag, scan the VIN, tap services, Save) and it *is* its invoice, numbered and ready. Works with no signal; the invoice is made the moment the car syncs.
- **One list.** The Invoices tab is every car ever logged: search by tag, VIN, model or invoice number; filter by dealership, service, dates and where the money stands (Unpaid · Overdue · Paid). Fix a typo or remove a car while the invoice is still an unsent draft.
- **Collect.** Send the PDF + CSV by email, take the card on the Clover terminal or in the app, or settle every unpaid invoice for a dealership with one payment. Partial payments, refunds, receipts and overdue reminders are built in.

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
| New invoice `/jobs/new` | Big tag input, VIN camera scan (Code 39/128, QR, DataMatrix, PDF417) → NHTSA decode with cache, Mercedes model list + free text, Make has an **Other** you type in, service chips with priced overrides (reason required), **Other** asks what was done and puts that on the invoice line, 7-day duplicate warning. **Save** makes the car its own invoice; the success card shows the invoice number with **Collect** and **Open**. **Save & charge** (admins) jumps straight to the Terminal with it |
| Offline | Cars queue in IndexedDB and sync when online (idempotent on a client id, so retries never duplicate); each becomes its invoice on arrival and the form's card fills in the number. `/jobs/outbox` shows the queue with retry/discard. App shell is cached by a service worker |
| Invoices `/invoices` | The one list: every car as its invoice. Search tag/VIN/model/RO/invoice number/service, or a date (`9/27`, `sep 27`, `september`, `yesterday`, `last week`), or scan the VIN barcode on the car to pull up its invoice; filter by dealership, service, dates; **All · Unpaid (Not sent / Sent / Partial) · Overdue · Paid · Void**; **Collect** on every open row, **Collect all unpaid** and **Send invoices** (pick any of the unsent invoices, see the email exactly as the dealership gets it, then send each with its PDF and CSV) in the header. Detailers see their own cars, read-only |
| Invoice page | The car (VIN, color, notes), its services, subtotal/tax/total, where it stands (logged → sent → paid). Card payments taken in the app, on the Clover terminal or through the pay link add themselves; **Add payment** is for checks, ACH or cash that arrived outside the app. **Edit invoice** and **Delete invoice** while it is an unsent draft with nothing paid (owner, or the car's detailer for edits): the lines re-snapshot, the number stays. Deleted invoices go to **Invoices → Archive** and can be restored; nothing is ever removed. Branded and print-ready PDF, CSV, Excel; submit by email (Resend) with full send history; manual mark-as-submitted with confirmation upload; partial payments; void |
| Double-billing guard | At entry, the 7-day duplicate prompt says if the earlier car is already on an invoice (it always is now, so the prompt shows the number). `/invoices/new` still exists for cars logged before auto-invoicing, with the same VIN/tag conflict check |
| Terminal `/terminal` | Point of sale from any phone or laptop: amount keypad, open invoices (each shown as its car: tag, model, service, day) or a quick sale, paid by card (in app), card on the Clover device, cash, check or ACH; refunds (full/partial, back to the same card); email and print receipts; the day's transactions with totals |
| Dashboard `/` | Cars detailed today by service (a normal day is about 3 Used, 2 PDI, 4 Sold), this week and month, **Unpaid** (still to collect, not sent yet, sent and unpaid), collected, overdue reminders (configurable), and **Income** for any date range: total received, revenue logged, average per car, still to collect, invoices received per day; **This week** opens the Invoices list for the whole week, day by day; **Breakdown** shows one month at a time (last six selectable) by service and by week. Every number opens the Invoices list filtered to the cars behind it |
| Settings `/settings` | Company profile + logo, invoicing defaults, receipts (an off-by-default switch that emails the dealership a receipt the moment a payment lands on an invoice), dealerships (AP contacts, submission method, tax overrides), services grouped by category (seeded with the real menu: PDI $60, Sold $20, Used $200, Service Loaner Detail $125, Touch Up Detail $20–40, Tint Removal $40, Paint Correction about $50 ($40–60); a service can carry a quoted range inside which no override reason is needed) + per-dealership price grid, users (password or email invite, roles, reset), full CSV export |
| Roles | **Owner/Admin**: everything. **Detailer**: log cars, see and fix their own (as invoices, read-only otherwise); no pricing edits, no payments. Enforced by Postgres RLS, not just the UI |

## Project layout

```
apps/cali-tints
├── supabase/
│   ├── migrations/      0001 schema · 0002 functions/RPCs · 0003 RLS · 0004 storage · 0005 double-billing guard · … · 0015 one car, one invoice · 0016 search by service · 0017–0022 today by service, paint correction, week, "Other" label, archive, automatic receipts
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

UI previews with fixture data (no Supabase needed, dev only): `/dev/preview` (new car form), `/dev/preview/invoices` (the list), `/dev/preview/invoice`, `/dev/preview/dashboard`, `/dev/preview/terminal`, `/dev/preview/settings`.

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

**What a detailer sees.** Three tabs: their own **Dashboard** (today's cars by service, this week, this month, their cars per day for the last 30 days, and today's cars; no money, no one else's work; migration `0023`, `my_dashboard()`), **New invoice**, and **Invoices** limited to the cars they logged. Terminal and Settings are hidden, redirect to their dashboard if typed, and are blocked at the database. **manager** (migrations `0024`, `0025`) runs invoicing: the owner's dashboard, every invoice, sending, pay links, recording a payment that arrived, matching Clover payments; but no Terminal (no Collect, Save & charge, card or device charges, refunds; the `terminal_sales` ledger is owner/admin only) and no Settings (company, dealerships, prices, users, Clover, export), enforced by `is_owner_admin()` policies. **admin** gets everything the owner has.
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
- **A car is an invoice** (migration `0015`). `create_job` inserts the car (`jobs` + `job_services`) and, while `companies.auto_invoice` is on (default), calls `_create_invoice_from_jobs` for that one car in the same transaction: the invoice is numbered, its lines snapshotted and the car locked before the RPC returns. Detailers and offline syncs get the same behaviour (security definer). `edit_invoice_car` unlinks, edits through `update_job`, relinks and re-snapshots a draft, unpaid, one-car invoice without changing its number; `delete_invoice_car` voids it and soft-deletes the car. `invoices_filtered` is the list (search, dealership, service, detailer, dates, status, paging) with the cars and services on each row. The migration backfills every uninvoiced car into its own invoice.
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

## Clover (Fiserv) payments

Optional. With Clover on, the app and your Clover account stay in step:

| What | How |
|---|---|
| Invoices show up in Clover | Every generated invoice becomes an open Clover order (custom line items, one per job service). Pay it on the Clover device like any order. |
| Clover payments land on invoices | Once a day (Vercel Cron, 7am Pacific; Hobby plans allow daily only, raise it in `vercel.json` on Pro) and on **Sync Clover**, payments are pulled and matched: by the order above, then by an invoice number in the payment reference, then by an exact open balance. Anything else waits in **Clover payments to match** on the Invoices page, where you pick the invoice or ignore it. |
| Pay-by-card link in invoice emails | Hosted Checkout: a "Pay by card" button under the total. The dealership pays on Clover's page; the webhook marks the invoice paid. |
| Charge a card in the app | Invoice → Payments → **Charge card**. Clover's iframe fields tokenise the card; card numbers never reach this app. |
| Pay on the Clover terminal | Invoice → Payments → **Pay on terminal** sends the amount to the physical Clover device (REST Pay Display); the customer taps or inserts their card on the device and the payment lands on the invoice. Needs the device serial in Settings → Clover and the **Cloud Pay Display** app installed on the device. |

Setup (sandbox first, then production):

1. **Sign in with Clover (recommended).** Register one app in the [Clover developer dashboard](https://sandbox.dev.clover.com/developers) (and again in the production dashboard when going live): redirect URL `https://<your-app>/api/clover/callback`, permissions Merchant read, Orders read/write, Payments read/write, Online payments. Put its App ID and App secret in Vercel as `CLOVER_APP_ID` and `CLOVER_APP_SECRET`, redeploy, then **Settings → Clover → Sign in with Clover**. The merchant id, API access and the card-entry key all come back from Clover; tokens are stored encrypted (`clover_connections`, service role only) and refreshed before they expire. The Terminal shows a live connection pill; an expired sign-in turns into a one-click **Reconnect**.
2. **Or manual tokens.** Merchant dashboard → **Settings → API tokens** (Orders read/write, Payments read/write) → `CLOVER_API_TOKEN`; **Ecommerce API tokens** ("Hosted iFrame + API/SDK") → `CLOVER_ECOM_PRIVATE_TOKEN` and `CLOVER_ECOM_PUBLIC_KEY`. Enter the merchant id under **Settings → Clover → Advanced**.
3. `CRON_SECRET` (any long string) protects the daily payment sync; `CLOVER_WEBHOOK_SECRET` (any long string) protects the pay-by-card-link webhook.
4. In Clover's Hosted Checkout settings set the webhook URL to `https://<your-app>/api/clover/webhook?secret=<CLOVER_WEBHOOK_SECRET>` and the redirect URLs to `https://<your-app>/pay/done?ok=1` (success) and `…/pay/done?ok=0` (failure/cancel).
5. **Settings → Clover**: add the terminal serial for Pay on terminal. The **Getting set up** checklist on the Terminal and Settings pages lists anything still missing.

Reliability: every Clover call has a 20 s timeout and retries transient failures (network, 429, 5xx) with backoff; the device wait is never replayed. Successful calls stamp the connection as healthy; a 401/403 flags it for **Reconnect** instead of surfacing a cryptic error.

Limits: hosted checkout cannot refund or void through the API, so refunds are done in Clover; a refunded card payment is removed from the invoice by deleting the payment row (it returns to the match queue). Secrets never touch the database; only the merchant id and toggles are stored.

## Charge a customer in three taps

1. **New** → log the car → **Save & charge** (admins, online). The car is saved as its invoice and mirrored to Clover as an order.
2. The **Terminal** opens with that invoice selected and the balance on the keypad. Tap **Terminal** (the Clover device), **Card**, or **Cash / Check / ACH**.
3. The customer taps their card. The payment lands on the invoice, the receipt is one tap from the dealership's AP email or the printer.

Also: **Collect** on every open invoice (invoice page and list) opens the Terminal with that invoice ready; the invoice page's **Collect** menu offers the terminal, card in the app, cash/check, emailing the invoice with a pay-by-card link, or **Send payment link** on its own: the Clover checkout link (made on the spot if the invoice has none) emailed to the AP contact or any address typed in, copied, or shared to Messages from a phone. Every send is logged in the invoice's history. A **Clover setup** checklist sits on the Terminal and Settings until every piece (tokens, merchant ID, connection test, device serial, card keys, webhook) is in place.

## Charge several invoices at once

Terminal → **Invoices** → tick any set of open invoices, or **Select all unpaid** (the search box narrows it to one dealership). The keypad shows the combined balance; one card tap, one terminal payment or one check settles them all. Money is applied **oldest invoice first**: lowering the amount pays the older ones in full and leaves the newest partly open. One receipt lists every invoice; refunds are still per invoice. **Collect all unpaid** on the Invoices page opens the Terminal with everything selected; Collect on a row is the one-by-one path.

## Terminal (point of sale)

The **Terminal** tab does what the Clover terminal does, from the app:

| Take | Card typed in the app (Clover iframe), card on the physical Clover device, cash, check, ACH. **Invoices** comes first and is the default: every open invoice is listed as its car ("4821 · 2024 GLE 450", then invoice number, dealership, service and day), searchable by tag, model, number or dealership; tick one or several and the balance fills in (partial payments allowed). **Quick sale** is for anything that is not an invoice (description, customer name, email for the receipt). "Other" is not offered on the Terminal; the invoice page's Add payment still has it for money that came another way (Zelle, dealer credit). |
| Receipt | Email or print from the Paid dialog and from any transaction in the day's list. With **Settings → Receipts → Email a receipt automatically** on (off by default), every invoice payment from any path (Terminal, invoice page, card in the app, Clover device, pay link, matched Clover payment) emails the dealership's AP contact the receipt right away and shows as sent; a failed email only logs and never undoes the payment. |
| Refund | Any sale, full or partial. Card refunds go back to the same card through Clover; invoice-linked refunds shrink or remove the invoice payment and the invoice goes back to partial/unpaid. Pay-by-card-link (hosted checkout) payments are refunded from the Clover dashboard. |
| Receipts | Email (Resend, same env as invoice emails) or print (only the receipt prints). |
| The day | Every transaction for the chosen day, including payments recorded on invoice pages or matched from Clover, with sales / refunds / net and per-method totals. Counter sales count toward dashboard income. |

Ledger: `terminal_sales` (migration `0011`). Refund bookkeeping is one RPC, `refund_terminal_sale`; the day list is `terminal_transactions`. Not included: tips, SMS receipts, cash-drawer or printer hardware.

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

`Invoice Number, Invoice Date, Period Start, Period End, Vendor, Vendor EIN, Dealership, Dealership Address, Line, Service Date, Key Tag, VIN, Year, Make, Model, Color, RO/PO, Service, Detailer, Amount, Invoice Subtotal, Invoice Tax, Invoice Total, Payment Terms, Status`

Rules: UTF-8 with BOM, CRLF, RFC 4180 quoting, dates as `yyyy-mm-dd`, amounts with two decimals, one row per service line. New columns are only ever appended. A future DMS/AP integration can consume this file unchanged or read `invoice_items` directly.

## Operations notes

- **Locked cars**: a car on a sent or paid invoice cannot be edited. While the invoice is an unsent draft, **Edit invoice** / **Delete invoice** on the invoice page do the right thing; when Clover order push is on, an edited invoice's Clover order is replaced with the new lines (the old order is deleted and any pay-by-card link is remade). After that, void the invoice (only if no payments are recorded) to unlock the car; it then shows under *Cars with no invoice* on the dashboard and `/invoices/new` re-invoices it.
- **Applying 0015 to an existing database**: `pnpm db:push` (or paste the migration in the SQL editor). The backfill gives every uninvoiced car its own draft invoice, in `performed_at` order, so invoice numbers follow the calendar.
- **Tax**: company default is 0 %; set per dealership if a dealer requires it. Rates are fractional in the database (`0.0775`), percentages in the UI.
- **Timezone**: `companies.timezone` decides which calendar day a job belongs to for invoice periods and the dashboard.
- **Logo**: upload in Settings → Company; the PDF uses it (grayscale bundled mark on the print variant).
- **Data ownership**: Settings → Export downloads every table as CSV at any time.
