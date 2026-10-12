# T-008 — red-team → scout (reply: REJECTED)

**Status:** REJECTED
**Task:** T-009 input validation of T-008 (I-021..I-040, D-020). T-009 PASS/FAIL, ranking, portfolio and cards resume on scout's attempt 2.
**Attempt:** T-008 attempt 1 of 3 rejected · T-009 attempt 1 of 3 (validation + legal pre-work done; no verdicts issued)
**Cost:** ~150k in / ~13k out tokens est., ~20 min wall · model opus · 5 WebSearch (cap 5). Cash spent $0.
**Tools used:** Read, Grep, WebSearch, Write (all on the red-team list; no Bash, WebFetch or Edit)

## Input validation (D-014; red-team's FIRST validation of T-008, so D-007 auto-reject applies per D-016)
- Contract: Status DELIVERED yes · QUALITY SCORE yes (4) · payer/price/owner steps per row yes · **every claim tagged: NO** (12 defects below) → **automatic REJECTED** (D-007).
- FP-07 spot-checks, repo-cited claims, 4 of 4 match: W16 → `library/research/lane-a-ideas-2026-10-12.md` line 23 "Tiers run from $25 to $99" · W17 → same file line 10 "Setup-only work is $250-$750 one-time" · W18 → `library/research/income-lanes-2026-10-12.md` line 35 "items you purchased for the purpose of reselling" · I-039 "connector is live per CONTEXT" → `ops/CONTEXT.md` line 24 lists Upwork, state "Live".
- INC-004 verification (second agent, as scout asked): grep `UNVERIFIED r1|r2|r3` in `ops/IDEAS.md` = 4 hits (I-009, I-015, I-016, I-019). **INC-004 fix CONFIRMED.**
- Independent score: **3.** The research is honest: the missing payer evidence is stated first, and the price anchors are correctly called asking prices. It loses a point for 12 tag defects. Three of them (F9) concern platform payout, which sets speed to first dollar, the second ranking key. It also loses for ticking "Every claim tagged" while these remained (handoff line 68 checked only "go-decision numbers"). Below 4, so §3 also returns it.

## Fix list (full sweep done: every phrase of I-021..I-040, the T-008 handoff, and cache rows W1-W18, including tool/platform-behaviour phrases per FP-08)
| # | Where | Defect | Exact fix |
|---|---|---|---|
| F1 | I-029 "the search returned 10 gig pages for this niche"; handoff line 39 "10 gig pages = crowded" | Untagged. The count is the size of the tool's result list (FP-09), not a market count | Delete the crowding inference, or write "saturation UNVERIFIED (WebSearch result-list size, not a platform count)" |
| F2 | I-032 "many sellers returned (saturated)"; handoff line 47 "10 listings returned in one search" | Same as F1 | Same as F1 |
| F3 | I-025 "many Thumbtack profiles seen" | Untagged observation | Same as F1, or delete |
| F4 | I-040 and W5 "10 sellers returned, so supply is crowded" | A VERIFIED row carries an inference its quote ("Up to $50") does not state (FP-07, FP-09) | Keep the price VERIFIED; tag "crowded" UNVERIFIED as a separate clause |
| F5 | I-034 "sell-through 'can take months' (W12)"; W12 note "per another result" | Quoted with no URL | Add URL + date + quote, or tag UNVERIFIED |
| F6 | I-035 "ship times push to 7-14 d" | Untagged | Tag ASSUMPTION or UNVERIFIED |
| F7 | I-039 "Agency anchors VERIFIED (E1a/E1b above)" | VERIFIED with no quote on the row (D-018 tag lint, FP-07) | Add the inline quote + URL + date as I-038 does, or cite W17 with its quote |
| F8 | I-028 "$50 sterling flatware set resold for about $400 ... W12 VERIFIED page"; W12 claim column "$50 flatware to about $400" | W12's tag quotes only "$500 to $2,000" and the planer, not the flatware | Map the quote to a URL, or tag it UNVERIFIED in both places |
| F9 | "Platform pays out" in I-021, 029, 030, 032, 038, 040; I-031 "Etsy pays out"; legend [NF] "(the platform pays out)" | Untagged platform behaviour. Payout method, clearance hold and bank/ID entry were not searched, yet they decide [PR]-freeness and the S scores | Add "payout timing and setup UNVERIFIED (not searched); payout setup = entering payment info, a §2 hard gate" |
| F10 | I-028 "No selling by the owner, so no [SP]" and "owner checks eBay sold filter on the phone" | Untagged legal inference and platform behaviour | "[SP] not needed: UNVERIFIED (inference)" · "sold filter: ASSUMPTION (owner's reselling domain)" |
| F11 | I-023 "Free-item supply in Sacramento VERIFIED(... 'usually post on the free section on Craigslist')" | The quote does not say Sacramento | Add W14's "r/SacramentoBuyNothing" quote or narrow the claim. Note the snapshot is dated 2026-05-01 and goes stale 2026-11-01 (§1) |
| F12 | T-008 self-check "[x] Every claim tagged" | False while F1-F11 stand | Re-tick only after F1-F11 |

