# COMPLIANCE: rules the site must follow

Informational research for a static marketing site, **not legal advice**. Every legal source below was reached only through search-result summaries (no statute, ordinance or agency page was opened), so confidence is capped. A California business attorney and an insurance broker should review before launch (the privacy policy and terms carry that line). Source IDs refer to `research/sources.csv`; section references (§) refer to `research/trade-compliance.md`.

Status key: **MUST** = build requirement; **MUST NOT** = lint-enforced ban; **HOLD** = off the site until the owner supplies proof.

## 1. Claims the site must never make until proven (HOLD list; lint-enforced)

| # | Rule | Why | Source | Confidence |
|---|---|---|---|---|
| 1.1 | MUST NOT say or imply: licensed, insured, bonded, certified (incl. product-installer status), BAR registered, "fully licensed and insured", "contractor" | No license, registration, policy or certificate supplied. BAR registration for PDR is an open question (§B1). "Licensed" only with a named, checkable number the owner holds; "insured" only with a current policy and a certificate on request | TC-L01, TC-L09, BP-B20..B22 | Unverified (open) |
| 1.2 | MUST NOT state years in business, "experienced since", "master technician", awards, "family owned", "locally owned", customer counts, review counts, ratings, "trusted by" | None supplied. Owner input says only "two owner-technicians with deep experience plus a crew"; that sentence may be used as written without any number | inputs/notes.md; BLUEPRINT rule 1 | Verified (owner input) |
| 1.3 | MUST NOT use "best", "#1", "cheapest", "fastest", "same day", "30 minutes", "free estimate", "guaranteed", "satisfaction guaranteed", "lifetime", "warranty", "scratch-proof", "permanent", "never wash again", "5-7 year" or any durability figure | False or misleading advertising exposure; guarantees and "lifetime" claims need clear written terms | TC-L02..L04, TC-L07, TC-L08 (§B3, §B5) | Likely |
| 1.4 | MUST NOT put any price, "from $X", fee amount, deposit, membership price or wholesale rate on the site. Market ranges in the research are never 916's prices | None supplied; SB 478 (below) also requires mandatory fees inside any advertised consumer price | TC-L05 | Verified (law), none supplied (fact) |
| 1.5 | MUST NOT list any hours, "open now", response-time promise ("we reply in 15 minutes"), or availability claim | Not supplied | BP-B05 | Verified (owner input) |
| 1.6 | MUST NOT name staff, owners or customers | None supplied | inputs | Verified |

## 2. Results and card wording (owner's own phrases)

| Owner phrase | Rule | Source | Confidence |
|---|---|---|---|
| "Remove Dents" / "Dents gone." | MUST pair with the honest limit in the same page flow: "removes most shallow-to-moderate dents where the paint is intact; if a dent is not a PDR job, we tell you after looking at photos or in person". MUST NOT say "any dent", "every dent", "guaranteed gone" | TC-L17, TC-T02, TC-T03, TC-L02 | Likely |
| "Restore Your Ride" | Tagline only. MUST NOT imply paint restoration or collision repair | TC-L17 | Likely |
| "Showroom Finish" | MUST qualify: "aimed at a showroom-clean look; results depend on paint condition". Deep scratches and failed clear coat cannot be detailed away | TC-L17, TC-L03, TC-L04 | Likely |
| "Protection" | MUST name the real product only after the owner confirms what is offered. Until then the page says "ask about coating and protection options" | TC-L17 | Likely |
| "Enhancement", "Maintenance" | HOLD. Not published until the owner lists the real services | TC-L17 | Likely |
| "Sacramento, CA & Surrounding Areas" | MUST list named cities in body, footer, schema. MUST NOT use "surrounding areas" as the only statement | TC-L16 | Likely |
| "Your Vehicle Our Passion" | Optional puffery; not a fact claim | TC-L17 | Likely |
| Hero line 3 "We come to you." | True of the model (mobile). MUST NOT be read as "anywhere"; the named-city list is the scope | inputs | Verified |

## 3. Price advertising (SB 478, "Honest Pricing")

