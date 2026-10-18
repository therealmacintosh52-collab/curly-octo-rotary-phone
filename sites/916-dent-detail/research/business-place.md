# 916 Dent & Detail: business identity and place research (Stage 1, parts 1 and 3)

Retrieved 2026-10-18. Row IDs (B01, P01, C01...) refer to `sources-business-place.csv`.
Method limits: WebFetch is blocked in this environment (DNS failure on city/county hosts), so everything below comes from WebSearch result summaries. Confidence is labelled accordingly. No logins, no accounts. Inputs win over research.

## Part 1(a): THE BUSINESS

### Online presence found
- Exact-name searches ("916 Dent & Detail", "916 Dent", "916 Dent and Detail", with Yelp/Facebook/Instagram/TikTok terms) returned no site, Google Business Profile, Yelp, Facebook, TikTok, BBB or directory listing (B06). Unverified: a search engine summary cannot prove absence. A human must check Google Maps, Yelp, Facebook, Apple Maps, Bing Places, BBB, and CA Secretary of State (bizfileonline.sos.ca.gov, B25) in a browser.
- Instagram @916dentanddetail (owner-supplied): not indexed by search (B07). Nearest results are different accounts (@dentanddetail "The Dent and Detail Clinic", @detailsanddents). Not the same handle, not in Sacramento as far as visible.
- Phone 916-868-2447: no page found tying it to any business (B08). The 916-868 prefix exists. Reverse-lookup pages list individuals; not recorded here.

### Identity-confusion verdict
**NOT a confusable-identity problem. Proceed.** No other business was found matching name plus town. Look-alikes are all different names (B09-B19): The Dent Tent, Primetech PDR, Dent Shoppe, Sacramento Dent Repair, Dents Dings & Things, Bullseye Dent PDR, DentPro Sacramento, Dent Dynamic, Colors on Parade/CarLove, Detailing Ace, Glass Reflections. They are competitors, not identity conflicts. Residual risk: an unindexed listing or a CA SOS entity might exist; owner/human check required before claiming profiles (listed for TO-CONFIRM). The "916" prefix is also a common area-code brand, so expect search noise from other 916-named businesses.

### Licences and registrations
- CA BAR: the blueprint premise ("BAR does not license PDR shops that don't do auto body repair") could NOT be verified. Sources show ARD registration is required for anyone compensated for repairing motor vehicles including body repair (BPC 9880.1, B20), mobile repair needs registration and a per-vehicle registration number (16 CCR 3351.7.3, B21), and a 2025 rulemaking on mobile ARDs is pending (B22). None mentions PDR or detailing specifically. Status: **Unverified, open compliance question**. Do not state "licensed" or "not required" on the site; owner should ask BAR (hold for COMPLIANCE.md and TO-CONFIRM).
- Detailing: blogs say no state detailing licence; local business licence applies (B24, Unverified). Which of the 14 cities require a licence for a mobile operator: not found.
- Insurance/COI: nothing provided; do not claim.

### Canonical NAP (from owner inputs)
| Field | Value | Status |
|---|---|---|
| Name | 916 Dent & Detail | Owner input (B01) |
| Phone | 916-868-2447 (display as (916) 868-2447) | Owner-supplied from card, digits to be confirmed (B02) |
| Address | None published. Service-area business. Never publish a home address | Owner input (B04) |
| Service area wording | Sacramento, CA & Surrounding Areas (card) | Owner input |
| Cities (site) | Sacramento, Elk Grove, Roseville, Folsom, Rancho Cordova, Citrus Heights, Natomas, West Sacramento, Davis, Carmichael, Granite Bay, El Dorado Hills, Lincoln, Rocklin | Owner input |
| Base ZIP for travel fees | 95624 (Elk Grove); internal, not a published address | Owner input |
| Hours | [PLACEHOLDER: HOURS] | Not provided |
| Website | [PLACEHOLDER: DOMAIN] | Not provided |
| Email | [PLACEHOLDER: EMAIL] | Not provided |
| Instagram | https://www.instagram.com/916dentanddetail/ (handle owner-supplied) | Unconfirmed live (B03, B07) |
| Other social (FB, TikTok, YouTube), Google review link | [PLACEHOLDER] | Not provided |
| Tagline | Precision · Care · Perfection. Card secondary script line: "Your Vehicle Our Passion" | Owner input |
| Categories | To be chosen in Stage 2 / GBP kit | n/a |

