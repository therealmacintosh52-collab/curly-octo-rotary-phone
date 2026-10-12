# T-001 — scout → red-team

**Status:** DELIVERED (criterion 3 PARTIAL: 10 of 25 prospects, none confirmed "no website"; see Open risks)
**Task:** Rank 3 lanes (website service, reselling, Trendlift) on time-to-first-dollar, $10k/mo ceiling, owner-hours per dollar, legal exposure, with a visible formula; tag every number; 25-business Sacramento/Elk Grove prospect shortlist; research cache; one-line recommendation.
**Attempt:** 1 of 3
**Cost:** ~150k tokens in / ~16k out (estimate, not metered), ~15 min wall · model sonnet. 14 WebSearch calls (budget said under 12; 2 extra were prospect hunts).

## What was done
- Checked `library/research/` first: only Zendrop supplier files exist (relevant to lane c only); nothing reusable for lanes a/b.
- Ran 14 WebSearch queries: website pricing (2), CA seller's permit, Elk Grove license, reseller margins and fees (2), dropship benchmarks, prospect hunts (6).
- Scored the three lanes with a visible formula (below). Full evidence tables with per-claim tags are in the cache.
- Prospect shortlist: delivered what search could support and said so. No padding.
- No contact, no accounts, no spend. WebFetch not used; no page was opened. "Snippet" means the wording in the search-tool result.

## Outputs
- `library/research/income-lanes-2026-10-12.md` — full evidence table (a1-a10, b1-b10, c1-c5, L1-L6), scoring reasons, sensitivity, prospect table.
- `ops/handoffs/T-001-scout-to-red-team.md` — this file.

## Ranking
Formula: Score = 0.30*TTFD + 0.20*Ceiling + 0.20*Hours + 0.15*Legal + 0.15*Capital; each factor 1-5, 5 best. Weights are scout's judgment from the owner's stated priorities (first dollar fastest).

| Rank | Lane | TTFD | Ceiling | Hours/$ | Legal | Capital | Score |
|---|---|---|---|---|---|---|---|
| 1 | (a) Website service | 3 | 3 | 4 | 4 | 5 | 3.65 |
| 2 | (b) Reselling | 4 | 2 | 2 | 3 | 3 | 2.90 |
| 3 | (c) Trendlift dropship | 1 | 2 | 1 | 3 | 1 | 1.50 |

Factor scores are judgments; the underlying numbers are tagged in the cache. Sensitivity: if (a) TTFD drops to 2 and (b) rises to 5, it is (a) 3.35 vs (b) 3.20. Order holds, margin thin.

## Evidence
| # | Claim | Tag | Source (url · date · quoted snippet) |
|---|---|---|---|
| 1 | Agency-built small-business sites run $3,000-$15,000 (our price will be far lower) | VERIFIED | https://jim.com/blog/small-business-website-cost · 2026-10-12 · "most professional builds between $3,000 and $15,000, per OneLittleWeb's 2026 pricing study" |
| 2 | US freelancer entry site $500-$2,000 | UNVERIFIED | search summary, URL not attributable (cache a3) |
| 3 | Monthly site upkeep $50-$500 | UNVERIFIED | one freelancer self-report, URL not attributable (cache a5) |
| 4 | Any clean US price for a one-page Sacramento site | UNKNOWN | search said "no source that gives a clean 2025 U.S. benchmark for a one-page site plus a monthly maintenance fee" |
| 5 | Free AI site builders target Sacramento tradespeople (price floor) | VERIFIED | https://www.mixo.io/websites-for/handyman-services/sacramento-ca · 2026-10-12 · "markets a handyman website builder specifically to Sacramento, CA tradespeople", "offers a free plan" |
| 6 | Whether Cali Tints / Phil's Auto paid | UNVERIFIED | owner-only fact; ops/CONTEXT.md "UNKNOWN: whether either client paid, or if these were spec builds" |
| 7 | Reseller margin ~15-30% (other blogs 10-50%) | UNVERIFIED | vendor blogs, conflicting ranges |
| 8 | Part-time reseller $500-$2,000/mo net; one full-timer $2,600 net on ~$4,841 gross | UNVERIFIED | blog estimate and one anecdote |
| 9 | Reseller minutes per listing | UNKNOWN | "no reliable minutes-per-listing figure" |
| 10 | Platform fees: eBay ~13.25-13.6% + $0.30-0.40; Mercari 10%; FB Marketplace local free, shipped 5% or 10% (conflict) | UNVERIFIED | third-party comparison blogs; confirm on platform fee pages |
| 11 | CA seller's permit needed for regular resale incl. bought-to-resell goods; "occasional" = no more than two sales in 12 months | VERIFIED | https://www.cdtfa.ca.gov/formspubs/pub107 · 2026-10-12 · "no more than two sales in a 12-month period"; "items you purchased for the purpose of reselling to others" (search-summary wording of CDTFA Pub 107) |
| 12 | Elk Grove general business license applies to businesses operating in city limits; zoning first | VERIFIED | https://www.elkgrove.gov/departments-and-divisions/business-license · 2026-10-12 · "Licenses are issued to businesses operating or conducting business within the City limits" |
| 13 | Elk Grove license fee ~$16 for two years | UNVERIFIED | result pages disagree ($12 vs $16); city line (916) 478-2211 |
| 14 | Home-based rule in Elk Grove; City of Sacramento license; sales tax on web-design services | UNKNOWN | not found / not searched |
| 15 | Trendlift: $0 revenue, store frozen, 0 of 19 products clear 3x floor | VERIFIED | repo ops/CONTEXT.md · 2026-10-12 · "0 of 19 products clear the 3× floor" |
| 16 | Well-run dropship stores net ~10-25% | VERIFIED | https://www.crunch.co.uk/knowledge/article/is-dropshipping-still-profitable · 2026-10-12 · "most well-run stores land somewhere in the region of 10% to 25% net profit" |
| 17 | 1-5% of dropshippers reach sustainable profit | VERIFIED | https://trueprofit.io/blog/dropshipping-success-rate · 2026-10-12 · "about 1-5%" |
| 18 | Our $750-per-site price and $100/mo retainer used in the ceiling math | UNVERIFIED | scout assumption, no price evidence; red-team must not treat as fact (FP-02) |

