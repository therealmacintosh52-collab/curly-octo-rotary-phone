# MASTER PLAN — Local Business Visibility & Revenue-Leak Auditor

> Paste this whole file into Claude Code (or save it as `CLAUDE.md` / `docs/MASTER_PLAN.md` in an empty repo and tell Claude Code: "Read docs/MASTER_PLAN.md and execute Phase 0. Use plan mode first.").

---

## 0. Role & working agreement

You are the lead engineer building a production SaaS app. Operate like a senior full-stack + SEO/AEO engineer.

Rules for how you work:
1. **Plan before code.** At the start of each phase, write the plan to `docs/phases/phase-N.md`, then build.
2. **Never invent data.** Every finding in a report must link to the evidence that produced it (API response, crawled page, screenshot, timestamp). If a data point can't be fetched, mark it `UNAVAILABLE` with the reason — never guess or fill with plausible values.
3. **Every external call goes through a provider adapter** (`/lib/providers/*`) with: retry + backoff, timeout, cost logging (USD per call), raw-response caching, and a mock mode for tests.
4. **Tests are required** for the scoring engine, the revenue-loss model, and the access-control layer (solutions must never leak to client views).
5. Commit at the end of each phase with a summary. Keep a running `docs/DECISIONS.md` log.
6. Ask me before: adding a paid API, changing the data model, or anything that affects what clients can see.

---

## 1. Product summary

**Input:** I (the admin) paste any combination of:
- Business website URL
- Google Business Profile link (maps.app.goo.gl share link, google.com/maps URL, or name + city)
- Yelp business URL
- Optional: extra URLs (Facebook, Instagram, Nextdoor, Angi, BBB, etc.), target service area, main services, average ticket size

**Process:** The system resolves each input to a canonical business entity, pulls every available data point, researches the business across Google, Maps, AI answer engines, directories, and competitors, then runs a rules + LLM analysis engine that finds every problem hurting visibility and conversions.

**Output — two separate views of the same audit:**

| View | Who sees it | Contents |
|---|---|---|
| **Client Report** | The business owner (via private share link, no login required, or client login) | Scores, every problem found (plain English, with evidence + screenshots), severity, estimated monthly revenue lost (low/mid/high range with visible assumptions), competitor comparison, AI-visibility results, a "fix difficulty / impact" rating per problem — **but NOT how to fix it** |
| **Solution Vault** | Admin only (me) | For every problem: exact step-by-step fix, rewritten copy, keyword lists, schema/JSON-LD code, image specs, GBP category/description rewrites, review-response templates, content briefs, citation-building list, prioritized 30/60/90-day roadmap, time/cost estimate, my suggested price to do the work, and upsell ideas |

**Unlock control:** Admin can selectively reveal solutions to a client per problem, per category, or all at once (e.g., after they pay). Revealed solutions appear in the client report in the same simple format.

**Primary business use:** Lead generation + sales tool for a local marketing/AI-services agency. The client report is the "here's what's broken and what it's costing you" pitch; the vault is the delivery playbook.

---

## 2. Tech stack (use unless you have a strong reason — log it in DECISIONS.md)

- **Framework:** Next.js (App Router, TypeScript, strict mode)
- **UI:** Tailwind + shadcn/ui, Recharts for charts
- **DB + Auth + Storage:** Supabase (Postgres, Row Level Security, Storage for screenshots/PDFs)
- **Background jobs:** Inngest or Trigger.dev (audits take minutes, run as multi-step durable jobs with progress updates)
- **Crawling/rendering:** Playwright (headless Chromium) running in the job worker; full-page desktop + mobile screenshots
- **LLM:** Anthropic API (Claude) for analysis, copywriting, and solution generation — structured JSON outputs validated with Zod
- **Hosting:** Vercel (web) + job worker where Playwright can run (Inngest/Trigger.dev worker, Railway, or Fly.io)
- **PDF export:** Playwright print-to-PDF of the report route

### External data providers (each behind an adapter)

