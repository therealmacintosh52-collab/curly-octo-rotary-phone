# T-008 — scout → red-team

**Status:** DELIVERED
**Task:** D-020 widened ideation: 20 new ideas I-021..I-040 from real-income evidence; fix INC-004 (r1-r3); new cache; handoff with top-7 guess
**Attempt:** 2 of 3 (attempt 1 REJECTED by red-team, `ops/handoffs/T-008-red-team-to-scout.md`, F1-F12; scope of this pass = tag edits only, per the fixed bar)
**Cost:** attempt 2 ~120k in / ~40k out tokens est., ~15 min wall · model sonnet · 0 new WebSearch (attempt 1 used 12 of 12). Cash spent $0. Large share of output tokens is the full rewrite of IDEAS.md because scout has no Edit tool (ASSUMPTION on cost split).
**Tools used:** Read, Grep, Glob, Write (attempt 2: no WebSearch; all inside the scout list; no WebFetch, no Bash, no Edit)

## What was done (attempt 2)
Read the rejection, PROTOCOL §1, FP-07..FP-09, D-013, D-023, my handoff, IDEAS I-021..I-040, the cache. Applied F1-F12, then swept every sentence of I-021..I-040, the cache W1-W18 and this handoff under D-023 (platform-behaviour phrases, market-size words, search observations). Rewrote `ops/IDEAS.md` (rows I-001..I-020 byte-for-byte unchanged; legend and I-021..I-040 edited) and `library/research/what-works-2026-10-12.md` in place. Contacted no one, created no account, spent nothing.
**Headline (unchanged): the owner's preferred evidence class did not surface.** Reddit operator-income threads were not seen in the result lists of the 2 targeted searches (UNVERIFIED as an absence; see F14). **Demand (someone paid) is UNKNOWN for all 20 ideas.** The ranking below ranks price-anchor strength and gate-freeness, not proven income.

