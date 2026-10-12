# T-008 — scout → red-team

**Status:** DELIVERED
**Task:** D-020 widened ideation: 20 new ideas I-021..I-040 from real-income evidence; fix INC-004 (r1-r3); new cache; handoff with top-7 guess
**Attempt:** 1 of 3
**Cost:** ~190k in / ~32k out tokens est., ~25 min wall · model sonnet · 12 WebSearch (cap 12). Cash spent $0.
**Tools used:** Read, Grep, Glob, WebSearch, Write (all inside the scout list; no WebFetch, no Bash, no Edit)

## What was done
Read PROTOCOL, CONTEXT, D-020, failure patterns FP-07/FP-08, IDEAS, caches. Ran 12 searches aimed at operator income reports and marketplace prices. Appended I-021..I-040 to `ops/IDEAS.md`, fixed r1-r3, wrote the cache and README index. Contacted no one, created no account, spent nothing.
**Headline: the owner's preferred evidence class did not surface.** 2 of 12 searches targeted Reddit income threads (r/Flipping, r/sidehustle); the tool returned zero Reddit threads, only vendor blogs, a lending-app page and course pitches. No Google Trends, no Etsy/Fiverr sales counts, no local Craigslist demand counts. What I could verify: customer-side prices for local services (TaskRabbit, Dropcurb, Thumbtack), freelance listing prices, and reseller fee/margin claims with conflicts. **Demand (someone paid) is UNKNOWN for all 20 ideas.** Ranking below is of price-anchor strength and gate-freeness, not proven income.

## Outputs
- `ops/IDEAS.md` — I-021..I-040 appended; legend gains [NF], [AC], T-008 caution; r1-r3 tagged.
- `library/research/what-works-2026-10-12.md` — W1-W18 evidence table + "searched and found nothing" list.
- `library/research/README.md` — index row added.

## Coverage vs the brief
- Lanes: A = I-021..I-028 (8) · B = I-029..I-040 (12). Lane A rows I-021 may slip to B (platform onboarding time UNKNOWN).
- Lenses: Speed 021, 039 · Contrarian 022, 025, 037 · Arbitrage 023, 033, 034, 035, 036 · Pain mining 027, 032 · Bundling 024, 031, 038 · Picks-and-shovels 026, 029, 040 · Repackage 028, 030. Every lens at least twice.
- No site / no custom rail / no license known (tag [NF], all need [AC]): I-021, 029, 030, 031, 032, 038, 040 (7). License need for solo gig income is UNVERIFIED, not searched.
- Local-business shovels: 026, 029, 031, 038, 039. Info arbitrage: 023, 028, 034, 035, 036. Freelance-platform AI micro-services: 029, 030, 032, 039, 040. Boring/contrarian: 022, 025, 037 (+021, 024).
- Sneaker comps: not searched, so no sneaker row (evidence did not exist to support one).

## Ranking (formula)
Score = 0.35 E + 0.25 S + 0.20 H + 0.20 G, each 0-5. E = strength of VERIFIED price/demand anchor (5 = operator-reported paid income; 3 = platform customer price; 1 = nothing). S = chance of first dollar inside the lane window (account approval, outreach and shipping lower it). H = dollars per owner hour (physical, edit-heavy or per-item work lowers it). G = gate-freeness (0 = needs permit/spend/outreach/license, 5 = none). All E/S/H/G values are scout ASSUMPTIONS from the evidence tags; this is a guess for red-team to overwrite.
| I | idea | E | S | H | G | score | | I | idea | E | S | H | G | score |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 021 | Tasker assembly | 4 | 3 | 3 | 4 | 3.55 | | 031 | Etsy niche kits | 3 | 2 | 3 | 4 | 2.95 |
| 030 | AI-search gig | 3 | 2 | 4 | 4 | 3.15 | | 032 | resume gig | 3 | 2 | 3 | 4 | 2.95 |
| 022 | haul-away | 3 | 4 | 3 | 2 | 3.05 | | 029 | food video gig | 3 | 2 | 3 | 4 | 2.95 |
| 024 | assemble+haul | 3 | 3 | 3 | 3 | 3.00 | | 038 | Gumroad bundle | 2 | 2 | 4 | 4 | 2.80 |
| 039 | Upwork GBP | 3 | 2 | 4 | 3 | 2.95 | | 023 | free-to-sell | 2 | 4 | 3 | 2 | 2.70 |
| 040 | reseller photos | 2 | 2 | 3 | 4 | 2.60 | | 026 | local Reels | 2 | 3 | 2 | 2 | 2.45 |
| 025 | pressure wash | 2 | 3 | 2 | 2 | 2.25 | | 033 | phone flip | 3 | 2 | 2 | 1 | 2.15 |
| 035 | thrift triage | 3 | 2 | 2 | 1 | 2.15 | | 028 | comps check | 1 | 3 | 2 | 3 | 2.10 |
| 027 | listing concierge | 1 | 3 | 2 | 2 | 1.90 | | 034 | estate tool flip | 2 | 2 | 2 | 1 | 1.80 |
| 036 | card lots | 2 | 2 | 2 | 1 | 1.80 | | 037 | lead referral | 1 | 2 | 3 | 1 | 1.65 |
Ties at 2.95 broken by evidence that the category sells (031 named best-seller, 032 many sellers + Contra $250, 039 has agency anchors) over 029 (client must supply footage; 10 gig pages = crowded).