| Need | Provider | Notes |
|---|---|---|
| GBP data (categories, hours, rating, review count, photos, attributes, reviews sample) | **Google Places API (New)** — Text Search + Place Details | Use field masks to control SKU cost. Free caps are per-SKU monthly (Essentials/Pro/Enterprise tiers), not a pooled credit. |
| Local pack / Maps rankings, geo-grid rank scan | **DataForSEO SERP API** (Google Maps + Local Finder + Organic, with lat/long) | Do NOT scrape Google directly — ToS + blocking risk. |
| AI answer-engine visibility | **DataForSEO AI Optimization API** (LLM Responses, LLM Mentions) + **Google AI Mode / AI Overview SERP** | Covers ChatGPT, Gemini, Claude, Perplexity, Google AIO/AI Mode. |
| Keyword volume, CPC, difficulty, competitor keywords, backlinks | DataForSEO Labs + Backlinks | CPC is used in the revenue model (ad-equivalent value). |
| Page speed / Core Web Vitals | **Google PageSpeed Insights API** (free with key) | Mobile + desktop, plus CrUX field data when available. |
| Yelp data | **Yelp Places API** | Paid per-call plans; trial is evaluation-only, not commercial. Content cache max 24h; review text is excerpt only. Store derived metrics, not raw Yelp content, beyond 24h. Confirm license covers showing data to clients. |
| Directory/citation checks (Apple Business Connect, Bing Places, Facebook, BBB, Nextdoor, Angi, Yellow Pages, industry directories) | DataForSEO SERP site: searches + page fetch | NAP consistency matching. |
| Owner-authorized real data (optional upgrade) | Google Business Profile Performance API, Search Console, GA4 via OAuth | Gives real calls/clicks/directions instead of estimates. Build the OAuth connect flow in a later phase. |

All API keys in env vars. Build a `/admin/settings/providers` page showing which providers are configured, and a per-audit **cost meter** (sum of logged API costs).

---

## 3. Data model (Postgres)

```
businesses        (id, name, canonical_domain, phone, address, lat, lng, place_id, yelp_alias, primary_category, service_area jsonb, avg_ticket, created_by)
audits            (id, business_id, status, progress_pct, current_step, started_at, finished_at, total_cost_usd, inputs jsonb, scores jsonb, revenue_model jsonb, version)
raw_snapshots     (id, audit_id, provider, endpoint, request jsonb, response jsonb, fetched_at, cost_usd, expires_at)
evidence          (id, audit_id, type [screenshot|html|api_field|serp_result|llm_answer], storage_path, excerpt, source_url, captured_at)
findings          (id, audit_id, category, check_id, title, plain_english, severity [critical|high|medium|low], impact_score, fix_difficulty [easy|medium|hard], est_monthly_loss_low, est_monthly_loss_mid, est_monthly_loss_high, evidence_ids uuid[], status)
solutions         (id, finding_id, audit_id, steps jsonb, assets jsonb, code_snippets jsonb, time_estimate_hrs, suggested_price, priority_rank, roadmap_phase [30|60|90], is_revealed bool default false, revealed_at)
competitors       (id, audit_id, place_id, name, rating, review_count, categories, map_rank_avg, ai_mention_count, domain, metrics jsonb)
ai_visibility     (id, audit_id, engine, prompt, location, business_mentioned bool, position, cited_urls text[], competitors_mentioned text[], answer_excerpt, evidence_id)
rank_grid         (id, audit_id, keyword, grid_size, points jsonb /* [{lat,lng,rank}] */, avg_rank, share_of_top3)
share_links       (id, audit_id, token, expires_at, view_count, last_viewed_at)
report_views      (id, share_link_id, viewed_at, section, duration_sec)  -- engagement tracking for sales follow-up
```

### Access control — HARD REQUIREMENT
- `solutions` table: RLS allows SELECT **only** for admin role, OR for share-link/client requests **only where `is_revealed = true`**.
- The client report API route must query solutions with `is_revealed = true` server-side. **Never** send unrevealed solution data to the browser and hide it with CSS/JS.
- Write automated tests that request the client report as an anonymous share-link viewer and assert zero unrevealed solution fields appear anywhere in the response payload or rendered HTML.

---

## 4. Audit pipeline (durable job, each step checkpointed + progress reported)

