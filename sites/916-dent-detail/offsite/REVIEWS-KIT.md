# REVIEWS-KIT: getting honest reviews for 916 Dent & Detail

Status: draft for the owner. Nothing has been sent. **Texting wording and consent flow are marked for attorney review** (TO-CONFIRM #17). The Google review link does not exist until the Business Profile is verified; until then every link below uses the token `{{GOOGLE_REVIEW_URL}}`.

## 0. Rules that cannot be bent (Google policy, FTC 16 CFR Part 465, COMPLIANCE section 4)

1. **Ask every customer.** Same message, same timing, whatever the job was like, including customers who complained, and including dealer and fleet contacts.
2. **No sentiment gating.** Never ask "how was it?" privately and send only the happy ones to Google. Never say "only if you were happy". Never route unhappy people to a private form instead of the review link. Google's policy against selectively soliciting positive reviews and the FTC's rule on review suppression both apply. A private "contact us" line may sit **next to** the review link for everyone; it may never replace it.
3. **No incentives.** No discount, gift, raffle entry, cash or "free" anything in exchange for a review, positive or not. Do not offer a reward for 5 stars. If any thank-you ever exists it must be given regardless of rating and disclosed; the safe course is none.
4. **No fake, family, employee or paid reviews. No review kiosk on the crew's own phone.** The customer uses their own phone. Do not post reviews of your own business or competitors.
5. **Yelp:** Yelp discourages asking for reviews. Do not request Yelp reviews. Link to the Yelp listing; do not copy review text anywhere.
6. **Do not publish** star icons, review counts, or ratings on the site until real reviews exist and are shown with the reviewer's name as published, the source and a link (BLUEPRINT rule 2). No `AggregateRating` markup.
7. Do not text anyone without the consent recorded in section 4.

Policy sources (not opened in this stage; read before launch): Google Maps user-contributed content policy; Google Business Profile guidance on reviews; FTC 16 CFR Part 465 (effective 2024-10-21, per COMPLIANCE 4).

## 1. The direct Google review link

Needs the verified profile. Two ways; use A if it is available.

**A. From the dashboard (easiest, no Place ID needed).** Open your Business Profile (search "my business" while signed in, or Google Maps > Your business profile). Look for **Get more reviews / Ask for reviews / Share review form** (wording changes; verify). It gives a short link of the form `https://g.page/r/<code>/review` and a QR code. Copy the link.

**B. From the Place ID.**
1. Open the Maps Platform Place ID Finder (`developers.google.com/maps/documentation/places/web-service/place-id`) and search `916 Dent & Detail`. A service-area business with a hidden address may not appear in the finder; if it does not, use method A.
2. Copy the Place ID (starts with `ChIJ`).
3. Build: `https://search.google.com/local/writereview?placeid=PASTE_PLACE_ID_HERE`
4. Open it on a phone while signed in to a different Google account and check it lands on the review form for the right business. Do not post a test review.

**Then (in this order):**
1. Put the final link where the token is: `{{GOOGLE_REVIEW_URL}}` in the site build (footer "Leave a review", per COMPLIANCE 4) and in every script below.
2. Make a short link on the owner's own domain, so the printed plate never has to change: add a redirect `/review` to the Google link (the site's `_redirects` can hold it; site agent to add once the URL exists). Print text: `{{DOMAIN}}/review`.
3. Generate the printed plate: `python3 offsite/tap-to-review/make.py --url <GOOGLE_REVIEW_URL> --short https://<domain>/review` (see `tap-to-review/`).
4. Program an NFC tag (any NTAG213/215 sticker) with the same short link using a free phone NFC-writer app. Test with an iPhone and an Android phone.

Do not add UTM tags to the Google link. Do not use a link shortener you do not control.

## 2. Request scripts

All scripts are the same for every customer. Placeholders: `[FIRST NAME]`, `{{GOOGLE_REVIEW_URL}}`.

### 2a. In person (at handover)

> "That's done. If you have a minute later, a Google review really helps a small mobile business like ours. Here's a card with a code, or I can text you the link. Whatever you think, we'd value an honest one."

Hand over the tap-to-review plate or card. If they say yes to a text, record consent (section 4) before sending.

### 2b. SMS (only to people with recorded consent; attorney to review)

Message 1, within 24 hours of the job:

> Hi [FIRST NAME], thanks for choosing 916 Dent & Detail. If you have a minute, an honest Google review helps us: {{GOOGLE_REVIEW_URL}} Reply STOP to opt out, HELP for help. Msg & data rates may apply.

Reminder (one only, 5 days later, to everyone who has not replied STOP; same text for everyone):

> Hi [FIRST NAME], a quick reminder from 916 Dent & Detail. Our review link: {{GOOGLE_REVIEW_URL}} No reply needed. Reply STOP to opt out.

Reply to HELP:

