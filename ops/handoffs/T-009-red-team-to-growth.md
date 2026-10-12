# T-009 — red-team → growth

**Status:** DELIVERED
**Task:** PASS/FAIL per I-021..I-040 with reason; top 5 ranked by (evidence of real income) > (speed) > (asset fit); experiment card per survivor; total planned+running tests ≤5 after merging with EXP-A1..A5
**Attempt:** 2 of 3 (attempt 1 = input REJECTED, `ops/handoffs/T-008-red-team-to-scout.md`)
**Cost:** ~250k in (cumulative context) / ~16k out tokens est., ~30 min wall · model opus · 3 WebSearch (cap 3) · cash $0
**Tools used:** Read, Grep, Glob, WebSearch, Write (all on red-team's list; no Bash, Edit, WebFetch)

## Input validation (D-014, D-016)
- Bar (fixed in attempt 1): F1–F12 fixed and no new untagged claim in changed text. **Met → ACCEPTED.** Each of F1–F12 found as described in `ops/IDEAS.md` rows I-021..I-040 and cache rows W4, W5, W12, W14, W19.
- Spot-checks of changed claims, 5 of 5 match: I-039 "Setup-only work is $250-$750 one-time" = `library/research/lane-a-ideas-2026-10-12.md` l.10 · I-039 "around $300-$500 one-time" is contained in l.11 · I-030/I-039 "Tiers run from $25 to $99" = l.23 · I-030 "raw HTTP and WebFetch to commercial hosts return 403" = `ops/CONTEXT.md` l.27 · F13 math: I-026 0.70+0.75+0.40+0.40 = 2.25; I-021/030/022 recomputed 3.55/3.15/3.05.
- **My miss (D-016, not charged to scout):** I-031's VERIFIED quote ("restaurant menu templates appear in that same list") names menu templates, not the niche social kits the row sells. Attempt 1 had the same quote and I did not flag it. Carried here: demand for niche social kits is UNVERIFIED. No go decision rests on it (I-031 FAILs on owner hours). system-qc: log a reviewer-miss incident against red-team.
- Independent score: **4.** Every fix landed, plus 10 groups scout found itself (F13–F22). Not 5: the S (speed) scores leave out platform approval and payout clocks (FP-11). That is a scoring gap, not a tagging defect.

## Platform clocks (my 3 searches, 2026-10-12; all secondary sources, see Evidence S1–S7)
TaskRabbit: registration fee "varies by location" (~$25 per several sources); a card, a checking account and an SSN background check are required; approval <4 business days; payout within 24 h of a task, deposit up to 5 days; the platform's cut is in CONFLICT (0% vs 15%). Upwork: Project Catalog review "up to five business days" (undated forum post), with backlogs of weeks; fixed-price funds clear after about 5 business days (one source says up to 14); freelancer fee in CONFLICT (0–15% vs flat 10%). **Consequence: no platform idea can show a CONFIRMED dollar within 72 h. All platform rows are Lane B (first dollar ≈ 7–14 d).** Their H72 thresholds count orders and bookings; the auditor confirms the money later.

## Verdicts I-021..I-040 (owner: phone-only, vehicle UNKNOWN, 3–7 h/wk, <$100, Elk Grove/Sacramento)
| I | Verdict | Reason |
|---|---|---|
| 021 | PASS → EXP-B2 | Strongest evidence in the batch: the platform's own Sacramento customer price (W6). Lane B by its clocks. Conditions: vehicle/drill/background-check answers, fee ≤$25, assembly only, C2 |
| 022 | FAIL | Vehicle UNKNOWN; City/County hauling franchise and licence rules unresolved (L11); dump fees are spend. Re-queue only with a truck and L11 resolved |
| 023 | FAIL | Each pickup means contacting a private person [OA]; permit status for repeated resale of free items UNVERIFIED (W18); vehicle; source goes stale 2026-11-01 |
| 024 | FAIL | Inherits I-022's kill. Taking a TaskRabbit customer into an off-app haul likely breaks the app's payment rules (UNVERIFIED, not searched) |
| 025 | FAIL | Washer rental $50–$90/day (W8) breaks the ≤$25 cap; vehicle needed to move it; runoff rules not searched (UNVERIFIED) |
| 026 | FAIL | ~60 owner-min per $79 (ASSUMPTION); buying food is spend; filming on premises needs [OA]; phone editor UNVERIFIED (FP-06) |
| 027 | FAIL | Visit + photos + posting ≈45+ min per $20 (ASSUMPTION), i.e. ≤$0.45/min, the worst $/min in the batch |
| 028 | PASS (reserve) | Fits the reselling domain at 5 min/item; payer UNKNOWN (E=1); texts to people the owner knows [OA] + rail [PR]. No slot |
| 029 | FAIL | Owner edits video on the phone for every order (FP-06; editor UNVERIFIED); agents cannot carry the work; ~45 min per ~$32 net (ASSUMPTION) |
| 030 | PASS → EXP-B1 (merged) | Kit built and QA-passed (`library/templates/ai-search-check/`); Upwork listing price VERIFIED $25–$99; owner works only after an order |
| 031 | FAIL | 2–4 owner hours building kits in Canva before any demand signal (ASSUMPTION); demand quote covers menu templates only (my miss); Canva licence UNVERIFIED |
| 032 | PASS (reserve) | Contra $250 listing VERIFIED. Conditions: delete client resume data after delivery; no invented credentials. No asset fit, no slot |
| 033 | FAIL | Capital $100+ is over the cap; buy-to-resell needs a seller's permit (W18); the author admits losses |
| 034 | FAIL | Buy-to-resell permit (W18), spend, shipping heavy tools, sell-through UNVERIFIED |
| 035 | FAIL | Same permit kill as I-014 (T-006); see Open risks for the permit cluster |
| 036 | FAIL | Permit (W18); many small listings cost owner time; evidence is vendor blogs only |
| 037 | FAIL | No inbound source; payer UNKNOWN; CA referral-fee legality UNVERIFIED; no first dollar in 14 d |
| 038 | FAIL | No buyer channel (a new Gumroad product gets no traffic: ASSUMPTION); a generic bundle is new builder work (D-022); the anchor is agency work, not a $29 buyer |
| 039 | PASS → EXP-B1 (merged) | Kit built (`library/templates/gbp-pack/`); agency anchors VERIFIED $250–$750; same platform and approvals as I-030, so one test |
| 040 | PASS (reserve) | Fiverr "Up to $50" VERIFIED; fits reselling. Conditions: L12 (clean backgrounds only, never alter condition); text-only variant if no phone tool. No slot |

**Top 5 new ideas:** 1 I-021 (customer price published by the platform itself) · 2 I-030 (listing price for the exact deliverable on the target platform; kit ready) · 3 I-039 (kit ready; agency anchor, a weaker evidence class than a platform price) · 4 I-040 (Fiverr asking price; reselling fit) · 5 I-032 (asking price; no fit). Reserve: I-028.

## Portfolio decision (≤5 planned+running; today 5 planned, 0 running)
$/min = $ if it wins ÷ owner minutes to that dollar. The win probability is UNKNOWN for every row, so this is a ceiling, not an expectation. Mileage $0.70/mi is an ASSUMPTION.
| Test | Owner min | $ if win | $/min | Blocked on | Legal exposure | Decision |
|---|---|---|---|---|---|---|
| A1 owned items | 95 | ≥$50 | 0.53 | A-004 Q5/Q8 only | low (occasional sale, C8) | KEEP |
| A2 GBP pack | 34 | $99 | 2.9 | Q2–Q4 (C1), A-007 | texts to businesses (C3) | KEEP; carries the A5 line |
| A3 AI-check, local | 42 | $49 | 1.2 | Q2–Q4 (C1), A-008 | texts (C3) | DROP to fallback; its kit moves to B1 |
| A4 founding site | 32 | $150 deposit | 4.7 | Q1 framing, Q2–Q4, A-009; builder cost after deposit (D-022) | texts (C3) | KEEP |
| A5 QR kit $29 | 0 extra | $29 | n/a | rides the A2/A4 texts; T-010b D3/D4 | review rules (C4) | MERGE as an add-on line in A2/A4; threshold unchanged (≥1 of the 8 recipients by H72) |
| B1 = I-030+I-039 Upwork | 37 setup + 15/order | $84–$99 net (GBP) | 1.6–1.9 first, 5.6–6.6 repeat | A-014/A-015, C2; not Q2/Q3 | no outreach; payment on-platform | ADD |
| B2 = I-021 TaskRabbit | 37 + ~150/job | $45.50–$56 net/job | 0.24–0.30 | vehicle/tools answers, A-012/A-013, C2, fee | AB5: self-employment tax only (L10) | ADD (conditional) |
Math: B1 $99 × (0.85–1.0) = $84–$99 over 52 min → 1.6–1.9. B2 $35/h × 2 h = $70 × (0.85–1.0) = $59.50–$70, minus 20 mi × $0.70 = $14, gives $45.50–$56 over 187 min. B2 ceiling: ~2 jobs/wk inside 7 h ≈ $91–$112/wk ≈ $400–$480/mo, far below the $10k/mo target. It earns a floor, not scale.
**Result: A1, A2(+A5), A4, B1, B2 = 5 (3 Lane A / 2 Lane B).** Why A3 goes: it has the lowest $ per win and the most minutes before a yes (30 min of screenshots), and it was the third test waiting on the same unanswered A-004 Q2–Q4 (FP-10). B1 sells A3's built kit without that block, so the kit is reused, not wasted. Why B2 stays despite low $/min: it is the only entrant with platform-published demand (the D-020 first key), it has no C1 block, and it needs no outreach per job. **A3 is the named fallback:** if B1 or B2 fails its pre-gate or misses its live date, A3 takes the slot within 24 h (its card, kit and A-008 draft are ready).

## Experiment cards (scribe: copy to `ops/EXPERIMENTS.md`; A3 status → "shelved (fallback)", A5 → "merged into A2/A4")
**Step D, demand evidence (TODAY, owner): Wed 2026-10-14 by 12:00, 10 min, no login, no account.** (a) In the phone browser, open taskrabbit.com/locations/sacramento/assemble-furniture and screenshot 3 Tasker cards that show completed-task or review counts. (b) In Upwork (browser), search Project Catalog for "Google Business Profile optimization" and "ChatGPT AI search visibility"; screenshot 3 projects showing review count + price. (c) In the Fiverr app, search "google business profile"; screenshot 3 gigs showing reviews or "orders in queue". If any site asks you to log in, stop and screenshot the login screen; do not create an account. Send everything to growth. Etsy skipped: I-031 failed. Expected $0 directly; a failed gate saves the ≤$25 fee and ~75 owner-min.

**EXP-B1 — I-030+I-039 Upwork Project Catalog: GBP copy pack $99 + AI-search check $49 (Lane B)**
Hypothesis: two Catalog listings of the QA-passed kits get ≥1 order or ≥2 scope/price messages within 72 h of going live.
Pre-gate: launch only if ≥2 of the 6 Step D Upwork/Fiverr screenshots show a platform count of ≥10 reviews or ≥1 order in queue (FP-09). Fail = $0 spent; the slot goes to A3.
Cost cap: $0 cash (no paid Connects or membership; if Upwork asks for money, stop). Time cap: 72 h from the first listing going live. Not live by Thu 2026-10-22 20:00 = shelve, slot to A3.
Kill/continue at H72: CONTINUE if ≥1 order (funded) or ≥2 buyer messages asking scope/price · KILL if 0 orders and ≤1 message. A dollar counts only when the auditor sees the release in the Upwork balance or bank.
Owner steps: (1) Step D, Wed 10-14 12:00, 10 min (2) log A-014 by Wed 20:00, 2 min (3) by Thu 10-15 20:00, 25 min: create the profile from growth's draft, submit both Catalog projects, screenshot "under review" (4) when Upwork asks for a withdrawal method: log A-015 and add the bank, 5 min (5) at H24/H48/H72 after going live, screenshot stats/messages to growth, 1 min each (6) per order: send growth's intake message within 2 h; for AI-check orders, take site screenshots per `library/templates/ai-search-check/README.md` within 24 h (10 min); deliver in Upwork within 24 h of receiving inputs (5 min).
Approvals: A-014, A-015; C2/C10–C13.

**EXP-B2 — I-021 TaskRabbit Tasker, furniture assembly only, Sacramento/Elk Grove (Lane B)**
Hypothesis: a new assembly Tasker profile gets ≥1 booked task within 72 h of approval and nets ≥$35 from it.
Pre-gate: (i) owner answers yes to all three: car for jobs within 15 mi · own drill + level · willing to take an SSN background check; (ii) ≥2 of the 3 Step D Tasker screenshots show ≥25 completed assembly tasks or reviews. If any condition fails, B2 does not launch, $0 is spent and the slot goes to A3. If the page needs a login, (ii) is UNKNOWN and the owner decides at A-012.
Cost cap: $25 (registration fee, amount UNVERIFIED; if the app shows more than $25, stop). Time cap: approval by Wed 2026-10-21 20:00, else KILL (fee lost, ≤$25); then 72 h from approval.
Kill/continue at H72 after approval: CONTINUE if ≥1 task booked · KILL if 0. A dollar is CONFIRMED only when the deposit shows in the bank.
Owner steps: (1) Wed 10-14 by 12:00, 2 min: answer the three pre-gate questions (2) Step D (shared) (3) log A-012 by Wed 20:00, 2 min (4) by Thu 10-15 20:00, 25 min: register in the Tasker app with growth's profile text; assembly category only; rate ≤ the $35/h anchor (growth sets it); pay the fee only if it is ≤$25 and shown before payment (5) when the app asks for a payout account: log A-013 and add the checking account, 5 min (6) after approval, set 2 availability windows; accept a task only if this week's owner minutes plus the task stay ≤7 h (growth tracks this in TODAY.md) (7) the same day as each task, screenshot the earnings line to the auditor, 1 min.
Approvals: A-012, A-013; C2/C10/C11/C14.

**Proposed approvals (Orchestrator → DECISIONS; scribe → STATE APPROVALS):**
- A-012: "I approve creating a TaskRabbit Tasker account in my own name for furniture assembly in Sacramento/Elk Grove, consenting to its background check, and paying its registration fee by card only if the app shows $25 or less. Expires 2026-10-21."
- A-013: "I approve entering my checking-account details in the TaskRabbit app so it can pay me for completed tasks. No other payment info. Expires 2026-11-04."
- A-014: "I approve creating an Upwork freelancer profile in my own name and publishing two Project Catalog listings drafted by growth (Google Business Profile copy pack; AI-search readiness check), all payments on Upwork, no paid Connects or membership. Expires 2026-10-22."
- A-015: "I approve adding one withdrawal method (my bank account) in Upwork so released payments reach me. Expires 2026-11-05."

## Evidence
| # | Claim | Tag | Source (url · date · quote) |
|---|---|---|---|
| S1 | The Tasker registration fee varies by location | VERIFIED (lender marketing page) | https://joingerald.com/learn/work--income/taskers-guide · 2026-10-12 · search-summary wording "the fee varies by location" |
| S2 | Fee is $25; non-refundable or charged only on success (disputed) | UNVERIFIED | same search · "Several sources cite a $25 fee" is not tied to one URL |
| S3 | TaskRabbit takes no cut of Tasker earnings | UNVERIFIED (CONFLICT) | https://financebuzz.com/earn-as-taskrabbit-tasker, https://www.cnbc.com/select/taskrabbit-review/ · 2026-10-12 · "doesn't take a portion of your earnings" vs Gerald "15% cut"; the math uses both |
| S4 | Approval <4 business days; payout ≤24 h, deposit ≤5 days; card + checking + SSN required | UNVERIFIED (unmapped single sources) | same search 2026-10-12 |
| S5 | Upwork Catalog review "up to five business days"; backlogs of weeks | UNVERIFIED (undated forum post; may be >6 months old, §1) | https://community.upwork.com/t5/Freelancers/Project-Catalog/m-p/1117906 · 2026-10-12 · "allow up to five business days" |
| S6 | Upwork fixed-price funds clear after ~5 business days (or up to 14) | UNVERIFIED (unmapped guides) | WebSearch 2026-10-12 |
| S7 | Upwork freelancer fee 0–15% vs flat 10% | UNVERIFIED (CONFLICT) | https://joingerald.com/learn/work--income/upwork-service-fee-explained "0% to 15%"; https://aiproposer.com/learn/upwork-service-fee "flat 10%" · 2026-10-12 |
| S8 | My 3 searches returned 9, 9, 9 links | VERIFIED (live tool read) | WebSearch Links arrays 2026-10-12 (FP-09 base) |
| L10–L12 | AB 2257 assembly exemption; hauling rules; AI-photo rule | UNVERIFIED | reused from `ops/handoffs/T-008-red-team-to-scout.md` l.40–42 |

## Assumptions and open risks
- Assumptions: minute figures, the mileage rate, the 2-hour job length, the pre-gate cut-offs (≥10 reviews, ≥25 tasks) and win odds are red-team ASSUMPTIONS. The cut-offs are set now and must not be lowered later (§1).
- Permit cluster (I-014, I-033..036): if the owner wants a reselling lane, the lever is a CA seller's permit (registering = account creation). Orchestrator: ask it as an owner question. Cost and time UNVERIFIED (not searched).
- B2: the fee may be lost if approval fails (S2). Only assembly is in scope: TV/wall mounting stays out of the test until the CSLB minor-work limit is checked (UNVERIFIED, not searched).
- B1: Upwork may reject a new profile (UNVERIFIED); S5 may be stale. The A3 fallback covers both.
- growth (T-012): put Step D, A-012..A-015 and the pre-gate questions on TODAY for Wed 10-14; draft the Upwork profile, the 2 Catalog texts and the Tasker bio under `library/outreach/`. T-010b must close D1 before the first GBP pack delivery, and D3/D4 before any review card goes out.

## Acceptance checklist (TASKS.md T-009, verbatim) and self-check
- [x] PASS/FAIL per I-021..I-040 with reason — 20 rows: 6 PASS (021 → B2; 030 + 039 merged → B1; 028, 032, 040 reserve), 14 FAIL
- [x] top 5 ranked by (evidence of real income) > (speed) > (asset fit) — 021, 030, 039, 040, 032
- [x] experiment card per survivor — B1 (030+039), B2 (021); reserves get no card until a slot frees (max 5 live)
- [x] total planned+running tests ≤5 after merging with EXP-A1..A5 — A1, A2(+A5), A4, B1, B2 = 5; A3 = fallback
- Self-check: [x] every claim tagged · [x] math shown · [x] verdict matches rows · [x] FP-10, FP-11 appended · [x] only owned files written · [x] no contact/spend/IDEAS/EXPERIMENTS edit · [x] under 120 lines · [x] cost line

## QUALITY SCORE: 4
All 20 verdicts are tied to constraints. The portfolio math is shown, the cards have dated steps, pre-gates read from platform counts, and the fallback is named. Not a 5: every platform fee, clock and cut is secondary or in CONFLICT (S2–S7), and I missed the I-031 quote in attempt 1.

```
VERDICT: PASS-WITH-CONDITIONS (Day-2 portfolio = EXP-A1, A2(+A5 line), A4, B1, B2; A3 = fallback)
Conditions (in TASKS.md before launch): C1–C8 unchanged · C9 B1/B2 launch only after the Step D pre-gate passes on platform-displayed counts · C10 C2 extends to platform income: license held or A-010 logged before A-012/A-014 accounts go live · C11 all payment on-platform; no off-app deals with platform customers · C12 listings say "AI-assisted, human-reviewed"; no ranking/result promises (owner reads every GBP/report copy, QA D2) · C13 T-010b D1 fixed before the first GBP delivery; D3/D4 fixed before any review card is sent · C14 B2 assembly only; owner week ≤7 h including tasks · C15 A3 replaces any B slot that fails its pre-gate or live date within 24 h
Kill criteria (growth/auditor): per-card H72 thresholds · B1 not live by 10-22 20:00 · B2 not approved by 10-21 20:00 · a missed owner step twice = kill · total cash spend > $25 = pause all · any complaint or "stop" = off every list
```
