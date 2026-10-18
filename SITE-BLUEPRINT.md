# SITE BLUEPRINT: build a researched, search-ready website for ANY local business

> Paste everything below the line into Claude Code, then fill the three lines under INPUTS. Nothing else is needed.
> This is a method, not a template. It must work for a plumber, a dentist, a bakery, a law firm, a florist or a gym,
> and no two results may look or read alike.

---

## INPUTS (fill these in)

- BUSINESS NAME: `<name>`
- TOWN, STATE (and any other towns served): `<town, state>`
- ANYTHING ELSE I'VE PROVIDED: links (Google Business Profile, Yelp, Facebook, Instagram, existing site), a logo, photos, a business-card image, an intake JSON, notes. Put files in `sites/<slug>/inputs/`. Anything in this prompt, in that folder, or in the chat is **authoritative** over what you find by research. If research contradicts it, keep the provided value and list the conflict in `TO-CONFIRM.md`.

`<slug>` = lowercase-hyphenated business name. Everything you create goes under `sites/<slug>/`.

## YOUR JOB

Produce, for this one business, (1) a fast, accessible static website engineered to rank in Google web and map results, Bing, Apple Maps and Yelp, and to be quoted by AI answer engines (Google AI Overviews, ChatGPT, Perplexity, Gemini, Copilot, Claude); and (2) the off-site kit and print assets that make the rest of the internet agree with the site. Every decision comes from research on THIS business, its trade, its town and its competitors. Never from habit.

## NON-NEGOTIABLE RULES

1. **No invented facts.** Never publish a license number, years in business, price, hours, owner or staff name, award, certification, guarantee, review, rating, customer count, "family owned", "locally owned", "licensed and insured" or any statistic unless it is provided or verified from a cited source. Unverifiable items are left OUT of the pages and logged in `TO-CONFIRM.md` (item, where it would go, who can confirm it).
2. **No invented people, work or reviews.** No fake staff photos, fake finished-work photos, fake testimonials, fake before/afters. Testimonials only if the client supplied them or they are real public reviews, shown with the reviewer's name as published, the source and a link, and flagged in `TO-CONFIRM.md` for client approval. For Yelp, link to the listing; do not copy review text.
3. **Real photos first.** Use only client-provided images. Where none exist, use clean illustrated or typographic graphics you make yourself (SVG), and mark each empty photo slot in `PHOTO-SHOTLIST.md`. Never copy, hotlink or trace images from Google, Yelp, competitors or stock sites you have no licence for. Fonts must be self-hosted or system fonts with an open licence.
4. **Competitors are for analysis, never for copying.** No competitor sentence, structure or image appears in the output. Write everything fresh, in this business's voice.
5. **No doorway pages.** A service×city page exists only if the business really serves that place AND you can write at least ~300 words of genuinely local, non-swappable content for it (real neighbourhoods, landmarks, local conditions, regulations, typical jobs, supplied proof). If not, do not create it. Quality over page count.
6. **Honest ranking claims.** You cannot guarantee or observe rankings. Never write that the site "will rank". Report what you verified and what only a human can check.
7. **Official docs beat this prompt.** Where this prompt conflicts with current guidance from Google Search Central, Google Business Profile, Bing Webmaster, Apple, Yelp, Schema.org or the FTC, fetch the current page, follow it, and note the difference in `VERIFICATION-REPORT.md`.
8. **Privacy and accounts.** Never publish a home address of a service-area business (storefront address only if the business has a public storefront). No personal phone, email, EIN or ID numbers on the site. Create no accounts and request no passwords; every external profile is created later in the client's name.
9. **Don't ask, decide.** Work through the stages without stopping to ask questions. Record every assumption in `ASSUMPTIONS.md`. Stop and ask ONLY if the business cannot be identified with confidence (two businesses match the name and town) or the trade is one you must not advertise (illegal or unlicensed practice).
10. **No publishing.** Do not deploy, buy a domain, touch DNS, send email or post anywhere. Stop at deploy-ready files.

## WORKFLOW (follow in order; commit after each stage on the current branch; no pull request)

Use subagents for research reading and parallel fact-gathering. Keep strategy, design and every judgment call in the main thread.

### STAGE 1: RESEARCH → `research/RESEARCH.md` (+ `research/sources.csv`)

Every fact gets: value, source URL, date retrieved, confidence (**Verified** = two independent sources or an official record; **Likely**; **Unverified**). Public pages only; do not log in, bypass blocks or ignore robots/terms.

