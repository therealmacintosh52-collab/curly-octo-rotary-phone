# VERIFICATION REPORT: Stage 6 (independent verifier, 2026-10-18)

Everything below was re-run by the verifier against a fresh `python3 build.py` (build is deterministic: two builds produced identical `public/`). `build-notes.md` was read only to know what was claimed. Servers: `tools/serve.py` on ports 8110 (unstamped `public/`), 8111 (stamped COPY, https dummy endpoint), mock endpoint server on 8121 (stamped COPY with `/submit`). `public/` itself was never stamped. Scripts used are in the verifier's scratch folder, not in the repo; the repo tools (`lh.mjs`, `axe.mjs`, `lint.py`, `check.py`, `check_limits.py`) were used as shipped.

## 0. Result table

| # | Check | Result | Key numbers |
|---|---|---|---|
| 1a | HTML validity | PASS (real validator) | W3C Nu validator 3 (vnu.jar via java) on 25 pages: 0 errors on the stamped copy. Unstamped: 2 errors, both the literal `{{FORM_ENDPOINT}}` token in `action` (expected until stamped). 15 warnings: 12 redundant `aria-required` on `required` inputs, 3 "section lacks heading". CSS: 3 "errors" for `animation-timeline`/`animation-range` (scroll-driven animation, valid in current Chrome, unknown to the validator; wrapped in `@supports`) |
| 1b | Links, sitemap, canonicals, H1, titles, metas, images | PASS | 25 pages; 0 broken internal links or anchors; 24 sitemap URLs = 24 indexable built pages (404 excluded, noindex); every canonical = `https://{{DOMAIN}}<path>`; 1 H1 on every page; titles 28 to 60 chars, unique; descriptions 121 to 153 chars on indexable pages, unique (404: 95, noindex); all `<img>` have alt (decorative = empty) and width/height; no `hreflang` (intended); 20 external links are all syntactically valid `https://` (not fetched: the proxy returns 403 for every external host, see section 7) |
| 2 | JSON-LD | PASS with notes | 24 pages, all blocks parse; types used: AutomotiveBusiness (1), WebSite, WebPage, BreadcrumbList, Service (6), Article (4), FAQPage (17), CollectionPage, ContactPage, AboutPage. No address, geo, priceRange, offers, email, AggregateRating or Review anywhere; `sameAs` = the owner's Instagram only; telephone `+1-916-868-2447` equals visible text |
| 3 | Lighthouse mobile + axe | PASS | see section 3: all templates perf 100, a11y 100, SEO 100 (404: 69 by design), best-practices 100 on the stamped copy; axe 0 violations at 390, 768 and 1280 on all 25 pages |
| 4 | Screenshots, JS-off, reduced motion, opacity probe, keyboard, forms | PASS after 3 fixes | see section 4 |
| 5 | Leak lint, fact audit | PASS lint; fact audit FAIL then fixed or logged | unstamped lint: tokens only; stamped copy: `lint ok`; 6 unsourced or wrong sentences fixed, the rest logged in TO-CONFIRM #26, #29, #30, #31 |
| 6 | Offsite kit | PASS after 1 fix | `check_limits.py` exit 0; card generator now blocks non-DRAFT output until `--phone-confirmed`; entity comparison all PASS |

## 1. Structure (re-run; paste of key output)

```
sitemap urls 24 lastmods 24 built pages 25
in sitemap not built []   built indexable not in sitemap []   noindex in sitemap []
dup titles []  dup desc []
ISSUES [('desc', '/404.html', 95)]      <- noindex 404, below the 100-char floor I applied; harmless
```
Validator (`java -jar vnu.jar --also-check-css`, stamped copy): `Error` count on HTML = 0. Unstamped `public/`: `Error: Bad value "{{FORM_ENDPOINT}}" for attribute "action"` on `/photo-quote/` and `/dealers-and-fleets/` only.
Image dimension check: every `width`/`height` attribute matches the file (the 40x40 logo mark is a deliberate 80x80 source at 2x, same aspect ratio). Hero images are the home page's only photos; both carry the "Illustration. Not a customer vehicle." caption and alt text that says "Illustration of ...". No text is baked into the images shipped on pages (the 24 share images in `/og/` carry only the title line, by design).

## 2. JSON-LD and Google guidance (rule 7)

Properties found across all blocks: `@context @graph @id @type about acceptedAnswer areaServed author dateModified datePublished description hasOfferCatalog headline image inLanguage isPartOf item itemListElement knowsAbout logo mainEntity mainEntityOfPage name position provider publisher sameAs serviceType slogan telephone text url`. Every one is a defined schema.org property of the type it sits on (AutomotiveBusiness inherits LocalBusiness/Organization: `slogan`, `knowsAbout`, `hasOfferCatalog`, `areaServed`, `sameAs`, `logo`, `telephone`; `serviceType` on Service). **Not verified against schema.org itself**: schema.org is blocked by the proxy (`CONNECT tunnel failed, response 403`), so type and property existence is from my knowledge of the vocabulary plus ASSUMPTIONS S-31's earlier search-result check. Home description in JSON-LD equals the visible "In short" source string `DESC_LONG`; FAQPage appears on 17 pages, each with a visible FAQ (check.py and my own check found every question visible in the page text). The `WebSite` node is emitted on 24 pages, whereas `ENTITY-PLAN.md` section 2 says "home only"; harmless (same `@id`), logged here, not changed.

