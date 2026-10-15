# 916 Dent & Detail

Website, booking engine, CRM (`/admin`), AI booking assistant ("916 Concierge"), dealer portal and SEO for a Sacramento mobile
paintless-dent-repair and detailing business. Next.js 16 (App Router, TypeScript strict), Tailwind v4, Supabase, Stripe, Twilio, Resend,
Anthropic. Owner spec: [`SPEC.md`](SPEC.md) · assumptions: [`DECISIONS.md`](DECISIONS.md) · open items: [`TODO.md`](TODO.md) ·
**launch report, checklist and rollback: [`LAUNCH.md`](LAUNCH.md)** · security review: [`SECURITY.md`](SECURITY.md) ·
per-phase technical reference: [`docs/REFERENCE.md`](docs/REFERENCE.md) · scheduler options: [`docs/SCHEDULER.md`](docs/SCHEDULER.md).

**Status: built and tested locally in mock mode. Not deployed. Nothing is live, no account exists, no real message has been sent.**
Every external service runs in a clearly-labelled mock mode until its keys are set, so the whole product works with zero keys.

## Run it with zero keys

```bash
npm install
npm run dev                  # http://localhost:3000 (dev mode: slow, no perf numbers)
npm run build && npm start   # production build (use this for demos and Lighthouse)
npm run doctor               # which services are live / mock, and exactly what is missing
npm run seed -- --demo       # sample customers, leads, bookings and an escalated chat -> .data/mock-db.json
MOCK_DB_FILE=.data/mock-db.json ADMIN_DEMO_LOGIN=1 npm start   # production build with that data and the demo logins
```

Node 20.9+ (built on Node 22). In the app: `/book` (booking), `/admin` (owner + tech app; the login page shows **DEMO** users in mock mode),
`/dealers` (dealer portal; "DEMO" sign-in), chat bubble bottom-right on every public page.

## Commands

| Command | What it does |
|---|---|
| `npm run verify` | **the release gate**: tsc, eslint, vitest (unit + bot), production build, `check:seo`, `check:owner` (report only; `--strict-owner` makes it fatal), Playwright e2e (mock mode, mobile + desktop), axe on every route class. Exits non-zero on any real failure. `--skip=e2e,axe` / `--only=unit,build` to narrow |
| `npm test` | all vitest tests (`tests/unit`, `tests/bot`) |
| `npm run test:bot` | the 15 Concierge scenarios + 13 adversarial cases (offline mock policy; `BOT_LIVE=1 ANTHROPIC_API_KEY=… npx vitest run tests/bot/scenarios.test.ts` for the live model) |
| `npm run test:e2e` | Playwright against the production build in mock mode (`playwright.config.ts`; starts its own server on :3210; projects `mobile` 390x844 and `desktop` 1440x900) |
| `npm run axe` | axe-core on every public route class, 3 contexts (mobile, desktop, reduced motion) against a running server |
| `npm run lhci` | Lighthouse CI (6 URLs x 3 runs, mobile preset, assertions on the median) against the production build; uses the sandbox Chromium via `CHROME_PATH` |
| `npm run doctor` | environment check, never prints secrets. `-- --production` also fails while a launch service is still in mock mode |
| `npm run setup:admin -- --email you@x.com` | creates the owner login (live: Supabase admin API; mock: prints the demo credentials) |
| `npm run seed` | writes the mock database file (`--demo` adds sample data); live data uses `supabase/seed.sql` |
| `npm run deploy` | **dry run by default**: prints the preflight + `vercel deploy --prod` plan. `-- --yes` runs it (see step 14) |
| `npm run check:owner` | lists every `[OWNER]` placeholder still in the code (the launch checklist) |
| `npm run check:seo` / `check:content` | SEO crawl gate / content-similarity gate (the latter also runs on `prebuild`) |
| `npm run leave-behind` | regenerates `public/dealers/leave-behind.pdf` (set `NEXT_PUBLIC_SITE_URL` first so the QR code is right) |
| `npm run media` | regenerates every image/video asset in `public/` from `brand/` (needs `ffmpeg`) |

---

# Setup guide: every key, in order

Do these once, in this order. Each step says what to click, what to copy, and which variable it feeds. Put values in `.env.local` while
testing locally and in Vercel (Project > Settings > Environment Variables, scope Production) for the real site. **Never commit `.env.local`.**
After each service run `npm run doctor`: it shows LIVE for that service when the keys are right.