1. **The business:** its own site/socials, Google Business Profile (public listing, categories, services, hours, photos count, review count/rating/velocity, Q&A), Yelp, Facebook, Instagram, BBB, Apple/Bing listings, state license board and Secretary of State records, news/press, any business-card or photo inputs (read them visually and extract details). Build one canonical **NAP** (name, address or service area, phone, hours, website) and note every inconsistency found across the web.
2. **The trade:** how customers buy it (emergency vs planned, price-led vs trust-led, call vs book vs walk-in), the questions they ask (Google autocomplete, People Also Ask, forums, review text of competitors), seasonality, typical prices and process, licensing and advertising rules for the trade and state (put these in `COMPLIANCE.md`: e.g. contractor licence display, bar and medical advertising rules, financial disclosures, fair-housing, alcohol, anything regulated), and the words real customers use versus industry jargon.
3. **The place:** towns/neighbourhoods served, distances and drive times, landmarks, climate or local conditions that change the work, local regulations/permits, local events, demographics, languages spoken (decide whether a Spanish or other-language version is warranted by the area and trade).
4. **The competition:** the top 5 organic and top 3 map-pack competitors for the main money terms in the actual town. For each: GBP primary + secondary categories, services listed, review count and velocity, site structure, page types, schema used, what they answer well, **what they miss**. Output a gap table.
5. **The keyword universe:** primary (service + town), secondary, near-me, neighbourhood, long-tail, question and comparison queries, with intent, rough competitiveness and the page that will own each. Use only data you can actually source (autocomplete, SERP features, competitor titles); label estimates as estimates.
6. **Best-in-trade design references:** 6+ standout sites in this trade (national and local) and what makes them convert.

### STAGE 2: STRATEGY → `strategy/`

- `KEYWORD-MAP.md`: one primary intent per page, no two pages competing for the same query.
- `SITE-ARCHITECTURE.md`: page list chosen from the research, **sized to the business** (a one-chair barber may need 8 pages; a multi-service contractor 30). Always include: home, each core service, about, contact, FAQ, service-area, privacy policy, terms, 404. Add only what research justifies: city pages (rule 5), pricing/cost guides, process, gallery, reviews, blog/guides, financing, emergency, careers, menu, booking, team, locations, Spanish mirror. Define internal-link rules, breadcrumb trail and URL scheme (short, lowercase, hyphenated, no dates).
- `CONVERSION-PLAN.md`: the primary action for this trade (call, text, book, quote, directions, order) and where it appears; phone tap-to-call and sticky mobile bar if calls matter; form fields kept to the minimum; a quote or booking path; hours-aware messaging.
- `ENTITY-PLAN.md`: the one set of facts (NAP, categories, descriptions, `sameAs` profiles) that site, schema, directories and AI-readable files must all repeat identically.

### STAGE 3: DESIGN BRIEF → `strategy/DESIGN-BRIEF.md` (before any CSS)

From the stage-1 design references and this business's real brand inputs, decide and justify:
- **Layout archetype for this trade and audience** (examples, not a menu: emergency trades = phone-first, proof-heavy, minimal steps; restaurants = menu, hours, order, atmosphere; medical/legal = credentials, privacy, calm, clarity; retail = product, location, stock; beauty/fitness = gallery, booking, vibe; B2B = authority, case evidence). Invent a better one if the research supports it.
- Palette (from the real logo/brand if provided; otherwise derived from the trade and place), with every text/background pair **computed** to meet WCAG 2.1 AA contrast (4.5:1 body, 3:1 large/UI).
- Type pairing, scale and line-length; hero concept; section rhythm; trust devices (only real ones); motion language and where it stops.
- **Anti-template test:** before building, read the other folders in `sites/`. This site must differ in palette, type pairing, hero concept and layout structure from every existing one, including same-trade sites. Record how it differs.
- Mobile first: design the 390px layout first; one-thumb reachability for the main action.

### STAGE 4: BUILD → `sites/<slug>/public/` (static HTML/CSS/JS, no framework needed)

Reference for **engineering mechanics only, never for design or copy:** `sites/phils-auto-fleet-repair/` (`build.py`, `site.css`, `site.js`) and `sites/quantum-growth/public/` (placeholder stamping via `set-domain.py` and `set-lead-email.py`, leak linting, the reveal/motion guards). Reuse those patterns if they fit; improve them if not.