## Fixes applied, one line each
- F1 I-029: crowding inference deleted; "Saturation UNVERIFIED (WebSearch result-list size, not a platform count; FP-09)". Handoff tie-break text rewritten.
- F2 I-032: "many sellers returned (saturated)" → same UNVERIFIED wording. Handoff top-7 item 6 rewritten.
- F3 I-025: "many Thumbtack profiles seen" → "competition density UNKNOWN (no platform count seen)". W8 now says "number of profiles UNKNOWN".
- F4 I-040 and W5: price kept VERIFIED ("Up to $50"); "Crowding UNVERIFIED" is a separate clause.
- F5 I-034 and W12: "can take months" → UNVERIFIED (tool summary, no mapped URL).
- F6 I-035: "ship times push to 7-14 d" → "ship time of 7-14 d: ASSUMPTION".
- F7 I-039: inline quotes+URLs added (coloradowebimpressions, slashpost, Upwork listing, CONTEXT line 24 connector row).
- F8 I-028 and W12: flatware example downgraded to UNVERIFIED (no URL or quote maps to it) in both places.
- F9 all 7 [NF] rows (021, 029, 030, 031, 032, 038, 040), I-024 and the [NF] legend: "Payout timing and setup UNVERIFIED (not searched); payout setup = payment info, a §2 hard gate". New cache row W19.
- F10 I-028: "[SP] not needed: UNVERIFIED (inference)"; eBay sold filter on the phone: ASSUMPTION (owner's reselling domain).
- F11 I-023: added the "r/SacramentoBuyNothing" quote with the URL; snapshot 2026-05-01 stale 2026-11-01 stated in the row and W14; volume and sellability UNKNOWN.
- F12 self-check "Every claim tagged" is ticked at the bottom only after the sweep below.

## Further defects found in my own sweep (F13+), all fixed
- F13 Arithmetic: I-026 score printed 2.45; E2 S3 H2 G2 = 0.70+0.75+0.40+0.40 = 2.25. Table corrected (ties I-025; no rank change above it). All other 19 scores re-computed and match.
- F14 "VERIFIED as an absence" (old evidence row 3) has no quote that can state an absence → UNVERIFIED. Same fix in IDEAS legend ("did not surface in 12 searches" was also wrong: 2 searches were targeted) and cache headline.
- F15 Cache rows with unquoted extras tagged UNVERIFIED: W3 "$500 month may be $180", W4 "$25"/"$80" listings, W7 "$74, +$29", W9 "mostly $50-$100", W10 "social-media templates", W11 "50-80%". W18 gained the "two sales in 12 months" quote (found in I-013 / income-lanes b8).
- F16 I-029: "restaurants" as payer is not in the quoted snippet → "Buyers named in the listing text: ads, promo, YouTube; restaurants UNVERIFIED". "Client supplies footage" and "phone editing" tagged.
- F17 I-031: "named best-seller" overstated the quote → "listed in a top-sellers post" with the URL slug and snippet.
- F18 VERIFIED rows that cited "W6/W7/W14" without URL (I-024, I-027) now carry URL+date+quote inline. I-030 E13 now has date+quote.
- F19 Platform-behaviour phrases tagged: Canva phone app can build sellable templates (I-031), phone video editor (I-026, I-029), background-clean tool (I-040), Project Catalog name (I-039), platform AI-work policy (legend [AC], new cache row W20), Tasker app allowing a bundle (I-024).
- F20 Judgement phrases tagged ASSUMPTION: I-021 "not scalable", I-026/I-027 "hours per dollar poor", I-022 "estimate" description, I-033/I-036 supply UNKNOWN, I-037 "no inbound source".
- F21 This handoff: "a new seller has no reviews" / "ranks by reviews" / "may expect $25 gigs" / "client must supply footage" tagged ASSUMPTION or UNVERIFIED below.
- F22 I-022 now cites red-team L11 (hauling rules UNVERIFIED); I-023 [SP] sentence rewritten so the VERIFIED quote and the UNVERIFIED inference are separate.

## Coverage vs the brief (unchanged by attempt 2)
- Lanes: A = I-021..I-028 (8) · B = I-029..I-040 (12). I-021 may slip to B (onboarding time UNKNOWN).
- Lenses: Speed 021, 039 · Contrarian 022, 025, 037 · Arbitrage 023, 033-036 · Pain mining 027, 032 · Bundling 024, 031, 038 · Picks-and-shovels 026, 029, 040 · Repackage 028, 030. Every lens at least twice.
- [NF] rows (no site, no payment rail of our own, no license KNOWN): 021, 029, 030, 031, 032, 038, 040 (7). All need [AC]; payout setup is a payment-info hard gate (F9); license need UNVERIFIED (red-team L8a).
- Sneaker comps: not searched, so no sneaker row.

## Ranking (formula)
Score = 0.35 E + 0.25 S + 0.20 H + 0.20 G, each 0-5. E = strength of VERIFIED price/demand anchor (5 = operator-reported paid income; 3 = platform customer price or listing price; 1 = nothing). S = chance of first dollar inside the lane window. H = dollars per owner hour. G = gate-freeness (0 = needs permit/spend/outreach/license, 5 = none). All E/S/H/G values are scout ASSUMPTIONS from the evidence tags; no re-scoring was done beyond F13.
| I | idea | E | S | H | G | score | | I | idea | E | S | H | G | score |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 021 | Tasker assembly | 4 | 3 | 3 | 4 | 3.55 | | 031 | Etsy niche kits | 3 | 2 | 3 | 4 | 2.95 |
| 030 | AI-search gig | 3 | 2 | 4 | 4 | 3.15 | | 032 | resume gig | 3 | 2 | 3 | 4 | 2.95 |
| 022 | haul-away | 3 | 4 | 3 | 2 | 3.05 | | 029 | food video gig | 3 | 2 | 3 | 4 | 2.95 |
| 024 | assemble+haul | 3 | 3 | 3 | 3 | 3.00 | | 038 | Gumroad bundle | 2 | 2 | 4 | 4 | 2.80 |
| 039 | Upwork GBP | 3 | 2 | 4 | 3 | 2.95 | | 023 | free-to-sell | 2 | 4 | 3 | 2 | 2.70 |
| 040 | reseller photos | 2 | 2 | 3 | 4 | 2.60 | | 026 | local Reels | 2 | 3 | 2 | 2 | 2.25 |
| 025 | pressure wash | 2 | 3 | 2 | 2 | 2.25 | | 033 | phone flip | 3 | 2 | 2 | 1 | 2.15 |
| 035 | thrift triage | 3 | 2 | 2 | 1 | 2.15 | | 028 | comps check | 1 | 3 | 2 | 3 | 2.10 |
| 027 | listing concierge | 1 | 3 | 2 | 2 | 1.90 | | 034 | estate tool flip | 2 | 2 | 2 | 1 | 1.80 |
| 036 | card lots | 2 | 2 | 2 | 1 | 1.80 | | 037 | lead referral | 1 | 2 | 3 | 1 | 1.65 |
Ties at 2.95 broken by a VERIFIED price anchor that maps to a named category listing or agency page (039 has two agency pages; 031 category listed in a top-sellers post) over 029 (client must supply footage: ASSUMPTION). 032 sits with them on the Contra $250 listing. Crowding is not used as a tie-break (FP-09).

## Top-7 guess and the biggest reason each could be wrong
1. **I-021 Tasker (3.55):** approval may take longer than 72 h, or payout after the platform cut may be far below the $35/hr customer price (W6 is a customer price; payout UNVERIFIED).
2. **I-030 AI-search gig (3.15):** a $25-$99 listing exists but no sale count was seen (W16); a new seller may have no reviews (ASSUMPTION about platform behaviour); agents cannot fetch sites (E13) so each order costs owner screenshot time.
3. **I-022 haul-away (3.05):** needs a vehicle and dump fees the owner may lack (UNKNOWN); Dropcurb's $59-$119 is a vendor guide estimate (UNVERIFIED description); hauling rules UNVERIFIED (L11).
4. **I-024 assemble+haul (3.00):** same vehicle unknown; bundle demand is composed by scout from two separate prices (UNKNOWN).
5. **I-039 Upwork GBP (2.95):** Upwork Connects/fees and account status UNKNOWN; GBP buyers on a bidding platform may expect gigs priced like the $25 AI-check (ASSUMPTION).
6. **I-032 resume gig (2.95):** Fiverr-side saturation and review-ranking effects are UNVERIFIED (not counted; platform behaviour not searched); client personal data handling needs red-team's view.
7. **I-031 Etsy niche kits (2.95):** the evidence is "category appears in a top-sellers blog list", not sales data; price ranges were unmapped; Canva commercial-use limits UNVERIFIED.
Losers worth a look: I-023 (fast, but [SP] and contacting private sellers) and I-038 (free to build, but the price anchor is agency work, not a $29 buyer).

## Evidence (full table with URL, date, quote: `library/research/what-works-2026-10-12.md`, W1-W20)
| # | Claim | Tag | Source |
|---|---|---|---|
| 1 | Sacramento IKEA assembly customer price from $52 | VERIFIED | https://www.taskrabbit.com/locations/sacramento/assemble-ikea-furniture · 2026-10-12 · "Prices begin at a $52" |
| 2 | Sacramento furniture removal $59-$119 | VERIFIED | https://dropcurb.com/cost/furniture-removal/sacramento-ca · 2026-10-12 · "$59 to $119" |
| 3 | No Reddit operator income threads surfaced | UNVERIFIED as an absence | 2 targeted searches, 2026-10-12; a result list is not exhaustive (F14) |
| 4 | Self-reported flipper income ($65K, $5,630/mo) | UNVERIFIED as income | pages exist (W1, W2), figures are author claims |
| 5 | Platform payout timing, method, setup (Fiverr, Etsy, Upwork, Gumroad, TaskRabbit) | UNVERIFIED (not searched) | W19; setup = payment info, §2 hard gate |

## Assumptions
- Every E/S/H/G score, minute figure and test price is a scout ASSUMPTION. "Gate-free" means no gate that evidence shows. Platform fees, onboarding times, listing costs, payouts and AI-work policies are UNKNOWN (not searched).
- The cost split in the Cost line is an estimate.

## Open risks
- Evidence gap (red-team, Orchestrator): the ranking rests on asking prices. Cheap next step: the owner opens the Fiverr/Etsy/TaskRabbit apps and screenshots review counts and "orders in queue" for 3 listings (5 min; browsing without an account: UNVERIFIED).
- [SP] (red-team): I-023, 033-036 involve resale of goods; registering for a permit is an account creation (PROTOCOL §2).
- Payout (red-team, Orchestrator): every platform row needs two A-### approvals (account, payout setup). Until payout is searched, S scores for 021, 029-032, 038, 040 are optimistic guesses (ASSUMPTION).
- The "red-team verdict" column reads "queued" because scout cannot Edit rows; scribe should blank it when copying verdicts.
- Incident for system-qc: none new. Prevention proposal (D-023 already applied): scout sweeps by sentence; scout has no Edit tool so a one-row fix costs a full-file rewrite (process note for the Orchestrator).

## INC-004 fix (r1-r3), unchanged and CONFIRMED by red-team (4 grep hits in IDEAS.md)

## Acceptance checklist (from the T-008 brief)
- [x] 20 ideas I-021..I-040, no duplicates of I-001..I-020
- [x] ≥8 Lane A (8), ≥8 Lane B (12), all seven lenses ≥2
- [x] ≥6 ideas needing no site / own payment rail / license KNOWN (7; payout setup and license UNVERIFIED, stated per row)
- [x] picks-and-shovels, info arbitrage, platform AI micro-services, ≥3 boring/contrarian
- [x] each row: lens, lane, payer and price tagged, phone steps, evidence tag; minutes are ASSUMPTIONS
- [x] VERIFIED = URL + date + quote; max 12 WebSearch (12 used in attempt 1, 0 in attempt 2)
- [x] INC-004 r1-r3 tagged UNVERIFIED
- [x] cache written + README index (README row unchanged; its "no Reddit income reports surfaced" is a tool observation)
- [x] under 120 lines, tools line, top-7 with reasons, scored per D-013

## Self-check
- [x] Every claim tagged (ticked after a sentence-by-sentence sweep of I-021..I-040, W1-W20 and this file: platform phrases, market-size words, search observations; results F1-F22) · [x] Only owned files written (IDEAS.md, library/research/what-works-2026-10-12.md, this handoff) · [x] No hard-gate action taken · [x] Under 120 lines · [x] Cost line filled · [x] Prospects: none listed (businesses only in I-001..I-020, unchanged)

## QUALITY SCORE: 4
All 12 listed defects are fixed and my own sweep found and fixed 10 more groups (one arithmetic error, one false VERIFIED-as-absence). Every platform-payout phrase now says UNVERIFIED and names the hard gate. Not a 5: demand is UNKNOWN for all 20 rows, payout and platform fees were never searched, so the S scores are guesses; the E/S/H/G values are judgement. Per D-013 the owner-gated unknowns do not lower this score. A residual risk is a defect my sweep missed in the unchanged rows I-001..I-020 (accepted under T-005; not re-swept here, scope).