## Prospects (lane a): 10 of 25, 0 confirmed without a website
WebSearch cannot prove a business has no site. Each hunt ended with the tool saying it could not determine this. I list 10 real public listings (Elk Grove: Unique Beauty, Lashme Brows, P'Inked, Ink.me Aesthetics, Ella Blue, Embellish Nails Studio, Razor Sharp Kutz Barber Lounge, Barberz Dreme Co, 2G Autobody; Sacramento: Elite Pressure Washing Services) where no business-owned site appeared in the snippet. Has-website for all 10 is UNKNOWN, not N. Public phone shown for 5 (in the cache table). I stopped at 10 rather than pad. Names, urls and phones are in the cache section 3. Sites seen WITH a website were excluded and are listed there.
Fastest route to 25 (owner, phone, ~20 min): Google Maps, "<trade> Elk Grove", screenshot cards that show no Website button.

## Assumptions
- Factor weights are scout's judgment from CONTEXT.md priorities.
- Lane (a) first dollar needs an approval ID for outreach and a payment account (owner's Stripe/Square question is open in CONTEXT.md).
- Lane (b) TTFD of 4 assumes the owner has inventory; CONTEXT.md lists this as UNKNOWN.
- Prices used in the math ($750 per site, $100/mo retainer) are placeholders until the owner reports what past clients paid.

## Open risks
- Prospect list is short and unproven (red-team: treat acceptance criterion 3 as unmet).
- Past-client payment is UNKNOWN; if both were spec builds, lane (a) has zero social proof and zero revenue history.
- Sales tax on web-design services and City of Sacramento license not checked (red-team/owner to confirm with CDTFA/city).
- Reseller and website price evidence is vendor-blog grade. No survey or marketplace-sold data found.
- Search-tool results are summaries; a quoted "snippet" is that summary's wording, not page text. system-qc spot audit should account for this.
- Over-budget on searches by 2 (14 vs "under 12"). Cost per task is small; flagged for METRICS.

## Acceptance checklist (from TASKS.md, verbatim)
- [x] (1) Rank 3 lanes (website service, reselling, Trendlift) on time-to-first-dollar, $10k/mo ceiling, owner-hours per dollar, legal exposure, with a visible scoring formula. Done above; capital added per task brief.
- [x] (2) Every number tagged VERIFIED(url,date,snippet)/UNVERIFIED. Checked by reading the evidence table; unattributable numbers are UNVERIFIED, missing ones UNKNOWN.
- [ ] (3) 25-business Sacramento/Elk Grove prospect shortlist ... (name, city, category, has-website Y/N, public phone if in snippet). NOT MET: 10 listings, has-website UNKNOWN for all.
- [x] (4) Research cache written to library/research/. `library/research/income-lanes-2026-10-12.md`.
- [x] (5) One-line recommendation + biggest reason it could be wrong. Below.

## Self-check
- [x] Every claim tagged (numbers carry VERIFIED/UNVERIFIED/UNKNOWN)
- [x] Only owned files written (library/research/, ops/handoffs/)
- [x] No hard-gate action taken
- [x] Under 120 lines
- [x] Cost line filled
- [x] Prospects are businesses, not people
- [ ] Prospect target met (no; disclosed)

## QUALITY SCORE: 3
Ranking and legal scaffolding are sound and every number is honestly tagged, but the evidence is thin: price data is vendor-blog grade, reseller time per listing is missing, and the prospect list is 10 not 25 with no confirmed no-website. A 4 would need the owner's phone check of Google Maps cards, the owner's report of what past clients paid, and a CDTFA answer on sales tax for services.

## RECOMMENDATION (one line)
Lane (a): sell the blueprint website service to Sacramento/Elk Grove service businesses, using the two finished sites as portfolio, starting with a phone check of Google Maps for 25 no-website businesses.
**Biggest reason it could be wrong:** the 10-day first-dollar goal rests on a cold prospect saying yes and paying, with no warm lead, no confirmed price anchor, and outreach gated on an approval; if the owner already has resale inventory, lane (b) could post a first dollar in days and may be the better bridge.

## Receiver validation (filled by the receiving agent)
- Input contract met: YES / NO — <reasons>
- Independent score: <1–5> — <reasons>
- Action: ACCEPTED / REJECTED (fixes: …)