### Step 1 — Resolve & normalize inputs
- Expand short links (maps.app.goo.gl) → extract place identifiers → confirm via Places Text Search (name + address) → `place_id`.
- Yelp URL → business alias → Yelp business details.
- Website → canonical domain (follow redirects, check http→https, www vs non-www).
- Cross-check NAP (name, address, phone) across all three sources. **Mismatches are findings.**
- If inputs conflict (e.g., website phone ≠ GBP phone), flag and continue.

### Step 2 — Website deep crawl (Playwright)
Crawl up to N pages (default 50, configurable), prioritize home, services, contact, about, location pages. Collect:

**Technical SEO**
- Title tags, meta descriptions (missing/duplicate/length), H1/H2 structure, canonical tags, robots meta, `robots.txt`, XML sitemap, broken links (4xx/5xx), redirect chains, HTTPS/mixed content, hreflang (if any), indexability, orphan-ish pages, URL structure
- PageSpeed Insights (mobile + desktop): LCP, INP, CLS, TTFB, performance score, CrUX field data
- Mobile rendering: tap-target size, viewport, font size, horizontal scroll (screenshot at 390px width)

**Local SEO on-site**
- NAP present on every page / footer, matches GBP exactly
- Embedded map, service-area/location pages, city + service keyword targeting
- `LocalBusiness` (or specific subtype) JSON-LD: present? valid? fields complete (name, address, geo, openingHours, telephone, priceRange, sameAs, aggregateRating rules, areaServed)?
- Other schema: `Service`, `FAQPage`, `Review`, `BreadcrumbList`, `Organization`

