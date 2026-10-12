# Go live: Cali Tints for Mike's company

The order to do things in, what each step needs from whom, and what it costs. Each step says who does it: **you** (the consultant), **Mike** (the owner), or **both** on a call.

## 0. What you end up with

- The web app on Vercel at your domain (for example `https://app.calitints.com`), signed in on Mike's computer (owner) and on every employee's Clover Flex (the Cali Tints Clover app) or phone.
- Supabase holds the data; Resend sends the invoices; QuickBooks Online receives every invoice and sends payments back; the daily job closes each month on the 1st.
- Only Mike sees money. Everyone else logs jobs.

## 1. Accounts to create (you, 1 hour)

| Service | Plan | Why | Monthly |
|---|---|---|---|
| [Supabase](https://supabase.com) | Pro | database, auth, photo storage, daily backups; the free plan pauses after a week of inactivity | $25 |
| [Vercel](https://vercel.com) | Pro | hosting, the daily cron at a fixed time, 60 s functions for PDFs; Hobby works for a test but is not licensed for a business | $20 |
| [Resend](https://resend.com) | Free (3,000 emails/mo) | invoice emails from your domain | $0 |
| Domain | any registrar | `app.calitints.com` for the app and a sending domain for Resend | about $1 |
| [Intuit developer](https://developer.intuit.com) | Free | the QuickBooks app keys | $0 |
| [Clover developer](https://www.clover.com/developers) | Free account | publishing the private Clover app; a **Dev Kit** (a Flex in developer mode) is a one-time purchase, roughly $500 | $0 |

Mike already pays for QuickBooks Online and the Clover devices. Total run cost: about **$46/month** plus the one-time Dev Kit.

## 2. Supabase (you, 30 min)

1. New project (US West), strong database password, save it.
2. Project Settings → API: copy the project URL and the publishable key; Settings → API keys: create a secret (service role) key.
3. Apply the schema: in `apps/cali-tints`, `.env.local` with `SUPABASE_DB_URL` (Settings → Database → Session pooler string) then `pnpm db:push` (runs `supabase/migrations/0001` … `0042` in order; re-runnable) and `psql "$SUPABASE_DB_URL" -f supabase/seed.sql` for the company row, dealerships and the service menu.
4. Authentication → URL configuration: Site URL `https://app.calitints.com`, Redirect URLs `https://app.calitints.com/auth/callback` and `https://app.calitints.com/auth/reset`. Email templates: the defaults are fine; the invite goes through this.
5. Storage: the buckets (`job-photos`, `logos`, `submission-confirmations`) are created by the migrations. Nothing to click.
6. Backups: Pro includes daily backups; turn on Point-in-time recovery if Mike wants hour-level restores (+$100/mo, usually not needed).

## 3. Vercel (you, 20 min)

1. Import the GitHub repo. Root Directory `apps/cali-tints`, Framework Next.js, Install `pnpm install`, Build `pnpm build`.
2. Environment variables (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL=https://app.calitints.com`, `RESEND_API_KEY`, `EMAIL_FROM="Cali Tints Billing <billing@calitints.com>"`, `CRON_SECRET` (`openssl rand -hex 32`), `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_ENV=production`. **Do not set `DEMO_ACCESS_KEY`** on the real deployment.
3. Domains: add `app.calitints.com`, set the DNS record the dashboard shows.
4. Deploy. `vercel.json` registers two crons: `/api/cron/daily` (7am Pacific: month close, QuickBooks, expired estimates and holds, stale deposit links) and `/api/cron/automation` (**every five minutes**: confirmations, reminders, the review request, nudges, the queued texts). Vercel sends `CRON_SECRET` itself. Check Settings → Cron Jobs shows both; the five-minute one needs the Pro plan (Hobby runs crons once a day).

## 4. Resend (you, 15 min)

Add and verify the sending domain (DNS records), create an API key, set `EMAIL_FROM` on a verified address. Send yourself a test invoice from the app once an owner exists.

## 5. First owner (both, 10 min)

1. Supabase → Authentication → Users → *Add user* with Mike's email and a temporary password. The first user becomes the owner automatically (`handle_new_user`).
2. Mike signs in at `https://app.calitints.com`, changes the password (Forgot password → reset email), reads the guide that opens on first sign-in.
3. Settings → Company: name, address, EIN, billing email, logo, timezone. Monthly invoicing: *Email each month's invoice automatically* on. Tax rate 0 unless a dealership requires tax.
4. Settings → Dealerships: each dealership's AP contact and email(s). The shop (*Cali Tint · Fulton Ave*) is seeded as the **Retail** location: walk-in jobs logged there are paid at the counter on the Clover and never invoiced. Fix its street number.
5. Settings → Services & prices: check the menu and prices; per-dealership prices in the grid.
6. Settings → Users: add every employee. Roles: Detailer for the team, Manager for a lead who should see every job, Admin for someone who runs Settings without money. Only Mike is Owner.
7. Settings → Shop menu: the twelve retail services are seeded with **placeholder** prices and durations (a banner says so until each is edited); set the real price per car size, the add-ons, which services need a lift or a skill.
8. Settings → Booking: hours, bays / lifts / techs (seeded 6 / 2 / one per detailer), days off, the policy (20 % deposit, 30-minute hold, 24-hour notice), the **review link** (Google: Business Profile → Ask for reviews → copy the short link; it goes into the review request 30 minutes after a paid job), quiet hours (default 20:00–08:00), and read the eleven email templates once. Under **Automations** every rule is on; switch off any Mike does not want.

## 6. QuickBooks Online (both, 20 min)

1. On developer.intuit.com (your login): create an app, QuickBooks Online Accounting scope. Keys & credentials → Production: copy the client id and secret into Vercel (`QUICKBOOKS_*`), add the redirect URI `https://app.calitints.com/api/quickbooks/callback`. Production keys need the app's *Production settings* filled in (privacy URL `https://app.calitints.com/privacy`, terms URL `/terms`, a host domain, EULA); Intuit approves that in a day or two. Test with the Development keys and `QUICKBOOKS_ENV=sandbox` against a sandbox company first.
2. Mike: Settings → QuickBooks Online → **Connect QuickBooks**, sign in with the Intuit login that owns the books, pick the company. Open invoices go over at once.
3. Check: log a test job; within seconds it is a line on a new open invoice in QuickBooks for that dealership (the job row shows `QB <number>`). Edit the job: the line changes. Delete it: the line goes. In QuickBooks the customer (dealership) and the *Auto detailing* item exist.
4. Record a test payment in QuickBooks on a closed month's invoice; after the next daily run (or **Sync now**) the invoice here shows it. Sending the invoice from QuickBooks marks it Sent here after the next sync.

## 7. The Clover app (you: 1 to 2 weeks of calendar time, mostly waiting)

**Why not just send the Clover a link?** Clover devices are locked down: the Flex has no general web browser to open a link in (Clover tells developers not to rely on one), and a production device cannot have an app installed any way other than the Clover App Market. So the app has to be published there, as a **private** app only Mike's merchant account can see. It is the same web app inside; it takes no payments and leaves his payment apps alone. Until it is approved, the team uses the same login on their phones (Add to Home Screen).

1. Clover developer account; request production access; order a **Flex Dev Kit**.
2. Build the release APK: GitHub → Actions → *Cali Tints Clover app* → Run workflow with `app_url = https://app.calitints.com`, version `1.0.0`, code `1` (set the signing secrets first; see `apps/cali-tints-clover/README.md`).
3. Create the private Android app in the Developer Dashboard (package `com.calitints.clover`, the **Payments** permission only, for *Collect on this Clover* on retail jobs; privacy/terms URLs, screenshots), upload the APK, test on the Dev Kit with `apps/cali-tints-clover/SUBMISSION.md`'s checklist, record the demo video, submit.
4. After approval, add Mike's merchant id; Mike installs the app on every Flex from More Tools → App Market → Cali Tints. Employees sign in once per device.

Until the Clover app is approved, the team can use the web app on their phones (Add to Home Screen) with the same logins; nothing changes later except the device.

## 7b. Deposits online through Clover (you, 30 min; optional, no new fee)
1. Leave `DEPOSITS_ONLINE` unset (or `none`) and everything works with deposits taken at drop-off. Do the rest only when you want customers to pay the deposit from the link.
2. Clover merchant dashboard → **Ecommerce** (the web-payments section; Clover may call it "Ecommerce API tokens" or "Online payments") → create an integration of type **Hosted Checkout**. Copy the **private key** and your **merchant id** (the 13-character id in the dashboard URL). An "Iframe" or "API only" key is refused by Clover for hosted checkout.
3. On the same screen set the webhook URL to `https://<your app>/api/clover/webhook?secret=<a long random string>` and put that same string in `CLOVER_WEBHOOK_SECRET`. Clover sends a verification code first; the app echoes it back.
4. Vercel → Environment variables: `DEPOSITS_ONLINE=clover`, `CLOVER_ENV=production` (or `sandbox` with a sandbox merchant to try it first), `CLOVER_MERCHANT_ID`, `CLOVER_ECOM_PRIVATE_KEY`, `CLOVER_WEBHOOK_SECRET`. Redeploy.
5. Try it: book a test appointment from `/book`, open its `/a/<token>` page, tap **Pay the deposit**, pay with a test card in the sandbox. The appointment page shows the deposit paid and the booking confirmed within a few seconds (the webhook). Refund the test payment in the Clover dashboard and record it on the ledger.
6. Optional: a merchant REST API token with *Payments read* in `CLOVER_API_TOKEN` lets the daily job reconcile a payment whose webhook never arrived; without it the owner matches it by hand (Take the deposit → Paid online, with the Clover payment id).

## 8. Day-one checks (both, 30 min)

- A detailer logs a car on a Flex with a photo; it appears on Mike's Jobs list within seconds; the detailer sees no prices anywhere.
- Mike opens the job: no prices anywhere on it (the amounts are on the month's invoice); *Needs a price* when "Other" was used, and Edit job sets that amount.
- Settings → Company → **Run month close**: nothing to close yet (or the previous month's invoices if there is history). Invoices → *This month so far* shows the running totals.
- An invoice: Submit by email reaches the dealership's AP address (send one to yourself first), the QuickBooks card says Sent, the PDF downloads.
- Export → every CSV downloads (Mike only).
- Sign in as a manager: Jobs and the team dashboard only; `/invoices` redirects; the price list shows no prices.
- Retail, on a phone: book a test appointment from `/book` (use Mike's own phone and email, tick both consents) → it shows under Retail → Today as a lead and Mike gets the "new online booking" email → Confirm it → the confirmation email arrives (needs Resend) → within five minutes a reminder text appears under **Texts to send** when the time is inside 24 hours → tap it → the messaging app opens with the text → Sent.
- Write a test estimate for that customer → Email the link → open it on the phone → pick a tier, sign, approve → Mike gets the "estimate approved" email → Create the job → collect it as cash → sign the receipt → the receipt email arrives → 30 minutes later the review request is in the log and the text queue.
- Settings → Booking → Automations → **What went out**: every one of those runs is listed as sent (or skipped with the reason). Cancel the test appointment and refund nothing (cash was a test).

## 9. Ongoing

- **Every day**: jobs land on the dealership's open QuickBooks invoice as the team logs them. Mike sends each dealership's invoice from QuickBooks when the month is done (or whenever he likes).
- **1st of every month, 7am**: the job closes the month here and links the mirror invoice to the QuickBooks one. Nothing to do unless a *Needs a price* job remains (set it before the month ends; the line updates in QuickBooks) or a red QB badge says a sync failed.
- **Payments**: recorded in QuickBooks as usual; they appear here by the next morning. Checks that never reach QuickBooks can be recorded here with Add payment.
- **Every five minutes**: the automation run. Nothing to do except glance at Retail → Today for **Texts to send** (one tap each; they wait, nothing is sent without the tap) and **Leads to confirm**. Quiet hours hold everything until 8am.
- **New employee / device**: Settings → Users; install the Clover app on the new Flex.
- **Updates**: push to the repo → Vercel deploys the web app; for the Clover app, run the workflow with a higher version code and upload the APK in the Developer Dashboard (devices update themselves).
- **Backups**: Supabase daily; Export → CSV any time for the accountant.