## Top-7 guess and the biggest reason each could be wrong
1. **I-021 Tasker (3.55):** onboarding/background check may take longer than 72 h or pay far below the $35/hr customer price after the platform cut (W6 is a customer price; payout UNKNOWN).
2. **I-030 AI-search gig (3.15):** a $25-$99 listing exists but no sale count was seen (W16), and a new seller has no reviews; also agents cannot fetch sites (E13) so each order costs owner screenshot time.
3. **I-022 haul-away (3.05):** needs a vehicle and dump fees the owner may lack (UNKNOWN) and Dropcurb's $59-$119 is a competitor's own estimate; hauling registration is UNVERIFIED.
4. **I-024 assemble+haul (3.00):** same vehicle unknown; bundle demand is invented by scout from two separate prices.
5. **I-039 Upwork GBP (2.95):** Upwork Connects/fees and account status UNKNOWN; GBP pack buyers on a bidding platform may expect $25 gigs.
6. **I-032 resume gig (2.95):** the Fiverr resume niche is saturated (10 listings returned in one search) and ranks by reviews a new seller lacks; client personal data handling needs red-team's view.
7. **I-031 Etsy niche kits (2.95):** "named best-seller" is a seller-education blog, not sales data, and price ranges were unmapped; Canva commercial-use limits are UNVERIFIED.
Losers worth a look: I-023 (fast, but [SP] and contacting private sellers) and I-038 (free to build, but price anchor is agency work, not a $29 buyer).

## Evidence
All 18 evidence rows (W1-W18) with URL, date and quoted snippet are in `library/research/what-works-2026-10-12.md`; each IDEAS row carries its inline tag. Tool summaries were not page text; where a summary did not name the page, the tag is UNVERIFIED and says so.
| # | Claim | Tag | Source |
|---|---|---|---|
| 1 | Sacramento IKEA assembly customer price from $52 | VERIFIED | https://www.taskrabbit.com/locations/sacramento/assemble-ikea-furniture · 2026-10-12 · "Prices begin at a $52" |
| 2 | Sacramento furniture removal $59-$119 | VERIFIED | https://dropcurb.com/cost/furniture-removal/sacramento-ca · 2026-10-12 · "$59 to $119" |
| 3 | No Reddit operator income threads surfaced | VERIFIED as an absence | 2 searches, 2026-10-12, zero reddit.com thread URLs in either result list (one mirror of a Craigslist free-items thread appeared in search 9) |
| 4 | Self-reported flipper income ($65K, $5,630/mo) | UNVERIFIED as income | pages exist (W1, W2) but figures are author claims; one author admits early losses |

## Assumptions
- Every E/S/H/G score, minute figure and test price is a scout ASSUMPTION. "Gate-free" means no gate that evidence shows; license need for gig income is UNVERIFIED.
- Platform fees, onboarding times, listing costs and Tasker payouts are UNKNOWN (not searched).

## Open risks
- Evidence gap (red-team, Orchestrator): the ranking rests on asking prices. A cheap next step is owner-side: open the Fiverr/Etsy/TaskRabbit apps on the phone and screenshot review counts and "orders in queue" for 3 target listings (5 min, no account needed to browse is UNVERIFIED).
- Permit [SP] (red-team): I-023, 033-036 resell goods; seller's-permit registration is a hard gate.
- Cosmetic: the new rows' "red-team verdict" column reads "queued" because scout cannot Edit rows after writing; scribe should blank it when copying verdicts.
- FP-02/FP-08 self-check: no go-decision number in these rows is untagged; the one place I paraphrased a summary (W1 "$850 weekend", "$170-220") I left out of the IDEAS rows and kept UNVERIFIED in the cache.
- Incident for system-qc: none new. INC-004 fixed (below).

## INC-004 fix (r1-r3), all in `ops/IDEAS.md`
- r1 "pagespeed.web.dev (no login)" in I-009 and I-019 → "no login: UNVERIFIED r1, the tool's login behaviour was not searched".
- r2 "in-app instant quotes (no spend)" in I-016 → "\"instant\" and \"no spend\": UNVERIFIED r2, trade-in terms not searched".
- r3 "drop-off stores refuse" in I-015 → "UNVERIFIED r3: cache E2c exists but is not cited on this row".
- Verification (different agent): red-team or system-qc to grep `UNVERIFIED r1|r2|r3` in IDEAS.md (4 hits expected). No other text in I-001..I-020 was changed.

## Acceptance checklist (from the T-008 brief)
- [x] 20 ideas I-021..I-040, no duplicates of I-001..I-020 — overlap noted: I-021..028 vs I-013 (owned-item sale) is distinct; I-030 repackages I-009 for a platform
- [x] ≥8 Lane A (8), ≥8 Lane B (12), all seven lenses ≥2 (counts above)
- [x] ≥6 ideas needing no site / custom rail / license (7, license caveat UNVERIFIED)
- [x] picks-and-shovels, info arbitrage, platform AI micro-services, ≥3 boring/contrarian (listed above)
- [x] each row: lens, lane, payer and price tagged, phone steps, evidence tag; minutes are ASSUMPTIONS (legend)
- [x] VERIFIED = URL + date + quote; max 12 WebSearch (12 used)
- [x] INC-004 r1-r3 tagged UNVERIFIED
- [x] cache written + README index updated
- [x] under 120 lines, tools line, top-7 with reasons, scored per D-013

## Self-check
- [x] Every claim tagged · [x] Only owned files written (IDEAS.md, library/research/*, this handoff) · [x] No hard-gate action taken · [x] Under 120 lines · [x] Cost line filled

## QUALITY SCORE: 4
Tags are per-row, unmapped summary figures are marked UNVERIFIED, and the absent Reddit evidence is stated up front. Not a 5: the evidence class the owner prioritized did not surface, 6 of 20 rows have payer UNKNOWN, and my E/S/H/G scores are judgement. Per D-013 the owner-gated unknowns (account approvals, vehicle, rail) do not lower this score. What would make it a 5: one search round that returns real sold/review counts for Fiverr, Etsy or TaskRabbit-type listings.