**AEO / AI-readiness**
- Clear entity statement (who, what, where) in first screen of home page
- FAQ content answering real customer questions in direct-answer format
- Question-style headings, concise answer paragraphs, lists/tables AI engines can extract
- `sameAs` links connecting website ↔ GBP ↔ Yelp ↔ socials
- `llms.txt` present (low weight — note as optional, don't overstate it)
- Author/owner/credentials/licensing visibility (trust signals)
- Content depth per service vs. top competitors

**Images**
- Missing/weak alt text, filenames (IMG_1234.jpg), oversized files, non-modern formats (no WebP/AVIF), no lazy loading, stock-photo detection (LLM vision check on a sample), no real team/work photos

**Conversion / revenue leaks**
- Click-to-call phone link on mobile, phone visible above fold
- Primary CTA above fold, online booking/quote form, form length/friction, form actually submits (detect only — do NOT submit real forms)
- Reviews/testimonials displayed on site, trust badges, guarantees, pricing transparency
- Chat widget, hours visible, "open now" clarity
- Page load time impact on bounce (cite PSI numbers)

**Content & keywords**
- Keywords the site currently ranks for (DataForSEO Labs)
- Keyword gaps vs top 3 local competitors
- Service pages missing entirely (e.g., competitor has "brake repair Elk Grove" page, client doesn't)
- Thin pages (<300 words), duplicate content, outdated copyright year / stale blog

### Step 3 — Google Business Profile analysis
- Primary + secondary categories vs. what top-ranking competitors use
- Completeness: description, hours, special hours, attributes, services/products, service area, website link, appointment link, phone
- Photos: count, recency, owner vs customer photos, cover/logo present
- Reviews: count, average, **velocity** (reviews per month, last 90 days vs competitors), recency of newest review, owner response rate + response time, sentiment themes (LLM clustering of complaint + praise themes), keyword mentions in reviews
- Posts/updates recency (if detectable)
- Business name keyword stuffing or suspension risk flags
- Compare every metric vs. average of top 3 map-pack competitors

### Step 4 — Yelp analysis
- Claimed status (if available), rating, review count, categories, photos, hours, response to reviews
- Rating/review-count gap vs Yelp competitors in same category + area
- Cross-platform consistency with GBP

### Step 5 — Citations & NAP consistency
- Check presence + NAP accuracy on: Apple Business Connect / Apple Maps, Bing Places, Facebook, BBB, Nextdoor, Yellow Pages, Angi/HomeAdvisor/Thumbtack (if relevant category), industry-specific directories
- Output: table of directory → listed? → NAP match? → link

### Step 6 — Local rank research
- Generate keyword set: `{service} near me`, `{service} {city}`, `best {service} {city}`, `{service} open now`, plus top 10 from keyword research. Admin can edit before running.
- **Geo-grid scan:** for top 3–5 keywords, run Google Maps rank checks on a grid (default 5×5, 1-mile spacing, configurable 3×3 to 9×9) centered on the business. Render as a colored heat-map grid on a map.
- Organic rank for same keywords.
- Identify the top 3–5 competitors appearing most often → store in `competitors`.

### Step 7 — AI answer-engine visibility ("AI ranking")
- Prompt set (editable), e.g.:
  - "Best {service} in {city}"
  - "{service} near me" (with location context {city, state})
  - "Who is the most trusted {service} in {city}?"
  - "Affordable {service} in {city} with good reviews"
  - "{business name} reviews" (brand check — does AI know them, and is what it says accurate?)
- Run across: ChatGPT, Gemini, Perplexity, Claude, Google AI Overview, Google AI Mode.
- Record per engine: mentioned (y/n), position in list, cited sources, competitors named, what the AI says about the business (accuracy check against real data — flag hallucinated hours/services/prices).
- Compute **AI Share of Voice** = % of prompts where the business is mentioned, vs each competitor.
- Identify which sources AI engines cite (Yelp, BBB, Reddit, local news, competitor sites) → those become citation targets in solutions.
- Note in the report: AI answers vary run to run; show date + engine + prompt for every result.

### Step 8 — Off-site & authority
- Backlink count, referring domains, local links, vs competitors
- Social profiles: exist? active? linked from site?
- Brand mentions (unlinked), local press, Reddit threads mentioning the business or category in the city

### Step 9 — Analysis engine
- **Rules layer first** (deterministic checks in `/lib/checks/*`, each with: id, category, detection logic, severity rule, evidence builder). Target 150+ checks across categories.
- **LLM layer second:** Claude reviews the gathered evidence to catch things rules can't (weak copy, unclear value prop, trust gaps, bad review-response tone, content gaps). LLM findings must reference evidence IDs; reject any finding without evidence.
- Dedupe + merge overlapping findings.
- Score each category 0–100 and an overall **Visibility Score** and **Conversion Score**. Scoring weights live in a config file with unit tests.

### Step 10 — Revenue-loss model (the "how much you're losing" number)
Must be **transparent, conservative, and range-based**. Never a single precise number.

For each tracked keyword:
```
lost_clicks  = monthly_search_volume × (CTR_at_target_position − CTR_at_current_position)
lost_leads   = lost_clicks × lead_conversion_rate
lost_revenue = lost_leads × close_rate × avg_ticket
```
Plus conversion leaks on existing traffic (slow site, no click-to-call, no booking) using published benchmark ranges, and review-gap impact.

- All assumptions (CTR curve by map position, conversion rate, close rate, avg ticket) are **editable by admin per audit**, with industry defaults in a config table with sources noted.
- Output low / mid / high. Show assumptions in a collapsible "How we calculated this" panel on the client report.
- Also show **ad-equivalent value**: lost clicks × keyword CPC = "what you'd pay Google Ads for the traffic you're missing."
- Attribute estimated loss to specific findings so each problem shows its own $ range.
- Unit-test the model with fixed fixtures.

### Step 11 — Solution generation (vault only)
For every finding, generate a solution record:
- Step-by-step fix (specific to THIS business, not generic)
- Ready-to-use assets: rewritten title/meta tags, H1s, GBP description (within char limits), recommended categories, service page outlines + full content briefs, FAQ Q&As, JSON-LD code blocks (validated), image alt texts + filenames, review-request message templates (SMS/email), review-response templates (positive + negative), citation-submission list with URLs
- Time estimate, difficulty, tool needed, my suggested price
- Priority rank by (estimated $ impact ÷ effort) → auto-built **30/60/90-day roadmap**
- **Growth ideas** section (not tied to a finding): e.g., seasonal campaigns, partnership ideas, content angles, Google LSA eligibility, referral program, local sponsorships, short-form video ideas based on the business's services

---

## 5. UI

### Admin
- `/admin` — dashboard of all audits (status, scores, $ loss mid, last client view, cost)
- `/admin/audits/new` — paste inputs, optional service area/ticket size/keyword edits, "Run audit" → live progress screen with step list
- `/admin/audits/[id]` — tabs: Overview · Findings · **Solution Vault** · Competitors · Rank Grid · AI Visibility · Revenue Model (editable assumptions → recompute) · Raw Evidence · Share & Unlock
- Unlock panel: toggle reveal per solution, per category, or "reveal all"; preview exactly what the client will see
- Bulk mode (later phase): upload CSV of prospects → queue audits → prospect list sorted by $ loss

### Client report (`/r/[token]`)
Design goals: a busy owner understands it in 60 seconds on a phone.
1. **Hero:** business name, overall score gauge, big "Estimated revenue you're missing: $X–$Y / month" with "How we calculated this" link
2. **Top 5 biggest problems** (cards: plain-English title, why it matters, $ range, severity color, evidence thumbnail)
3. **Where you show up vs. competitors:** map rank heat-grid, side-by-side table (rating, reviews, review velocity, photos, AI mentions)
4. **AI search check:** "When people ask ChatGPT/Google AI for {service} in {city}…" — engine-by-engine: shown / not shown, who's shown instead
5. **Full problem list** grouped by category (Google Profile · Website · Speed & Mobile · AI Search Readiness · Reviews & Reputation · Listings Across the Web · Content & Keywords · Images · Conversion), each expandable with evidence (screenshots, exact text found)
6. For each problem: **Impact** and **Fix difficulty** badges. If unrevealed: "Solution available — contact us" CTA. If revealed: show the solution in simple step format.
7. **CTA** footer: book a call / reply / phone (configurable)
8. Download PDF button
- No jargon without a one-line explanation (e.g., "Schema markup = hidden labels that help Google and AI understand your business").
- Mobile-first, fast, accessible (WCAG AA).
- Track views per section (for sales follow-up timing).

### Branding
White-label settings: my agency name, logo, colors, contact CTA, custom domain for report links.

---

## 6. Build phases

| Phase | Deliverable | Done when |
|---|---|---|
| 0 | Repo, Next.js, Supabase, auth (admin role), env config, provider adapter pattern with mocks, CI running tests | `npm test` passes, admin can log in |
| 1 | Input resolver (GBP link/Yelp URL/website → canonical entity) + NAP cross-check | 5 real test businesses resolve correctly |
| 2 | Website crawler + PSI + screenshots + technical/on-page/schema/image/conversion checks | Crawl report JSON for test sites |
| 3 | GBP + Yelp + reviews analysis + competitor discovery | Competitor table populated |
| 4 | Keyword research + organic rank + geo-grid scan + heat map | Grid renders on map |
| 5 | AI visibility module across all engines + share of voice | Per-engine results with evidence |
| 6 | Citations/NAP + backlinks/off-site | Directory table populated |
| 7 | Analysis engine (rules + LLM), scoring, revenue model with tests | Scores + $ ranges reproducible from fixtures |
| 8 | Solution generator + vault UI + roadmap | Every finding has a solution |
| 9 | Client report UI + share links + unlock controls + access-control tests + PDF | Leak tests pass |
| 10 | White-label, view tracking, bulk prospect mode, cost meter, re-audit/compare-over-time | Before/after comparison works |
| 11 | Optional OAuth: GBP Performance, Search Console, GA4 for real data | Real metrics replace estimates when connected |

---

## 7. Non-negotiables & edge cases
- Handle: no website, website on Wix/Squarespace/GoDaddy builders, service-area businesses with hidden address, multi-location businesses (pick location), businesses not on Yelp, non-English sites, sites blocking bots (report it, don't bypass protections).
- Respect robots.txt for crawling; identify the crawler with a user agent; rate-limit.
- Don't store full Yelp review text or Google review text longer than provider terms allow; store derived metrics + short excerpts.
- No fabricated claims in client reports. Every $ figure is labeled "estimate" with its range and assumptions.
- Re-running an audit creates a new version; keep history for before/after proof.
- Log total API cost per audit and warn if it exceeds a configurable budget.

---

## 8. Start now
Begin with Phase 0. Show me the plan in `docs/phases/phase-0.md`, list every env var / API account I need to create (with signup links), then build it.
