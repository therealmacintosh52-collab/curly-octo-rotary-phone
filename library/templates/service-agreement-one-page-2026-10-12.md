DRAFT — verify with a licensed attorney before first use

Still needs an attorney (red-team T-011 §3; not decided by this draft):
- The liability cap in clause 9 (Cal. Civ. Code §1668).
- Whether replying "I agree" counts as a signature on these facts.
- The current text of B&P §17538.41, and whether "they asked on the call" counts as consent to a text.
- Do-not-call status of cell numbers listed as business numbers.
- Sales tax on services.
- Whether "[Name] Growth" is a fictitious business name (until decided, the party is the owner's legal name).

# Service Agreement (one page) — v2026-10-12 (repair attempt 3: red-team M1–M9 applied)
Fields in [brackets] are filled by the owner. No trade name is used until the fictitious-name decision (A-013) is made.

**Parties.** [Owner full legal name], sole proprietor ("Agency", [city], CA, [email/phone]) and [CLIENT BUSINESS] ("Client", [contact name], [email/phone]).

1. **Scope.** Agency provides: [tick one] ☐ Starter: Growth Audit, 90-day plan, 30 days of drafted content, message scripts (one-time) ☐ Monthly: Google Business Profile management, post drafting/scheduling, review-request scripts, lead follow-up scripts, weekly report. Anything else needs a written add-on. Agency advises; Client approves what is published in its name. Starter is delivered within 7 days of payment; if not, Client may cancel for a full refund.
2. **Price and payment.** $[amount] [one-time / per month], due [date / on the same day each month] by [payment method]. No setup fee unless written here: $[0]. Starter is paid in full before work starts; monthly is paid in advance. A new monthly price applies only after 30 days' notice and Client's reply "I agree"; otherwise service ends at the end of the paid month.
3. **Term.** Starter is one-time: it does not renew and no further charge is made. Monthly renews automatically each month at $[X] on the [day] until cancelled; no minimum term. Client cancels any time by texting CANCEL to [phone] or emailing [email]; Agency confirms within 1 business day; service ends at the end of the paid month and no further charge is made. Agency keeps Client's "I agree" message for 3 years.
4. **No guarantee of results.** Agency does not guarantee rankings, reviews, calls, leads, customers, or revenue. Any numbers in reports are labeled as measured or estimated.
5. **Access.** Agency works only through Manager/partner roles invited by Client (e.g., Google Business Profile, Meta Business Suite). Client keeps the Owner role; Agency asks only for Manager. Client never gives Agency a password. Client can remove access at any time. Agency will not ask for payment cards or bank logins.
6. **Data handling.** Agency uses Client information only to deliver the service, keeps it in private files, does not sell or share it, and will not post Client's customer names or reviews outside the service. On request, Agency deletes or returns Client files within 30 days of cancellation, except what the law requires it to keep.
7. **Ownership.** Client owns its accounts, listings, customer data, and the content made for it once paid for. Agency keeps its templates, methods, and tools. Agency may use Client's name or results publicly only with Client's separate written (text/email) permission.
8. **Reviews and honesty.** Agency asks real customers for real reviews. No fake or bought reviews. Agency never asks only happy customers, never discourages negative reviews, and never offers anything for a review. Client confirms its business info and offers are accurate and lawful and that it holds any licenses its trade requires.
9. **Liability.** Services are marketing help, not legal, tax, or licensing advice. Agency's total liability is limited to the fees Client paid in the 30 days before the claim, to the extent the law allows. Agency is an independent contractor.
10. **Governing law.** California law governs. The parties try to settle disputes in good faith by text/email first; otherwise courts in [Sacramento] County, California.
11. **Whole agreement.** This page is the full agreement; changes only in writing (text/email counts). Agreed by typed name or by replying "I agree" to the message that carried this page. Both parties agree to make, sign and receive this agreement and all notices electronically by text or email.
12. **Customer messages.** Agency drafts customer messages; Client sends them from its own accounts, only to customers who gave Client their number. Agency never messages Client's customers.

Client: [typed name] [date] · Agency: [typed name] [date]

---
## Text-message versions for phone pre-sell (two separate texts, one per billing type; each under 320 chars)
Counted by regex on the saved text with a 25-character sender name and a 5-character price ("$1500"). Recount if the name or price is longer.

**Starter (one-time) — 270 chars, budget 320**
```
From [Owner full legal name]. Terms: Starter is one-time $297, paid before work, delivered in 7 days or full refund. No guaranteed results. Manager access only, never passwords; you own your accounts. Reply YES and I'll send the 1-page agreement. STOP = no more texts.
```
**Monthly — 247 chars, budget 320**
```
From [Owner full legal name]. Terms: $[X]/mo, renews monthly until you cancel by text/email. No guaranteed results. Manager access only, never passwords; you own your accounts. Reply YES and I'll send the 1-page agreement. STOP = no more texts.
```
Never send both in one conversation; pick the one that matches the box ticked in clause 1. Send by hand from the owner's own phone, once, only to a business's public number and only if the business asked for the terms on the call (red-team C3: no cold text). "no/stop/silence" = never contact again. Not a signed agreement; the one-page above must be agreed (reply "I agree") before any work or payment. Monthly is not quoted this week (red-team T-011 ruling 2).

## Notes for the owner and attorney (not part of the agreement)
- RISK RULES coverage: scope, price, no guarantee, no long-term contract, cancel terms, Manager-only access (MOS RISK RULES, library/playbooks/growth-agency-mos.md l.41-47).
- California automatic renewal law (ARL), amended by AB 2863, effective 2025-07-01: express consent to renewal, an annual reminder, and cancellation through the same channel used to sign up. VERIFIED(https://btlaw.com/en/insights/alerts/2025/california-expands-automatic-renewal-law-new-requirements-now-in-effect, 2026-10-12, search summary: "same channel used to initiate the subscription"; page not opened). Clause 3 therefore cancels on the sign-up channel (text or email) and keeps the "I agree" message.
- The ARL "consumer" buys for personal, family or household purposes, so a business buyer likely falls outside it. VERIFIED(https://california.public.law/codes/business_and_professions_code_section_17601, 2026-10-12, search summary: "personal, family, or household purposes"); no case law found on a business retainer, so this is a reading, not a ruling. The agreement complies anyway because it is cheap. Replaces the stale 2018 Mintz note.
- Electronic signature: UETA applies only if the parties agreed to transact electronically. VERIFIED(https://stimmel-law.com/articles/electronic-signatures-and-their-requirements-california-latest-case, 2026-10-12, summary: "agree to conduct the transaction by electronic means"); clause 11 states that agreement.
- Manager role: only owners can remove other owners and managers. VERIFIED(https://support.google.com/business/answer/3403100, 2026-10-12, summary: "only owners can remove other owners and managers"); clause 5.
- Reviews: Google bars selective review asks, discouraging negatives and incentives; FTC 16 CFR 465 bans fake or paid reviews. VERIFIED(https://support.google.com/local-guides/answer/2622994, 2026-10-12, summary); clause 8.
- Texts to customers: California restricts text ads to mobile devices (existing relationship plus opt-out is one exception; statute copy current to 2016, current text UNVERIFIED) and FCC 2024 rules extend do-not-call to texts to wireless numbers (one court ruling). Clause 12 keeps Agency out of customer messaging. Attorney item.
- Do not use it for paid-ads management (post-Graduation Gate) without a revised scope.