Everything marked **[OWNER]** is a business fact only you can supply (phone number, prices, hours...). They are consolidated, with the exact file
for each, in [`LAUNCH.md`](LAUNCH.md) section B.

## 1. Domain and Vercel project
1. Buy or pick the domain (for example `916dentdetail.com`). **[OWNER]**
2. Create a Vercel account and a new project from the Git repository; set the **Root Directory** to `916-dent-detail` (this folder lives inside a larger repo).
3. Framework preset: Next.js (auto-detected). Build command and output are the defaults (`npm run build`).
4. Project > Settings > Domains: add the apex and `www`. Vercel then shows the exact DNS records to create at your registrar. As of writing the apex
   record is an `A` to `76.76.21.21` and `www` is a `CNAME` to `cname.vercel-dns.com`; **use whatever the dashboard shows**. Wait for the green check.
5. Set `NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN` (no trailing slash) in Vercel **before the production build**: canonical URLs, sitemap, schema, OG images,
   Twilio signature checking and the dealer QR code all derive from it. Changing it later needs a redeploy.
6. **Vercel plan:** crons that run every 5/10 minutes (reminders, hold expiry, missed-call text-back) need **Pro**. Hobby only runs crons once a day.
   Alternatives (GitHub Actions, cron-job.org): [`docs/SCHEDULER.md`](docs/SCHEDULER.md). Decide before launch; without it reminders do not go out on time.

## 2. Supabase (database, auth, photo storage)
1. supabase.com > New project. Pick the region closest to Sacramento (West US), set a strong database password (store it in a password manager; the app does not use it).
2. Project Settings > API: copy **Project URL** -> `NEXT_PUBLIC_SUPABASE_URL`, **anon public** key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **service_role** key -> `SUPABASE_SERVICE_ROLE_KEY`.
   The service-role key bypasses all row-level security: server-side only, never in a `NEXT_PUBLIC_` variable, never in the browser.
3. SQL Editor > New query. Run these files **in this order**, one at a time, each must finish without error:
   `supabase/migrations/0001_init.sql` -> `0002_admin.sql` -> `0003_concierge.sql` -> `0004_dealers.sql` -> `0005_security_fixes.sql`, then `supabase/seed.sql`
   (services, two placeholder technicians named "[OWNER] Tech One/Two", Mon-Sat 8-17 hours). Re-running `seed.sql` is safe. Never edit an applied migration: add `0006_…`.
   (CLI alternative: `supabase link --project-ref …` then `supabase db push`, then run `seed.sql`.)
4. Storage: `0005` creates the private bucket `photos` (images only, 5 MB cap) when run in Supabase. Check Storage > Buckets shows `photos` with **Public = off**.
   If you want another bucket name, create it private yourself and set `SUPABASE_PHOTOS_BUCKET`.
5. Authentication > URL Configuration: **Site URL** = `https://YOUR-DOMAIN`; **Redirect URLs** add `https://YOUR-DOMAIN/admin/auth/callback`.
6. Authentication > Providers: keep **Email** enabled (used for owner magic links and dealer passwords). Authentication > Sign In / Providers settings:
   leave "Confirm email" as you like (dealer accounts are created server-side and gated by your approval; owner accounts by `setup:admin`).
   Optional hardening: turn **off** "Allow new users to sign up" once your owner, techs and any dealers exist (dealers sign up through the server, not the public endpoint).
7. Set the app secrets (generate each with `openssl rand -base64 48`):
   `BOOKING_TOKEN_SECRET` (signs booking links and chat sessions, 32+ chars, **required** once Supabase is set), `ADMIN_SESSION_SECRET` (admin cookie, 32+),
   `DEALER_SESSION_SECRET` (dealer cookie, 32+), `CRON_SECRET` (24+, see step 11). Use different values for each.
8. Technicians: in Authentication > Users create each tech (email + password or invite). In Table Editor: add a row in `techs` (name, phone, home_zip, color) and set the
   user's `profiles` row to `role = tech`, `tech_id = <that techs.id>` (create the `profiles` row with the user's id if it does not exist). Edit weekly hours in `tech_availability`.
9. Run `npm run doctor`: Supabase should say LIVE.

