# Carrier onboarding — how the system works

Three pieces. Nothing sensitive touches the website.

| Piece | Tool | What it holds |
|---|---|---|
| Carrier's details | `onboarding.html` → Netlify Forms (`carrier-onboarding`) | Equipment, insurance agent, lanes, contact. **No SSN, no documents, no banking.** |
| Agreement + documents | BoldSign (free tier) | Signed agreement with all documents attached as one PDF |
| Your records | `carrier-roster.xlsx` → Google Sheets | Who, what status, what's expiring, what you've deleted |

---

## Why documents don't go through the website

Netlify Forms *can* take file uploads. It should not take these.

- The whole submission is capped at **8 MB**. A carrier photographing a COI and a CDL
  blows past that routinely, and it fails at the end of a long form.
- **Netlify never deletes uploaded files** — not when you delete the submission, not when
  you delete the form. California Civ. Code § 1798.81 requires you to be able to dispose
  of records containing personal information. You would not be able to delete a W-9.
- Upload links are long-lived, unauthenticated URLs that get copied into your email
  notifications and any CSV you export.

A W-9 for a sole proprietor contains their Social Security number. Treat it accordingly.

---

## One-time setup

### 1. BoldSign account

1. Sign up at **boldsign.com** — free tier covers 25 envelopes a month, which is about
   25 new carriers. Turn on **two-factor authentication** immediately.
