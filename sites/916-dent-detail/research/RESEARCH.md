# RESEARCH: 916 Dent & Detail (merged Stage 1)

Merged 2026-10-18 from three research passes (`business-place.md`, `trade-compliance.md`, `keywords.md` + `design-references.md`, `competitors.md`) and the owner inputs. Source rows live in `sources.csv`; IDs below use the unified prefixes **BP-** (business/place), **TC-** (trade/compliance/competition), **KD-** (keywords/design). The `aliases` column in `sources.csv` maps every unified ID back to its original ID, and lists duplicate rows that were merged (18 merged; 147 rows remain).

## 0. Evidence quality (read first)

- **WebFetch was blocked in every research pass** (DNS failure, proxy 403). No competitor site, SERP, GBP, Yelp page, ordinance text or statute was opened. Everything third-party is a **search-result summary**. Confidence labels in `sources.csv` were kept as the researchers set them; nothing was upgraded in the merge.
- The only items that are solid: **owner inputs** (spec, notes, business card, which I re-read visually: the back of the card shows "916-868-2447", "Sacramento, CA & Surrounding Areas", "@916dentanddetail", and the three service rows), and two legal items carried as Verified (TC-L05 SB 478, TC-L06 FTC reviews rule), each still snippet-level. The competitor review counts are third-party mirrors (Likely at best).
- No keyword volumes, no autocomplete, no People Also Ask. Every "competitiveness" value is an **estimate** from what surfaced.
- Consequence: this synthesis supports strategy and design decisions. It cannot support publishing any third-party number, any price, or any legal claim. Those stay out of the site (see `COMPLIANCE.md`, `TO-CONFIRM.md`).

## 1. Executive summary