## 3. Owner login
```bash
# with the three Supabase variables in .env.local:
npm run setup:admin -- --email you@your-domain.com --name "Alex"
```
It creates (or finds) the Supabase auth user using the service-role key, confirms the email, and writes the `profiles` row with role `owner`. No password is invented or printed.
Sign in at `/admin/login` with **Email me a sign-in link** (needs step 2.5), or pass `--password "12+ characters"` to also set one. A second owner: run it again with `--role admin` (same reach as owner).
`--dry-run` shows what it would do. Alternative with no script: put the address in `ADMIN_EMAILS` and the first magic-link sign-in creates the owner profile.
In mock mode it just prints how to use the DEMO logins. **Never set `ADMIN_DEMO_LOGIN=1` or `DEALERS_DEMO_LOGIN=1` on the real site** (they are ignored when Supabase is configured, and `doctor --production` fails if they are set).

## 4. Stripe (deposits, invoices, memberships, dealer net-terms)
1. stripe.com > create the account and complete business verification (the owner does this). Start in **Test mode** (toggle top right) and finish the whole flow with test cards before going live.
2. Developers > API keys: **Publishable key** -> `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, **Secret key** -> `STRIPE_SECRET_KEY`. Test keys start `pk_test_`/`sk_test_`, live `pk_live_`/`sk_live_`; they must be the same mode.
3. **Webhooks.** Developers > Webhooks > Add endpoint, three separate endpoints (each has its own signing secret, shown after you create it). Use your real domain:

   | Endpoint URL | Events to send | Variable for its signing secret (`whsec_…`) |
   |---|---|---|
   | `https://YOUR-DOMAIN/api/stripe/webhook` | `payment_intent.succeeded`, `payment_intent.payment_failed` | `STRIPE_WEBHOOK_SECRET` |
   | `https://YOUR-DOMAIN/api/admin/stripe/webhook` | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` | `STRIPE_WEBHOOK_SECRET_ADMIN` |
   | `https://YOUR-DOMAIN/api/dealers/stripe-webhook` | `invoice.paid`, `invoice.voided` | `STRIPE_DEALER_WEBHOOK_SECRET` |

   `invoice.paid` goes to two endpoints on purpose: the admin endpoint handles only membership subscription invoices and ignores dealer invoices, the dealer endpoint handles only dealer invoices and ignores everything else (covered by `tests/unit/stripe-webhooks.test.ts`).