Current Google Search Central guidance (read through search-result summaries only; `developers.google.com` does not resolve in this sandbox):
- FAQ rich results: since the 8 Aug 2023 change Google shows them only for well-known government and health sites; existing markup may stay and "has no visible effects". Matches the blueprint note. No change needed (FAQPage here is for other engines).
- Review snippets: reviews about an entity published on that entity's own site (self-serving, in markup or via a widget) are not eligible for review rich results for LocalBusiness/Organization. The site has no review markup. Matches the blueprint.
- LocalBusiness: sources agree a service-area business can omit `address` and declare `areaServed`; one third-party source and one agency test claim removing the address from a GBP can hurt local ranking, which is a GBP matter, not a schema matter. Not contradictory to the blueprint (rule 8 forbids publishing a home address). Google's own LocalBusiness page could not be opened; "recommended properties" (geo, openingHoursSpecification, priceRange) are omitted deliberately because the values were not supplied.
Difference from the blueprint: none found. Confidence: search-summary level only.

## 3. Lighthouse (mobile preset, simulated slow 4G, headless Chromium from /opt/pw-browsers, Lighthouse from `916-dent-detail/node_modules`), 3 runs each, medians

Stamped copy served by `tools/serve.py` with the real `_headers` (CSP applied):

| Template (page) | Perf | A11y | BP | SEO | LCP s | CLS | TBT ms | KB |
|---|---|---|---|---|---|---|---|---|
| Home `/` | 100 | 100 | 100 | 100 | 1.58 | 0 | 0 to 5 | 712 |
| Service `/paintless-dent-repair/` | 100 | 100 | 100 | 100 | 1.20 | 0 | 0 | 64 |
| Guide `/guides/pdr-vs-body-shop/` | 100 | 100 | 100 | 100 | 1.21 | 0 | 0 | 62 |
| City `/service-area/elk-grove/` | 100 | 100 | 100 | 100 | 1.06 | 0 | 0 | 62 |
| Hub `/service-area/` | 100 | 100 | 100 | 100 | 1.20 | 0 | 0 | 62 |
| Quote `/photo-quote/` | 100 | 100 | 100 | 100 | 1.28 | 0 | 14 | 65 |
| Dealers | 100 | 100 | 100 | 100 | 1.28 | 0 | 0 | 65 |
| About | 100 | 100 | 100 | 100 | 1.20 | 0 | 0 | 61 |
| Contact | 100 | 100 | 100 | 100 | 1.20 | 0.014 | 0 | 61 |
| FAQ | 100 | 100 | 100 | 100 | 1.28 | 0.014 | 0 | 61 |
| Privacy | 100 | 100 | 100 | 100 | 1.20 | 0 | 0 | 62 |
| Terms | 100 | 100 | 100 | 100 | 1.20 | 0 | 0 | 61 |
| 404 (`/404.html`) | 100 | 100 | 100 | 69 | 1.28 | 0 | 0 | 60 |

