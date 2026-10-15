# Retargeting: Pixel, CAPI, Audiences, Sequences

Status: DRAFT. Nothing installed or launched. Creating ad accounts, installing pixels (a publish action on the site is the website agent's job), and spend are owner gates. Retrieved 2026-10-15. Source gap: no Meta Business Help or Google Ads help pages surfaced for audience windows; windows below are general practice, **verify in the account**. Privacy: add a consent banner and a privacy policy statement before any pixel fires (California privacy law applies; confirm with the site's Phase 6 consent solution and a legal advisor).

## Event mapping (site events -> Meta and Google)
| Site event | Meta standard event | Google Ads | Use |
|---|---|---|---|
| page_view (all pages) | PageView | Google tag | Audience building |
| quote_requested | Lead | Conversion (Lead) | Retarget non-bookers; exclude from prospecting |
| booking_completed | Schedule or Purchase (with value) | Conversion (Primary) | Exclude from retargeting; seed lookalike |
| call_click | Contact | Click-to-call conversion | Retarget warm |
| book_step_started (Phase 2 steps) | custom event `BookStarted` | optional | Abandon audience |

Method: Meta Pixel in the browser plus Conversions API from the server (Phase 2/6 can post `quote_requested` and `booking_completed`). Use the same `event_id` on both for deduplication. Hash email/phone before sending; send only with consent. **Verify in Events Manager** (Test Events tab).

## Audiences and windows
| Audience | Window | Sequence | Exclude |
|---|---|---|---|
| A1 Website visitors (all) | 30 days | Proof + offer | Bookers, A2 |
| A2 /book started, not completed | 14 days | Reminder + objection answer | Bookers |
| A3 quote_requested, not booked | 21 days | Follow-up + "slot open" | Bookers |
| A4 Video viewers 50% (reels/dent reveals) | 30 days | Photo-quote CTA | Bookers |
| A5 IG/FB engagers | 60 days | Social proof (real reviews only) | Bookers |
| A6 Customers (uploaded list, consent only) | n/a | Referral, maintenance, Gloss Shield upsell | Prospecting |
| A7 Lookalike of A6 / bookers | 1% | Prospecting variant | A6 |
Minimum audience size for Meta delivery is a known requirement (about 100 people; verify in account). If audiences are too small at launch, do broad geo-targeted prospecting first.

## Sequences (copy-paste ad copy)
Day 1-3 (A1), proof:
```
Dents gone. Paint glowing. Send a photo and see what we can do with no paint and no body shop.
```
Day 4-7 (A1 + A4), objection:
```
Think your dent needs a body shop? Often it does not. A photo is all we need for a price.
```
Day 8-14 (A2), nudge:
```
You started a booking. Finish it in two minutes and we will confirm a time.
```
Day 10-21 (A3):
```
Your quote is ready to book. Pick a time and we come to you.
```
Customer (A6), 60-90 days after a job:
```
How is your paint holding up? Send a photo and we will tell you if a Paint Deep-Clean is due. [OWNER: confirm service cadence]
```

## Frequency and budget
- Cap about 2-3 impressions per person per week (practice; verify). Retargeting budget is a small share of total ad spend: [OWNER decision D4]. Pause retargeting if A1 is below the minimum audience size.
- Exclude bookers on both Meta and Google lists within 24 hours of `booking_completed`.

## Google remarketing
Build lists in Google Ads from the same events (visitors 30 days, quote_requested 21 days). Use Search RLSA or Demand Gen only with enough list volume; verify the current product names in the account. No Display shotgun.

## Compliance
- Do not retarget people who opted out; honor consent. Do not use customer photos or reviews without consent.
- Do not collect health or sensitive data: dent/paint is not sensitive, but never target using sensitive categories.
- Meta can reject, remove or restrict any ad at its discretion (ConductAtlas summary of Meta ad terms, https://conductatlas.com/platform/meta/meta-terms-of-service/advertising-and-commercial-content/, 2026-10-15; third-party).

## Report
Weekly: reach, frequency, cost per `quote_requested` and per `booking_completed` from retargeting vs prospecting; kill any ad set above the owner's cost cap.
