# Review Requests (compliant scripts)

Status: DRAFT. Owner sends or says these (hard gate: contacting anyone). Never auto-send without the owner's approval of the sending system.

## Policy summary (read once)
Sources are third-party summaries, retrieved 2026-10-15; Google's own policy page could not be fetched, so **verify against Google's Prohibited and Restricted Content policy (Maps user-contributed content) in the dashboard help**:
- Review gating is prohibited: do not ask only happy customers, and do not route unhappy customers to private feedback instead of the public link. Source: https://www.podium.com/online-reviews/review-gating/ and https://www.jturnerresearch.com/blog/google-has-updated-their-review-policies-again (J. Turner post dated June 2026, describes April updates).
- Incentives are prohibited: no discounts, gifts, entries or credits for a review (positive, negative or neutral). Source: https://www.tryvizup.com/blog/google-review-rewards-policy and J. Turner above.
- Also flagged: scripting wording, asking for specific employee names, pressuring on-site, quotas or pay tied to review volume. Source: J. Turner.
- Asking is allowed. Ask every customer the same way, every time. Keep a log (https://www.dacgroup.com/?p=159133).

## Rules for us
1. Ask every completed job, same message, no screening.
2. Never mention discounts, referral credit, or any reward in the same message. (Referral credits in the Phase 3 program are for referrals, not reviews. Keep them out of review messages.)
3. Never suggest what to write. Never ask for 5 stars; ask for an honest review.
4. Review link: `[OWNER GOOGLE REVIEW LINK]` (g.page/r/... from site.ts googleReviewUrl, currently empty). Get it: Profile > "Ask for reviews" in dashboard.
5. Send within 24 hours of the job, once, plus one reminder at day 5 if no response. No more.
6. Do not text customers who did not give us their number for service contact. A service follow-up to a customer who booked is a transactional relationship, but a review request is borderline marketing in the eyes of some counsel: include opt-out and get consent in the booking form ("Text me updates and a review request. Reply STOP to opt out."). See `dealers/door-knock-kit.md` legal note and the TCPA summary there.

## In person (at handoff)
```
Thanks for trusting us with your car. If you are happy with the work, a Google review helps neighbors find us. If anything is not right, tell me now and I will fix it. Either way, here is the link: [OWNER GOOGLE REVIEW LINK]. Honest feedback only.
```
Note on "if anything is not right": this is service recovery on site, not gating, as long as the link is offered to everyone. Offer the link to everyone, always.

## QR card (print)
Front: `How did we do?`
Back: `Scan to leave an honest Google review. [QR to OWNER GOOGLE REVIEW LINK]` and `916 Dent & Detail. Precision · Care · Perfection.`
Do not print "5 stars" or any reward on the card.

## SMS (after the job)
```
Hi [FIRST NAME], this is [OWNER NAME] at 916 Dent & Detail. Thanks for having us out today. Would you leave an honest review? [OWNER GOOGLE REVIEW LINK] Reply STOP to opt out.
```
Reminder (day 5, only if no review):
```
Hi [FIRST NAME], one gentle reminder if you have a minute for a review: [OWNER GOOGLE REVIEW LINK]. Thanks either way. Reply STOP to opt out.
```
Send window: 9am-8pm local; AB 1865 would bar text ads 9pm-9am if enacted (pending as of 2026-05-16, https://www.govbuddy.com/california/bills/ab-1865/), so stay inside 9am-9pm regardless.

## Email
Subject: `How did we do?`
```
Hi [FIRST NAME],

Thank you for choosing 916 Dent & Detail. If you have a minute, an honest Google review helps other Sacramento drivers find us:

[OWNER GOOGLE REVIEW LINK]

Whatever your experience, we want to hear it. Reply to this email if you want to talk to us directly.

[OWNER NAME]
916 Dent & Detail
[OWNER PHONE]
```
Footer for any marketing-flavored email: [OWNER BUSINESS MAILING ADDRESS or PO box] and "Reply STOP to unsubscribe" (CAN-SPAM requires a postal address and opt-out for commercial email, https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business, retrieved 2026-10-15). A pure transactional thank-you is lighter, but include the footer anyway.

## Dealer / fleet version
```
Hi [CONTACT FIRST NAME], thanks for the work on [VEHICLE COUNT] units. If you are happy with it, a short Google review from the store helps us a lot: [OWNER GOOGLE REVIEW LINK]. Honest feedback is welcome either way.
```
Send only to the contact who dealt with us, once.

## Tracking
Log each request (date, channel, customer ID) in /admin (Phase 3 pipeline has stage "Reviewed"). Count asks vs reviews weekly. Goal is the ask rate (100% of completed jobs), not the review count.
