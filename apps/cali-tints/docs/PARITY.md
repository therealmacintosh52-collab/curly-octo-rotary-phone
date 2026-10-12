# Parity: every tagged line of the brief

Source tags: **DOC** the brief's own text · **TEK** Tekmetric · **QIQ** QuickQuote-style estimating · **ALP** AutoLeap · **URB** Urable · **ORB** Orbisx · **MC** ManyChat · **ZAP** Zapier/Make.
Status: **Built** (in the app, tested) · **Partial** (part of it, the rest noted) · **Existing** (was in the app before the retail work) · **Not built**.
Flag: the env flag that switches it on, or **none** when it runs with zero paid keys.

Decisions that shaped the table (2026-10-12): same business (Mike's shop, retail side), one company, no Stripe / Twilio / AI / Meta; Clover is the only processor; a 20 % non-refundable deposit; a booking without a paid deposit is a Lead until staff confirm; estimate money is owner + admin only; e-signature on the estimate and on the paid receipt.

## Module 1: core data and vehicle ID

| Feature | Source | Where it lives | Status | Flag |
|---|---|---|---|---|
| Entity set (customers, vehicles, services, estimates, appointments, jobs, payments, photos, audit log) | DOC | `0037`–`0042`, `src/lib/db/types.ts` | Built (no inventory, memberships, inspections tables) | none |
| Customer profile: contact, consents, source, tags, notes, timeline, lifetime spend | DOC | `customers`, `customer_timeline`, `/retail/customers/[id]` | Built (spend from the ledger; owner/admin) | none |
| Vehicle profile and history (VIN, YMM, trim, body class, size class, color, plate, odometer) | DOC TEK | `vehicles`, `odometer_readings`, `/retail/vehicles/[id]` | Built | none |
| Services done per vehicle | DOC TEK | timeline (jobs, appointments, estimates) | Built | none |
| Products / chemicals used per vehicle | DOC TEK | — | Not built | none |
| Pre-existing damage, inspections, declined work on the vehicle | DOC TEK | `job_findings` (severity, status), `vehicle_open_findings`, the customer page | Partial (findings and declined work kept per vehicle; no diagram, no inspection templates) | none |
| "Next visit" notes | DOC | `customers.notes`, `vehicles.notes` | Partial (free text, no reminder) | none |
| VIN barcode scan | DOC URB ALP | `vin-scanner.tsx`, Clover scanner bridge | Existing | none |
| VIN plate / door-jamb photo → vision reads the VIN | DOC | — | Not built (barcode + typed VIN) | `AI_PROVIDER` (reserved) |
| NHTSA vPIC decode (+ size class) | DOC | `src/lib/vin.ts`, `src/lib/vehicles.ts` | Built | none |
| Plate photo OCR, plate → VIN | DOC | — | Not built | paid API |
| Duplicate customer / vehicle alerts and merge; archive | TEK | `find_duplicate_customers`, `merge_customers`, `archive_customer` | Built | none |
| No artificial limits | ORB URB | — | Built (nothing capped) | none |

## Module 2: pricing, canned jobs, estimates

| Feature | Source | Where it lives | Status | Flag |
|---|---|---|---|---|
| Price matrix: service × size class × condition modifier | DOC | `0038`, `service_prices_by_size`, `price_modifiers`, `quote_total`, Settings → Shop menu | Built | none |
| Canned jobs (labor + parts + fees), oil/tire/brake templates, sublets | TEK | — | Not built (oil change, brakes seeded as services) | none |
| Labor rates, parts markup, shop supplies, disposal fee, tax per line type | TEK | `services.taxable`, `retail_settings.tax_all_lines` | Partial (tax per item; no markup/fees) | none |
| Estimate types Standard / Quick / Options / Package | QIQ | `estimate_options` (single or good/better/best) | Partial (single or tiers) | none |
| Quote requests default to Good/Better/Best | DOC | `estimate-builder.tsx` | Built | none |
| Tier descriptions from catalog benefit text only | DOC | `services.benefit_text` | Built | none |
| Expiry date on the PDF, PO number, creator | QIQ | `estimates.expires_at`, `po_number`, `created_by` | Built | none |
| Staff "mark accepted" → authorization record | QIQ | `mark_estimate_accepted`, `estimate_authorizations` | Built | none |
| Scheduling from an estimate carries its notes and lines | QIQ | `book_appointment(p_estimate)`, "Schedule it", `/book?e=` | Built | none |
| Public estimate page: token link, tiers, add-ons, live total, e-sign, pay choice, viewed timestamps, matches the PDF | DOC QIQ ALP TEK | `/e/<token>`, `estimate_by_token`, `estimate_respond`, `/api/e/[token]/pdf` | Built | none (deposit payment needs `DEPOSITS_ONLINE=clover`) |
| Per-item approve / decline on the public page | DOC | add-on toggles | Partial (add-ons per item; the chosen tier as a whole) | none |
| Deposit priced on the chosen option | QIQ | `estimates.deposit_required` | Built | none |
| Public instant-quote calculator → book | DOC | `/book` (size → services → price) | Built | none |
| Branded estimate / invoice templates | URB | `src/lib/estimates/pdf.tsx`, `src/lib/receipts/pdf.tsx` | Built | none |
| Contract attachments with e-sign | QIQ | — | Not built | none |
| AI estimator from photos | QIQ | — | Not built | `AI_PROVIDER` (reserved) |
| AI chat editor in estimates | QIQ | — | Not built | `AI_PROVIDER` (reserved) |
| Mass invoicing of completed jobs | QIQ | month close (dealership side) | Existing (dealerships only) | none |
| Sales pipeline board | QIQ | `/retail/estimates` status chips | Partial (a list with status filters, not a board) | none |

## Module 3: booking and capacity

| Feature | Source | Where it lives | Status | Flag |
|---|---|---|---|---|
| Service duration, required resources, skill, start windows | DOC | `services.duration_minutes`, `required_resource_kinds`, `required_skill`, `start_window_*` | Built | none |
| Multi-resource slot logic (every resource + a qualified tech free for the block) | DOC | `find_slots`, `_find_free`, `_resource_busy` | Built | none |
| Long jobs in start windows, short ones fill gaps | DOC | `_booking_needs` (tightest window wins) | Built | none |
| Tech time off, blackout days, daily capacity | DOC | `time_off`, `blackout_days`, `business_hours` | Built (capacity = the resources) | none |
| Line-item scheduling (own date / tech per line) | URB | — | Not built (one block per appointment) | none |
| One engine for the booking page, staff, estimates, (later) the AI | DOC | `find_slots` | Built | none |
| Online booking page + lead form | QIQ URB ORB | `/book`, `booking-wizard.tsx` | Built (no embeddable widget) | none |
| Per-service intake questions feeding modifiers | ORB | `price_modifiers.ask_customer`, `question` | Built | none |
| Self-schedule after e-sign; staff calendar preview | QIQ | `/e/<token>/done` → `/book?e=`, `/retail/calendar` | Built | none |
| Deposit confirms the booking: hold N minutes, reminder at N−10, release | DOC | `create_hold`, `hold.expiring` rule, `release_expired_holds` | Built | none |
| Lead → Booked on the payment webhook | DOC | `record_payment_system_retail` → `_apply_paid_deposit` | Built | `DEPOSITS_ONLINE=clover` |
| Confirmations and reminders (24 h, 2 h) | ORB URB | rules `booking_booked`, `booking_reminder` | Built (email + queued text) | none |
| Abandoned booking recovery after 15 minutes | DOC | rule `hold_abandoned` (`abandoned_minutes`) | Built | none |
| Reschedule / cancel via link, policy enforced | DOC | `/a/<token>`, `cancel_hours` | Built | none |

## Module 4: payments, deposits, memberships, gift cards

| Feature | Source | Where it lives | Status | Flag |
|---|---|---|---|---|
| Processor behind a flag (Clover hosted checkout) | DOC | `src/lib/clover/`, `/api/clover/webhook` | Built (Clover only; no Stripe by decision) | `DEPOSITS_ONLINE` |
| Deposits: amount, non-refundable by policy, applied to the final bill | DOC | `retail_settings.deposit_*`, `payments`, `retail_charge` | Built | none |
| Text-to-pay, receipts by text / email, refunds, webhooks drive status | ALP DOC | pay link copy, `receipt` template, `refund_payment`, webhook | Built (refund is a ledger record; the money moves in Clover) | `DEPOSITS_ONLINE` for the link |
| In-shop final payment: balance screen, mark paid by method + reference | — | `retail-payment.tsx` v2 | Built | none |
| Clover Flex push (Cloud Pay Display) | DOC | — | Not built (Secure Pay inside the Clover app exists) | — |
| Tipping on the payment page | URB | — | Not built | — |
| BNPL | URB DOC | — | Not built | — |
| Memberships | QIQ | — | Not built | — |
| Gift certificates | ORB | — | Not built | — |

## Module 5: intake, photos, inspections

| Feature | Source | Where it lives | Status | Flag |
|---|---|---|---|---|
| Walk-around photos, compression, offline queue, timestamps | DOC | `job_photos`, `photo-picker.tsx`, outbox | Existing | none |
| Video, resumable uploads, odometer / fuel / keys at intake | DOC | clips on a finding (`src/lib/media/upload.ts`, TUS over 6 MB), odometer (`add_odometer`) | Partial (video + resumable yes; fuel / keys no; findings need signal) | none |
| Damage pins on an SVG diagram | DOC | — | Not built | none |
| Customer e-sign of pre-existing condition | DOC | — | Not built | none |
| AI damage assist | DOC | — | Not built | `AI_PROVIDER` (reserved) |
| Before / after overlay camera, composite, share link | QIQ | before / after kinds exist | Partial | none |
| Digital vehicle inspection (templates, G/Y/R, report) | TEK ALP DOC | — | Not built | none |
| Repair-symptom intake | DOC | — | Not built (brake / noise inspection is a bookable service) | none |

## Module 6: work orders, board, approvals

| Feature | Source | Where it lives | Status | Flag |
|---|---|---|---|---|
| Work board with custom stages | ALP | appointment statuses, Today | Partial (fixed statuses, no board) | none |
| Tech mobile view | ALP | My jobs, Retail Today, the RO notes tab (`ro-notes.tsx`) | Partial | none |
| Mid-job upsell → updated estimate link → approve | DOC TEK | new estimate from the customer page | Partial (manual) | none |
| Declined work saved and resurfaced | TEK DOC | `job_findings.status = declined`, "From last time" on the next RO, the customer page count | Built (no drip yet) | none |
| Status texts (checked in, ready) | URB | — | Not built (rules exist for booked / reminder / cancelled only) | none |
| Real-time dashboard: today's jobs, deposits outstanding | ALP | Retail Today, `retail_money_summary` | Built (refresh on load, not live) | none |

## Module 7: California BAR compliance

| Feature | Source | Where it lives | Status | Flag |
|---|---|---|---|---|
| Write It Right rules blocking start / finalize | — | — | Not built | none |
| Signed documents immutable with versions | — | `estimate_authorizations` append-only, signatures bucket | Partial | none |

## Module 8: messaging and inbox

| Feature | Source | Where it lives | Status | Flag |
|---|---|---|---|---|
| One inbox per customer (web chat, SMS, DM, email) | ALP ORB MC | — | Not built | — |
| Free SMS deep links + email | — | Text the link, `text_queue` (`sms:` href) | Built | none |
| Twilio two-way SMS | — | — | Not built (by decision) | `SMS_PROVIDER` (reserved) |
| Tap-to-call + call notes | ORB | `tel:` links on the customer page | Partial (no call notes) | none |
| Missed-call text-back, caller recognition, RCS | — DOC | — | Not built | — |
| Editable templates with variables; every send logged | — | Settings → Booking templates (11), `automation_runs` | Built | none |

## Modules 9, 10, 11: AI assistant, social automation, command bar

| Feature | Source | Where it lives | Status | Flag |
|---|---|---|---|---|
| AI sales assistant (web → SMS → IG/FB), server tools, hard rules, spend cap | DOC ALP | — | Not built (zero paid keys by decision) | `AI_PROVIDER` (reserved) |
| Meta comment / DM / story triggers, flow builder, drips, hand-off | MC DOC | — | Not built | Meta app |
| Fallback inbound lead endpoint | — | — | Not built (`/book` is the lead form) | none |
| Owner command bar | QIQ | — | Not built | `AI_PROVIDER` (reserved) |

## Module 12: retention and marketing

| Feature | Source | Where it lives | Status | Flag |
|---|---|---|---|---|
| Review engine after completed + paid, skip recent / reviewed | DOC ORB ALP | rule `job_review`, `review_url`, `mark_reviewed` | Built | none |
| Maintenance / warranty reminders by months or miles | DOC TEK URB | — | Not built | none |
| Declined-work drip over 30–60 days | DOC TEK | — | Not built | none |
| Cross-sell from findings | DOC | — | Not built | none |
| Follow-ups after estimates, auto-stop | QIQ | rule `estimate_nudge` (stops when answered) | Built | none |
| Segment builder, campaigns, reports | TEK DOC | — | Not built | none |
| Weather campaigns, paid ads | DOC | — | Not built | — |
| Consent, STOP, quiet hours, send log | — | `sms_opt_in`, `marketing_opt_in`, quiet hours, `automation_runs` | Built (STOP handling needs a provider) | none |

## Module 13: automation engine

| Feature | Source | Where it lives | Status | Flag |
|---|---|---|---|---|
| Internal events list | ZAP URB | `events` (hold, booking, estimate, payment, job kinds), `_derive_events` | Built | none |
| Rule builder when → wait → if → action | ZAP URB | `automation_rules`, Settings → Booking → Automations | Built (edit delay / action / template; no free-form condition editor) | none |
| Default rules shipped | — | `seed_automation_defaults` (11 rules) | Built | none |
| Run log; dry run; outbound webhooks | — | `automation_log` | Partial (log yes; no dry run, no webhooks) | none |

## Modules 14 to 21

| Feature | Source | Where it lives | Status | Flag |
|---|---|---|---|---|
| Inventory, parts status, POs, vendors, PartsTech | URB ORB TEK ALP DOC | — | Not built | — |
| Account-level wholesale price lists | DOC URB | `dealership_service_prices` | Existing | none |
| Dealer portal login, VIN submission, fleet automation | DOC URB | — | Not built | none |
| Consolidated monthly invoice, terms, reminders, aging | DOC URB | `/invoices`, QuickBooks | Existing | none |
| Expenses, P&L, reports, sales tax summary | ORB TEK ALP | owner dashboard, exports, Today money tiles | Partial | none |
| Team clock-in, job clocks, commission | URB ORB ALP | roles only | Not built | none |
| Mobile service, routing, dispatch | DOC URB QIQ | — | Not built | — |
| Voice AI receptionist | ALP QIQ | — | Not built | — |
| AI after-preview, coverage selector, photo sorting | DOC QIQ URB | — | Not built | — |
| Multi-location, public API, CSV import | URB QIQ | `company_id` everywhere; Settings → Export | Not built (export exists) | none |

## Cross-cutting

| Requirement | Where it lives | Status |
|---|---|---|
| Roles owner / admin / advisor / manager / detailer, RLS, audit | `is_owner()`, `is_admin()`, `can_price_jobs()` (owner, admin, advisor), `audit_log` | Built |
| Customer access by token only (no customer login) | `anon` executes token RPCs; no table grants | Built |
| Webhook signature verification | `/api/clover/webhook` shared secret + verification handshake | Built |
| Secrets env-only, `.env.example` | `.env.example` | Built |
| Media signed URLs, compression | photos, signatures bucket (server-side writes) | Built |
| PWA offline intake | outbox (jobs); customers need signal | Partial |
| America/Los_Angeles | `companies.timezone` | Built |
| Test mode flags for payments / messaging | `DEPOSITS_ONLINE=none`, `CLOVER_ENV=sandbox`, no SMS provider | Built |
| Source URLs in code comments | `src/lib/clover/*.ts` (docs.clover.com) | Partial |