- MUST: if prices are ever added for consumer purchases, any advertised price includes all mandatory fees except government charges (Civ. Code 1770(a)(29), effective 2024-07-01). A mandatory travel or mobile fee must be inside the headline price. Commercial (dealer, fleet) purchases are outside the law's consumer scope, but still no unsubstantiated claims.
- MUST: a "what affects the price" guide may exist **with no numbers**. It lists drivers only.
- MUST NOT: "from $X" excluding a fee that is always charged; "was/now" pricing without a genuine prior price (B&P 17501, not retrieved).
- Source: TC-L05. Confidence: Verified (AG page plus law-firm summaries; text not opened).

## 4. Reviews and testimonials (FTC 16 CFR Part 465, effective 2024-10-21; BLUEPRINT rule 2)

- MUST: show only real reviews with the name as published, source and link; ask **every** customer for a review, never gate by sentiment; disclose any incentive.
- MUST NOT: fake, purchased, curated or "placeholder" reviews on the live site; star icons, rating rows, review counts; reward tied to 5 stars; `AggregateRating` or `Review` JSON-LD for the business's own pages.
- Launch state: **no reviews page, no review widget.** A "Leave a review" link appears in the footer only after the owner supplies the Google review link.
- Source: TC-L06. Confidence: Verified.

## 5. Insurance claims language (hail and general)

- MUST: "We give you a written estimate and photos your insurer can use." Describe the claim process as information (comprehensive coverage, deductible vs repair cost) and point to the California Department of Insurance consumer line (800-927-4357, TC-T05).
- MUST NOT: "we handle your claim", "we deal with your insurance", "we'll get it approved", any claim-outcome promise, "a claim won't raise your rates" or the opposite (sources disagree).
- Why: who may negotiate a claim for a fee (public-adjuster rules) was not researched.
- Source: TC-T04, TC-T05, TC-L18 (§B12). Confidence: Unverified (open).

## 6. Hail framing

- MUST: "Valley hail is occasional, not annual." Cite only documented events: 2018-02-26 storm (up to 3 in accumulations, stranded vehicles, no dent counts) and the NWS 2023-03-11 warning for quarter-size hail south and east of the city, with "damage to vehicles is expected" attributed to NWS.
- MUST NOT: claim 2018 caused car dents; give hail frequency or dates beyond those; imply a hail-response team or capacity.
- Source: BP-H01..H05. Confidence: Likely.

## 7. Water and "eco" claims

- MUST: "Dent removal uses no water" is the only water statement allowed at launch (true of the method).
- MUST NOT: "eco-friendly", "biodegradable", "zero discharge", "green", "water reclaim", "no runoff", "captures wash water" until the owner confirms the actual method. Then describe it literally (for example "rinseless products; no wash water to storm drains") and keep the FTC Green Guides (16 CFR 260, not retrieved) in mind.
- Context for the owner: Sacramento County Code ch. 15.12 allows only stormwater and listed exempt discharges into storm drains; residential-vehicle-washing exemption does not extend to commercial mobile washing; fines up to $5,000 per day cited by the City brochure; Sacramento, Elk Grove, Folsom, Citrus Heights and Rancho Cordova each have a similar ordinance; ordinance text and 2004 excerpt date not re-verified.
- Source: BP-P01..P03, TC-L15. Confidence: Likely.

## 8. Texting, calling, forms (TCPA / California)

- MUST: next to any phone field on the photo-quote form, an unchecked-by-default, optional consent line: "By submitting this form you agree that 916 Dent & Detail may text you about your quote. Message and data rates may apply. Reply STOP to opt out, HELP for help." (Wording subject to attorney review.)
- MUST: honor STOP and any reasonable revocation; no marketing texts without recorded consent. A reply to someone who texted first is generally informational (attorney to confirm).
- MUST NOT: pre-check consent; make consent a condition of getting a quote; text purchased lists. California-specific texting law (B&P 22948 et seq.) not researched.
- Source: TC-L12. Confidence: Likely; CA-specific Unverified.

## 9. Privacy