2. Upload your dispatch agreement as a template. (Don't have one yet? See
   `AGREEMENT-BRIEF.md` — it's the brief to hand a transportation attorney.)
3. Add signature and date fields for the carrier.
4. Add **Request Attachments** slots, one per document, all on the carrier's role:
   - MC authority letter *(required)*
   - W-9 *(required)*
   - Certificate of insurance *(optional — you may request it from their agent instead)*
   - Notice of assignment *(optional — factoring only)*
   - Driver's licence / CDL *(required)*
5. Put a blank W-9 into the template as a second document so carriers who don't have one
   can fill it in without leaving the flow.
6. Copy the template's shareable link.
7. Paste it into `onboarding.html`, replacing `[[BOLDSIGN_ENVELOPE_URL]]`.
   `preflight.sh` fails while that placeholder is still there.

> **Before you rely on the free tier**, confirm Request Attachments is included on it —
> vendors move features between tiers. If it has moved, the fallbacks are SignNow
> Business Premium (~$15/user/month annual) or PandaDoc Starter (~$19/user/month annual).
> Don't use DocuSign for this; you'd pay ~$40/user/month to unlock the same field.

### 2. Netlify form notifications

Netlify will **not** email you when a form is submitted until you set it up.

Netlify → **Forms** → **Form notifications** → add an email notification for **both**
`carrier-intake` (leads) and `carrier-onboarding` (this new one). Miss the second and
carriers will fill in ten minutes of detail that silently lands in a dashboard.

### 3. The roster

Upload `carrier-roster.xlsx` to Google Sheets. Five tabs: Carriers, Insurance, Documents,
Broker Setups, Retention Log. Delete the example row on each once you have real carriers.

Turn on 2FA for the Google account. This is the index of everything.

### 4. Drive folders

`Carriers / <MC#> <Carrier name> /` — one per carrier. The signed packet PDF goes here.
**The W-9 does not stay here.** See retention below.

---

## Running an onboarding

1. **Send the link.** `steadhauldispatch.com/onboarding.html` after the intro call.
2. **Their details arrive** by email from Netlify. Add a row to **Carriers** (status
   `Onboarding`) and fill the **Insurance** tab from what they sent — especially the
   agent's name, phone and the policy expiry date.
3. **They sign and upload** via the BoldSign link on the same page. You get the completed
   packet as one PDF.
4. **Chase the COI if needed.** The certificate is the usual hold-up. Call their agent
   directly with the details from the form — most will email it the same day. Ask to be
   added as a certificate holder so you get renewals automatically.
5. **Build the broker packets.** Submit through broker portals (RMIS, MyCarrierPackets
   and so on), not as email attachments. Log each one on **Broker Setups**.
6. **Delete the W-9.** Once the broker setups are done, delete it from BoldSign and from
   Drive. Record it on the **Retention Log** and date it on the **Documents** tab.
7. **Flip status to `Active`** and set the start date on **Carriers**. The free-week-ends
   date calculates itself.

---

## Retention — the short version

**You have no reason to keep a carrier's W-9.** You don't pay them; the broker or their
factor does. It's pass-through: collect it, forward it, delete it.

Keep long-term: the signed dispatch agreement, and the insurance record on the roster.

Delete once broker setups are complete: the W-9, and any image of a voided cheque if one
ever reaches you (it shouldn't — tell carriers to give banking details to their factor
or the broker directly, never to you).

Write each deletion in the **Retention Log**. § 1798.81 requires reasonable steps to
dispose of these records; the log is how you demonstrate you took them.

---

## Every promise on the site, and the system behind it

The website sells specific things. Each one needs somewhere it actually gets done, or
it's just copy. This is the map.

| The site promises | Where it happens | Tab |
|---|---|---|
| Broker authority + $75K bond verified **before every booking** | Vet the broker, record the check, re-check anything older than 30 days | **Brokers** |
| Broker payment history tracked, slow payers dropped | Days-to-pay and status per broker | **Brokers** |
| Load sourcing, rate negotiation, booking | Every load you book, with miles, linehaul and auto-calculated RPM | **Loads** |
| **You approve every load** — nothing books without your yes | `Carrier approved` + how (text/call/email). Red if "No" | **Loads** |
| Rate confirmations straight to the carrier | `Rate con sent` per load | **Loads** |
| Detention / layover / TONU recovery *(Pro, Full Desk)* | Claim, amount, status, amount actually recovered | **Claims** |
| Invoicing to the factoring company *(Pro, Full Desk)* | `Invoiced` / `Paid` per load | **Loads** |
| **First week free** | `Free week?` → fee due goes to zero automatically | **Billing** |
| **Truck down, you owe nothing** | `Truck down?` or zero loads → fee due goes to zero automatically | **Billing** |
| Flat weekly fee, never a percentage | Standard fee derived from the plan, never from load value | **Billing** |
| **Friday revenue report**: gross, miles, RPM, deadhead % | Type the week-ending date and carrier; it pulls from Loads | **Friday Report** |
| **Eight trucks per dispatcher, hard cap** | Counts active carriers per dispatcher, flags FULL | **Capacity** |
| Broker packets to 25+ brokers, COI placed, NOA filed | One row per broker setup, with status | **Broker Setups** |
| Every broker's COI current | Days-left countdown, amber at 30, red at 14 | **Insurance** |
| W-9 deleted after setup | Deletion date, plus the audit log | **Documents**, **Retention Log** |

Two of these are worth saying plainly, because they're the ones that turn into a dispute:

**`Carrier approved` on the Loads tab is your evidence.** The first time a carrier says
they never agreed to a load, that column is the only thing standing between you and
their word. Fill it in as you book, not afterwards.

**Billing zeroes itself out.** Fee due goes to zero for a free week, for a truck-down
week, and for any week where you booked zero loads. You don't have to remember the
promise — but do check the column before invoicing, because an invoice that ignores it
is the fastest way to lose a carrier who'd otherwise have stayed.

---

## Weekly, five minutes

**Insurance tab** — check the **Days left** column. Amber at 30 days, red at 14. An
expired COI means brokers stop accepting the carrier and loads fall over with no warning.
Call the agent before it lapses, not after.

**Brokers tab** — anything in `Days since check` over 30 turns amber. Re-verify before
you book it again; the site promises a check before every booking, and bond status
changes without notice.

**Friday Report** — add a row per active carrier with Friday's date. It fills itself from
Loads. Send it. Deadhead over 15% highlights amber, which is usually the conversation
worth having.

**Billing** — add the week's rows, check the zeroed ones are right, then invoice.

---

## If something leaks

California's breach law changed on **1 January 2026** (SB 446). The clocks are hard now:

- **30 calendar days** from discovery to notify affected California residents.
- **15 calendar days** after notifying them, submit a sample notice to the California
  Attorney General — but only if more than 500 residents are affected.
- Where SSNs or driver's licence numbers were exposed, the notice must include the
  toll-free numbers and addresses of the major credit reporting agencies.

Before any of that: contain it, write down what happened and when you found out, and
call a lawyer. Put their name and number here now, while nothing is on fire:

**Attorney:** _______________________  **Phone:** _______________________

Also worth getting cyber liability quotes. For a one-person business it's usually the
cheapest control available relative to what it covers.

---

## Basic hygiene

- **2FA on BoldSign, your email, and Google.** No exceptions — email is the master key
  to everything else.
- **A password manager**, unique password per service.
- **Full-disk encryption** on the laptop and phone that touch this.
- **No documents in your phone's camera roll.** If you photograph something for a
  carrier, delete it after uploading.
- **Never email or text a W-9**, yours or theirs. If a carrier emails you one anyway,
  reply with the signing link, then delete the email and empty the trash.

That last point is worth saying out loud to carriers, and the onboarding page does:
stolen carrier packets are how identity hijacking and double-brokering start, and cargo
insurers deny those claims. Being visibly careful with it is a selling point against
every competitor still collecting W-9s as Gmail attachments.
