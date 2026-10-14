# Cali Tints — jobs by the day, one invoice a month

A mobile-first, offline-capable PWA that replaces handwritten invoices for a detailing vendor working inside Mercedes-Benz dealerships.

- **Log every car.** A job takes seconds from the lot (stock number, scan the VIN, tap services, photos, Save). Works with no signal; it syncs when the device is back online.
- **Straight into QuickBooks.** Every saved job becomes a line on the dealership's open QuickBooks invoice for the month, numbered by QuickBooks, within seconds. Mike sends it and takes payment in QuickBooks; the app tracks the number, balance and payments. On the 1st the month closes here and the app keeps a mirror of the invoice. Nobody types anything into QuickBooks.
- **Get paid.** Record the check, ACH or card payment when it arrives. Partial payments and overdue reminders are built in.

Stack: Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · shadcn-style UI on Radix · Supabase (Postgres, Auth, Storage, RLS) · Resend · Vercel.

---

## Contents

1. [Features](#features)
2. [Project layout](#project-layout) · [Retail OS: architecture, module map, flags, phone checklist](#retail-os-the-shops-everyday-customers)
3. [Local setup](#local-setup)
4. [Supabase setup](#supabase-setup)
5. [First sign-in and demo data](#first-sign-in-and-demo-data)
6. [Guest preview](#guest-preview-share-a-link-no-login)
7. [Email (Resend)](#email-resend)
7. [QuickBooks Online](#quickbooks-online)
7. [The Clover app](#the-clover-app)
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
| New job `/jobs/new` | Required: date, stock number, year, make, model, color, at least one service. Big stock number input, VIN camera scan (Code 39/128, QR, DataMatrix, PDF417; the Clover scanner inside the Clover app) → NHTSA decode with cache, Mercedes model list + free text, Make has an **Other** you type in, service chips with no prices (every service is billed at the price list in Settings; nobody sees or changes a price on a job), **Other** asks what was done (and, for the owner or an admin, the amount) and puts that on the invoice line, 7-day duplicate warning, before/after photos. **Save & next** saves the job; the success card offers **Open job** |
| Photos | Optional on every job: one Take a photo button opens the device camera (or the in-app camera where a WebView has no file chooser, e.g. the Clover Flex), compresses to ~0.4 MB JPEG, up to eight per car. Job page: gallery, lightbox, **Add photos**, Remove while the job is open. Storage `job-photos/<company>/<job>/<client_id>.jpg`; a retried upload overwrites the file and skips the row (`job_photos.client_id`, migration `0030`) |
| Offline | Jobs queue in IndexedDB with their compressed photos and sync when online (idempotent on a client id, so retries never duplicate). `/jobs/outbox` shows the queue with retry/discard. App shell is cached by a service worker |
| Jobs `/jobs` | Every car logged, newest first under day headers. Search stock number/VIN/model/service/dealership, or a date (`9/27`, `sep 27`, `september`, `yesterday`, `last week`), or scan the VIN barcode on the car; filter by dealership, detailer, service, dates; **All · Not invoiced · Invoiced · Archive**. Detailers see their own jobs. A job page shows the car, services, photos and where it stands (logged → on the month's invoice → paid); **Edit job** and **Delete job** while it is not on an invoice; deleted jobs sit in the Archive and can be restored |
| Monthly invoices `/invoices` | Owner only. On the 1st the daily job (`/api/cron/daily`, `close_month()`) turns every dealership's jobs from the month into one invoice: numbered, lines snapshotted, jobs locked. With **Email each month's invoice automatically** on (Settings, default on) it is emailed to the dealership's AP contact right away; otherwise it waits as Not sent. **This month so far** shows each dealership's running count and total with **Invoice now** to close one early. Search by number, dealership, a stock number on it or a month; **All · Unpaid (Not sent / Sent / Partial) · Overdue · Paid · Void · Archive**; **Send invoices** emails any unsent ones (see the email first). `/invoices/new` re-invoices jobs left behind by a voided invoice, with the VIN/tag double-billing check |
| Invoice page | One dealership, one month: every car and service line, subtotal/tax/total, where it stands (logged → sent → paid). **Add payment** records the check, ACH, card or cash that arrived. Branded and print-ready PDF, CSV, Excel; submit by email (Resend) with full send history; manual mark-as-submitted with confirmation upload; partial payments; void (jobs go back to Not invoiced) |
| Dashboard `/` | **Owner**: cars detailed today by service (a normal day is about 3 Used, 2 PDI, 4 Sold), this week and month, **Unpaid** (still to collect, this month so far, not sent yet, sent and unpaid), collected, overdue reminders (configurable), and **Income** for any date range; **Breakdown** shows one month at a time by service and by week. **Admin / manager**: the whole team's day, counts only (today by service, this week, this month, cars per detailer, today's cars, the last 30 days). Every number opens the Jobs list filtered to the cars behind it |
| Settings `/settings` | Company profile + logo, monthly invoicing (email automatically, **Run month close** now), **QuickBooks Online** (owner: Connect, Sync now, auto-send, service item), dealerships (AP contacts, submission method, tax overrides), services grouped by category (seeded with the real menu: PDI $60, Sold $20, Used $200, Service Loaner Detail $125, Touch Up Detail $20–40, Tint Removal $40, Paint Correction about $50 ($40–60); a service can carry a quoted range inside which no override reason is needed) + per-dealership price grid, users (password or email invite, roles, reset), full CSV export |
| Retail (the shop) | A location flagged **Retail** in Settings → Dealerships (seeded as *Cali Tint · Fulton Ave*) is the company's own counter. Its jobs are logged the same way but never put on a monthly invoice or into QuickBooks by the app; they show **Collect** until paid. Inside the Clover app, **Collect on this Clover** opens Clover's payment screen (Secure Pay) for the job's total and records the payment on the job (`record_retail_payment`); the owner or an admin can record cash or a check by hand. Clover's own QuickBooks app books those card sales if Mike wants them in the books |
| Findings on every estimate and invoice | A **side panel** (a Notes tab on a phone) on each retail estimate and invoice where the tech writes **notes, findings (green / yellow / red), photos, short clips and recommendations** (a finding with a suggested service; **Add to this estimate** puts it on the quote). Findings live on the **estimate** from the start (any member can write while it is open, so the tech inspects before anything is approved) and move onto the invoice at approval, so both pages list the same rows (migration `0050`). A note can be **Internal only**. The customer sees the rest: **Send findings** (owner, admin, advisor) texts it (the phone's own messaging app, prefilled) or emails it (template *Findings*, editable in Settings → Booking) with a link to `/e/<link>` (a draft quote shows "your quote is being prepared" and cannot be answered) or, once approved, `/r/<link>`, which is now the customer's **invoice page** as soon as the invoice exists (amount due, pay at the shop, what we found) and their receipt once paid. Both PDFs list the findings. |
| Retail car lookup bar | At the top of every Retail screen: **license plate**, **VIN** (typed or scanned) and **mileage**. A car on file (plate with any spacing, or VIN) shows its owner and last mileage and starts **New estimate** with the customer, the car and the mileage filled in; a car not on file is decoded from its VIN (NHTSA) and the estimate starts with "add this car" (plate, VIN and mileage saved with it). The mileage is stored on the estimate (`estimates.odometer`, migration `0049`), logged as a reading on the car, and carried to the invoice, which shows it with the plate; the estimate page and PDFs show it too. Any role can look a car up; only owner, admin and advisor start estimates. |
| The estimate screen | Migration `0051`. **Customer on the left, the car on the right** (year, make, model, trim; VIN and license plate; engine size and engine code; mileage). **Diagnosis** and **Repairs** are two itemized sections under them, each with its own *Add a line* and subtotal (the menu chips sit in Repairs); on the customer's page, the PDF and the invoice the lines are grouped the same way (a Diagnosis line carries "Diagnosis ·" onto the invoice). A **Summary | Findings** tab on the side gives the technician and the advisor the findings panel while they itemize, and the customer sees the same findings with the quote. A blank draft estimate is created the moment the customer is picked (so the tech can add findings at once); it is always an estimate first, and nothing becomes an invoice until the customer approves. A draft that was never sent can be deleted. Sending an estimate with no lines is refused. Not built: crediting the diagnosis fee against the repairs when they are approved. |
| Retail starts with an estimate | **There is no "New job" for retail.** A retail customer's path is **Customer → Estimate → approved and signed → Invoice `RI-…` → paid at the counter**. Approving the estimate (the customer on their phone, or staff recording it at the counter) creates the retail job and its invoice at once, with the approved lines at the quoted prices and any deposit applied (migration `0048`, `_convert_estimate_core`); a supplement estimate lands on its repair order the same way. A booked appointment can still be checked in without an estimate. The global New job form is dealership-only and `create_job` refuses the retail location. Retail → **Work** lists the shop's repair orders. Everything stays out of the dealership monthly invoices and QuickBooks. |
| One repair order through its stages | Migration `0052`. One RO moves **Estimate → Work in progress → Invoice → Paid/Closed** under one number (`RO-000123`, minted when the estimate is first sent; a supplement carries the RO it was written for), with a **stage bar** on the estimate, the repair order and the invoice (derived from the facts, never typed in). The header carries the customer's **concern in their words**, the **mileage in** and the advisor's **initials** (initials only: the no-names rule on invoices stands). **Approval makes the RO, not the invoice**: the approved lines come across tied to their estimate line and the authorization that covered them (`job_services.estimate_line_id`, `authorization_id`), and the invoice (`RI-…`, own counter, never QuickBooks) is made by **Convert to invoice** (owner, admin, advisor) from that same record. `job_authorizations` is the append-only record of who authorized what, how, when and for how much (check-in, estimate, change order; amounts only for those who price jobs). **Work nobody authorized is flagged *Not authorized* and blocks the invoice**; payment at the counter waits for the invoice; the plain job editor can no longer change a retail RO's lines (they change through an estimate). **Check-in** (appointment page) takes mileage in, the concern, and the initial authorization (name and signature, or by phone) before the RO opens. The customer's `/r/<link>` shows *where your car stands* (the concern, what is approved so far, no amount due) until the invoice exists. Existing retail invoices are backfilled as converted. Not yet: completion notes (mileage out, cause and correction, quality check), named jobs with priority, declined-work reminders (the next slices). |
| Side notes with actions (0053) | Each finding on the side panel carries a severity chip, "2 photos · 1 video", the note, and **RECOMMEND REPLACE / DIAG / MONITOR** (also on the customer's page and the PDFs). An icon row under it: **Add to estimate** (owner, admin, advisor) prices the fix right there: labor (hours × the shop rate), parts, fees, with the total "**plus tax**"; saving puts every line on **one estimate** (the finding's own, or one supplement draft on its RO) and the panel says *Estimate so far $X plus tax*. **Camera** and **Upload from the phone** add a photo or clip to an existing finding (any member who can write). **Share** texts, emails or copies the link for that finding. The estimate edit screen leaves the Add-to-estimate icon off on purpose (the builder owns the lines there; its own *Add to this estimate* link still works). |
| Plate or VIN lookup | A plate in the bar at the top of Retail, or in the estimate's Vehicle card, finds the car **in your own records** and brings its **VIN, year, make, model, trim and engine** by itself; a plate that belongs to another customer says so and offers their estimate. A plate nobody knows says there is no VIN yet and leaves the VIN to **type or scan**; a complete VIN is decoded (NHTSA, free) and fills the car, and everything stays editable by hand. A **paid plate-to-VIN service is wired as a flag and OFF** (`PLATE_PROVIDER`, `PLATE_PROVIDER_KEY`): no vendor adapter is bundled until you choose one (it must be written against the vendor's documentation, and it returns vehicle data only, never the owner). Caching of paid lookups arrives with that adapter. |
| Retail → Invoices `/retail/invoices` | **Retail has its own invoicing, apart from the dealerships.** Every retail repair order is also an invoice numbered `RI-000123` (its own counter, `jobs.retail_invoice_number`, migration `0047`; the dealerships' are `INV-…`). The list (To collect / Paid / All / Void, search by number, name, phone or car) and the page (lines, tax, deposit, payments, signature, balance, PDF headed *Invoice*) are for owner, admin and advisor; taking the payment stays on the repair order's counter card. Nothing retail is ever on a monthly dealership invoice or sent to QuickBooks (`close_month`, `invoice_now` and the QuickBooks sync skip it; the SQL suite asserts it). **Retail → Jobs** `/retail/jobs` is the shop's own list of repair orders; the dealership **Jobs** tab no longer shows them (`jobs_filtered(p_scope)`). Retail and the dealerships appear together only on the **dashboard**: the dealership numbers, then a **Retail** block (`retail_dashboard()`: cars today and this month, collected this week, retail still to collect; counts only for a manager). |
| Retail → Estimates `/retail/estimates` | Owner and admin write a quote for a walk-in: customer + car (priced by its size class), one option or **Good / Better / Best** built from the shop menu with condition add-ons, add-ons the customer can tick, an "Other" line with a typed amount, good-until date, PO, notes. **Email the link** (Resend, `estimate_sent` template) or **Text the link** (`sms:` from the phone) or copy it. The customer opens `/e/<token>` (no login; 24-byte token): picks the option, ticks add-ons, sees the live total and deposit, types their name, **signs on the screen** and approves (or declines); the signature PNG lands in the private `signatures` bucket, the approval is recorded with time, IP and device (`estimate_authorizations`), the owner gets an email. Staff can also **Mark approved** for an answer taken in person or by phone, **Decline**, and **Create the job** (the chosen lines at the snapshot prices). Branded PDF with the signature. Sent estimates expire on their date (daily cron). Managers and detailers see estimates without money |
| Retail → Calendar `/retail/calendar` | One slot engine in Postgres (`find_slots`) for staff, the public page and the estimate link: a time is offered only when a bay (and a lift when the service needs one) and a tech with the right skill are free for the whole block, inside business hours, off blackout days and time off, honouring each service's start window, the lead time and how far ahead the shop books. Day view (bay / lift / tech badges on each row) and week view; **New appointment** (owner/admin/manager) picks the customer, services priced by the car's size, a time; an approved estimate schedules from its page with its lines and prices kept. Appointment page: Confirm a lead, **Check in** (opens the retail job with the lines at those prices), Done, Move, Cancel, No-show, the customer's manage link. Today shows leads to confirm and live holds |
| Book online `/book` | No login. Car size → services with benefit text and the size price → the add-on questions the owner marked "ask the customer" (Settings → Shop menu) → a time → the spot is **held** (`hold_minutes`, countdown) while they type name, phone, email, two separate consents, the car, how they will pay → a **Lead** the shop confirms (a paid deposit confirms it by itself). `/a/<token>` lets them move or cancel inside the notice window (`cancel_hours`); inside it the page says to call. `?e=<estimate token>` books an approved estimate straight to a time. Emails (Resend, templates in Settings → Booking) for the hold, the confirmation and a cancellation when an address is on file |
| Repair orders (the notes tab) | Every retail job is the shop's **repair order**: numbered `RO-000123` on its own (migration `0043`; dealership jobs keep their stock numbers), shown on the job page, the Jobs list, Today and the customer's visits. The job page has **Job** and **Notes** tabs on a phone (side by side from 1280 px): the tech adds a **note** or a **finding** with a severity (green / yellow / red), a suggested service from the retail menu, photos and a **short clip** (up to 60 s / 100 MB; the phone's camera; resumable upload so a dropped Wi-Fi picks up where it left off), all in one timestamped feed. **From last time** shows findings on the same car from earlier visits that were never done (declined work is kept on the vehicle, and the customer page counts it). Admins and the advisor write on any open job, a detailer on their own; the owner or an admin removes anything, others what they wrote. Checking in an appointment offers **Open the notes**. No names on the feed (the no-names rule on jobs holds). The estimate built from the findings, with labor, parts, fees and sublets, is the next slice |
| Estimates on the RO (labor, parts, fees, sublets) | Migration `0044`. An estimate line is a menu service priced by size (as before) or **labor** (hours × a named shop rate from Settings → Shop menu → Labor rates), a **part** (qty × price, part number, vendor, taxable by default), a **fee** or a **sublet**; the advisor may type their **cost** on any line (staff only, never on the customer's page or PDF; the builder shows the margin). **Shop supplies** = min(% of labor, cap) is a computed amount on the option, never a line the customer can untick. **Build the estimate** on the RO's notes tab turns the open findings into lines (the suggested service, else an hour of labor to price); the estimate is a **supplement** on that RO: its page and the customer's link show the RO, the car and *what we found* with the photos and clips. On a single-option estimate the customer **keeps or declines each item** and signs; declined items stay on the car as findings; the authorization records the approved amount. **Add the approved work to the RO** puts the kept lines on the job (labor / parts / fees / sublets sit on hidden system services, labelled, so the counter balance and the receipt carry them; tax follows). The job page says *Waiting on approval* while the customer has it |
| Automations (Settings → Booking) | One events outbox in Postgres (`events`, written by the booking, estimate and payment RPCs) and eleven shipped rules (`automation_rules`: when → wait → if → do), each one on or off with its own delay and template: hold running out, abandoned booking, booking request received, booking confirmed, reminder before the visit (24 h and 2 h, once per mark), cancelled, receipt after a paid job, **ask for a review** 30 min after a paid job (skipped when asked in the last 90 days or already reviewed; the Google link from Settings), estimate not answered after 3 days, and two "tell me" rules that email the owner (an estimate approved, a new online booking). Vercel Cron calls `/api/cron/automation` **every five minutes**: `enqueue_due_runs` (derives the timed events, matches rules, honours **quiet hours** 20:00–08:00) → `claim_runs` → email through Resend and/or a **queued text** → `complete_run`. Nothing is paid for SMS: a text lands in **Texts to send** on Today, one tap opens the phone's messaging app with the message filled in, then **Sent**. Every run is in the log (sent, skipped and why, failed). Without `RESEND_API_KEY` emails log as skipped, never lost |
| Deposits and the counter | Every payment on one ledger (`payments`: deposit / balance / refund, method, who, when). **Deposits**: 20% by policy; with `DEPOSITS_ONLINE=clover` the customer taps **Pay the deposit** on their booking page or the estimate thank-you page and pays on Clover's hosted checkout (your existing merchant; the link is made the moment they tap because Clover sessions live 15 minutes; the signed webhook at `/api/clover/webhook` is what marks it paid and flips the booking **Lead → Booked**; a redirect proves nothing). With the default `DEPOSITS_ONLINE=none` nothing is charged online: staff **Take the deposit** at drop-off (cash, check, on the Flex; the owner can match an online payment by its id). A paid deposit on an approved estimate books the appointment the moment the customer picks a time. **The counter** collects the balance = total − deposit (Collect on this Clover for that amount, or cash/check), then the customer **signs the receipt** on the phone; the receipt (lines, deposit, payments, signature, timestamp) is a PDF for staff and a `/r/<token>` page + PDF for the customer. The owner records refunds on the ledger. Today shows deposits still due and what came in this week |
| Roles | **Owner**: everything, and the only one who sees invoices, payments, income, the price list and the export. **Admin**: every job, Settings for users and dealerships, may type the amount of an "Other" line. **Advisor** (migration `0043`): runs the retail counter: every job, writes and sends estimates with their prices, sees retail balances, deposits and the money tiles on Today; no invoices, income, dealer price list, Settings, export or cash/check by hand (the Flex only). **Manager**: every job, no settings. **Detailer**: log cars, see and fix their own. Enforced by Postgres RLS and column privileges (migration `0029`): invoices, payments and the price list are owner-only at the database, `services.default_price` and `job_services.price` are unreadable by app users (the owner reads them through `service_prices_v` / `job_service_prices_v`), the money RPCs refuse everyone else, and no price sent with a job is ever saved (migration `0036`: the list price is used, no overrides, no reasons), except the amount the owner or an admin types on an "Other" line. "Other" logged by anyone else is flagged **Needs a price** for them |

## Project layout

```
apps/cali-tints
├── supabase/
│   ├── migrations/      0001 schema · 0002 functions/RPCs · 0003 RLS · 0004 storage · 0005 double-billing guard · … · 0015 one car, one invoice · 0016 search by service · 0017–0026 today by service, paint correction, week, "Other" label, archive, detailer dashboard, manager role, guide · 0027 removes the Terminal and Clover · 0028 jobs by the day, one invoice a month · 0029 only the owner sees money · 0030 photos (client_id, detailer file removal) · 0031 QuickBooks Online · 0032 jobs live in QuickBooks, photo kind · 0033 owner and admin see job prices · 0034 retail location, counter payments · 0035 no employee names on jobs · 0036 no prices on jobs · 0037 retail customers and vehicles · 0038 shop menu, size prices, booking settings · 0039 estimates, public approval page, e-signature · 0040 booking: slots, holds, calendar, public /book · 0041 deposits, the ledger, the signed receipt · 0042 events outbox, automation rules, the text queue · 0043 the Advisor role, RO numbers, the notes tab (findings, photos, clips) · 0044 estimates on the RO: labor, parts, fees, sublets, shop supplies, per-item approval, approved work onto the RO
│   ├── seed.sql         company, 2 dealerships + the shop, the dealer menu and the 12 retail services, the default automation rules
│   └── tests/           SQL test suite runnable on plain Postgres (run.sh): 01_flows (dealership side), 02_retail (the shop)
├── docs/                GO-LIVE.md (the order to go live) · PARITY.md (every line of the brief, where it lives) · STATUS.md (module by module)
├── scripts/seed-demo.mjs   demo users + 60 days of jobs + invoices (uses the real RPCs)
├── public/sw.js         service worker (app shell cache)
└── src/
    ├── app/             routes: (app)/… authenticated · public e/[token], book, a/[token], r/[token] · login, auth/*, api/*, dev/preview/* (dev only)
    ├── components/      ui/ (primitives) · jobs/ · invoices/ · dashboard/ · retail/ · settings/ · offline/ · pwa/
    └── lib/             supabase clients · auth · vin · money · csv · dates · offline (idb) · invoices (pdf/csv/xlsx/email) · retail (quote, slots, templates, email) · estimates · booking · clover (hosted checkout) · receipts · automation (the runner) · quickbooks
```

## Retail OS: the shop's everyday customers

The dealership side (New job → Jobs → one invoice a month → QuickBooks) and the retail side (walk-in customers) share one login, one database, one Settings, one company. They are kept apart by **data and navigation**, not by code: retail screens live under the **Retail** tab and the public pages; a retail job is still a `jobs` row on the shop location, now linked to a customer, a vehicle, an estimate and an appointment. Nothing here is multi-tenant yet, but `company_id` sits on every table so it can be.

### Architecture

```
 customer's phone (no login)                      staff (owner · admin · manager · detailer)
 ┌──────────────────────────────┐                 ┌──────────────────────────────────────────┐
 │ /e/<token>   approve + sign  │                 │ Retail: Today · Calendar · Customers ·   │
 │ /book        size→services→  │                 │         Estimates · appointment pages    │
 │              slot→hold→lead  │                 │ Jobs (dealership) · Invoices · Dashboard │
 │ /a/<token>   move · cancel · │                 │ Settings: Shop menu · Booking (policy,   │
 │              pay the deposit │                 │   hours, bays/lifts/techs, templates,    │
 │ /r/<token>   signed receipt  │                 │   automations + log)                     │
 └──────────────┬───────────────┘                 └──────────────────┬───────────────────────┘
                │ anon client: token RPCs only                        │ RLS + column privileges
                ▼                                                     ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────────┐
 │ Supabase Postgres (security-definer RPCs are the only write path)                        │
 │  customers · vehicles · services (+size prices, modifiers) · retail_settings · resources  │
 │  estimates (+options, lines, authorizations) · appointments (+services, resources)        │
 │  payments · receipt_tokens · jobs (+customer/vehicle/estimate/appointment)                │
 │  events ─► automation_rules ─► automation_runs ─► text_queue        Storage: signatures   │
 └───────┬──────────────────────────────────────────────────────┬───────────────────────────┘
         │ every 5 min: /api/cron/automation                     │ daily: /api/cron/daily
         │ enqueue_due_runs → claim_runs → send → complete_run    │ month close · QuickBooks ·
         ▼                                                       │ expire estimates · holds ·
 Resend (email) · text_queue (owner taps "sms:" link) ·          ▼ stale pay links
 owner email                                      Clover hosted checkout ──► /api/clover/webhook
                                                  (DEPOSITS_ONLINE=clover)   (signed; marks the
                                                                              deposit paid, lead→booked)
```

### Module map (the brief's numbering)

| # | Module | Built | Where |
|---|---|---|---|
| 1 | Core data, vehicle ID | Customers, vehicles (size class from NHTSA), odometer, duplicates + merge, consents, timeline | `0037`, `/retail/customers`, `src/components/retail/customer-*`, `vehicle-*` |
| 2 | Pricing, canned jobs, estimates | Size-class price matrix, add-on modifiers, taxable per line, labor rates, parts / fees / sublets, shop supplies, cost + margin for staff, Good/Better/Best, per-item approval with e-sign, PDF | `0038`, `0039`, `0044`, `/settings/retail`, `/retail/estimates`, `/e/<token>`, `src/lib/retail/quote.ts`, `src/lib/estimates/` |
| 3 | Booking, capacity | `find_slots` engine (bays, lifts, techs, skills, hours, days off, time off, start windows), holds, calendar, `/book`, manage links | `0040`, `/retail/calendar`, `/book`, `/a/<token>`, `src/lib/retail/slots.ts` |
| 4 | Payments, deposits | Ledger, 20 % deposit via Clover hosted checkout (flag) or at drop-off, balance at the counter, signed receipt + PDF, refunds | `0041`, `src/lib/clover/`, `/api/clover/webhook`, `/r/<token>`, `src/lib/receipts/` |
| 5 | Intake, photos, inspections | Photos per job; the notes tab: findings with severity, photos and clips, declined work kept on the vehicle. Damage pins, DVI templates: not built | `0043`, `src/components/jobs/ro-notes.tsx`, `src/lib/media/` |
| 6 | Work orders, board | Every retail job is the RO (RO-000123); statuses (lead → booked → checked in → done) open it; findings → estimate → signed per-item approval → approved work onto the RO (the mid-job upsell); no custom stage board | `0043`, `0044`, `set_appointment_status`, `/jobs/[id]?tab=notes` |
| 7 | CA BAR compliance | Not built (the shop is detailing; brakes/oil are seeded as services only) | — |
| 8 | Messaging, inbox | Email templates with placeholders, `sms:` deep links, the text queue; no inbox, no Twilio | `src/lib/retail/templates.ts`, `text-queue.tsx` |
| 9 | AI sales assistant | Not built (`AI_PROVIDER` reserved) | — |
| 10 | Social automation | Not built | — |
| 11 | Owner command bar | Not built | — |
| 12 | Retention, marketing | Review request, estimate nudge, abandoned-booking follow-up, reminders; no segments or campaigns | `0042` rules |
| 13 | Automation engine | Events outbox, rules (when → wait → if → do), 5-minute runner, quiet hours, run log | `0042`, `src/lib/automation/runner.ts`, `/api/cron/automation` |
| 14 | Inventory, parts | Not built | — |
| 15 | Dealer and fleet | Dealership invoicing, per-dealer prices, QuickBooks (existing); no dealer portal | `/invoices`, `src/lib/quickbooks/` |
| 16 | Money, reports | Owner dashboard, income, exports, QuickBooks (existing); retail money tiles on Today; no P&L | `/`, `retail_money_summary` |
| 17–21 | Team clocks, mobile dispatch, voice AI, visual selling, platform | Not built | — |

### Flags (zero paid keys by default)

| Flag | Values | Default | Effect |
|---|---|---|---|
| `DEPOSITS_ONLINE` | `none` · `clover` | `none` | `clover`: **Pay the deposit** opens Clover's hosted checkout; `none`: the choice is recorded and staff take the deposit at drop-off |
| `RESEND_API_KEY` | key or unset | unset | Unset: every email (estimate link, hold, confirmation, reminder, receipt, review request) is logged as **skipped: not configured**; the queued texts still work |
| `QUICKBOOKS_*` | keys or unset | unset | Dealership invoices to QuickBooks Online; nothing on the retail side depends on it |
| `DEMO_ACCESS_KEY` | string or unset | unset | Turns a deployment into the guest preview on sample data; never set it on the real deployment |
| `SMS_PROVIDER` | reserved | `none` | Not read by any code today. Texts go through the owner's phone (`sms:` links); a paid provider would plug into `queue_text` |
| `AI_PROVIDER` | reserved | unset | Not read by any code today. Modules 9/11 would plug in here |

### Environment variables

| Variable | Needed | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | The project and its public key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server only: users, signatures upload, the cron runners, the webhook |
| `NEXT_PUBLIC_APP_URL` | yes | Every public link (`/e`, `/book`, `/a`, `/r`) and email footer |
| `CRON_SECRET` | yes | Bearer for `/api/cron/daily` and `/api/cron/automation` (Vercel sends it) |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email | Without them emails are skipped and logged |
| `DEPOSITS_ONLINE`, `CLOVER_ENV`, `CLOVER_MERCHANT_ID`, `CLOVER_ECOM_PRIVATE_KEY`, `CLOVER_WEBHOOK_SECRET`, `CLOVER_API_TOKEN` | for deposits online | See `.env.example` and GO-LIVE §7b |
| `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_ENV` | for QuickBooks | Dealership side |
| `DEMO_ACCESS_KEY` | demo only | Guest preview |
| `SUPABASE_DB_URL` | `pnpm db:push` only | Never in the app |

### Phone test checklist (390 px, guest preview or a real install)

1. **Retail → Today**: leads to confirm, holds, today's appointments, the money tiles (owner/admin), **Texts to send** → tap a text → the messaging app opens with the message → back → **Sent**.
2. **Customers** → search → *Ana Lopez* → vehicles, visits, estimates, payments on the timeline → **Mark reviewed**.
3. **Customers → New** → scan a VIN → size chip appears → save.
4. **Estimates → New** → customer, car, Good/Better/Best, an add-on, Other with an amount → Save → **Email the link** / **Text the link** / **Copy link**.
5. Open the link as the customer (`/e/<token>`; demo: `/e/demo-estimate-token-ana-camry-0001`): pick a tier → total changes → tick an add-on → type the name → sign → **Approve** → thank-you page → **Pick a time**. The supplement on the RO (demo: `/e/demo-estimate-token-marcus-tesla-0004`): the RO and the car, *what we found* with the photos, every item with a checkbox → untick one → the total and the supplies follow → sign → Approve.
6. **`/book`**: size → services + the add-on question → price → a day → a slot → details with the two consents → the hold countdown → confirm → done.
7. **`/a/<token>`** (demo: `/a/demo-booking-token-ana-camry-00001`): move, cancel inside the notice window (refused), **Pay the deposit** (only with `DEPOSITS_ONLINE=clover`).
8. **Calendar** → day and week → **New appointment** → appointment page → Confirm → Check in (opens the job) → Done.
9. **Job page** (retail, `RO-000042` in the demo): **Notes** tab → the feed (note, urgent finding with a photo and a clip, a yellow one) → **Add a finding** → severity, title, suggest a service, photo, clip → Save; **From last time** at the top; **Build the estimate** → the builder prefilled on the RO → **Add a line** → Part → Save; the estimate page shows labor / part / fee lines, supplies, cost and margin; **Estimates on this RO** on the notes tab; back on **Job**: Collect on this Clover / cash / check for the balance → **Sign the receipt** → receipt link → `/r/<token>` (demo: `/r/demo-receipt-token-ana-camry-000001`) → PDF.
10. **Settings → Shop menu**: placeholder banner, size price grid (owner), add-ons with "Ask the customer", **Labor rates** (the default), **Shop supplies and tax**.
11. **Settings → Booking**: policy (deposit, hold, notice, review link, quiet hours, follow-up timings), hours, bays/lifts/techs, days off, templates (11), **Automations** (rules on/off, tap a rule → delay/template, **What went out** log).
12. Sign in as a detailer: Retail tab without money anywhere, the Notes tab on their own job; a manager: no settings; an advisor (`?as=advisor` in the demo): estimates with prices and the money tiles, no Invoices tab.

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
| `RESEND_API_KEY`, `EMAIL_FROM` | Invoice and retail emails (see below) |
| `CRON_SECRET` | Bearer for the two cron routes |
| `SEED_*` | Demo credentials for `pnpm seed:demo` |

The full list, with the retail flags, is under [Retail OS → Environment variables](#environment-variables).

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

## QuickBooks Online

**Live**: every saved, edited or deleted job updates the dealership's open QuickBooks invoice for that month (`src/lib/quickbooks/live.ts`: `syncJobMonth` rebuilds the lines from the month's open jobs; created on the first job, deleted if the month empties). QuickBooks numbers the invoice; the number is kept on `quickbooks_month_invoices` and on each job (`jobs.quickbooks_doc_number`, shown as `QB 1061` on the Jobs list and job page). The device calls `POST /api/quickbooks/live {jobId}` right after a job syncs; server actions do the same after edits; the daily sync sweeps every open month. When the month closes, `linkClosedMonths` hands the QuickBooks invoice to the app's mirror invoice (number, balance, payments keep flowing). One `SalesItemLineDetail` line per car × service, BillEmail = the dealership's first AP email, no tax line. Mike sends the invoice from QuickBooks (an `EmailSent` there marks it Sent here) and records payments there; they come back as payments here. Owner only.

1. At [developer.intuit.com](https://developer.intuit.com) create an app (QuickBooks Online Accounting scope). Under *Keys & credentials* add the redirect URI `https://<your-app>/api/quickbooks/callback` (and `http://localhost:3000/api/quickbooks/callback` for local sandbox tests).
2. Set `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET` and `QUICKBOOKS_ENV` (`sandbox` with the Development keys and a sandbox company; `production` with the Production keys). Tokens are stored encrypted (`src/lib/crypto.ts`, key derived from the client secret) in `quickbooks_connections`, readable by the service role only.
3. The owner opens **Settings → QuickBooks Online → Connect QuickBooks**, signs in at Intuit and picks the company. Open invoices are sent over right away.
4. QuickBooks numbers the invoices (the app's own `INV-…` number is only the mirror's id). Nothing to switch on in QuickBooks.
5. Each dealership becomes a QuickBooks Customer (found by name or created; remembered on `dealerships.quickbooks_customer_id`). Every line posts to one Service item, **Auto detailing** by default (found by name or created on the first Income account; `companies.quickbooks_item_id/_name`, changeable in Settings).
6. The daily job (`/api/cron/daily`) keeps every open month live and sends any closed invoice not yet in QuickBooks when **Keep QuickBooks live** is on, then pulls balances: when QuickBooks shows a lower balance than we do, the difference is recorded here as a payment (method *other*, reference *QuickBooks*; `record_payment_system()`, service role only). **Sync now** in Settings and **Send to QuickBooks** / **Resend** on an invoice do the same on demand. Failures show on the invoice (red `QB` badge, message) and in Settings.

Access tokens last an hour and refresh themselves; the refresh token lasts about 100 days of inactivity, after which the owner sees *Reconnect QuickBooks*. Tax: the detailing is labor and the rate is expected to be 0; a non-zero tax amount is noted in the QuickBooks private note rather than mapped to a tax code. **QuickBooks Desktop** is not supported directly; use Settings → Export (CSV) or an invoice's Excel download and import it there.

## The Clover app

`apps/cali-tints-clover/` is an Android WebView shell for the company's Clover devices (Flex, Mini, Station), distributed as a **private app** on the Clover App Market. It adds what the page cannot reach on a Clover: the device's barcode scanner (`window.CaliClover.scan()` → `src/lib/native/clover.ts` → `vin-scanner.tsx`) and the camera for before/after photos (`getUserMedia` granted after the Android CAMERA permission; `photo-picker.tsx` uses the in-app shutter because the Flex has no gallery app). No payments, no Clover data permissions. The APK is built by GitHub Actions (`.github/workflows/cali-tints-clover.yml`); build, signing and the App Market steps are in `apps/cali-tints-clover/README.md` and `SUBMISSION.md`. The public `/privacy` and `/terms` pages are the listing's policy links. The whole go-live order (accounts, Supabase, Vercel, Resend, QuickBooks, Clover, day-one checks, costs) is in [`docs/GO-LIVE.md`](docs/GO-LIVE.md).

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
pnpm test          # vitest: VIN check digit/extraction, money, CSV, date presets, PDF/XLSX/CSV/email renderers, retail quote maths, slots, templates, estimate/receipt PDFs, Clover payload + webhook, the automation runner
pnpm db:test       # migrations + RLS/RPC/trigger tests on a local Postgres 16 (PGHOST/PGPORT/PGUSER env): tests/01_flows.sql and tests/02_retail.sql
pnpm build
```

End-to-end at 390 px (Playwright against a production build in guest mode, `DEMO_ACCESS_KEY=testkey123 pnpm build && pnpm start -p 3200`): `.dev/redesign-e2e.mjs` (dealership screens) and `.dev/retail-e2e.mjs` (every retail screen, the public pages, automations). They live in the gitignored `.dev/` folder of the development checkout.

`pnpm typecheck` runs `next typegen` first so the generated `PageProps`/`LayoutProps`/`RouteContext` types exist on a fresh checkout (CI). `supabase/tests/run.sh` creates a throwaway database, installs a small stub of Supabase's `auth`/`storage` schemas, applies the migrations and seed, then runs `tests/01_flows.sql`, which asserts detailer isolation, idempotent `create_job`, price override rules, invoice generation/locking, payment status transitions, void/unlock, per-job grouping, dashboard stats, storage path policies, and (0015) car-is-invoice: auto-invoicing for detailers and retries, the backfill, edit/delete rules, the filtered list and detailer read access. CI (`.github/workflows/cali-tints-ci.yml`) runs all of the above.

## CSV / DMS integration contract

Per-invoice CSV (`/api/invoices/{id}/csv`, also attached to emails) and the *Invoice line items* export share the same columns, in this fixed order:

`Invoice Number, Invoice Date, Period Start, Period End, Vendor, Vendor EIN, Dealership, Dealership Address, Line, Service Date, Stock Number, VIN, Year, Make, Model, Color, RO/PO, Service, Detailer, Amount, Invoice Subtotal, Invoice Tax, Invoice Total, Payment Terms, Status`

`Detailer` is kept for the import contract but is always empty since migration `0035`: employee names do not travel with jobs or invoice lines (who did a car stays an id for the owner's filters and the team dashboard's counts).

Rules: UTF-8 with BOM, CRLF, RFC 4180 quoting, dates as `yyyy-mm-dd`, amounts with two decimals, one row per service line. New columns are only ever appended. A future DMS/AP integration can consume this file unchanged or read `invoice_items` directly.

## Operations notes

- **Locked jobs**: a job on an invoice cannot be edited. Void the invoice (only if no payments are recorded) to unlock its jobs; the next month close picks them up again, or `/invoices/new` re-invoices them now.
- **Month close**: Vercel Cron calls `/api/cron/daily` at 7am Pacific with `CRON_SECRET`; it is idempotent, so **Run month close** in Settings → Company is safe any time (first-day setup, a missed cron). The same run expires estimates, releases dead holds and closes stale deposit links.
- **Automation**: `/api/cron/automation` runs every five minutes (`vercel.json`; Vercel Pro, since Hobby crons run once a day). Everything it sends is logged under Settings → Booking → Automations; a run is claimed once, so a double call sends nothing twice.
- **Tax**: company default is 0 %; set per dealership if a dealer requires it. Rates are fractional in the database (`0.0775`), percentages in the UI.
- **Timezone**: `companies.timezone` decides which calendar day a job belongs to for invoice periods and the dashboard.
- **Logo**: upload in Settings → Company; the PDF uses it (grayscale bundled mark on the print variant).
- **Data ownership**: Settings → Export downloads every table as CSV at any time.