> 916 Dent & Detail: for help call (916) 868-2447 **[CONFIRM #1]**. Reply STOP to opt out. Msg & data rates may apply.

Reply to STOP (send once, then never text again): 

> You are unsubscribed from 916 Dent & Detail texts. No more messages will be sent.

### 2c. Email (only if the owner later creates a business email; none exists today)

Subject: `How did we do, [FIRST NAME]?`

> Hi [FIRST NAME],
> Thank you for having 916 Dent & Detail work on your vehicle. If you have a minute, an honest Google review helps other people in the Sacramento area find us: {{GOOGLE_REVIEW_URL}}
> If something was not right, reply to this email or call (916) 868-2447 so we can look into it. Your review is welcome either way.
> 916 Dent & Detail

(The "reply if something was not right" line sits **beside** the review link for everyone; it is not a filter.)

### 2d. Dealer and fleet contacts

Same text, sent to the person who dealt with the crew, after the batch is delivered. Business reviewers can leave reviews too; do not ask a dealer to review on behalf of the whole company.

## 3. Cadence

| When | What | To whom |
|---|---|---|
| At handover | In-person ask + plate | Everyone |
| Within 24 h | SMS (or email) message 1 | Everyone with recorded consent |
| Day 5 | One reminder | Everyone who has not opted out |
| After that | Nothing. Never a third ask | n/a |
| Weekly | Check new reviews; reply within 2 business days | Owner |

Track in a simple sheet: date, job, asked yes/no (must be yes for every job), method. This log is your proof that every customer is asked.

## 4. Consent for texting (TCPA and California; **attorney review required**)

Not legal advice; California-specific texting law was not researched (COMPLIANCE 8). Working rules until counsel reviews:

- Get a recorded opt-in before any text that is promotional in nature, and treat the review request as promotional to be safe. Record who, when, how.
- Acceptable opt-in forms: (a) the optional, **unchecked** consent line on the photo-quote form (COMPLIANCE 8) extended to cover job-follow-up messages; (b) a spoken or written "OK to text you a review link?" at handover, written into the job log the same day.
- Consent wording (attorney to finalize): "By giving us your mobile number you agree that 916 Dent & Detail may text you about your quote, your appointment, and to ask for a review. Message and data rates may apply. Message frequency varies. Reply STOP to opt out, HELP for help. Consent is not a condition of getting a quote or service."
- Every text identifies the business and carries STOP language (Message 1 does). Honor STOP at once and keep the list.
- Send only between 8 a.m. and 9 p.m. in the customer's local time (a common conservative rule; attorney to confirm).
- Texting from a business app or software on a registered business line may require carrier registration (A2P 10DLC); texting one-to-one from the owner's phone may differ. Ask the provider and the attorney.
- Never buy lists. Never text a number that has said STOP, even for a new job, without fresh consent.

## 5. Reply templates

Reply to **every** review within two business days. Be brief, specific, human. Never reveal a customer's vehicle, address, plate, price, or any job detail they did not post. Never argue, never offer money to change a rating, never ask them to remove it. Sign as "the team at 916 Dent & Detail" (no personal names are on file).

**5 stars**

> Thank you, [FIRST NAME]. We appreciate you taking the time to say so. We're glad the work met your expectations, and we're here when your next vehicle needs us.

**4 stars**

> Thank you for the kind words, [FIRST NAME]. We would like to earn the fifth star next time. If anything could have been better, please call us at (916) 868-2447 **[CONFIRM #1]** and tell us.

**3 stars**

> Thanks for your honest feedback, [FIRST NAME]. We would like to understand what fell short. Please call (916) 868-2447 **[CONFIRM #1]** so we can look at it together.

**2 stars**

> We are sorry the experience did not meet your expectations, [FIRST NAME]. We take this seriously. Please call (916) 868-2447 **[CONFIRM #1]** so we can find out what happened and what we can do.

**1 star**

> We are sorry, [FIRST NAME]. This is not the experience we want anyone to have. Please call (916) 868-2447 **[CONFIRM #1]** so we can look into it properly. We will listen.

**Review that does not match any job or seems fake or abusive:** do not accuse in public. Reply once: "We could not match this to a job in our records. Please contact us at (916) 868-2447 **[CONFIRM #1]** so we can look into it." Then use Google's "Report review" flow. Never reply with threats or personal details.

**Review that mentions a dent we said could not be fixed with PDR:** "Thank you for the feedback. We only recommend paintless dent repair when the paint and metal allow it, and we would rather say so than do the wrong repair." (Claims nothing about results.)

## 6. Do not

- Offer a discount or gift for a review. Ask only happy customers. Say "5 stars" in a request. Put the plate on the crew's phone. Text someone who has not agreed. Copy Yelp or Google review text onto the site. Add `AggregateRating` or a star row to the site.

## 7. Placeholders left on purpose

`{{GOOGLE_REVIEW_URL}}` (the real link), `{{DOMAIN}}` (the domain). Both are stamped or pasted once the owner has them.
