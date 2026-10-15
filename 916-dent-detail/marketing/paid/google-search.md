# Google Search Campaigns

Status: DRAFT. Nothing is created and no spend is authorized. Creating the Google Ads account, entering payment and launching are owner hard gates. Retrieved 2026-10-15.

Sources and confidence:
- RSA structure: up to 15 headlines and 4 descriptions (Google help, https://support.google.com/google-ads/answer/7684791, retrieved 2026-10-15, confirmed in search). Character limits: headline 30 is confirmed by a third-party spec (https://www.jumpfly.com/blog/responsive-search-ad-specs-for-google-ads/, 2026-10-15). The 90-character description limit was NOT confirmed in search today (only seen for responsive display ads); it is the long-standing RSA limit, so **verify in the Ads editor**; the editor will flag any overage.
- Sitelink/callout limits (25 / 35) and match type behavior are general Google Ads practice, not re-verified today.
- Markets and prices are not asserted. No CPC, CPA or volume numbers appear here because none were sourced.

## 1. Offer and landing page
One offer everywhere: **Get a price from a photo** -> `https://[OWNER DOMAIN]/book`. Final URL pattern per ad group: `https://[OWNER DOMAIN]/book?utm_source=google&utm_medium=cpc&utm_campaign={campaign}&utm_term={keyword}` (ValueTrack `{campaign}`/`{keyword}` need to be verified in the account). Dent ad groups can land on `/services` first only if `/book` underperforms: test, do not guess.

## 2. Campaign structure
| Campaign | Goal | Ad groups | Start |
|---|---|---|---|
| C1 Dent Removal | quote_requested + calls | Mobile PDR; Door Ding; Dent Near Me; Dent Removal No Paint | Live first |
| C2 Detail and Coating | quote_requested | Mobile Detailing; Ceramic Coating; Paint Correction; Interior Detail | Live second (after C1 has tracking proof) |
| C3 Hail (seasonal) | quote_requested | Hail Dent Repair; Hail Damage Car | PAUSED. Turn on only after a hail event in the service area; check NWS first (research: valley hail occasional, not annual) |
| C4 Brand | protect name | 916 Dent & Detail | Low bid; only when someone else bids on the name or the brand has searches |
| C5 Dealer and Fleet | dealer leads | Dealer Dent Repair; Fleet Detail | Optional; low budget; start only after the door-knock kit (`dealers/`) |

Settings (**verify in account**): Network: Google Search only (turn off Search Partners and Display expansion at start). Bidding: start with Manual CPC or Maximize Clicks with a CPC cap; move to Maximize Conversions only after about 15-30 conversions (common practice, UNVERIFIED). Ad rotation: default. Language: English (add Spanish only with Spanish landing copy).

## 3. Geo targeting and schedule
- Location: target by named cities/ZIPs, not by "state". Start with a radius or ZIP list around base ZIP 95624 (`site.baseZip` in site.ts): Sacramento, Elk Grove, Rancho Cordova, Citrus Heights, Natomas, West Sacramento, Folsom, Roseville, Davis, Carmichael, El Dorado Hills, Granite Bay, Lincoln, Rocklin (the 14 target cities from `research/local-facts.md`). Match the radius to the booking engine's travel-fee limit (Phase 2).
- Targeting option: set "Presence: people in or regularly in your targeted locations" (not "presence or interest") so out-of-area searchers do not click. Wording is **verify in account**.
- Schedule: ads on when the owner can answer a call or reply within 15 minutes. If hours are unset, run 7am-8pm and reduce later. [OWNER: hours] Call asset schedule should match.
- Device: all devices; the landing page is phone-first (SPEC).

## 4. Keywords (match types)
Start with phrase and exact. Add broad only with Smart Bidding and a long negative list.

C1 Dent Removal:
```
[paintless dent repair sacramento]
[mobile dent repair sacramento]
[dent repair sacramento]
[dent removal sacramento]
[door ding repair sacramento]
"paintless dent repair near me"
"mobile dent repair near me"
"mobile paintless dent repair"
"car dent removal sacramento"
"dent repair elk grove"
"dent repair roseville"
"dent repair folsom"
"dent repair rancho cordova"
"dent repair citrus heights"
"door ding repair near me"
"remove dent without paint"
"dent repair no repaint"
```
C2 Detail and Coating:
```
[mobile car detailing sacramento]
[ceramic coating sacramento]
[paint correction sacramento]
"mobile detailing near me"
"mobile car detailing elk grove"
"mobile detailing roseville"
"mobile detailing folsom"
"ceramic coating near me"
"swirl mark removal"
"car scratch removal sacramento"
"interior car detailing sacramento"
```
C3 Hail:
```
[hail damage car repair sacramento]
"hail dent repair near me"
"paintless hail repair"
"hail damage car repair roseville"
```
C5 Dealer and Fleet:
```
"dealership dent repair sacramento"
"mobile dent repair for dealers"
"fleet dent repair sacramento"
"used car dent repair"
```
C4 Brand:
```
[916 dent and detail]
[916 dent & detail]
"916 dent detail"
```

## 5. Negative keywords (account-level shared list)
Add as phrase match. Apply "wholesale" to C1 and C2 only (leave it off C5 Dealer):
```
free
diy
how to
tutorial
youtube
kit
tools
course
training
class
school
jobs
job
hiring
career
salary
supplies
wholesale
insurance claim form
body shop
collision
paint job
repaint
respray
bumper repair
windshield
glass
tint
wrap
motorcycle
bike
boat
rv
junkyard
salvage
used cars for sale
```
Review the Search Terms report weekly for the first 4 weeks and add negatives. "body shop" is a negative because we are not one; revisit if tests show it brings buyers who compare.

## 6. Responsive Search Ads (character-verified by script)
Pin lightly: pin "Get a Price From a Photo" to headline position 1 or 2 only if performance data shows it helps; otherwise leave unpinned (Google guidance on pinning reduces flexibility, UNVERIFIED). Never use "best", "#1", "cheapest", "guaranteed" or "licensed/insured" unless provable.

### RSA-1 Dent Removal (ad groups: PDR, Door Ding, Mobile Dent)
Headlines (each <= 30 chars):
```
Dent Removal, No Paint
Mobile Dent Repair Sacramento
We Come To You
No Body Shop. No Repaint.
Get a Price From a Photo
Door Dings Gone Fast
Paintless Dent Repair
Dents Out, Paint Stays
Greater Sacramento Mobile
Send a Photo, Get a Price
Book Online in Minutes
Precision. Care. Perfection.
Mobile Paintless Dent Pros
Fix Dings at Home or Work
Original Paint Kept
```
Descriptions (each <= 90 chars):
```
Paintless dent repair at home or work. No body shop, no repaint. Send a photo for a price.
Dents worked out from behind the panel so factory paint stays. Mobile across Sacramento.
Door dings, creases and parking-lot dents. Get a price from a photo before you book.
Mobile service in Sacramento, Elk Grove, Roseville and Folsom. Book online in minutes.
```

### RSA-2 Hail Fix (ad group: Hail, seasonal)
Headlines (each <= 30 chars):
```
Hail Fix, No Repaint
Hail Dent Repair Sacramento
Paintless Hail Repair
Send Photos of Every Panel
Get a Price From a Photo
We Come To You
Hail Damage Specialists
Hood and Roof Dents Out
Work With Your Estimate
Mobile Across Sacramento
Book a Hail Slot Online
Original Paint Kept
Precision. Care. Perfection.
Hail Dents Removed
See If Paintless Fits
```
Descriptions (each <= 90 chars):
```
Hail dents on hood, roof and doors. Paintless repair at home. Send photos for a price.
Bring your insurance estimate. We price the repair and tell you what paintless can do.
No body shop, no repaint where paintless fits. Mobile across Greater Sacramento.
Hail hit your car? Send photos of each panel and get a price before you book.
```

### RSA-3 Detail and Gloss Shield (ad groups: Mobile Detail, Ceramic, Paint Correction)
Headlines (each <= 30 chars):
```
Gloss Shield Ceramic Coating
Mobile Car Detailing
Swirl & Scratch Erase
Paint Correction Sacramento
We Come To You
Get a Price From a Photo
Paint Deep-Clean
Interior Reset Detail
Water Beads Right Off
Book Online in Minutes
Precision. Care. Perfection.
Detailing at Home or Work
Ceramic Coating Sacramento
Glossy Paint, Easier Washes
Mobile Across Sacramento
```
Descriptions (each <= 90 chars):
```
Swirl removal, ceramic coating and deep-clean detailing at home or work in Sacramento.
Gloss Shield bonds a hard protective layer to corrected paint. Water beads and rolls off.
Get a price from a photo. We come to you across Greater Sacramento.
Interior Reset, Paint Deep-Clean and Swirl & Scratch Erase. Book online in minutes.
```

### RSA-4 Dealer and Fleet (campaign: Dealer, low budget)
Headlines (each <= 30 chars):
```
Dealer Dent Removal Sacramento
On-Lot Dent Repair
Per-Panel Wholesale Rates
Fleet Dent and Detail
Mobile Recon Services
We Come To Your Lot
Request a Dealer Quote
No Body Shop Wait
Greater Sacramento Lots
Precision. Care. Perfection.
```
Descriptions (each <= 90 chars):
```
On-lot dent removal and detailing for dealers and fleets. Per-panel rates. Get a quote.
We come to your lot. Dealer rate sheet, clear terms. Sacramento, Roseville, Elk Grove.
Cut recon downtime. Mobile dent repair and detail for Sacramento dealers and fleets.
Ask for a wholesale rate sheet. Greater Sacramento coverage.
```

## 7. Assets (extensions)
Call asset: [OWNER PHONE]. Count calls from ads: set a minimum call length in Ads (setting name: verify). Connect to `call_click` for taps; Google forwarding number reporting: verify in account.

Sitelinks (title <= 25, two description lines <= 35 each):

```
Title: Get a Price From a Photo
Line 1: Send photos, get a quote
Line 2: Before you commit
URL: https://[OWNER DOMAIN]/book
```

```
Title: Dent Removal
Line 1: No paint, no body shop
Line 2: Door dings to hail
URL: https://[OWNER DOMAIN]/services
```

```
Title: Gloss Shield
Line 1: Ceramic coating
Line 2: Water beads right off
URL: https://[OWNER DOMAIN]/services
```

```
Title: Dealer Programs
Line 1: Per-panel wholesale
Line 2: On-lot scheduling
URL: https://[OWNER DOMAIN]/dealers
```

```
Title: Pricing
Line 1: How we price
Line 2: Photo-based quotes
URL: https://[OWNER DOMAIN]/pricing
```

Callouts (<= 25 chars each):
```
We Come To You
No Paint, No Body Shop
Photo-Based Pricing
Book Online
Greater Sacramento
Dealer Programs
Original Paint Kept
Mobile Service
```

Structured snippet (header: Services): `Dent Removal, Hail Fix, Swirl & Scratch Erase, Gloss Shield, Paint Deep-Clean, Interior Reset` (each value has its own limit of 25 characters; every value is under 25).
Location asset: not used. We are a service-area business with no public address; linking the Business Profile as a location asset needs the address data and is **verify in account**. Use "Affiliate"/area text only if offered.
Image assets: real job photos only (gbp/photo-shot-list.md), 1:1 and 1.91:1. Business name asset: `916 Dent & Detail`. Logo: /brand.
Promotion asset: none until a real offer exists.

## 8. Conversion tracking tie-in
Site events (Phase 6 analytics): `quote_requested`, `booking_completed`, `call_click`.
| Event | Google Ads conversion | Role | Value |
|---|---|---|---|
| booking_completed | Purchase/Booking | Primary | Booked job value or deposit amount if passed; else [OWNER avg ticket] |
| quote_requested | Lead (submit lead form) | Primary at the start (more volume to learn from) or Secondary; decide with the data | [OWNER lead value] (e.g. close rate x avg ticket) |
| call_click | Click-to-call | Secondary | Lower value |
Method: GA4 -> import conversions into Ads, or a gtag/Google Tag with event names; add Enhanced Conversions if consent allows (CA privacy: coordinate with the cookie/consent banner, Phase 6). Verify in Ads: Goals > Conversions; test each event with Tag Assistant before spending. Use `gclid` capture into /admin lead source (SPEC Phase 3 lead sources include UTM capture).

## 9. Starting budget: [OWNER] decision D4
No sourced CPC, so a budget number would be invented. Use this logic instead:
1. Pick a target cost per booked job you can afford: [OWNER TARGET CPA] (not more than a fixed share of the average job profit, set by the owner).
2. Decide how many bookings per week you want from ads: [OWNER N].
3. Estimate the leads-to-booking ratio from your own data once you have it (SPEC Phase 3 reports close rate). Until then assume nothing.
4. Weekly spend cap = [OWNER TARGET CPA] x [OWNER N] (x lead-to-booking multiplier once known).
5. Daily budget = weekly spend cap / 7. Too small a budget cannot exit the learning phase; if the number is below what Google suggests in the account, run fewer campaigns (C1 only), not thinner ones.
6. Test window: 30 days with a hard stop. Kill rule: no quote_requested after [OWNER N] clicks or spend of [OWNER $], then fix landing page or targeting before spending more (`ops/EXPERIMENTS.md` format: hypothesis, cost cap, time cap, kill threshold).
Illustrative arithmetic only (not a forecast): if the cap is $X per booking and 3 bookings a week are wanted, weekly spend is 3 x $X.

## 10. Launch checklist
1. Business Profile live (gbp/). 2. Conversions tested. 3. Negatives list applied. 4. Call number real. 5. Ads reviewed for policy (no unprovable claims). 6. Owner approves budget and presses publish (hard gate). 7. Day 3, 7, 14 search-terms review.

## 11. Report
Weekly (Sunday): spend, clicks, quote_requested, booking_completed, call_click, cost per quote and per booking, search terms added, top ad. Feeds /admin reports (ad CPA).