1. **Business.** 916 Dent & Detail is a mobile, no-storefront Sacramento business: paintless dent repair (PDR) plus auto detailing, two owner-technicians and a crew, serving retail and B2B (dealers, fleets, rental lots, body shops). It has **no discoverable web footprint** (no site, GBP, Yelp, Facebook, TikTok, BBB found; Instagram handle is owner-supplied and not indexed). No identity confusion with another business (BP-B06..B19). Nothing to clean up yet, and nothing for AI engines to quote yet: the site and the profiles will be the whole entity.
2. **What is not known** (and so cannot appear): hours, prices, email, domain, license/insurance/BAR status, warranty terms, reviews, job photos, names, years, which "additional services" exist, how water is handled.
3. **Trade.** PDR is bought as a planned, convenience-driven fix, often "while I'm here"; hail is event-driven; coating is researched; dealer recon is volume B2B. Customers search "how much", then pick on a fast, low-friction estimate. Competitors sell by call or text quote and fast turnaround (TC-T01, TC-C02). **No Sacramento competitor surfaced with a photo-quote page, a price-drivers guide, a dealer-recon page, or an honest "what PDR can't fix" block except CARSTAR** (TC-C04). Those are the openings.
4. **Place.** Sacramento is hot (about 23 days over 100F in a typical year; record 2024, BP-HT01) and hail is **occasional, not annual** (2018-02-26; NWS 2023-03-11 warning; BP-H01..H05), so "Hail Fix" is real but cannot be a headline claim. Wash water may not go to storm drains (Sacramento County, Sacramento, Elk Grove, Folsom, Citrus Heights, Rancho Cordova each have ordinances; BP-P01..P03). About 13% of county residents speak Spanish at home (BP-L03).
5. **Competition.** Fragmented. Directory mirrors (Lantern, Poyst, ZoomInfo) fill many result slots, which implies the own-site field is soft (estimate). Review counts to beat on the map: 53 to 328 for the PDR set, 4 to 89 for mobile detailers (all third-party mirrors, Low confidence).
6. **Design.** "Dark and premium" is the detailing-trade cliche (KD-design-template). The brand is fixed by the owner. Differentiation must come from restraint, type (Michroma is unused by every other site here), a transformation hero, and real process transparency rather than from black and gold alone.
7. **Decisions this drives:** photo-quote as the primary action; 6 service pages (owner's six plain-language names, real terms in H1/titles); 4 dedicated city pages (Sacramento, Elk Grove, Roseville, Folsom), all other places as named areas on one service-area page; no Spanish mirror at launch; no prices, no reviews page, no gallery until real material exists.

## 2. Conflicts list: owner input vs research (owner value is kept; the conflict is logged)

| # | Owner input | Research finding | Resolution on the site | TO-CONFIRM |
|---|---|---|---|---|
| C1 | Card: phone 916-868-2447 | Read visually from artwork only; no web page ties the number to a business (BP-B02, BP-B08) | Use as given (authoritative); build flag `PHONE_CONFIRMED=false` fails the production lint until the owner confirms the digits | #1 |
| C2 | Card: "Remove Dents" / "Showroom Finish" | Absolute result claims; PDR cannot fix sharp creases, stretched or cracked paint (TC-T02, TC-T03); false advertising exposure (TC-L02..L04) | Tagline-level use only, qualified in body copy ("most shallow-to-moderate dents where paint is intact"; "results depend on paint condition") | #8 |
| C3 | Hero line "Dents gone. Paint glowing." | Same absolute-claim risk | Kept verbatim as the owner's hero line; the subhead and the visible "what PDR can't fix" block qualify it in the same viewport flow | #8 |
| C4 | Card: "Sacramento, CA & Surrounding Areas" | Too vague for schema, GBP and AI; GBP wants named service areas (TC-L16) | Named cities in schema, footer, service-area page. "Surrounding areas" is not used as the only statement and not in schema | none |
| C5 | Spec Phase 6: 14 dedicated city pages; 9 service pages at 900+ words; 10 blog posts | Rule 5: city pages need ~300 words of non-swappable local content; evidence is thin outside 4 cities (BP city table); no data supports 900-word pages; 10 posts have no sourced topics | 4 city pages; 6 service pages sized to what is knowable; 4 guides. Everything else on the service-area page | #10 |
| C6 | Spec: nav "Pricing, Reviews, Book" | No prices supplied; no reviews exist | Nav: Services, Dealers & Fleets, Guides, Service area, Get a price from a photo. A price-drivers guide with no numbers replaces Pricing; Reviews omitted | #5, #10 |
| C7 | Spec: "Eco-friendly, no runoff (water reclaim)" section | Reclaim equipment unconfirmed; FTC Green Guides risk (TC-L15; `trade-compliance.md` section B10) | Omitted at launch. Only "PDR uses no water" (true by method) is stated. Section returns when owner confirms the method | #9 |
| C8 | Spec: memberships; booking engine; deposits; per-panel wholesale pricing; travel fee by radius from 95624 | None of the terms exist; SB 478 makes mandatory fees part of any advertised consumer price (TC-L05) | None on the site. Dealer page says "quote per vehicle" only | #5 |
| C9 | Spec: "COI on request" for dealers | No insurance supplied (trade-compliance.md §B2, trade-compliance.md §B11) | Not stated until owner confirms a policy | #7 |
| C10 | Spec: "same-day on-lot" (dealers) | Unconfirmed capacity | Not stated | #8 |
| C11 | Spec Phase 6 schema: "AutoRepair + LocalBusiness" | "AutoRepair" implies mechanical repair and touches the open BAR question (trade-compliance.md §B1); researchers also advise against "auto repair shop"/"auto body shop" labels | Schema type is the parent `AutomotiveBusiness` (confirm exists on schema.org at build); see `ENTITY-PLAN.md` | #2 |
| C12 | Spec: headlight restoration is a Phase 6 service page; "Additional Services" on the card are unspecified | Not among the owner's six plain-language names; unconfirmed | No headlight page. Card's "Protection / Enhancement / Maintenance" only appears as "Ask about additional services" | #8 |
| C13 | Owner: base ZIP 95624 (Elk Grove) | Must never be published (blueprint rule 8); Elk Grove city page could imply "based in Elk Grove" | Elk Grove page never says based or located there; distances not published | none (decision recorded in ASSUMPTIONS) |
| C14 | Hero video frames (owner-supplied) | Frames look like a staged or generated scene (dark navy sedan, wet studio floor), not a documented 916 job; unknown | Presented as an illustration of the idea, captioned "Illustration, not a customer vehicle" until the owner states otherwise (rule 2: no fake before/afters) | #4 |
| C15 | Spec: Hail Fix as a named service | Hail is occasional here; no vehicle-dent hail source for Sacramento; claim-handling language is risky (trade-compliance.md §B12) | Hail page exists, framed "when it happens", with claim steps as information and "written estimate and photos your insurer can use" | #8 |

## 3. The business

### 3.1 Canonical facts (from inputs, authoritative)

| Field | Value | Status |
|---|---|---|
| Name | 916 Dent & Detail | Owner (BP-B01) |
| Tagline | Precision · Care · Perfection. Script line on card: "Your Vehicle Our Passion" | Owner |
| Hero line | Dents gone. Paint glowing. We come to you. | Owner |
| Phone | (916) 868-2447 (digits owner-supplied from card; confirm) | Owner, [CONFIRM] |
| Address | None. Service-area business; never publish an address or base ZIP | Owner |
| Service area | Sacramento, Elk Grove, Roseville, Folsom, Rancho Cordova, Citrus Heights, Natomas, West Sacramento, Davis, Carmichael, Granite Bay, El Dorado Hills, Lincoln, Rocklin | Owner |
| Instagram | @916dentanddetail (owner-provided, not verified live) | Owner |
| People | Two owner-technicians plus a crew; no names, no years | Owner |
| Customers | Retail and B2B (dealerships, fleets, rental lots, body shops) | Owner |
| Services | PDR; auto detailing (interior and exterior); "additional services": protection, enhancement, maintenance | Card |
| Plain names | Dent Removal (no paint, no body shop); Swirl & Scratch Erase; Gloss Shield; Paint Deep-Clean; Hail Fix; Interior Reset | Owner |
| Not provided | Email, domain, hours, prices, license, insurance, reviews, job photos, social URLs other than IG, Google review link | Owner (BP-B05) |

### 3.2 Online presence and licensing

- No site, GBP, Yelp, Facebook, TikTok, BBB, directory listing found for the exact name (BP-B06; Unverified, because a search summary cannot prove absence). Instagram handle not indexed (BP-B07). Phone not tied to any page (BP-B08). A human must check Google Maps, Yelp, Facebook, Apple Maps, Bing Places, BBB and the CA Secretary of State before claiming profiles.
- **BAR registration is an open question** (TC-L01; BP-B20..B22): BPC 9880.1/9882 require registration for compensated vehicle repair including body repair; mobile repair needs registration and per-vehicle numbers (16 CCR 3351.7.3); a 2025 rulemaking on mobile ARDs is pending. Nothing found says PDR or detailing is exempt or covered. Status Unverified, high stakes. The site neither claims nor disclaims licensing.
- Detailing: no state licence found (blog-level, Unverified, TC-L09). City of Sacramento requires a Business Operations Tax certificate (TC-L10, Likely); rules for the other served cities were not researched.

## 4. The trade

### 4.1 How customers buy

| Segment | Mode | What drives the choice |
|---|---|---|
| Single ding / door dent | Planned but impulse-fixed | Convenience (comes to home or work), speed, "no paint" |
| Hail | Event, then planned | Insurance vs deductible, multi-day jobs |
| Lease return, trade-in, sale prep | Deadline | Avoiding appraiser or lessor charges (TC-T09, TC-T10, low reliability) |
| Mobile detailing | Planned, recurring, pre-sale | Trust in who is in the car, price anchors, interior mess |
| Ceramic coating | Researched, high consideration | Prep quality, product, warranty terms, durability claims |
| Dealer, fleet, rental, body-shop recon | B2B, volume, repeat | Turnaround, reliability, insurance certificate, per-unit quote, invoicing |

Price-led entry, trust-led close. Text or photo quote is the dominant low-friction path in competitor copy (TC-C02). Call/text/book split is not measurable from public data; offer all three and measure.

### 4.2 Customer words vs trade jargon

| Customers say | Trade says | Site rule |
|---|---|---|
| ding, dent, door ding, parking-lot dent | PDR, paintless dent repair, dent removal | Lead with "dent removal"; define PDR once; real term in H1 and URL |
| hail damage | hail PDR | "Hail damage repair" in title and H1 |
| no paint, no body shop | no filler, factory finish kept | Matches owner name "Dent Removal (no paint, no body shop)" |
| wax, ceramic, coating, protect paint | sealant, SiO2, nano-coating | "Gloss Shield" always paired with "ceramic coating" |
| scratches, swirls | paint correction, machine polish | "Swirl & Scratch Erase" paired with "paint correction" |
| clean inside | interior detail | "Interior Reset" paired with "interior detailing" |
| tree sap, water spots | decon, clay bar, iron removal | Plain words in headings; "Paint Deep-Clean" paired with "decontamination" |

Brand names are labels, not queries; every page carries the plain search term in H1/H2/title.

### 4.3 Process, limits, timelines

- PDR: technician pushes or pulls the dent from behind or around the panel, no filler, no repaint (TC-T01).
- Limits (consistent across CARSTAR page and general articles, TC-T02, TC-T03): best on shallow, round dents with intact paint; sharp creases, stretched metal (white stress marks), cracked or chipped paint, some panel edges, braced panels and aluminum need case-by-case judgement; structural damage and airbag-sensor areas are not PDR jobs.
- Timelines are **competitor self-claims** (30 min to 2 h per job; CARSTAR 2-3 days). Site states **no timelines** until the owner supplies their own.
- Coating: correction before coating because coating seals in defects; cure rules are product-specific (TC-T15). Site says "follow the product's instructions" and no durability years.

### 4.4 What changes the price (no 916 prices exist)

Dent size, depth, sharpness; number of dents and panels; panel material (aluminum harder); access (roof rails, braced panels, edges); paint condition; oversized dents; mobile/travel; hail count and insurance estimating basis; for detailing: vehicle size, condition, add-ons, pet hair, stains, sap; for coating: correction hours, product tier, warranty; B2B: volume and repeat (TC-T06, TC-T08, TC-T15, TC-T16, TC-T18). Market numbers found are SEO-page-grade (e.g. $75-$150 small PDR dent, $60 mobile fee, $800-$3,000+ coating) and **must never appear on the site as 916's prices**.

### 4.5 Insurance and hail claims (information only)

Hail is normally a comprehensive-coverage matter; liability-only does not cover it; deductibles commonly $500-$1,000 per general guides; if repair costs less than the deductible a claim may not pay; sources disagree on rate impact (TC-T04). CDI consumer hotline 800-927-4357 (TC-T05). The site offers "a written estimate and photos your insurer can use" and never "we handle/negotiate your claim" (TC-L18 unresolved).

### 4.6 Seasonality

Late winter to spring for valley hail (low authority, TC-T11); summer heat (BP-HT01); sap spring-summer (BP-HT03, general, not Sacramento-specific, Unverified). Publish only as Likely-labelled generalities ("heat and sun are the long season here"); no seasonal statistic.

## 5. The place

### 5.1 Conditions

- Heat: about 23 days of 100F+ in a typical year; 2024 record, 45th on 2024-09-24 (BP-HT01, CBS/ABC10 summaries).
- Hail: 2018-02-26 storm, up to 3 inches of accumulation, stranded vehicles, no dent counts (BP-H01, BP-H02); NWS warning 2023-03-11, quarter-size hail south/east of the city, "damage to vehicles is expected" (BP-H04); CBS report of hail in Woodland, Roseville, Citrus Heights, a Natomas carport collapse, year not confirmed (BP-H03). No source for 2024-2026 car-denting hail. Wording: "Valley hail is occasional, not annual".
- Wash water: County EMD says businesses may not discharge wash water, even soapy "biodegradable", to storm drains (BP-P01); City brochure cites fines up to $5,000/day and covers detailers (BP-P03); each of Sacramento, Elk Grove, Folsom, Galt, Citrus Heights, Rancho Cordova has its own ordinance (BP-P02). Ordinance text not retrieved. PDR needs no water.
- Spanish: about 32.4% of county residents 5+ speak a non-English language at home, about 13.1% Spanish (BP-L02, BP-L03, calculated from SACOG ACS table); Citrus Heights 9.21% Spanish-primary households (BP-L04, 2024).

### 5.2 Spanish decision

A Spanish mirror is defensible on demographics but is a promise to answer Spanish calls and texts. Not known. **No mirror at launch.** Revisit when the owner confirms Spanish capacity (TO-CONFIRM #10). Machine-translated pages are barred.

### 5.3 Distances

Sourced straight-line distances from Elk Grove: Folsom 21.4 mi, Davis 22.1, Roseville 24.2; Elk Grove to Roseville by road about 31 mi / 34 min (BP-D01, BP-D02). All other times are estimates. **No drive times are published.** Since 95624 is private, even the sourced rows are not shown as "from our base".

### 5.4 City verdicts (rule 5)

Test: ~300 words of genuinely local, non-swappable content from sourced facts or owner-supplied proof. None of the cities has owner-supplied proof yet; the sourced material is thin everywhere. Verdicts are conditional on a human map or city-site check of every named landmark before publish.

| Place | Sourced material (unified IDs) | Verdict |
|---|---|---|
| Sacramento | Old Sacramento 28-acre NHL district, Tower Bridge, Capitol, Sutter's Fort (BP-C01); Auburn Blvd dealer strip (BP-C03); county/city stormwater rule (BP-P01, P03); heat (BP-HT01); 2018 hail (BP-H01); Golden 1 Center (local-facts, CBS) | **Dedicated page** (hub) |
| Elk Grove | Elk Grove Auto Mall, Laguna Promenade, Elk Grove Commons (BP-C04); named dealers (BP-C05); own stormwater ordinance (BP-P02) | **Dedicated page**; B2B dealer angle; never "based in" |
| Roseville | Westfield Galleria ~6,400 spaces by Hwy 65 (BP-C06); Roseville Automall (BP-C07); hail reports (BP-H03); Placer guidance (BP-P06) | **Dedicated page** |
| Folsom | Intel campus off Prairie City Rd and Hwy 50, 2025 layoffs context (BP-C08); Folsom auto mall (BP-C09); own ordinance (BP-P02); Greenback Ln retail (BP-C10) | **Dedicated page**. Do not use the layoffs as sales copy; mention employer context neutrally or skip it |
| Citrus Heights | Greenback Ln 70,000+ vehicles/day (2019 city flyer), Sunrise MarketPlace, rental share, 9.21% Spanish-primary (BP-C13, BP-L04); hail (BP-H03) | **No page at launch.** One flyer, 2019, plus an undated hail article cannot carry 300 non-swappable words without invention. Listed on the service-area page. Revisit with owner job proof |
| Natomas | Boundaries, I-5 exit, school district (BP-C15, C16); carport hail (BP-H03) | Named area on service-area page; mention inside Sacramento page |
| Rancho Cordova, West Sacramento, Davis, Carmichael, Granite Bay, El Dorado Hills, Lincoln, Rocklin | One or two facts each (BP-C11..C25), several stale or unsourced | Named areas on service-area page only |

## 6. Competition

Top organic and map-pack sets are proxies from search surfacing, Low confidence (full detail in `competitors.md`, kept as is).

| Term | Surfaced | Review proxy |
|---|---|---|
| paintless dent repair Sacramento | CARSTAR Capitol Collision, Dent Shoppe (Folsom), Primetech PDR, The Dent Tent, directories | Sacramento Collision Center 5.0/328, Dent Tent 5.0/121, Primetech 5.0/53 |
| mobile car detailing Sacramento | Sac Detailing, Eco Process, Precision Detailing, many 5-or-fewer-review listings | Precision 4.8/89, Nor Cal Mobile Detailing Pros, fragmented |
| ceramic coating Sacramento | Elite Auto Works (visibility from press releases), Nor Cal, Sacramento Car Detailing, Moro, Coastal Detail | small pools |
| hail damage repair Sacramento | Primetech, Sacramento Collision Center, Bullseye, roofing results | same |
| dealership recon Sacramento | nobody surfaced (TC-C16) | none |

**Gap table (condensed from competitors.md; each gap becomes a page or block):**

| # | Gap | 916 response |
|---|---|---|
| 1 | No price-driver guidance, no honest ranges | `/guides/what-affects-dent-repair-price/`, no numbers |
| 2 | "Can my dent be fixed?" honesty (only CARSTAR) | PDR page block + `/guides/can-this-dent-be-fixed-without-paint/` |
| 3 | No dealer/fleet/rental/body-shop page | `/dealers-and-fleets/` |
| 4 | Dent + detail + protection as one mobile offer | Home and service cross-links, one-visit framing only if owner confirms |
| 5 | Hail guidance specific to Sacramento | `/hail-damage-repair/` with sourced events and claim steps |
| 6 | Coating honesty (prep, cure, no unproven years) | `/ceramic-coating/` |
| 7 | Transparent water practice | Deferred until the owner states the method |
| 8 | Neighborhood coverage | 4 city pages + service-area page |
| 9 | Review volume | Cannot be filled yet; ask every customer later, no gating |
| 10 | Photo-quote funnel (no competitor page surfaced) | `/photo-quote/` + text path |
| 11 | NAP consistency (Elite shows inconsistent numbers) | One canonical set (`ENTITY-PLAN.md`) |

## 7. Keyword universe (summary; the page assignment is in `strategy/KEYWORD-MAP.md`)

No volumes exist. Competitiveness is an estimate.

- **Primary** (service + Sacramento): paintless dent repair (Med), mobile dent repair (Med), dent removal (Med), door ding repair (Low-Med), mobile car detailing (High), ceramic coating (High), paint correction (Med-High), hail damage repair (Med).
- **Secondary:** car dent repair, PDR (jargon, Low-Med), interior car detailing (Med-High), scratch and swirl removal (Low-Med), clay bar / paint decontamination (Low), dent repair cost (Med: national pages dominate), insurance dent repair (Med).
- **Near me** (dent repair, mobile detailing, ceramic coating, hail near me): won by GBP proximity and reviews; pages only support with NAP and mobile wording.
- **City terms:** only for Sacramento, Elk Grove, Roseville, Folsom pages; the rest are named areas.
- **Long-tail / questions** (hypotheses, not observed): send photo for dent repair estimate; text for dent repair quote; remove door ding without repainting; can all dents be fixed with PDR; how long does PDR take; does insurance cover dent repair; does PDR work on hail; do I need paint correction before ceramic; how long does ceramic last; do mobile detailers need my water and power.
- **Comparison:** PDR vs body shop; ceramic vs wax; ceramic vs PPF (not offered unless confirmed); mobile vs shop detailing.
- **B2B:** dealership dent repair Sacramento (Low-Med), used car reconditioning vendor, fleet dent repair, rental car dent repair on-site, body shop PDR subcontractor.
- **Validation plan:** pull live autocomplete and PAA for the 8 primary terms; Keyword Planner (free with an account the owner makes); replace estimates with Search Console data after launch; local rank grid around Sacramento.

## 8. Design references (hypotheses; no reference site was viewed)

Eight references (Dent Wizard, Primetech, Dent Tent, Coastal Detail, Gtechniq, Ceramic Pro studios, Framer dark-detail templates, Rolls-Royce/Aston/Porsche atmosphere) give these converting patterns, all [search] or [background]:

1. Audience-split architecture and an outcome-led headline for dealers (Dent Wizard).
2. Credential-based trust (Gtechniq accredited installers); 916 holds no certification, so it substitutes **process transparency**.
3. Dark and premium is already the trade template (KD-design-template, KD-design-zarla); luxury-auto brands lean on negative space, one image per screen, tracked small caps, very few colors.
4. Local service sites must keep a visible action in the first viewport, unlike luxury brands.
5. Photo-led proof wins; invented proof is the trade's cliche to avoid.

Clichés to avoid: carbon fiber, hexagon patterns (note: the owner's *card* uses a hex texture; the site does not), speed lines, badge soup, stock polishing shots, fake urgency, stat bands of invented numbers, star-rating rows, "call for a quote" as the only path.

Repo sites read directly (Verified): Phil's Auto (light paper, indigo, system fonts, split hero + stat band, Python build, 25 pages) and Cali Tints (dark green-black, lime, Inter + Space Grotesk, video hero + booking card, angled dividers, stat band, Astro). Full comparison in `strategy/DESIGN-BRIEF.md`.

## 9. What the research could not establish

BAR requirement for PDR; ordinance texts; every competitor's GBP categories, schema, titles, H1s; actual SERP and map order; keyword demand; any 916 price, hour, license, insurance, review, photo; whether the hero video shows a real job; Spanish capacity; water method; real hail frequency for car damage; city business-tax rules outside Sacramento. All are in `TO-CONFIRM.md` or the verification plan.

## 10. Merge notes

- `sources.csv` = BP (73 rows) + TC (58) + KD (34) = 165 rows, minus 18 exact-restatement duplicates merged into the retained row (their IDs kept in `aliases`) = 147 rows. Retained rows keep their original confidence.
- Cross-pass ID collisions (`C##`, `L##` existed in two files with different meanings) are resolved by the prefixes.
- Source files kept unchanged beside this one: `business-place.md`, `trade-compliance.md`, `keywords.md`, `design-references.md`, `competitors.md` (as instructed), and the three `sources-*.csv`.
