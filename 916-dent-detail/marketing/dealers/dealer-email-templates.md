# Dealer Email and Text Templates

Status: DRAFT. Owner sends (hard gate: contacting anyone). Use only for contacts you met in person or who asked for info; do not buy lists or scrape personal emails (public business info only, per scout). Legal notes in `door-knock-kit.md`.

Footer for every email (CAN-SPAM requires a valid postal address and a clear opt-out; https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business, retrieved 2026-10-15):
```
916 Dent & Detail  |  [OWNER MAILING ADDRESS or registered PO box]  |  [OWNER PHONE]
Not interested? Reply "unsubscribe" and I will not contact you again.
```
Address: this is a mailing address for legal footer purposes. A registered PO box or private mailbox is accepted by the FTC guide; it is not the GBP address. [OWNER decides].

## E1 Day 0: thank you + rate sheet
Subject: `Thanks, [FIRST NAME]. Rate sheet inside`
```
Hi [FIRST NAME],

Thanks for a minute today at [DEALERSHIP]. As promised, our rate sheet is attached. We come to your lot to remove dents with no paint and no body shop, and we detail on site.

If you have a lot car with a ding, send me a photo and I will give you a price. No commitment.

[OWNER NAME]
916 Dent & Detail
[OWNER PHONE]  |  https://[OWNER DOMAIN]/dealers

[FOOTER]
```

## E2 Day 2: trial offer
Subject: `One dent on us?`
```
Hi [FIRST NAME],

Quick follow-up. If you have one lot car with a dent, send me a photo and I will tell you honestly whether paintless fits and what it costs. [OWNER: add "first car free" only if you will honor it.]

Photo link: https://[OWNER DOMAIN]/book

[OWNER NAME]  |  [OWNER PHONE]

[FOOTER]
```

## E3 Day 7: proof + insurance
Subject: `A look at the work + our COI`
```
Hi [FIRST NAME],

Here are two recent lot jobs [attach REAL before/after only, with permission]. Same-day on-site, no repaint.

If your group needs a certificate of insurance or W-9 for vendor approval, I will send them today. [OWNER: confirm COI exists]

[OWNER NAME]  |  [OWNER PHONE]

[FOOTER]
```

## E4 Day 14: last check
Subject: `Should I keep sending photos-and-prices?`
```
Hi [FIRST NAME],

Last note from me for now. If dents pile up before a sale or a turn, you can send a photo any time: https://[OWNER DOMAIN]/book. I will check back next month unless you tell me not to.

[OWNER NAME]  |  [OWNER PHONE]

[FOOTER]
```

## Cold intro (only if no visit happened; sparse use)
Subject: `Mobile dent removal for [DEALERSHIP]`
```
Hi [FIRST NAME],

I run 916 Dent & Detail, a mobile dent removal and detailing crew in Greater Sacramento. We work on your lot, no paint, no body shop. I got your name from [WHERE, e.g. the store website or your front desk]. May I send a one-page rate sheet?

[OWNER NAME]  |  [OWNER PHONE]

[FOOTER]
```
Must be a real contact from public business info (store page or the receptionist), not personal data scraped elsewhere. CAN-SPAM has no B2B exemption (FTC guide above).

## Reply templates
Price question:
```
Thanks. Pricing is per panel and depends on dent size and count. I attached the rate sheet. A photo of the car lets me give an exact number.
```
After a trial car:
```
Thanks for letting us work on the [VEHICLE]. Here is the invoice [attach]. If anything is not right, tell me and I will fix it. If you are happy, I would appreciate a short Google review from the store: [OWNER GOOGLE REVIEW LINK] (honest feedback only).
```
Vendor approval request:
```
Happy to complete vendor setup. Attached: W-9 and certificate of insurance [OWNER: attach once real]. Tell me if you need anything else.
```
Referral ask:
```
If another store in your group has dents on the lot, may I introduce myself? No pressure. [OWNER: no referral rewards unless you decide on a program]
```

## Text templates (opted-in contacts only; include STOP)
See `door-knock-kit.md` (T1, T2, T4). Send between 9am and 8pm Pacific. Log every opt-out and stop immediately.

## Tracking
Subject lines to test: `One dent on us?` vs `Photo = price`. Log replies in /admin lead source `dealer` / `door-knock` (verify field names). Pause a sequence when a contact replies.