After the Stage 6 CSS edits (section 4 fixes) a re-run on the stamped copy gave home 100/100/100/100 (LCP 1.58 s, TBT 5 ms), service 100/100/100/100 (LCP 1.28 s), quote 100/100/100/100 (LCP 1.21 s).
- **Best Practices note.** On the UNSTAMPED build BP is 96, and the only failing audit is `errors-in-console`: Chrome logs "invalid source: '{{FORM_ORIGIN}}'" for the CSP `connect-src`/`form-action` tokens. That is the unstamped token and disappears when stamped (BP 100). The builder's "78 from is-on-https" did not reproduce: Lighthouse treats `localhost` as a secure context, so `is-on-https` did not fail here. Because the page was never served over real HTTPS, **the HTTPS result (HSTS, mixed content, certificate) is not verified**.
- 404: SEO 69 is the `is-crawlable` audit (noindex plus HTTP 404), intended.
- CLS 0.014 on contact and FAQ: the layout shift is the Inter web-font swap (`font-display: swap`, Lighthouse names both Inter woff2 files); under the 0.1 threshold. Open and minor: a `<link rel=preload>` for `inter-400` would remove it.
- **INP lab proxy** (not field INP): scripted taps on `/`, `/faq/`, `/photo-quote/` at 390 px with 4x CPU throttle and a `PerformanceObserver` of type `event`: worst interaction duration 136 ms (home, first tap, while the hero frames load), 56 ms (FAQ), 96 ms (quote). All under 200 ms. Field INP not measurable here.
- **axe-core 4** (wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice, all `<details>` open) on all 25 pages at 390, 768 and 1280: **0 violations** each, 75 page-states. One `incomplete` on every page: color-contrast where text sits over a gradient or the hero image; checked instead by computing the palette pairs (Ivory 17.0:1, Steel 6.07:1 on Onyx, Gold 8.20:1, the gradient numeral's darkest stop 4.14:1 vs the 3:1 large-text need) and by viewing the screenshots.

## 4. Screenshots, no-JS, reduced motion, opacity probe, keyboard, forms

Screenshots taken (Chromium, 15 pages x 3 widths x 3 modes = 135 full-page images): home, service, guide, city, hub, quote, dealers, about, contact, FAQ, privacy, terms, 404, hail, guides index; at 390, 768, 1280; normal, JavaScript disabled, `prefers-reduced-motion: reduce`. I viewed contact sheets of home (390/768/1280, five scroll states, t=1 s and t=6 s), service, guide, city, quote (390, 768, 1280), dealers, FAQ, 404 and footer, JS-off and reduced-motion home, JS-off dealers and 404. Automated checks per page and mode: horizontal overflow (none anywhere), clipped text (only the visually hidden table `<thead>` and the honeypot, both intended), console errors (none; the 404 page's own 404 status is the only one), tap targets.

Defects found and fixed in this stage:

| # | Defect | Evidence before | Fix | Evidence after |
|---|---|---|---|---|
| D1 | Hero H1 lines 2 and 3 ("Paint glowing.", "We come to you.") stayed at opacity 0 when observers and timers fail (the 7 s failsafe was itself a `setTimeout`; reveal after that is driven by scroll + `requestAnimationFrame`). Violates the motion-safety rule | `observers+timers dead @390/@1280: / ["ln l2 op=0.00 \"Paint glowing.\"","ln l3 op=0.00 ..."]` | `build/css/critical.css`: `@keyframes scrubfail{to{opacity:1}}` and `html.scrub .hero h1 .l2, .l3 {animation: scrubfail 0s linear 5s forwards}`; a CSS-only reveal that needs no JS or timer. Side effect (intended): an idle visitor sees the full line after 5 s | `probe2 ok: 0 hidden text elements` for observers+timers dead, hero.js blocked, all scripts blocked, JS off, reduced motion, scrolled; at 390 and 1280; 25 pages x 5 modes (the only items ever flagged are the disabled "Send" buttons on the unstamped build, which are intentionally dimmed) |
| D2 | Tap targets under 44 px: breadcrumb links 36x42, 43x42, 77x42; footer phone link 246x38 | shots2 metrics: `a "Home" 36x42`, `a "(916) 868-2447" 246x38` on every page | `.crumbs a` min-height/min-width 44 (flex, centered, `align-items:center` on the list so it stays aligned); `.ft .tel` padding 6px to 12px | re-run: no `a`/`button`/`select`/`summary` under 44 px on any page at 390, 768, 1280, JS on/off. Remaining: the 24x24 consent checkbox; its label spans the row and is above 44 px tall, so the tap target is the label (accepted, noted) |
| D3 | Copy defects, see section 5b (6 sentences) | | build modules | rebuilt, `check.py` 0 errors |

Contrast over the hero: viewed at 390 and 1280 in the static (JS-off, reduced motion) and scrubbed states; Ivory text over the dark frames reads clearly; the gold third line is the only gradient text (large). No clipping or overlap seen; the hero buttons sit in the thumb zone above the sticky bar.

Keyboard path (home to photo-quote to unstamped submit), Playwright, 390 and 1280:
- First Tab stop is "Skip to content", visible, 3 px Light Gold outline. Enter moves the URL hash to `#main`; document focus stays on `body` (Chromium moves the sequential focus start point), and the next Tab lands on the first link inside `main` ("Get a price from a photo"). Works; adding `tabindex="-1"` to `<main>` would help older Safari; not changed.
- Order: skip link, hero primary, hero call, in-text links, section CTAs, service cards, in DOM order; reached a `/photo-quote/` link by Tab and opened it with Enter. Form order: name, phone, need, vehicle, city, photos, notes, consent, submit (submit disabled when unstamped), matching visual order.
- Visible focus: 1,355 distinct tab stops over 9 templates at 390 and 1280: **0 without an outline or shadow**. (A first run showed focused elements "outside the viewport"; that was smooth scrolling in progress. Re-run with a 450 ms settle: 0 of 45 off-screen.)
- Unstamped submit: submit button `disabled`, notice "This form isn't connected yet." Pressing Enter in a field, `requestSubmit()`, and a forced click produced **0 non-GET requests** (network log) at both widths; JS off, Enter in a field: 0 non-GET requests.
- Stamped COPY (endpoint `/submit`) with a mock server (port 8121) logging every POST: empty submit gives an error summary ("Error: please fix 5 fields..."), focuses the summary and flags `name, phone, need, vehicle, city` (`aria-invalid`), 0 POSTs; every control has a label (0 unlabeled); honeypot filled: 0 POSTs and the generic success state (bot gets no signal); valid submit with 2 photos: one `multipart/form-data` POST with fields `name, phone, need, vehicle, city, notes, website, consent, photos, photos`; success panel shown, form hidden, focus moved to it; server 500: error summary with the fallback text, form kept, button re-enabled. Dealers form: required fields `name, phone, company, type, count, city, need`, one multipart POST. No CSP or console errors in the stamped site (only the deliberate 500).
- Not verified: screen readers (VoiceOver, TalkBack, NVDA), real touch devices.

## 5. Leak lint and fact audit

Unstamped `public/`: `PENDING` only for `{{DOMAIN}}` (28 files), `{{ANALYTICS_ID}}` (25), `{{FORM_ENDPOINT}}` (2), `{{FORM_ORIGIN}}` (1), the phone-status marker (25) and the form-unconnected marker (2); `hard failures: 0`; 1 allowlisted hit (a third-party dealer address, see 5c). `lint.py` exits 1 as designed. Stamped copy (dummy `testsite.org`, https dummy endpoint, `--analytics none`, `--phone-confirmed`): `allowlisted hits: 1; hard failures: 0; pending tokens/markers: 0` and `lint ok`.

Independent grep of the rendered text of all 25 pages for licensed, licence, insured, bonded, certified, guarantee, warrant, lifetime, family, years, award, #1, best, review(s) as a claim, rating, stars, any `$` amount, 95624, any street address, other businesses' names from the repo (Phil's, Cali Tints, Quantum): **no forbidden claim found**. The hits were benign: "insurance" and "Department of Insurance" as the topic of the claim guides; "license plates" in the privacy note; "review by the owner's attorney"; "maintenance-free"; competitor/third-party names appear only as cited sources (CARSTAR, Chase, Insuranceopedia, LoopNet, KBB, DealerRater). The one street address (2500 Auburn Boulevard) is a cited third-party dealership.

### 5a. Fact audit: how it was done and what traced

Every sentence of all 25 pages was read. Each factual sentence was classified as (A) owner input, (B) traced to a `sources.csv` row, (C) method/trade advice without a source row, (D) a promise of business behavior or policy the owner did not supply, or (E) site-mechanics fact (true of the page itself). Counts are approximate (about 900 sentences; connective and call-to-action sentences are not facts).

| Claim group | Pages | Trace |
|---|---|---|
| Name, tagline, hero line, "two owner-technicians with deep experience, plus a crew", retail and B2B customers, six plain-language names, no storefront, no street address, 14 places, phone, Instagram | all | A: `inputs/notes.md`, `owner-spec.md`; BP-B01..B05 |
| PDR works from behind the panel, no filler or repaint; limits (sharp creases, stretched or cracked paint, edges, braced areas, aluminum, airbag-sensor areas) | home, PDR, hail, guides, FAQ | B: TC-T01, TC-T02, TC-T03, KD-pdr-limits (Likely to Unverified; third-party shop pages) |
| Hail is comprehensive coverage; liability-only generally not; deductible vs repair cost; premium effect "guides disagree"; CDI line 800-927-4357; falling objects and flood per CDI | hail, claim guide | B: TC-T04, TC-T05, KD-insurance-pdr |
| Appraisers price repair cost; repainted panel can be noticed; lease company can bill beyond wear | PDR vs body shop, claim guide | B: TC-T10, TC-T09 |
| Hail history: 26 Feb 2018 up to ~3 in, stranded vehicles, no dent counts; 11 Mar 2023 NWS quarter-size hail; valley hail occasional; CBS March storm (Woodland, Roseville, Citrus Heights; Natomas carport) | hail, Sacramento, Roseville | B: BP-H01, BP-H04, BP-H02, BP-H03 |
| ~23 days at or above 100 F in a typical year; 2024 record, 45th on 24 Sep | coating, Sacramento, Elk Grove | B: BP-HT01 |
| Stormwater: businesses may not discharge wash water of any kind to storm drains; Sacramento, Elk Grove, Folsom, Citrus Heights, Rancho Cordova have own ordinances; City of Sacramento commercial auto-washing brochure | mobile detailing, 3 city pages | B: BP-P01, BP-P02, BP-P03 |
| Coating: layer over paint, prep and correction first, seals in defects, no single honest duration, wax vs ceramic table | coating, correction | B (weak): TC-T15 (Unverified) |
| City facts: Old Sacramento 28-acre NHL, Capitol, Tower Bridge, Sutter's Fort; Natomas definition, NUSD, I-5 Arena Blvd exit; Auburn Blvd dealer list; Elk Grove Auto Mall, Laguna Promenade, Elk Grove Commons, dealer brands; Galleria ~6,400 spaces, Automall Drive; Intel campus Folsom, Folsom Blvd auto mall | city pages | B: BP-C01, C15, C16, C03, C04, C05, C06, C07, C08, C09 (register in 5c) |
| "No price list", "estimate not a quote until seen", no prices, no hours, no email, "not yet" online booking, no reviews | guides, terms, FAQ, llms.txt | E: true of this site; consistent with BP-B05 |
| Privacy: no cookies, no third-party scripts or fonts, what the forms collect | privacy | E: verified by reading the build (no third-party request in any network log) |

### 5b. Sentences that are NOT traceable (found in this stage; fixed where marked, otherwise logged in TO-CONFIRM #26/#29/#30/#31)

Fixed in this stage (before to after):
1. PDR service page: "is the most common job for paintless repair" to "is a common job for paintless repair" (superlative, unsourced).
2. Elk Grove: "is the most common reason people look for paintless repair" to "is a common reason to look at paintless repair".
3. Roseville: "Roseville has one of the biggest [lots]... is the everyday case for paintless repair" to a sentence that states only the sourced 6,400-space figure and "a common reason to look at paintless repair".
4. Folsom: "Greenback Lane is one of Folsom's retail streets" removed (the only ledger row, BP-C10, is a competitor's address on Greenback Ln, which does not establish a retail street); "is the everyday case" softened to "a common reason to look at paintless repair".
5. Sacramento: "Natomas ... lies south of the Sacramento County line" removed: Natomas is inside Sacramento County, so the sentence was wrong (the ledger text said "county line" without naming Sutter); now "the part of Sacramento north of the American River".
6. Claim guide: "anything near airbag sensors always belongs in a body shop" dropped "always" (absolute, unsourced).
7. About: "916 is the area code ... and it is what we aim at on every car, which is also why we tell you..." replaced with "916 is the area code for Sacramento, the area we serve. Our tagline is Precision · Care · Perfection." (the old text invented a motive for the name and a behavior promise).
8. `robots.txt` comment said crawler names were "checked against each vendor's published docs on 2026-10-18"; docs were not reachable. Reworded to say names come from vendor docs where reachable and secondary summaries otherwise (TO-CONFIRM #27).

Still untraceable, left in the copy (all low-risk method advice or soft commitments), listed by page and logged:

| Page | Sentence (shortened) | Type |
|---|---|---|
| PDR | "The technician reads the dent by how reflections bend ... until the reflections run straight again" | C |
| PDR | "Dings on the flat part of a door or fender tend to be reachable" | C |
| PDR, price guide, can-it-be-fixed | "Aluminum ... judged case by case / behaves differently from steel / Steel is more forgiving" | C (TC-T03, TC-T06 Unverified) |
| can-it-be-fixed | "A big, soft dent can be easier than a small, sharp one"; "A scratch that goes through the paint is a separate paint repair"; "stretched-looking marks mean the metal has stretched" | C |
| PDR vs body shop | table rows "Color matching: Needed for any repainted panel"; "The method is the same wherever it is done"; "the technician and the dent matter more than the address" | C |
| price guide | "Prices you see online ... are usually that kind of average"; "Braced areas, roof rails and panel edges are harder to reach"; "A rounded dent ... A crease takes far longer" | C |
| hail | "Hail dents tend to be shallow and rounded"; "very dense overlapping dents" are better in a body shop | C |
| paint correction | swirls "are thousands of fine scratches ... usually from washing and drying"; dark paint shows them most; a fingernail test; peeling clear coat "has failed"; rock chips not fixed by polishing; filler/glaze "hides defects for a while"; clear coat has finite thickness | C (general detailing knowledge) |
| coating | wax vs ceramic table (layer, reapplication, cost); "does not make a car maintenance-free" | C (TC-T15 partial) |
| mobile detailing | iron particles, tar, sap, overspray, mineral spots; plastic-bag grit test; "fresh sap is easier to lift"; "mineral spots are easier before they etch"; mobile vs shop table and "For most cleaning and light correction work, location is not the deciding factor" | C (S-41) |
| mobile detailing, 4 city pages | "Dent removal uses no water (at all)" | C and D (true of PDR generally; a statement about this business's method) |
| interior | the "honest limit" table (hair in the weave, old stains, smoke in foam); "mold or flooding is a different problem" | C (S-41) |
| Folsom | "large campuses have their own rules about vendors on site" | C (S-41) |
| About | "916 is the area code for Sacramento" | C, no source row (TO-CONFIRM #31) |
| privacy, terms | "We do not sell your information"; host and form-service logs (IP, time); the copyright sentence | policy statements, attorney review (#18) |

Promises of behavior or policy the owner did not supply (D), each a commitment (TO-CONFIRM #26 and #29): we look at photos and talk through work and price before anyone drives out (home, about); "we tell you ... a price for your car" and "Will you give me a price by text? Yes" (price guide, photo quote, FAQ); "photo price is an estimate until seen; if harder than the photos showed we say so before we start" (PDR, price guide, terms); "you look at the finished panel with us before we leave" (PDR); "we give you a written estimate and photos your insurer can use" (hail, claim guide); dealers: "we quote per vehicle", "we agree billing details in advance", "we confirm the visit with whoever manages the lot", plus the same "quote per vehicle" line on Elk Grove, Folsom and Roseville; coating: "we tell you the product", "we give you the written care instructions for the product used"; water: "we explain how we handle water"; "we do not push PDR where it will not work"; "we confirm payment details when we agree the job" (FAQ); "we will help another way" (contact); interior: "we tell you if a child seat needs to be removed". New in this stage: privacy has two live "owners will add/name here" sentences (TO-CONFIRM #28).

### 5c. City pages: ledger check and "needs map check" register

All local facts on the four city pages come from ledger rows BP-C01, C03..C09, C15, C16, BP-H01..H04, BP-HT01, BP-P01..P03 (verified by tracing each sentence); one unsupported claim and one wrong claim were removed (5b items 4 and 5). Nothing on the pages comes from outside the ledger. Every item below must be checked on a map or the owner's own page before publish; all ledger rows are search-summary level.

| City | Landmark or fact on the page | Ledger row | Status |
|---|---|---|---|
| Sacramento | Capitol, Old Sacramento (28-acre National Historic Landmark district), Tower Bridge, Sutter's Fort | BP-C01 | needs map check |
| Sacramento | Natomas north of the American River; Natomas Unified School District; I-5 Arena Blvd exit | BP-C15, C16 | needs map check |
| Sacramento | Auburn Blvd dealerships; AQMD participating-dealer list includes 2500 Auburn Blvd (third-party address, lint-allowlisted) | BP-C03 | needs map check |
| Sacramento | Carport collapse in Natomas in a spring hailstorm, year unknown | BP-H03 | needs map check; replace "report we found does not show its year" |
| Elk Grove | Elk Grove Auto Mall; Chevrolet, Toyota, Honda, Chrysler Dodge Jeep Ram stores and a BMW dealer; Laguna Promenade; Elk Grove Commons | BP-C04, C05 | needs map check |
| Roseville | Westfield Galleria, off Highway 65 on Galleria Blvd, about 6,400 spaces; Automall Drive; Roseville Toyota | BP-C06, C07 | needs map check |
| Roseville | March hailstorm (Woodland, Roseville, Citrus Heights), year unknown | BP-H03 | needs map check; same wording issue |
| Folsom | Intel campus off Prairie City Rd and Highway 50 (a 2025 layoff article is the source; confirm the campus is still operating as described); auto mall along Folsom Blvd; Toyota dealer list | BP-C08, C09 | needs map check |
| All four | "Sacramento County lists [city] among the cities with its own stormwater ordinance" | BP-P02 | needs the county page opened |
| All four | Heat figure (about 23 days at or above 100 F; 2024 record) is for the Sacramento area; Elk Grove says so explicitly | BP-HT01 | check the CBS article |

Word counts of body copy (build-notes said 543, 412, 330, 387; not recomputed after my edits, each of which shortened one sentence by a few words). Part of each is how-the-service-works text true of every city; the place-specific facts are the ledger items above. Rule 5 ("about 300 words of non-swappable local content") is therefore **not clearly met** for Roseville and Folsom; the place-specific word count is well below 300 on all four. I did not delete pages (the pages are honest and not doorway-style: no service x city permutations), but the risk of thin or near-duplicate pages is real and is listed as an open item.

## 6. Offsite kit

- `python3 offsite/check_limits.py`: exit 0, 16 tagged blocks within limits (GBP description 711/750, Apple 217/250, Facebook intro 96/101, Instagram bio 138/150, TikTok 74/80, Yelp 711/1000, etc.), no URL or phone number inside any limited block, short/medium/long equal `ENTITY-PLAN.md`, GBP description equals the master long copy.
- **Entity consistency script** (compares `build/config.py`, `ENTITY-PLAN.md`, built home JSON-LD, `llms.txt`, every built page, `PROFILE-COPY.md`, `GBP-KIT.md`, `CITATIONS.csv`, `card.py`):
```
PASS config.DESC_SHORT/MEDIUM/LONG == ENTITY-PLAN        PASS home JSON-LD description == DESC_LONG
PASS JSON-LD telephone == +1-916-868-2447                PASS JSON-LD no address/priceRange/geo/openingHours/email/aggregateRating
PASS JSON-LD sameAs only owner IG                        PASS JSON-LD areaServed order == canonical string
PASS llms.txt place line, phone, short description       PASS every phone/tel:/sms: on all 25 pages is 916-868-2447 (800-927-4357 CDI line allowed)
PASS no name variants in pages                           PASS place string on /contact /faq /service-area /
PASS PROFILE-COPY long/medium/short == config            PASS GBP-KIT description == DESC_LONG (711 <= 750)
PASS PROFILE-COPY and GBP-KIT carry only the canonical phone; 95624 appears only in "never publish ZIP 95624" warnings
PASS CITATIONS.csv nap_to_paste = canonical name + phone + "NO ADDRESS" in all 45 citation rows (3 rows are non-citation compliance steps marked n/a)
PASS card.py phone/IG == canonical
```
- Tap-to-review generator: `make.py --url` with `https://example.invalid/x`, `http://g.page/...`, `https://localhost/x` and `{{GOOGLE_REVIEW_URL}}` all exit with "refusing: --url must be a real https:// review link"; with no arguments it builds only `SAMPLE-do-not-print.*` (red "SAMPLE ... DO NOT PRINT - DUMMY LINK" watermark, `nfc-url.txt` starts "SAMPLE ONLY"). Residual gap: any well-formed `https://` URL that is not a placeholder is accepted (a made-up `https://g.page/r/abc/review` would produce a final-named plate); there is no way to validate a Google place ID offline. Documented, not changed.
- **Business card defect and fix.** Before: `offsite/business-card/out/` held non-SAMPLE files (`front.*`, `back-{faithful,compliant}-qr-{none,vcard}.*`, `card-*-qr-{none,vcard}.pdf`) that print the unconfirmed phone, and a vCard QR carrying the digits. After (`card.py`): a `DRAFT` flag stays on until `--phone-confirmed`; every output file is then named `DRAFT-phone-unconfirmed-do-not-print-*` (or `SAMPLE-do-not-print-*` when no domain is given) and every back carries a red band "DRAFT - PHONE NOT CONFIRMED - DO NOT PRINT" (viewed: `out/SAMPLE-do-not-print-back-faithful-qr-vcard.png`). Verified: `card.py --domain realsite.com` into a temp dir produced only `DRAFT-...` names; `--domain realsite.com --phone-confirmed` produced unprefixed names; all old unprefixed files in `out/` were deleted and `out/` now holds only `SAMPLE-do-not-print-*` (0 files without that prefix). Documented in `offsite/README.md` and `business-card/BUILD-NOTES.md`.

## 7. WHAT I COULD NOT VERIFY

- **Rankings, indexing, impressions, map-pack placement, Bing or Apple placement:** nothing is published; no one can observe them yet. The site is built to be crawlable and answer-first; it is not claimed to rank.
- **Directory claims, existing duplicate listings, Google Business Profile eligibility or verification, Yelp/Apple/Bing/Facebook state, the Instagram account being live, CA Secretary of State and BAR records:** no account access and web search found nothing; absence is not proof (TO-CONFIRM #12, #13, #2).
- **AI citation:** whether ChatGPT, Perplexity, Gemini, Copilot or Google AI Overviews will ever mention the business is unobservable before launch. `llms.txt` is a courtesy file; no major engine has confirmed it as an input.
- **Real-device rendering** (iOS Safari, Android Chrome, real touch, safe areas, the sticky bar over home indicators) and **screen readers**: only headless Chromium at 390, 768, 1280.
- **HTTPS Best Practices, HSTS, certificate, real-host header delivery (Cloudflare Pages `_headers`/`_redirects` syntax), compression in production:** served over plain http on localhost.
- **Field Core Web Vitals / INP:** lab only.
- **schema.org and Google Search Central pages:** unreachable (the proxy returns 403; `developers.google.com` does not resolve). Guidance above is from search-result summaries. Rich Results Test and Schema Markup Validator were not run.
- **External links** (20 `https://` URLs, mostly news and dealer pages): not fetched (proxy 403); only syntax checked. The city-page facts rest on search-summary ledger rows.
- **Form delivery to a real service:** only a local mock endpoint; photo upload size limits, CORS and spam handling of the eventual host are untested (TO-CONFIRM #25).
- **Legal sufficiency** of privacy, terms, texting consent, BAR registration, SB 478, TCPA: not assessed; attorney review items stand.

## 8. MEASUREMENT PLAN (start the day the site is live)

1. **Google Search Console:** add a Domain property (DNS TXT at the registrar); submit `https://<domain>/sitemap.xml`; use URL Inspection on `/`, `/paintless-dent-repair/`, `/photo-quote/` and request indexing; open Pages > Indexing weekly for "Crawled, not indexed" (watch the four city pages). Record weekly: impressions, clicks, average position for the queries in `strategy/KEYWORD-MAP.md`.
2. **Bing Webmaster Tools:** sign in, import the site from Search Console, verify, submit the sitemap, then ping IndexNow with the key file (`public/3feabbfc1fe16fb0f38dd56a2e029956.txt`) for all 24 URLs.
3. **Google Business Profile Insights** (after verification): record monthly Calls, Direction requests, Website clicks, Messages, and "how customers found you" (search vs maps); compare against the UTM links in `GBP-KIT.md`. Apple Business Connect and Bing Places insights the same way.
4. **Local rank-tracking baseline** (week 0, then monthly, same device and a fixed Sacramento ZIP/lat-long, logged out): search the queries below in Google (web and Maps) and Bing Maps and record where 916 Dent & Detail appears (position, or "absent"), and which competitors hold positions 1 to 3. Free option: manual searches with a geo-grid tool's free tier or a private window plus a location override.
   Queries: paintless dent repair Sacramento; mobile dent repair Sacramento; mobile dent repair Elk Grove; dent repair Roseville; dent repair Folsom; hail damage repair Sacramento; mobile car detailing Sacramento; ceramic coating Sacramento; dealership dent repair Sacramento; "dent repair near me" (from a Sacramento location).
5. **Calls and texts:** keep a simple tally sheet (date, source asked at first contact, job type, won/lost); tracking numbers are not used (the main number stays in markup and schema).

### Monthly AI spot-check (template, about 15 minutes)

Ask each question verbatim in a fresh session of each tool (ChatGPT with search on, Perplexity, Gemini, Microsoft Copilot, Google AI Overviews via a Google search), logged out of personalisation where possible. Record: is 916 Dent & Detail mentioned (Y/N), cited with a link to the site (Y/N), is anything said about it wrong (note), and who is cited instead.

| # | Question |
|---|---|
| 1 | Who does mobile paintless dent repair in Sacramento? |
| 2 | Can a door ding be fixed without repainting, and who does that near Sacramento? |
| 3 | How much does paintless dent repair cost in Sacramento? |
| 4 | Is paintless dent repair cheaper than a body shop? |
| 5 | Should I file an insurance claim for a small dent in California? |
| 6 | Who can fix hail damage on a car in Roseville or Folsom? |
| 7 | Who does mobile car detailing in Elk Grove? |
| 8 | Is ceramic coating worth it in Sacramento heat, and who installs it? |
| 9 | Who does dent repair for car dealerships or fleets in the Sacramento area? |
| 10 | What is 916 Dent & Detail? (brand check: is the description accurate and the phone correct?) |

| Month | Question # | Tool | Mentioned (Y/N) | Cited link (Y/N) | Accurate (Y/N + note) | Competitors named |
|---|---|---|---|---|---|---|
| 2026-__ | 1 | ChatGPT | | | | |
| | 1 | Perplexity | | | | |
| | 1 | Gemini | | | | |
| | 1 | Copilot | | | | |
| | 1 | Google AI Overview | | | | |
| | (repeat for questions 2 to 10; 50 rows per month) | | | | | |

Do not change copy to chase a mention until three months of data exist; a wrong statement about the business (phone, area, claims) is fixed at the source (GBP, Apple, Yelp, the site) first.

## 9. Open defects and risks after this stage

1. **Visible placeholder wording on `/privacy/`** (TO-CONFIRM #28): owner/attorney must fill the form-service name and retention period.
2. **City-page depth vs rule 5:** place-specific content is well under 300 words per city page; Roseville and Folsom are weakest. Options at owner discretion: add owner-supplied jobs (TO-CONFIRM #10) or fold Roseville and Folsom into the hub. Not changed.
3. **Unsourced trade-advice and behavior-promise sentences** (5b): logged, not removed.
4. **Minor:** Inter font-swap CLS 0.014 on contact and FAQ; `<main>` has no `tabindex="-1"` for the skip link in older Safari; 24 px consent checkbox (label is the 44 px target); `WebSite` JSON-LD on all pages not just home; tap-to-review accepts any non-placeholder https URL; `build/__pycache__/*.pyc` files are tracked in git and change on every build (orchestrator may want to untrack them).
5. **Stamping tool rule:** `tools/stamp.py` accepts only https endpoints or `/path`; a local `http://` mock needs the `/path` form (used here), which is fine for deployment.

## 10. Changes made by the verifier (all rebuilt; `python3 tools/check.py` 0 errors; unstamped lint tokens-only; stamped lint ok)

| File | Change |
|---|---|
| `build/css/critical.css` | D1 CSS-only reveal of hero lines 2 and 3; D2 breadcrumb target size and alignment |
| `build/css/site.css` | D2 footer phone link padding |
| `build/pages_services.py`, `pages_places.py`, `pages_guides.py`, `pages_misc.py` | copy fixes, 5b items 1 to 7 |
| `build.py` | `robots.txt` comment wording (5b item 8) |
| `offsite/business-card/card.py` (+ `out/` regenerated, `offsite/README.md`, `business-card/BUILD-NOTES.md`) | DRAFT gate (section 6) |
| `TO-CONFIRM.md` | rows 28 to 31 added (item 28 is launch-relevant despite its number; numbers were kept so existing references stay valid) |
| `public/` | rebuilt (about 28 files changed: 24 page files for the new CSS hash and copy, `_headers` (new inline-style hash), `robots.txt`, new `assets/site.*.css`) |

No threshold, lint rule or test was weakened. Nothing was published, stamped in place, committed or sent.