**Re-submission bar, fixed now (FP-08 discipline):** ACCEPT if F1-F12 are fixed and the changed text adds no untagged claim. A defect I find later in unchanged text is my miss (D-016) and is not charged to scout. Scope: tag edits only. No new searches and no re-scoring are needed (≈10-15 min sonnet, ASSUMPTION).

## Legal pre-work for T-009 attempt 2 (red-team's own research; no idea gets a verdict here)
| # | Claim | Tag | Source (url · date · quote) |
|---|---|---|---|
| L8 | Elk Grove license covers businesses "operating or conducting business within the City limits" | VERIFIED | https://www.elkgrove.gov/departments-and-divisions/business-license · 2026-10-12 · search-summary wording "operating or conducting business within the City limits" |
| L8a | Whether a solo app-based gig worker needs the Elk Grove license | UNVERIFIED | Same search 2026-10-12: summary "didn't turn up a page that addresses app-based gig workers directly". Fee $16/2 yr vs $12 (older page): unmapped, UNVERIFIED |
| L8b | Elk Grove solicitor permit for selling "services from private residence", $36 + $49 background check | UNVERIFIED (unmapped) | Candidate https://codepublishing.com/CA/ElkGrove/html/ElkGrove04/ElkGrove0402.html. Relevant only to door-to-door offers; no Day-1 card does that |
| L9 | Sacramento: a Business Operations Tax certificate is required for "all businesses that operate in the City", plus a home occupation permit if the business runs from a residence | UNVERIFIED (summary not tied to a named URL) | Candidates https://www.cityofsacramento.org/BOT and https://www.cityofsacramento.gov/content/dam/portal/finance/Revenue/BUSINESS-TAX-app_Revised-12-2019-FILLABLE.pdf · 2026-10-12 · gig coverage: "the sources don't say whether a gig worker who works through a platform ... needs the certificate" |
| L10 | AB 2257 referral-agency exemption: lists furniture assembly; excludes delivery, courier, transportation, trucking, janitorial, and construction beyond minor home repair. Exempt relationships go to the Borello test | UNVERIFIED (secondary, "one source", unmapped) | Candidates https://www.natlawreview.com/article/new-california-law-clarifies-and-expands-exemptions-classification-independent, https://tbowleslaw.com/?p=8201 · 2026-10-12. Olson v. California outcome UNKNOWN. Red-team inference (UNVERIFIED): AB5 liability sits with the hiring entity. For the owner as a Tasker, the exposure is self-employment tax and no employee protections, not a penalty, so A-005 applies |
| L11 | Hauling: City of Sacramento code §13.24.070 makes properties use franchised haulers. The County needs a franchise (Ch. 6.20) and a "Special Business License ... to provide hauling services in the unincorporated area" | UNVERIFIED (summary, unmapped) | Candidates https://www.cityofsacramento.gov/public-works/recycling-solid-waste/Commercialwasteservices/commercial-collection-services, https://wmr.saccounty.gov/Pages/FranchiseApplication.aspx · 2026-10-12. The County franchisee list names a residential junk-removal operator (unmapped). Elk Grove not searched. I-022/I-024 carry this plus the vehicle UNKNOWN into re-review |
| L12 | No official FTC rule on AI product photos was found. Secondary: the general test is "likely to mislead a reasonable consumer", and a small disclaimer does not cure a misleading image | UNVERIFIED (vendor blog) | https://deep-image.ai/blog/ftc-ai-image-editing-false-advertising-ethics/ · 2026-10-12. Korean rules in the results are not the US FTC. Working rule for I-040-type work: clean backgrounds only; never alter an item's condition or features. eBay/Poshmark image rules not searched |
| L13 | WebSearch returns about 9-10 links per call | VERIFIED (live tool read) | WebSearch tool output, 2026-10-12, Links arrays of my 5 calls: 10, 9, 9, 10, 9 entries (basis of FP-09) |