4. **Products and prices: nothing to create.** Deposits, pay links, memberships and dealer invoices use inline `price_data`, so Stripe creates the products on first use. The three membership monthly prices are set in `src/config/pricing.ts` (`memberships[].priceMonthly`) **[OWNER]**.
5. Settings > Billing > **Customer portal**: activate it (members manage or cancel their subscription there).
6. **Invoicing** (dealer net terms) needs no extra setup beyond the secret key and the dealer webhook. Invoices are created as `send_invoice`; Stripe does not email them until you send them from the Stripe dashboard (our own "invoice ready" email goes to the dealer's AP address).
7. **Terminal** (card reader, optional): needs hardware and `STRIPE_TERMINAL_LOCATION_ID`. The server routes exist; **the reader screen is not built**. Skip for launch; take card-present payments with a pay link or record cash/Zelle by hand.
8. `npm run doctor` > Stripe LIVE. Then make a test booking with card `4242 4242 4242 4242` and confirm all three endpoints show successful deliveries in the Stripe dashboard.

## 5. Twilio (text messages, missed-call text-back, the Concierge by text)
1. twilio.com > create the account (owner). Buy a local **916** number (Phone Numbers > Buy a number, SMS + Voice capable).
2. Copy **Account SID** -> `TWILIO_ACCOUNT_SID`, **Auth Token** -> `TWILIO_AUTH_TOKEN`, the number in E.164 (`+1916…`) -> `TWILIO_FROM_NUMBER` (or a Messaging Service SID -> `TWILIO_MESSAGING_SERVICE_SID`).
3. `OWNER_ALERT_PHONES` = your mobile(s) in E.164, comma separated: escalation texts and call forwarding go here.
4. **Inbound SMS webhook:** Phone Numbers > your number > Messaging configuration > *A message comes in* = Webhook, `https://YOUR-DOMAIN/api/sms`, **HTTP POST**
   (if the number is in a Messaging Service, set the same URL under the service's Integration > Send a webhook; it overrides the number). Signature checking hashes the exact URL,
   so `NEXT_PUBLIC_SITE_URL` (or `TWILIO_WEBHOOK_BASE_URL`) must be the public origin.
5. **Missed calls**, pick one:
   - the Twilio number is the business line: Voice configuration > *A call comes in* = Webhook, `https://YOUR-DOMAIN/api/voice/incoming`, POST (rings `OWNER_ALERT_PHONES` for 20 s, then texts the caller);
   - your existing number forwards only unanswered calls to Twilio: set *A call comes in* to `https://YOUR-DOMAIN/api/voice/missed?mode=forwarded`, POST.
6. Keep Twilio's default opt-out handling on (STOP, START, HELP). Put the HELP wording from `HELP_REPLY` in `src/lib/concierge/facts.ts` into Twilio's opt-out settings.
7. **A2P 10DLC registration (required for reliable US delivery; carriers filter unregistered numbers):** Twilio Console > Messaging > Regulatory Compliance > A2P 10DLC.
   Register the **Brand** (legal business name, EIN or sole-proprietor path, address, website = your domain), then a **Campaign** (use case such as Customer Care / Account Notifications).
   Campaign fields: description = appointment confirmations, reminders, on-the-way alerts, receipts and review requests plus customer-initiated chat; **opt-in** = booking form checkbox at
   `https://YOUR-DOMAIN/book` and the "REMIND ME" reply in chat (both show the full disclosure) with the terms page `https://YOUR-DOMAIN/terms#sms`; sample messages = copy from `src/lib/notify/templates.ts`;
   privacy policy + terms URLs = `/privacy` and `/terms` **only after counsel has reviewed them and the template notice is removed**. Approval takes days to weeks: **start this first**.
8. Test from a real phone: text the number, then `STOP`, then `START`, then `HELP`.

## 6. Resend (email)
1. resend.com > create the account; Domains > Add domain: use a sending subdomain such as `mail.YOUR-DOMAIN` (keeps your main domain's reputation separate).
2. Resend shows the DNS records to add at your registrar (typically a TXT for SPF, a TXT at `resend._domainkey` for DKIM, and an MX for bounce handling on the subdomain; use the exact values shown).
   Also add a DMARC record at `_dmarc.YOUR-DOMAIN`, for example `v=DMARC1; p=none; rua=mailto:you@YOUR-DOMAIN`, and tighten `p=` after a few weeks of clean reports.
3. Wait for **Verified**. API Keys > create a key with "Sending access" -> `RESEND_API_KEY`.
4. `EMAIL_FROM="916 Dent & Detail <bookings@mail.YOUR-DOMAIN>"` (must be on the verified domain). `OWNER_ALERT_EMAILS` = where dealer-signup, add-on and escalation emails go (comma separated).

## 7. Anthropic (photo quotes and the 916 Concierge)
1. console.anthropic.com > create a key -> `ANTHROPIC_API_KEY`. Set a monthly spend limit in the console.
2. Optional: `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `CONCIERGE_MAX_COST_USD` (default 0.50 per conversation), `CONCIERGE_RETENTION_DAYS` (default 180: chat transcripts older than this are deleted daily).
3. **Before launch, read real transcripts**: all automated bot tests use the offline mock policy. Run `BOT_LIVE=1 ANTHROPIC_API_KEY=… npx vitest run tests/bot/scenarios.test.ts`, then chat with it yourself for an hour. Watch `cacheRead` in `concierge.usage` events to confirm prompt caching.

## 8. Analytics and ads (optional; nothing loads until an ID is set)
- **GA4:** analytics.google.com > Admin > Data streams > Web: Measurement ID -> `NEXT_PUBLIC_GA4_ID`; Measurement Protocol API secret -> `GA4_API_SECRET`.
- **Meta Pixel + Conversions API:** Events Manager > create Pixel -> `NEXT_PUBLIC_META_PIXEL_ID`; Settings > Conversions API > generate access token -> `META_CAPI_ACCESS_TOKEN`; `META_TEST_EVENT_CODE` only while testing in Test Events.
- **Google Ads:** Conversions > create `quote_requested`, `booking_completed`, `call_click` actions: Ads ID (`AW-…`) -> `NEXT_PUBLIC_GOOGLE_ADS_ID`, each label -> `NEXT_PUBLIC_GOOGLE_ADS_LABEL_QUOTE` / `_BOOKING` / `_CALL`.
- **Vercel Analytics:** on automatically on Vercel (enable it in the dashboard); `NEXT_PUBLIC_VERCEL_ANALYTICS=1` elsewhere.
- A consent banner appears only once at least one ID is set. It links to `/privacy` (override with `NEXT_PUBLIC_PRIVACY_URL`).

## 9. Google Calendar sync (optional, one-way push, built and unit tested against a stub; never run against Google)
Each confirmed booking creates/updates/deletes one event on the assigned technician's calendar (no customer name, phone or email is written, only services, ZIP, address and the booking id).
Google Cloud console > create a project > enable the **Google Calendar API** > IAM > Service Accounts > create one and a JSON key. Share each technician's calendar with the service account's email
(Make changes to events). Then set `GOOGLE_CALENDAR_CLIENT_EMAIL` (the `client_email`), `GOOGLE_CALENDAR_PRIVATE_KEY` (the `private_key`, keep the `\n` escapes) and
`GOOGLE_CALENDAR_IDS=alex=abc@group.calendar.google.com,sam=def@group.calendar.google.com` (first name, lowercase, = calendar id; or set `calendar_id` on the `techs` row).
It is **write-only**: availability never reads Google, so vacations and personal blocks still go in `/admin/schedule/settings`.

## 10. Upstash Redis (optional, recommended on Vercel)
Without it rate limits are per serverless instance. upstash.com > create a Redis database > REST API: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

## 11. Scheduled jobs (crons)
`vercel.json` declares four crons (dispatch every 5 min, concierge every 10 min, transcript retention daily, dealer statements monthly). Set `CRON_SECRET` (step 2.7); Vercel sends it as
`Authorization: Bearer …` automatically on **Pro**. On Hobby, or if you prefer, call the same four URLs from GitHub Actions or cron-job.org: copy-paste recipes in [`docs/SCHEDULER.md`](docs/SCHEDULER.md).

## 12. Business facts and prices (code, not env)
Edit these files and commit; `npm run check:owner` lists what is still a placeholder: `src/config/site.ts` (phone, email, hours, socials, Google review link),
`src/config/pricing.ts` (every price, set `PRICES_ARE_PLACEHOLDERS = false` when done), `src/config/booking.ts` (durations, deposit policy, SMS wording), `src/content/dealers.ts` (`claimsConfirmed`),
plus real photos and reviews. The complete list with owners and files is `LAUNCH.md` section B.

## 13. Privacy policy and terms
`/privacy` and `/terms` (with the SMS program disclosures) are **templates marked "not legal advice"**. Have a lawyer review and edit them (`src/app/privacy/page.tsx`, `src/app/terms/page.tsx`),
then remove the notice in `src/components/LegalPage.tsx`. The booking form, the chat consent step, the footer and the cookie banner already link to them.

## 14. Deploy
```bash
npm run doctor -- --production     # no demo logins, no half-configured service, launch services not in mock mode
npm run deploy                     # DRY RUN: prints exactly what would run
npm run deploy -- --preflight-only --yes   # runs the preflight (leave-behind PDF if the domain is set, doctor, verify --strict-owner) without deploying
npm run deploy -- --yes            # preflight, then `vercel deploy --prod`
```
Needs the Vercel CLI logged in and the project linked (`vercel login`, `vercel link`). A failing preflight step stops everything before the deploy. The preflight is strict about `[OWNER]`
placeholders on purpose: it will refuse to deploy until the owner items are done. After deploying, follow `LAUNCH.md` sections D and E (smoke test, monitoring, rollback).
The leave-behind PDF is regenerated only when `NEXT_PUBLIC_SITE_URL` is set; until then the committed PDF's QR code points at localhost and **must not be printed**.

## Troubleshooting
- **Every Twilio message is rejected (403):** `NEXT_PUBLIC_SITE_URL` / `TWILIO_WEBHOOK_BASE_URL` does not match the URL Twilio calls (https, no trailing slash, same host).
- **Booking links say "not valid" after a deploy:** `BOOKING_TOKEN_SECRET` changed. Keep it stable; changing it invalidates every issued link and chat session.
- **Reminders never arrive:** cron not running (step 11) or the customer did not opt in (email always, texts only with consent).
- **Admin shows the DEMO banner on the real site:** Supabase variables are missing in that environment; `doctor` will say so.
- **Dealer account stuck on "waiting for approval":** approve it at `/admin/dealers`.