- MUST: a privacy page that describes exactly what is collected (form fields, photos uploaded, IP if the form host logs it, analytics if any, text messages), the form-processor's role once chosen, retention (owner to supply), contact method, and a "reviewed by owner's attorney" line. Photos of vehicles may contain plates and surroundings; say how they are used (quotes only).
- MUST: no tracker, pixel, font CDN or third-party script loads without disclosure; the build ships none. Analytics ID is a stamped placeholder; if cookies are ever set, add a notice.
- MUST NOT: "CCPA compliant", "we never share your data" without basis. CCPA thresholds (revenue over $26,625,000 and others) are likely not met by a local operator (TC-L13, Likely, not legal advice); CalOPPA applicability not researched.
- Source: TC-L13. Confidence: Likely/Unverified.

## 10. Accessibility

- MUST: WCAG 2.1 AA (contrast table in `strategy/DESIGN-BRIEF.md`, skip link, focus, 44px targets, labelled form fields, reduced motion, text alternatives, captions or transcript for any media). An accessibility contact line is on the contact and privacy pages.
- MUST NOT: "fully ADA compliant", accessibility overlay widgets.
- Source: TC-L14. Confidence: Likely (bill status Unverified).

## 11. Contact and location privacy

- MUST: service-area business, **no street address anywhere** (site, schema, llms.txt, images, metadata, form host, EXIF of any image). Never publish ZIP 95624 or any "based in Elk Grove" phrasing. In JSON-LD omit `address`; use `areaServed` with named places.
- MUST NOT: personal phone, personal email, EIN or ID numbers.
- Source: BLUEPRINT rule 8; TC-L16. Confidence: Verified (owner/blueprint), Likely (Google).

## 12. Business licences, tax and insurance (owner action, not site copy)

- OWNER TO CHECK: (a) BAR automotive repair dealer registration for PDR and mobile detailing (BPC 9880.1, 9882; 16 CCR 3351.7.3; 2025 mobile-ARD rulemaking pending; BP-B20..B22, TC-L01); (b) City of Sacramento Business Operations Tax certificate (916-808-8500) and the equivalent in each served city (TC-L10); (c) general liability and garagekeepers coverage before any COI language (TC-L11); (d) whether a written estimate is required once registered; (e) written warranty terms if any (Civ. Code 1793.1; FTC 16 CFR 239, TC-L07, TC-L08).
- If registration turns out to be required and is absent, even publishing prices could be a problem; flag to the attorney before launch. The site makes no statement either way.
- Confidence: Unverified (open).

## 13. Dealer and fleet page

- MUST NOT: "COI on request", "net terms", "same-day on-lot", per-panel or per-dent rates, "recon time cut by X days" until the owner supplies them and they are true. MAY say: "tell us how many vehicles and where; we quote per vehicle after looking at photos".
- Source: C9, C10 in `research/RESEARCH.md` conflicts. Confidence: n/a (owner supplied nothing).

## 14. Google Business Profile and directories

- MUST: hide address (service-area business), list named areas, use the real business name only (no keyword stuffing), same phone everywhere, answer verification honestly. See `strategy/ENTITY-PLAN.md`.
- Source: TC-L16. Confidence: Likely (official page not opened).

## 15. Machine-checkable lint (the build must fail on any of these in `public/`)

`licensed`, `insured`, `bonded`, `certified`, `guarantee`, `warranty`, `lifetime`, `years of`, `since 19`, `since 20`, `family owned`, `locally owned`, `award`, `best in`, `#1`, `cheapest`, `free estimate`, `same day`, `same-day`, `eco-friendly`, `biodegradable`, `zero discharge`, `reclaim`, `95624`, any `$` followed by a digit, `AggregateRating`, `Review`, star glyphs outside the decorative ban list, `example.com`, `TODO`, `lorem`, `[CONFIRM`, `{{`, the names Phil's, Cali Tints, Lodi (any other business name in this repo). Allow-list exceptions are written in the lint file with a reason, for example the privacy page may say "we do not guarantee" if the attorney text needs it.
