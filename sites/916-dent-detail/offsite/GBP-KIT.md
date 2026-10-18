# GBP-KIT: Google Business Profile for 916 Dent & Detail

Everything here is a draft for the owner to enter in the owner's own Google account. Nothing has been created or posted. Facts come only from `strategy/ENTITY-PLAN.md`, `inputs/`, and `COMPLIANCE.md`. Items marked **[CONFIRM]** are blocked by `TO-CONFIRM.md` (number in brackets).

**Evidence limits (read first).** Google's help pages (support.google.com) could not be opened in this stage (DNS blocked). What is cited below was reached through search-result summaries only. Google's category list and picker wording change; every category name is **"verify exact names in the dashboard picker"** unless marked otherwise. Limits marked "(3rd-party)" came from non-Google pages.

Code blocks tagged `limit=N` are checked by `python3 offsite/check_limits.py` (results in README).

---

## 1. Categories

Competitor GBP categories could not be read for any Sacramento rival (`research/competitors.md`: "Unverified"). The only evidence is that "Auto dent removal service" appears on other PDR profiles and "Car detailing service" is cited as the standard detailing primary by a third-party forum. So the table below is a reasoned recommendation, not an observation.

| Slot | Category (verify exact name in picker) | Why | Confidence |
|---|---|---|---|
| **Primary** | **Auto dent removal service** | Highest-intent service ("Dent Removal"); seen on other PDR profiles; matches the owner's lead service | Likely (3rd-party) |
| Secondary 1 | **Car detailing service** | Covers Swirl & Scratch Erase, Paint Deep-Clean, Gloss Shield, Interior Reset | Likely (3rd-party) |
| Secondary 2 (conditional) | A *mobile* detailing or car-wash variant, **only if the picker offers one and wash-only jobs are really sold** | Reinforces "comes to you" | Unverified |
| Secondary 3 (conditional) | A coating / paint-protection style category, **only if it exists in the picker and the owner confirms coating is sold** (TO-CONFIRM #8) | Ceramic coating had no dedicated category in prior research | Unverified |
| **Do not add** | Auto body shop, Auto repair shop, Auto restoration, Auto paint shop, Window tinting, Used car dealer | "No body shop, no repaint" is the brand; BAR registration question is open (COMPLIANCE 12); not offered | n/a |

Up to 9 secondary categories are *allowed* by the blueprint, but only two (at most four) are honest today. Padding with unoffered categories is a suspension and relevance risk, so this kit uses **1 primary + 1 firm secondary + up to 2 conditional**.

**Verify steps (10 min, dashboard):** Edit profile > Business information > Business category. Type "dent", "detail", "ceramic", "mobile", "coating", "protection" and write down every suggestion. Open the top 3 Sacramento PDR and detailing profiles in Maps and read the category line under each name. Send the owner's screenshot back so this table can be corrected. If the first 90 days are mostly detailing, swap primary and secondary 1 (one primary only).

## 2. Business name, phone, website, appointment link

| Field | Value |
|---|---|
| Name | `916 Dent & Detail` exactly. No keywords, no city, no "Mobile" added |
| Phone (primary) | `(916) 868-2447` **[CONFIRM #1: digits, and that it receives texts with photos]** |
| Website | `https://{{DOMAIN}}/?utm_source=google&utm_medium=organic&utm_campaign=gbp-website` |
| Appointment / photo-quote link | `https://{{DOMAIN}}/photo-quote/?utm_source=google&utm_medium=organic&utm_campaign=gbp-appointment` |
| Messaging | Off until the owner decides who answers chat, to avoid unanswered-message penalties in the UI |
| Address | **Hidden.** Service-area business. Never enter the home address, never ZIP 95624 |

`{{DOMAIN}}` is stamped by the site build (`stamp.py`) once the owner buys a domain. Do not enter the token into Google.

## 3. Service areas

Google's limit on service areas is "up to 20, within about two hours' drive of the business" (3rd-party; Google's help page not opened; verify in the dashboard). Enter the owner's 14 places, in this order, matching `ENTITY-PLAN.md`:

Sacramento, Elk Grove, Roseville, Folsom, Rancho Cordova, Citrus Heights, West Sacramento, Davis, Rocklin, Lincoln, El Dorado Hills, Granite Bay, Carmichael, Natomas.

Natomas, Carmichael, Granite Bay and El Dorado Hills are communities rather than incorporated cities; if the picker has no match, choose the nearest listed place or ZIP-based area and keep the same list on the site. Do not add places not in the owner's list.

## 4. Business description (limit 750)

Identical to `ENTITY-PLAN.md` section 5 (long copy). No phone, URL, price, hours, license or guarantee. Google's help text (3rd-party summary of the Google page) says URLs and promotions or prices do not belong here.

```text limit=750
916 Dent & Detail is a mobile service in the Sacramento area. We remove dents without paint or a body shop where the metal and paint allow it, and we tell you plainly when a dent is not a candidate. We also detail cars inside and out, including paint deep-clean, swirl and scratch removal, ceramic coating, interior cleaning and hail damage repair when it happens. Two owner-technicians and a crew come to your home, workplace or lot in Sacramento, Elk Grove, Roseville, Folsom, Rancho Cordova, Citrus Heights, West Sacramento, Davis, Rocklin, Lincoln, El Dorado Hills, Granite Bay, Carmichael and Natomas. Dealerships, fleets, rental lots and body shops are served too. Text photos of your dent to get a price.
```

Owner-approval items inside it (already in TO-CONFIRM): "home, workplace or lot", "ceramic coating", "hail damage repair". If the owner prefers a shorter, less list-heavy version, use the 217-character medium copy from `ENTITY-PLAN.md`, but keep it identical on every other profile. The first ~250 characters show before "more" (3rd-party), so the sentence order already leads with what it is and what it does.

## 5. Services (owner's plain-language names; no prices)

Add each as a **Service** (Edit profile > Services), under the category named. Descriptions are written to stay inside `COMPLIANCE.md` (no durations, no durability years, no "guaranteed"). Service description limit is ~300 characters (3rd-party; verify). Do **not** enter any price, "from $", or "free".

| Service name (as the owner calls it) | Description (limit=300) |
|---|---|
| Dent Removal (no paint, no body shop) | Paintless dent repair: we work the dent out from behind the panel, with no filler and no repaint, where the paint is intact. Send photos and we tell you if it is a candidate. |
| Hail Fix | Hail damage repair for vehicles with multiple dents. We give a written estimate and photos your insurer can use. Hail here is occasional, so this is for when it happens. |
| Swirl & Scratch Erase | Paint correction: machine polishing to reduce swirls and light scratches. Results depend on paint condition; deep scratches and failed clear coat cannot be polished away. |
| Gloss Shield | Ceramic coating for paint. Ask us which option suits your vehicle and what prep it needs. **[CONFIRM #8: products offered]** |
| Paint Deep-Clean | Decontamination of the paint (clay and iron removal) to lift bonded dirt, sap and overspray before polishing or coating. |
| Interior Reset | Interior detailing: vacuuming, wipe-down and cleaning of seats, carpets, panels and glass. Ask about stains and pet hair. |
| Dealer, fleet and rental lot service | Dent removal and detailing for dealerships, fleets, rental lots and body shops. Tell us how many vehicles and where; we quote per vehicle after seeing photos. |

**Additional Services stay out** (the card's "Protection / Enhancement / Maintenance") until the owner lists what they really are (COMPLIANCE section 2). **Products**: none. Do not add a product catalog.

```text limit=300
Paintless dent repair: we work the dent out from behind the panel, with no filler and no repaint, where the paint is intact. Send photos and we tell you if it is a candidate.
```

## 6. Attributes (choose only what is true; picker wording varies, verify)

| Attribute | Set? | Condition |
|---|---|---|
| Onsite services | Yes | True: mobile, "we come to you" |
| Online estimates | Yes, **after** the phone number is confirmed to receive photo texts (TO-CONFIRM #1) | The text-a-photo path is the estimate path |
| Appointment required / online appointments | Only if the owner confirms; do not guess | TO-CONFIRM #3 |
| Identifies as (women-led, Black-owned, veteran-led, LGBTQ+ friendly, etc.) | **Owner decides personally**; never default | Personal information; no basis in inputs |
| Wheelchair accessible, payment types, "free" anything | Skip | Not supplied; a mobile service has no entrance |
| Opening date | Skip | Not supplied; no "years in business" claim (COMPLIANCE 1.2) |

## 7. Hours and holidays

Hours are **not supplied** (TO-CONFIRM #3). Do not guess: wrong hours are a top cause of unwanted edits and bad reviews, and COMPLIANCE 1.5 bans "open now" claims.

- Placeholder to fill: `Mon [__] Tue [__] Wed [__] Thu [__] Fri [__] Sat [__] Sun [__]` (owner decides; closed days stay marked "Closed").
- If the work is by appointment only, enter the real windows when the owner takes calls, or the dashboard's appointment-only option **if it exists in the picker (verify)**. Do not publish "24/7".
- **Holidays:** Dashboard > Edit profile > Hours > "Add special hours". Enter the closed or changed hours for each date at least a week ahead. Dates to schedule each year: New Year's Day, Memorial Day, Independence Day, Labor Day, Thanksgiving, Christmas Day, plus any day the crew will not work. Re-check after every change of availability. (US federal holiday names; the owner decides which apply.)

## 8. Questions and answers (written as answers, because public Q&A was removed)

Search-level reporting (BrightLocal, Whitespark and others, not a Google announcement) says Google ended the public Business Profile Q&A section (API stopped 2025-11-03; section phased out from 2025-12) and replaced it with an AI "Ask Maps" feature that draws on the profile text, services, posts, photos and reviews. **Unverified; open the live dashboard to see whether a Q&A box still shows.** Consequence: these answers do double duty. (a) If a Q&A box exists, post each question from a personal account and answer it from the business account. (b) Otherwise the same facts go into service descriptions, posts, and the website FAQ so the AI answer has accurate material to quote.

| # | Question | Answer (all consistent with COMPLIANCE) |
|---|---|---|
| 1 | Do you come to me? | Yes. We are a mobile service and come to your home, workplace or lot in Sacramento, Elk Grove, Roseville, Folsom, Rancho Cordova, Citrus Heights, West Sacramento, Davis, Rocklin, Lincoln, El Dorado Hills, Granite Bay, Carmichael and Natomas. |
| 2 | How do I get a price? | Text photos of the dent, the vehicle, and where you are. We look at them and tell you what we can do. A price needs photos; we do not quote a number without seeing the dent. |
| 3 | Can every dent be fixed without paint? | No. Paintless dent repair works best on dents where the paint is intact. Sharp creases, stretched or cracked paint and some panel edges may not be candidates. We tell you after seeing photos or the vehicle. |
| 4 | What do I need to provide? | Tell us where the vehicle will be and send photos. For water or power needs, **[CONFIRM #9 before answering; until then say "ask us"]**. |
| 5 | Do you work with dealerships, fleets and body shops? | Yes. Tell us how many vehicles and where, and we quote per vehicle after seeing photos. |
| 6 | Do you handle hail damage? | Yes, as Hail Fix, when it happens. We give a written estimate and photos your insurer can use. We do not handle or negotiate insurance claims. |
| 7 | What is a ceramic coating (Gloss Shield)? | A coating applied to paint. Ask us which option suits your vehicle and what prep it needs. We do not give durability figures. **[CONFIRM #8]** |
| 8 | What is the difference between Swirl & Scratch Erase and a regular wash? | It is paint correction (machine polishing) to reduce swirls and light scratches. Results depend on paint condition; deep scratches cannot be polished away. |
| 9 | Do you have an office I can visit? | No. We have no storefront; we come to you. |
| 10 | What are your hours? | **[CONFIRM #3]** Do not answer until hours exist. |
| 11 | How much does it cost? | No price is listed because it depends on the vehicle and the damage. Send photos for a price. **[CONFIRM #5]** |

## 9. Posts (8 postable now + 2 held templates)

Rules for every post: real information only, no price, no "licensed/insured", no years, no statistics, no "free", no "guarantee", no "same day". **No stock or generated photos** (BLUEPRINT rule 3). Until real job photos exist (`PHOTO-SHOTLIST.md`), post text-only or with the logo. Post body limit is 1,500 characters (3rd-party); all drafts are under 600. Button: "Call now" or "Learn more" to the UTM link below. UTM for post links: `https://{{DOMAIN}}/photo-quote/?utm_source=google&utm_medium=organic&utm_campaign=gbp-post-<n>`.

Post types in Google's composer are Update ("What's new"), Offer, and Event. Seasonal posts are Updates.

| # | Type | Text | Button |
|---|---|---|---|
| P1 | Update | Got a dent and want a price? Text photos of the dent, your vehicle, and where it is parked. We look at them and tell you what we can do. We come to you. | Learn more (photo-quote) |
| P2 | Update | Not every dent is a paintless dent repair job. It works best where the paint is intact. Sharp creases, stretched or cracked paint and some panel edges may need another fix. We tell you after looking at your photos, so you do not pay for the wrong repair. | Learn more |
| P3 | Update | Dents out, paint cleaned up. Ask us about Dent Removal, Swirl & Scratch Erase and Interior Reset for your vehicle. We come to your home, workplace or lot. | Call now |
| P4 | Update | Running a dealership, rental lot, fleet or body shop? Tell us how many vehicles and where. We quote per vehicle after seeing photos, and we come to the lot. | Call now |
| P5 | Seasonal | Sacramento summers are hard on paint. Sun and heat bake on bird droppings, tree sap and road film. A Paint Deep-Clean lifts what washing leaves behind. Ask what your paint needs. | Learn more |
| P6 | Seasonal | Valley hail is occasional, not annual, but when it hits, photograph the damage before anything else. We give a written estimate and photos your insurer can use. For claim questions, the California Department of Insurance consumer line is 800-927-4357. | Learn more |
| P7 | Update | Following along? Our work and answers to common questions are on Instagram at @916dentanddetail. **[Post only after CONFIRM #13: account live and public]** | Learn more |
| P8 | Update | What to send for a price: 1) one photo of the whole panel, 2) one close-up with light across the dent, 3) a photo of the vehicle (year, make, model), 4) where it will be parked. That is all we need to start. | Learn more |
| P9 (HELD) | Offer | **Do not post.** An Offer needs a real, owner-approved offer with real dates and terms (nothing supplied; no discount exists). Template only: `[OFFER NAME] [OWNER-APPROVED TERMS] [START] [END]`. If it ever includes a price, SB 478 applies (COMPLIANCE 3). | n/a |
| P10 (HELD) | Event | **Do not post.** For a real, dated event only (for example an owner-run dealer lot day). Template only: `[EVENT TITLE] [DATE] [TIME] [PLACE: no home address]`. | n/a |

Post cadence: one a week is plenty; the point is fresh, accurate content, not volume. Posts disappear from view after a while, so reuse P1 and P8 on a schedule.

P6 uses the one sourced hail statement in `COMPLIANCE.md` section 6 and no hail dates or counts.

## 10. Photos and video

See `PHOTO-SHOTLIST.md` for the exact shots. Upload only real photos taken by the crew. Remove EXIF location data and never show a customer plate or home address (blur plates). The owner's hero video and beading image are of unknown origin (TO-CONFIRM #4): do **not** upload them to Google as "our work".

## 11. Verification

Google decides the method; options for a service-area business commonly include video verification, phone, or email, and can change per business (3rd-party; not verified). Answer verification **honestly**: show the real vehicles, tools and the business name. Do not use a virtual office, a mailbox store or a borrowed storefront (see section 12). Keep the phone line at hand.

## 12. Suspension and edit risks for a service-area business

Sources: Google's guidelines for representing a business on Google (support.google.com/business/answer/3038177), the page on hiding a service-area business's address (support.google.com/business/answer/10514137, content confirmed through search summary), and Google's Maps user-contributed content policy. None were opened in this stage; read each in a browser before acting. **The owner, not this kit, is responsible for the final answers given to Google.**

| Risk | What triggers it | What the owner does |
|---|---|---|
| Showing a home address | A service-area business should hide the address; Google says that after hiding, the profile shows only the service area | Set "Show business address to customers" off. Never type the home address into any other directory |
| Service areas too wide or invented | Listing places the business does not serve, or far outside the drive-time limit | Use only the owner's 14 places |
| Name stuffing | Adding "Mobile Dent Repair Sacramento" to the name | Name is `916 Dent & Detail`. Nothing added |
| Virtual office, PO box, coworking desk or mailbox used as a "storefront" | Google treats a business that cannot receive customers at that address as ineligible | Do not use one. A service-area business needs no address on the profile |
| Duplicate profiles (one per city, or one per service) | One business, one profile | Create exactly one profile. If a duplicate exists, claim or request removal; see `CITATIONS-CLEANUP.md` |
| Category padding or wrong categories | Auto body shop with no body shop | Section 1 |
| Review gating, incentives, fake or employee reviews | Google policy and FTC 16 CFR Part 465 | `REVIEWS-KIT.md`. Ask every customer; no gating; no incentive |
| Changing name, phone, categories, or service area right after verification | Can trigger re-verification or suspension | Settle the facts first (TO-CONFIRM #1, #3, #8) then enter once |
| Inconsistent NAP between site, profile and directories | Weakens trust and can trigger edits | One string from `ENTITY-PLAN.md` everywhere |
| Using a call-tracking number as primary | Search can show conflicting numbers | Main number stays primary; a tracking number can be added as additional only |
| Licensing claims | Claiming "licensed" with no verifiable number | None used; the BAR question is open (TO-CONFIRM #2) |

If suspended: do not create a new profile. Use Google's reinstatement form from the dashboard with accurate evidence (photos of vehicles and tools with the business name, a dated invoice with the name and phone, and an ID if asked). Edits to a verified listing can take time to appear; do not repeat edits.

## 13. Order of operations for the owner

1. Confirm phone digits and photo texts (TO-CONFIRM #1). 2. Browser-check for an existing listing (CITATIONS-CLEANUP.md). 3. Create the profile in the owner's Google account with the hidden address and the 14 areas. 4. Set category, description, services, hours when known. 5. Verify with Google's offered method. 6. Add real photos. 7. Copy the review link into `REVIEWS-KIT.md`, then into `{{GOOGLE_REVIEW_URL}}` on the site and `tap-to-review/`. 8. Post P1, P2, P8. 9. Then Apple, Bing, Yelp (`PROFILE-COPY.md`).