**Content standards**
- Answer-first writing: each page opens with a direct 40-60 word answer to its main question, then depth. Headings use the real questions customers ask. Prices, process steps and comparisons go in plain lists and tables, because answer engines extract them.
- Specific, experienced, local. State real details (materials, steps, timelines, local conditions) a generic competitor could not. No filler openers, no keyword stuffing, no generic "we pride ourselves" copy, no fake urgency.
- Cite sources on any factual claim that is not the business's own, and date-stamp guides ("Updated <month year>") only when actually reviewed.
- One H1 per page with the primary term and place, natural. Title tag ≤ ~60 chars, meta description ~150 chars written for clicks, unique per page.
- Alt text describes the image's content (empty alt for decoration). No text baked into images.

**Technical SEO / AEO**
- Semantic HTML, canonical on every page, `lang`, Open Graph/Twitter cards (generate a share image per key page), `sitemap.xml` (only indexable URLs, with `lastmod`), `robots.txt`, `404.html`, `_headers` (security headers, CSP, long cache for hashed assets), `humans.txt` optional.
- **Structured data (JSON-LD, valid, matching visible content):** the most specific `LocalBusiness` subtype (verify it exists on schema.org) with `name`, `url`, `telephone`, `address` or `areaServed` (service-area businesses: omit `address`), `geo`, `openingHoursSpecification`, `hasMap`, `sameAs` (verified profiles only), `priceRange` only if verified; `WebSite`; `Service` per service page; `BreadcrumbList`; `FAQPage` where an FAQ is visible (note: Google shows FAQ rich results only for a few site types, so this is for other engines, not a promise); `Person` only for verified named people. **Do not** add `AggregateRating`/`Review` markup for the business's own reviews on its own pages (Google treats self-serving review markup as ineligible); show reviews visibly with attribution and a link instead. Confirm this against current Google docs (rule 7).
- AI discovery: a plain-language `llms.txt` (what the business is, services, areas, NAP, key URLs) as a low-cost courtesy (state in the report that no major engine has confirmed it as a ranking input); a `robots.txt` that allows search/retrieval crawlers and records the owner's choice on training crawlers in `TO-CONFIRM.md` (verify current user-agent names for OpenAI, Anthropic, Perplexity, Google-Extended, Applebot-Extended, Common Crawl from each vendor's docs); IndexNow key file for Bing and partners. Make key facts crawlable as plain HTML text, not buried in scripts or images.
- **Entity consistency:** NAP, categories, descriptions and business name identical everywhere (rule: if call-tracking numbers are used, the main NAP number stays in markup and schema).
- **Performance budget:** mobile Lighthouse targets Performance ≥ 95, Accessibility 100, Best Practices ≥ 95, SEO 100; LCP < 2.5 s, CLS < 0.1, INP < 200 ms; no render-blocking third-party scripts; responsive AVIF/WebP with explicit dimensions, lazy-loading below the fold, `fetchpriority` on the hero; critical CSS inline; minimal JS. If a target is missed, report the real number and why.
- **Accessibility WCAG 2.1 AA:** landmarks, skip link, visible focus, keyboard operation, 44px touch targets, form labels and errors, `prefers-reduced-motion`, no colour-only meaning, sensible heading order, captions/transcripts for any media.
- **Motion safety (learned the hard way):** content must be fully visible with JavaScript off, with `prefers-reduced-motion`, and if any observer or timer fails. Never hide content with CSS that depends on JS to reveal it. Count-up or text effects must not destroy child markup.
- **Forms and contact:** working-pattern form with honeypot, clear success/error states, and a single replaceable placeholder for the destination; tap-to-call/text links; privacy notice near any consent checkbox. Until a destination is stamped, the form must say it isn't connected and send nothing.
- **Placeholders:** domain, form destination and analytics IDs each use one unmistakable token, stamped by a script, and the production lint **fails** while any token, "TODO", "lorem", "replace-with", `example.com` or another business's name from this repo remains.
- Spanish or other language version only if stage 1 justified it: real translation, `hreflang`, same quality bar. No machine-translated filler.
- Privacy policy and terms generated for the actual data collected, marked "review by the owner's attorney".

### STAGE 5: OFF-SITE KIT → `sites/<slug>/offsite/`

