# Phase 2 — Website crawl and the on-site check library

Written 2026-09-28 before the build (master plan §0 rule 1). Verification log at the end.

## Goal (master plan §4 step 2, §6)

Crawl the business's website (up to 50 pages, configurable), measure it with
PageSpeed Insights, and run a deep set of deterministic checks across technical SEO,
local SEO on-site, structured data, AI-readiness, images, conversion leaks and
content. Every finding cites evidence from the crawl. Done when a crawl report is
produced for test sites and the checks fire correctly on a deliberately flawed
demo site and stay quiet on a clean one.

The owner's brief for this phase: the audit must find what an expert finds, not a
handful of items. The library below is the deterministic layer; the LLM layer
(weak copy, unclear value proposition, stock-photo detection) is Phase 7.

## What is built

### Crawler (`src/lib/crawl/`)
- `analyzePage(html, url)` → `PageAnalysis`: title, meta description, canonical, robots
  meta, viewport, lang, favicon, headings (with order), word count, text sample,
  internal/external links (anchor, nofollow), images (src, alt, dimensions, loading,
  format, srcset), JSON-LD blocks (parsed, with types, parse errors kept), Open Graph,
  forms (fields, method), `tel:`/`mailto:` links, iframes (maps embeds), scripts count,
  third-party widgets (chat, booking, analytics), mixed content, phone/address text
  presence, copyright year, date patterns, FAQ patterns (question headings), trust
  phrases (licensed, insured, guarantee, BBB), pricing mentions, CTA phrases in the
  header/hero, `<address>` presence.
- `crawlSite()` → `SiteCrawl`: breadth-first over same-host links, priority queue
  (home, contact, about, services, locations, pricing, reviews, faq, blog first),
  robots.txt honored and parsed (incl. AI crawler rules), `sitemap.xml` (and index
  files) parsed, `llms.txt` probed, a random path probed for a soft-404, internal
  links probed for status (HEAD, capped), the largest images probed for byte size
  (HEAD, capped), redirect chains recorded. Rate limited to ~2 requests/second. Uses
  the website provider for every fetch, so every page lands in `raw_snapshots` and a
  re-run inside the TTL is free.
- `website.probe()` added to the provider: status/headers only, no body stored.
- Renderer (optional): when `CRAWLER_RENDERER=playwright` and Playwright can launch,
  the home page is rendered at 1440×900 and 390×844 for full-page screenshots
  (stored in the `screenshots` bucket as evidence) and the rendered text length is
  compared with the static HTML to detect JavaScript-dependent content. Off by
  default; Vercel functions cannot run Chromium. The worker choice is D-017.

### PageSpeed Insights (live)
`GET /pagespeedonline/v5/runPagespeed` for mobile and desktop on the home page:
performance score, LCP, INP (field), CLS, TTFB, plus the tap-target, font-size and
content-width audits. Free with `GOOGLE_PAGESPEED_API_KEY`; the keyless shared quota
is exhausted (checked 2026-09-28), so the key is required.

### Checks (`src/lib/checks/website/`)
Roughly seventy checks in seven categories. Each one reads only the crawl and
PageSpeed data, returns `unavailable` when its input is missing, and attaches
evidence (URL + the exact value seen). Severity and impact are fixed per check;
Phase 7 attaches $ ranges. Full list with ids is in the source; headline items:

| Category | Checks |
|---|---|
| technical_seo | https, http→https redirect, title missing/length/duplicate, meta description missing/length/duplicate, H1 missing/multiple, heading order, canonical missing/cross-host, noindex on key pages, robots.txt missing/blocks all, sitemap missing/not referenced/broken URLs, broken internal links, redirect chains, mixed content, viewport, lang, favicon, soft 404, oversized HTML, script bloat, PSI performance score, LCP, INP, CLS, TTFB, JavaScript-dependent content |
| local_onsite | phone in header, NAP in footer on every page, address site-wide, map embed, hours visible, service-area/location page, city in home title/H1, service+city targeting in titles |
| schema | LocalBusiness present, valid JSON, subtype specific, required fields (name, address, telephone, geo, openingHours, url, image, priceRange, areaServed, sameAs), schema NAP matches resolved NAP, Service schema on service pages, FAQPage when FAQ content exists, BreadcrumbList, Organization logo, self-serving aggregateRating |
| aeo | entity statement in first screen, FAQ content, question headings, answer-first service pages, credentials visible, about page, `llms.txt`, AI crawlers allowed in robots.txt, `sameAs` linking to GBP/Yelp/socials |
| images | alt missing, alt generic, generic filenames, oversized files, legacy formats, lazy loading, missing dimensions, too few real photos, logo present |
| conversion | tap-to-call (Phase 0), phone above the fold, primary CTA above the fold, quote/booking path, form length, contact page, testimonials/reviews shown, trust badges, pricing transparency, chat widget (informational), tap targets, font size, horizontal scroll, slow-mobile bounce risk |
| content_keywords | thin pages, home word count, generic home title, primary service in home title, service pages for listed services, outdated copyright, stale dates, near-duplicate pages, blog presence |