### Inconsistencies found
1. Card says "Sacramento, CA & Surrounding Areas"; owner-spec lists 14 named cities. Not a conflict, but pick one canonical phrase for GBP service areas and keep "surrounding areas" wording out of schema.
2. Card size 3.75 x 2.25 in (with bleed) vs blueprint 3.5 x 2 in plus 0.125 in bleed: 3.5+0.25=3.75 and 2+0.25=2.25, so consistent.
3. Card says "Paintless Dent Repair / Auto Detailing"; owner-spec plain-language names (Dent Removal, Swirl & Scratch Erase, Gloss Shield...) differ in wording by design; real terms stay in H2s/schema.
4. Owner-spec lists a Phase-2 booking stack and "Anthropic API"; irrelevant to this blueprint (static site) and not researched here.
5. Phone digits were read visually from artwork; confirm.
6. No external listings found, so no NAP mismatches across the web exist yet (nothing to clean up). This must be re-checked by a human.

## Part 1(b)/3: THE PLACE

### Regional conditions (sourced)
- **Heat:** Sacramento typically logs about 23 days of 100F+ per year; 2024 set a record (45th such day on 2024-09-24) (HT01). 2025/2026 totals not found. UV peak around 9 typical, 10-11 on clear days, from a commercial site (HT02, Unverified). Page wording: heat and sun are the long-season norm; no durability claims.
- **Hail:** Valley hail is occasional. Best-documented: 2018-02-26 storm, up to 3 in accumulation, stranded vehicles, Sacramento (H01, H02); a CBS report of a March hail storm in Woodland, Roseville, Citrus Heights with a Natomas carport collapse (year not confirmed, H03); NWS warning 2023-03-11 for quarter-size hail south/east of the city (H04). No source documents vehicle dent counts or any 2024-2026 car-denting hail in these cities (H05). **Conclusion:** hail cannot be the headline claim; "Hail Fix" works as an occasional/event service, framed honestly ("valley hail is occasional, not annual").
- **Tree sap:** general sources only, low quality (HT03, Unverified); mention only as generic advice, not as a Sacramento statistic.
- **Orchards/dust/agriculture:** no sourced material found; omit.

### Wash-water / stormwater (precision)
- Sacramento County EMD: businesses may not discharge wash water of any kind to storm drains, even soapy "biodegradable" water; residential car washing allowed if no hazardous materials (P01). City of Sacramento brochure: fines up to $5,000/day under the County ordinance; applies to commercial washers including detailers (P03). County says Sacramento, Elk Grove, Folsom, Galt, Citrus Heights and Rancho Cordova each have their own ordinances with similar rules (P02); county recommends disposal to the sanitary sewer (P04). Placer cities, Davis, West Sacramento: not retrieved (P05-P07 are partial).
- Ordinance text itself not retrieved. Mobile-detailer-specific permit in Sacramento County: not found. Central San (Contra Costa) permit is NOT a Sacramento rule. Site copy may say "we keep wash water out of storm drains" only after the owner confirms their method. PDR needs no water.