- `GBP-KIT.md`: recommended primary category and up to 9 secondary (justified by competitor research and Google's category list), services with descriptions, business description (≤ 750 chars, no keyword stuffing, no phone/URL in it), attributes, opening hours incl. holidays, Q&A seed questions with answers, products/menu if relevant, appointment/order links with UTM tags, photo shot list, and **8 starter posts** (offer, update, event, seasonal; real information only). Notes on verification and suspension risks for this trade (e.g. service-area business address rules, virtual-office and name-stuffing violations).
- `CITATIONS.csv`: 40+ directories ranked for this trade and region: data aggregators, core platforms (Google, Apple Business Connect, Bing Places, Yelp, Facebook, Nextdoor, BBB, Yellow Pages), trade-specific sites, local chamber/city/association listings. Columns: directory, URL, claim URL, category to choose, paid/free, priority, NAP to paste, status, live URL, NAP matches. Include a cleanup list of wrong or duplicate listings found in stage 1.
- `PROFILE-COPY.md`: ready-to-paste text for Yelp, Bing, Apple, Facebook, Instagram bio, LinkedIn if relevant, each within platform limits and consistent with `ENTITY-PLAN.md`.
- `REVIEWS-KIT.md`: the direct Google review link (how to obtain the place ID and build it), request scripts for SMS, email and in person, a follow-up cadence, and reply templates for 5-star through 1-star. **Requests go to every customer; never filter by sentiment or gate who may leave a review** (violates Google's policy and FTC rules). Include the consent/opt-out requirements for texting (TCPA; STOP/HELP).
- `tap-to-review/`: print-ready SVG/PDF plate with QR (to the review link), NFC URL and short-link text, with bleed and safe area.
- `business-card/`: front/back, 3.5×2 in with 0.125 in bleed and a safe area, SVG + print PDF, built from the client's real logo and brand (wordmark-only if no logo supplied; if a card image was provided, redesign it faithfully and consistently with the site). Include a QR to the site with a UTM tag and an optional vCard QR. Only verified details.
- `PHOTO-SHOTLIST.md`: exact shots the client should take (subject, angle, orientation, filename, which page uses it) in priority order.

### STAGE 6: VERIFY → `VERIFICATION-REPORT.md`

Run these, paste real results, and fix what fails. Say "not verified" for anything you could not run.
1. HTML validity, broken internal/external links, sitemap ↔ built pages parity, canonicals, one H1 per page, title/meta length and uniqueness, image dimensions and alt text.
2. JSON-LD: parses, uses real schema.org types and properties, matches visible text, no disallowed review markup.
3. Lighthouse (mobile) and axe-core on every template type; report the numbers.
4. Headless Chromium screenshots at 390, 768 and 1280 px; also with JavaScript disabled, with `prefers-reduced-motion`, and a **computed-opacity probe** proving no content stays hidden. Check keyboard path and focus order on the main conversion flow.
5. Leak lint (rule list in stage 4) and a fact audit: every factual sentence on the site traces to `sources.csv` or the supplied inputs.
6. A plain-language **what I could not verify** section: rankings, indexing, directory claims, GBP verification, AI citation. Add a **measurement plan**: Search Console and Bing Webmaster setup, GBP Insights, a local rank-tracking baseline, and a monthly spot-check of ~10 customer questions across ChatGPT, Perplexity, Gemini, Copilot and Google AI Overviews, recording whether the business is mentioned.

## DELIVERABLES (exact tree)

```
sites/<slug>/
  inputs/                 (what was provided; never modified)
  research/               RESEARCH.md, sources.csv, competitors.md
  strategy/               KEYWORD-MAP.md, SITE-ARCHITECTURE.md, CONVERSION-PLAN.md, ENTITY-PLAN.md, DESIGN-BRIEF.md
  public/                 the deploy-ready site (+ sitemap, robots, llms.txt, _headers, IndexNow key)
  offsite/                GBP-KIT.md, CITATIONS.csv, PROFILE-COPY.md, REVIEWS-KIT.md, tap-to-review/, business-card/, PHOTO-SHOTLIST.md
  COMPLIANCE.md  TO-CONFIRM.md  ASSUMPTIONS.md  VERIFICATION-REPORT.md  README.md
```

`README.md` explains: how to preview locally, how to stamp domain/form/analytics placeholders, how to deploy to Cloudflare Pages or any static host, and the first 10 things the owner must do (in order).

## FINISH

End with a short summary: pages built, the 10 highest-impact items in `TO-CONFIRM.md`, anything the client must supply, what you could not verify, and the manual steps the owner must take (domain, DNS, Search Console, claiming profiles in the client's name). Then stop.