## Pre-set rules for T-009 attempt 2 (so the re-review is one pass)
- Payer UNKNOWN is a condition met by a 5-min owner screenshot check (review counts / orders in queue in the Fiverr, Etsy and TaskRabbit apps; browsing without an account: UNVERIFIED), per the Orchestrator brief. It is not a kill unless the idea also fails on legality, owner time or dependencies.
- Platform account creation and payout setup each need an A-### (A-012+). C2 (license held or A-010 logged before first payment) extends to platform gig income until L8a/L9 are resolved.
- 0 new searches planned. The portfolio math uses the 5 Day-1 cards as they stand.

## Outputs
- `ops/handoffs/T-008-red-team-to-scout.md` — this rejection, the fix list and the legal pre-work
- `library/failure-patterns.md` — FP-09 appended

## Assumptions
- Token and minute figures are estimates. The scout fix time is an ASSUMPTION.

## Open risks
- Orchestrator: this costs one sonnet scout pass and pushes T-009/T-012 back by that pass. Live revenue is not delayed: EXP-A1..A5 are all "planned", none "running" (`ops/EXPERIMENTS.md` lines 17-21), so C1-C8 and the Day-1 cards stand. A §8 waiver is not available for F4, F7, F8: §8 bars waivers on VERIFIED tags.
- system-qc: log as input defect (send upstream). Root cause: scout's self-check tests "go-decision numbers" (T-008 line 68), which is narrower than §1 "every factual claim". Proposed prevention: scout's self-check adds "platform-behaviour phrases and search observations swept".

## Acceptance checklist (T-009, from TASKS.md verbatim)
- [ ] PASS/FAIL per I-021..I-040 with reason — not started: input REJECTED (D-007)
- [ ] top 5 ranked by (evidence of real income) > (speed) > (asset fit) — not started
- [ ] experiment card per survivor (hypothesis, cost cap, 48–72 h time cap, numeric threshold, dated owner phone steps, approval needed) — not started
- [ ] total planned+running tests ≤5 after merging with EXP-A1..A5 — not started. Today: 5 planned, 0 running (EXPERIMENTS.md)

## Self-check
- [x] Every claim tagged · [x] Full sweep stated (FP-08) · [x] Only owned files written (this file, FP-09) · [x] No contact, spend, or IDEAS/EXPERIMENTS edit · [x] Under 120 lines · [x] Cost line

## QUALITY SCORE: 4
The fix list is exact and covers every row; the spot-checks and INC-004 verification are done; the legal pre-work saves the re-review a search round. Not a 5: 7 of 8 new legal rows are UNVERIFIED because the summaries did not map to URLs, so the license and hauling questions remain open for the owner.

```
VERDICT: not issued — T-008 input REJECTED (D-007/D-016); T-009 resumes on scout attempt 2
Conditions: Day-1 C1–C8 unchanged (EXPERIMENTS.md header)
Kill criteria: unchanged; per-card H72 thresholds in EXPERIMENTS.md
```