### Spanish version
Sacramento County, ages 5+: about 32.4% speak a non-English language at home; about 13.1% speak Spanish (calculated from SACOG's 2017-2021 ACS table, L01-L03); Spanish is the largest non-English language, region 12.64%. About 5% of the population is limited-English Spanish speakers (L03). Verdict: **a Spanish mirror is defensible but not a day-one requirement.** Recommend: English-first launch, plus a small Spanish contact/FAQ page only if the owners can handle Spanish calls/texts; otherwise a mirror creates a promise the business cannot keep. Machine-translated filler is prohibited. Log as an owner decision (TO-CONFIRM). Current ACS B16001 tables were not retrieved.

### Distances/drive times from ZIP 95624 (Elk Grove)
Only partial sourced data (D01-D03): straight-line from Elk Grove: Folsom 21.4 mi, Davis 22.1, Roseville 24.2; Elk Grove to Roseville by road about 31 mi / 34 min. All other times are ESTIMATES, not sourced (D04): verify in a map app before use; do not publish minute figures.

### Per-city sourced facts and page verdicts
Rule 5 test: at least ~300 words that are genuinely local and non-swappable, from sourced facts or owner-supplied proof. Honest finding: no city has enough owner-supplied job proof yet, and sourced facts are thin. Verdicts are **provisional**: "Dedicated" means enough sourced material to write ~300 local words after one human verification pass (map/city site) and without invented claims.

| City | Sourced facts | Dedicated page? |
|---|---|---|
| Sacramento | Old Sacramento 28-acre NHL district, Tower Bridge, Capitol, Sutter's Fort (C01); Auburn Blvd dealer strip e.g. 2500 Auburn Blvd (C03); state-worker employer base (figure stale, do not publish, C02); county stormwater rule (P01-P03); heat and 2018 hail | **Dedicated** (hub; strongest regional material) |
| Elk Grove | Elk Grove Auto Mall, Laguna Promenade, Elk Grove Commons (C04); named dealers (C05); base ZIP 95624; straight-line distances (D01); own city stormwater ordinance (P02) | **Dedicated** (also the base; B2B dealer angle) |
| Roseville | Westfield Galleria ~6,400 spaces by Hwy 65 (C06); Roseville Automall (C07); Placer car-washing guidance (P06); hail reported (H03); Roseville/Lincoln/Rocklin ordinance not retrieved | **Dedicated** |
| Folsom | Intel campus off Prairie City Rd/Hwy 50 and 2025 layoffs context (C08); Folsom auto mall (C09); own ordinance (P02); Greenback Ln retail (C10) | **Dedicated** |
| Citrus Heights | Greenback Ln 70,000+ vehicles/day, Sunrise MarketPlace district, Auburn Blvd and Antelope Crossing business districts, over half housing is rental (apartment parking angle) (C13); own ordinance (P02); hail reported (H03); 9.21% Spanish-primary households (L04) | **Dedicated, conditional** (data is 2019; re-verify) |
| Natomas | Boundaries, I-5 Arena Blvd exit, Natomas USD (C15, C16); carport hail collapse (H03); airport adjacency | Fold into Sacramento service-area page unless more verified (Natomas Marketplace/airport specifics unsourced) |
| Rancho Cordova | Folsom Lake Honda dealer (C11); HQ employers (2018) (C12); own ordinance (P02) | Fold into service-area page (thin) |
| West Sacramento | Tower Bridge link (C17); city mobile-cleaning stormwater guidance (P05) | Fold (guidance not re-read) |
| Davis | Hanlees dealers (C18); car-wash rules are water-conservation, tiered and revocable (P07); Yolo County stormwater not retrieved | Fold |
| Carmichael | Carmichael Park, Jensen Botanical Garden, Fair Oaks Blvd (C19); tree cover claim unsourced | Fold |
| Granite Bay | Nugget at Granite Bay, Granite Bay Village on Douglas Blvd (C20); HOA specifics unsourced | Fold |
| El Dorado Hills | Serrano Pkwy traffic count only (C21) | Fold |
| Lincoln | Pop 49,757, Twelve Bridges, Thunder Valley, ~10 mi N of Roseville (C22, C23) | Fold |
| Rocklin | Quarry Park Adventures in Big Gun Quarry (C24); employer list stale (C25) | Fold |

Garage/HOA/apartment parking realities and local events: not sourced for any city beyond Citrus Heights rentals; do not assert.

### Recommended follow-ups (human or next stage)
Browser check of GBP/Yelp/Facebook/Apple/Bing/SOS/BAR; confirm phone digits; ask BAR about PDR registration; retrieve county/city ordinance text (WebFetch blocked); owner-supplied job proof per city (the main way to meet rule 5 for the folded cities).