### Scoring
After the crawl step the category scores and the headline Visibility and Conversion
scores (Phase 0 scaffold) are computed from the findings so far and stored in
`audits.scores`; the audit page shows them. Weights stay in `scoring/config.ts`.

### UI
Audit detail gains: scores, a crawl summary (pages, PSI numbers, robots/sitemap
state), findings grouped by category with counts. Preview scenario `crawl` runs the
whole pipeline against the demo site.

## Not in this phase
Competitors, rankings, AI engines, citations, backlinks, social, LLM-layer findings,
solutions, the client report layout. Also not a full Playwright crawl of every page
(home page render only, optional).

## Acceptance (owner, needs `GOOGLE_PAGESPEED_API_KEY`; Places key from Phase 1)
Run audits on the five Phase 1 businesses. For each: the crawl summary shows the
expected page count and PSI numbers, and the findings read as things a human
reviewer would agree with. Anything that looks wrong goes into the log below with the
check id so the rule can be tightened.

## Verification log (2026-09-28, build container)

| Step | Result |
|---|---|
| `pnpm lint` | 0 problems |
| `pnpm typecheck` | 0 errors |
| `pnpm test` | 17 files, 111 tests: page analysis, crawler on the flawed demo site (robots, sitemap, soft 404, link/image probes, redirect chains, snapshots) and the clean site, 97 website checks against both fixture sites (demo fires ≥ 50 findings across all seven categories with evidence on every one; clean site fires none; no PageSpeed → PSI checks `unavailable`, never findings), crawl step end to end (findings + evidence + scores persisted; PageSpeed not configured → recorded as UNAVAILABLE; no website → skipped), Inngest function with resolve + crawl steps |
| `pnpm db:test` | migrations + `01_access.sql` pass on Postgres 16 (schema unchanged this phase) |
| `pnpm build` | ok (see commit) |
| Preview `/dev/preview/audit?scenario=crawl` | full pipeline on the demo site: 68 findings (1 critical, 16 high, 26 medium, 25 low), Visibility 37, Conversion 18, crawl and PageSpeed cards render at 1440 px and 390 px |
| Live crawl + PageSpeed on real sites | **not done here**: no `GOOGLE_PAGESPEED_API_KEY` in the build container, and the keyless quota is exhausted (D-018). Owner protocol above. |

What changed against the plan during the build:
- Checks count is 97 (plan said ~70). Two planned items moved: `http→https redirect` folded into `https_missing`; `Organization logo` is `images.logo_missing`.
- `conversion.chat_widget_missing` was narrowed to "no tap-to-call, booking or chat at all" after it fired on the clean site; a site with a `tel:` link in the header passes.
- `content_keywords.duplicate_content` ignores shingles present on half the pages or more (header/footer boilerplate) so real sites are not flagged for their nav.
- `local_onsite.services_without_pages` matches singular/plural ("water heaters" ↔ "Water Heater Repair").
- Above-the-fold detection excludes the footer, so a footer phone number on a short page no longer counts as visible.
- Playwright rendering and screenshots are deferred to the worker decision (D-016/D-017).

## Exit criteria

- [x] Crawler, PageSpeed adapter and 97 checks implemented and pinned by tests on a flawed and a clean fixture site
- [x] Crawl step in the job; scores persisted; audit page shows scores, crawl summary, PageSpeed and grouped findings
- [ ] Five real sites crawled with PageSpeed numbers and findings a human reviewer agrees with (owner, with `GOOGLE_PAGESPEED_API_KEY`)
- [ ] Rendered crawl + screenshots (after D-017)
