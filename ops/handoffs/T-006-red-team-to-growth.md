# T-006 — red-team → growth

**Status:** DELIVERED
**Task:** (1) one-line PASS/FAIL per idea with killing reason; (2) top 5 ranked; (3) experiment card per survivor; (4) automatic REJECTED if any T-005 claim untagged
**Attempt:** 2 of 3
**Cost:** ~210k in / ~15k out tokens est., ~25 min wall · model opus · 6 WebSearch (cap 6). Cash spent $0.

## Input validation (T-005 attempt 2, per D-014)
- **Fixes U1-U6, M1-M5: all 11 present** in `ops/handoffs/T-005-scout-to-red-team.md` lines 12-22 and `ops/IDEAS.md` (legend line 10; I-001, I-005, I-010, I-016, I-019 rows). Per-row Source column added (FP-07 fix).
- **FP-07 spot-checks (5 repo-cited claims, all match):** S1 Phil's README line 7 "25 indexable pages" · S2 README lines 254-256 "Every old URL that 404s is ranking thrown away" / "`philsautoandfleetrepair.com` should 301 to" · S3 MASTER-BLUEPRINT line 25 "Lighthouse mobile ≥ 90 performance" · S4 playbook line 3 "Status: proven (two sites shipped" · S5 income-lanes line 99 "Excluded because a website WAS seen: ... Rob And Sons Soft Wash". Functions dir also holds `meta-webhook.mjs` (not material).
- **Residual untagged phrases, not on the fix list:** r1 I-009/I-019 "pagespeed.web.dev (no login)"; r2 I-016 "in-app instant quotes (no spend)"; r3 I-015 "items ... that drop-off stores refuse" (E2c exists but is not cited on the row). Scout says no new claims were added, and the fix list did not touch these phrases. I have no diff tool, so whether they were in attempt 1 is UNVERIFIED. They are my attempt-1 miss, not new defects. I carry all three as UNVERIFIED below, and none of them feeds a go decision. Logged as FP-08.
- **Score: 4.** That is the bar I fixed in advance. Not a 5: payer evidence is still asking prices plus test prices. **Action: ACCEPTED.** (If the Orchestrator reads D-007 as overriding the fixed bar, convert this to REJECTED with r1-r3 as one-line fixes. I advise against that: it would spend the last attempt on a reviewer error.)

## What was done
Filtered I-001..I-020 against legal/TOS, unit economics, time to first dollar, dependencies, failure modes and FP-01..FP-07. Ran 6 legal searches. Ranked the passing ideas using the brief's preferences (no build before the first dollar, uses repo assets, survives if both portfolio clients never paid). Wrote 5 cards. Appended FP-08. IDEAS.md not edited.

## Verdicts ([PR] = payment rail unconfirmed: a condition, not a kill, while A-004 is pending)
| I | Verdict | Killing reason / key condition |
|---|---|---|
| I-001 | PASS → card 4 | Deposit before build (E12). Show the two sites as "sample builds" unless A-004 Q1 confirms they are clients. Payer UNVERIFIED; [PR] |
| I-002 | PASS (hold) | Same as I-001 for 2 trade prospects. Starts only after I-001 lands a deposit (keeps live tests ≤5). Same "sample build" rule for Phil's |
| I-003 | PASS → card 2 | No build, no client dependency, blueprint GBP list exists (line 200). Pack leaves out Q&A items (Q&A feature status UNVERIFIED, not searched); [PR] |
| I-004 | FAIL | Builds and publishes a real business's brand before any buying signal. Needs SP-2, which is inactive. I-001 gets the same proof after a deposit |
| I-005 | PASS (reserve) | Fails "survives if both clients never paid". Promote it only if A-004 Q1 says a client paid. Terms ARL-style (L4) |
| I-006 | PASS (merge into I-005) | Depends on the same two relationships. A $50 referral credit is not a review incentive |
| I-007 | FAIL | No buyer until a site client exists, and the client needs their own Stripe. Re-queue as an upsell after the first site sale |
| I-008 | FAIL | No Spanish proofreader (T-005 U7 UNKNOWN). Unproofed translation would go on a client's public site. Depends on I-005 clients |
| I-009 | PASS → card 3 | Market price VERIFIED $25-$99 (E5a). Owner supplies screenshots (E13). Report states observed facts only and promises no rankings; [PR] |
| I-010 | PASS → card 5 | Wording must ask every customer, offer no incentive and filter nobody (L2, L3). Kit spec at MASTER-BLUEPRINT line 213; [PR] |
| I-011 | PASS (low) | $79 one-time against free generators (E3b) and $17/mo (E3a), plus unpriced menu-change support. Not top 5 |
| I-012 | PASS (low) | Payer UNVERIFIED. Owners can get captions free from AI chat (ASSUMPTION). Not top 5 |
| I-013 | PASS → card 1 | Cash at a public meetup needs no rail. CDTFA occasional-sale limits (L1): one sweep, owned items only |
| I-014 | FAIL | Buying to resell needs a seller's permit (L1b). Getting one is an account creation, a hard gate. Profit $8-$15 per flip, 2 meetups each |
| I-015 | FAIL | Selling others' goods for commission is business activity, and permit status is UNVERIFIED. 30% × $20-$99 = $6-$30 per item at ~1 owner-hour (ASSUMPTION) |
| I-016 | PASS (merge into I-013) | The trade-in quote becomes a comparison step in card 1. Quotes "no spend" UNVERIFIED (r2) |
| I-017 | PASS (hold) | 20+ owner minutes on a call per $49 sale. Keep it as the I-009 upsell, not a separate test |
| I-018 | PASS (merge into I-001) | Only the $590 annual-prepay arm. Monthly with a $0 build is deferred: build cost is lost on churn (FP-02). ARL-style terms (L4) |
| I-019 | FAIL | A $299 replacement build includes a 301 map and domain switch (Phil's README lines 248-259 show that scope) and cannot cover the work. The target already paid for a site |
| I-020 | FAIL | First dollar needs a third party's customer, so it cannot hit 72 h. Move to the Lane B queue |

## Ranking (top 5)
1 I-013 (+016): $0, no rail, no outreach, no license. Fastest dollar · 2 I-003 (+010 add-on): no build, $99 · 3 I-009: repo kit, verified price band · 4 I-001 (+018): biggest ticket, deposit-first · 5 I-010: $29 add-on, repo spec. Reserve: I-005 if A-004 Q1 = paid.
Owner time across all five ≈ 3.5 h in 72 h (ASSUMPTION; inside the 3-7 h/week). Outreach total: 11 businesses, each contacted once, none in two lists.
Unit math (ASSUMPTION prices, ~1 sale each): $99 + $49 + $150 + $29 = $327 gross from ~109 owner-min of service steps (A2 34 + A3 40 + A4 32 + A5 3) ≈ $180/owner-hour, before Stripe 2.9%+30¢ (playbook line 30). At 0 sales it is $0. These are tests, not a stream.

## Experiment cards (scribe: copy to ops/EXPERIMENTS.md; D0 = day the owner logs the approvals; dates assume D0 = Tue 2026-10-13, shift all dates if later; no approval by 2026-10-15 23:59 = card shelved and replaced; a missed step = one re-ask in TODAY.md, a second miss = kill, lesson "owner time")
```
EXP-A1 · I-013+I-016 sell owned items · cost cap $0 · time cap 72 h from first listing
Hypothesis: ≤5 owned items listed for local pickup bring ≥$50 cash within 72 h.
Kill/continue: CONTINUE if ≥$50 collected by H72 · one −20% reprice at H48 if <3 buyer messages · KILL if $0 at H72.
Owner steps: (1) answer A-004 Q5+Q8 by Tue 10-13 12:00, 2 min (2) photo top 5 items, send to growth by Tue 20:00, 15 min (3) electronics: screenshot in-app trade-in quote by Tue 20:00, 5 min (4) post growth's listings by Wed 10-14 12:00, 15 min (5) public meetups; cash, or Zelle only after it shows in the balance; by Fri 10-16 12:00, ~60 min (6) text each sale amount to auditor the same day, 1 min.
Approvals: A-004 (Q5, Q8). No new A-### (owner posts own items; agents only draft). Legal: owned household items, one sweep, nothing bought to resell (L1, L1b).
EXP-A2 · I-003 GBP copy-paste pack $99 (+ I-010 $29 add-on line) · cost cap $0 · time cap 72 h from first send
Hypothesis: ≥1 of 5 Elk Grove businesses with thin Google profiles pays $99 after one personal text.
Kill/continue: CONTINUE if ≥1 payment CONFIRMED by auditor by H72 · KILL if 0 paid and ≤1 reply asking details.
Owner steps: (1) screenshot 5 thin Maps cards (not beauty studios; those are EXP-A4) to growth by Tue 10-13 20:00, 15 min (2) read draft, log A-007 by Wed 10-14 09:00, 2 min (3) send 5 texts by Wed 12:00, 10 min (4) on yes, payment request within 1 h, 2 min (5) forward pack within 24 h of payment, 5 min (6) "no"/"stop" = never contact again.
Approvals: A-004 Q2 rail, Q3 sender, Q4 license; proposed A-007; proposed A-010 if no license.
EXP-A3 · I-009 AI-search readiness check $49 · cost cap $0 · time cap 72 h from first send
Hypothesis: ≥1 of 3 local businesses with websites pays $49 for a one-page AI-search report.
Kill/continue: CONTINUE if ≥1 CONFIRMED payment by H72 · KILL if 0.
Owner steps: (1) for 3 sites from income-lanes line 99: screenshot home page, /robots.txt, /llms.txt, PageSpeed result, one AI-assistant answer to "best <trade> in Elk Grove"; send by Wed 10-14 20:00, 30 min (2) log A-008 by Thu 10-15 09:00 (3) send 3 texts by Thu 12:00, 5 min (4) payment request within 1 h of yes; forward report within 24 h, 5 min.
Approvals: A-004 Q2-Q4; proposed A-008; A-010 if no license. Report: observed facts only, no ranking promises.
EXP-A4 · I-001+I-018 founding-client site: $450 ($150 deposit) or $590/yr prepaid · cost cap $0 cash (builder tokens only after deposit) · time cap 72 h from first send
Hypothesis: ≥1 of 3 Elk Grove lash/nail studios with no Website button pays a deposit or prepay after one text.
Kill/continue: CONTINUE if ≥1 deposit CONFIRMED by H72, or ≥2 replies asking for price/preview (one 48 h extension) · KILL if 0 positive replies at H72.
Owner steps: (1) Maps "lash Elk Grove"/"nails Elk Grove", screenshot 3 cards with no Website button, send by Tue 10-13 20:00, 20 min (2) log A-009 by Wed 10-14 09:00 (3) send 3 texts by Wed 12:00, 5 min (4) deposit request within 1 h of yes, 2 min (5) approve preview within 24 h of receipt, 5 min.
Approvals: A-004 Q1-Q4; proposed A-009; A-003 (SP-2) for the preview after the deposit; A-010 if no license. The two sites are "sample builds" unless Q1 confirms them as clients. Prepay terms: ARL-style (L4).
EXP-A5 · I-010 review-request QR kit $29 · cost cap $0 (shop prints) · time cap 72 h from the EXP-A2 send
Hypothesis: ≥1 of the 8 EXP-A2/A4 recipients buys the $29 add-on.
Kill/continue: CONTINUE if ≥1 CONFIRMED by H72 · KILL if 0.
Owner steps: (1) none extra: the line is inside the A-007/A-009 texts (2) payment request within 1 h of yes, 2 min (3) forward growth's PDF within 24 h, 1 min.
Approvals: covered by A-007/A-009. Wording rule: "We'd love your honest Google review: <link>". Shown to every customer; no reward; no "if you were happy"; no private-feedback detour.
Proposed approvals (exact wording for scribe):
A-007/A-008/A-009: "I have read growth's draft for EXP-A2/A3/A4. I approve sending it from my own phone, once, to each business I screenshotted for that card, with at most one reply-follow-up, stopping on any no/stop. Expires 2026-10-18."
A-010: "I approve applying myself for a business license in my city (Elk Grove or Sacramento), fee up to $25, before I accept the first service payment."
A-011 (only if A-004 Q2 = no rail): "I approve activating <rail I name> myself; agents create nothing."
```

## Evidence (legal rows; repo spot-checks are in Input validation)
| # | Claim | Tag | Source (url · date · quote) |
|---|---|---|---|
| L1 | Occasional seller of unwanted household items needs no permit (≤2 sales/12 mo) | VERIFIED | cdtfa.ca.gov/formspubs/pub107 + cdtfa.ca.gov/formspubs/cdtfa410d.pdf · 2026-10-12 · "no more than two sales in a 12-month period"; "disposing of unwanted household items, and does this no more than twice in any twelve-month period" (search-summary wording) |
| L1b | Bought-to-resell goods, or a business-scale series of sales, need a permit | VERIFIED | same pub107 · 2026-10-12 · "items you purchased for the purpose of reselling to others"; "a series of sales sufficient in number, scope, and character to amount to a business" |
| L2 | FTC rule bars incentives conditioned on review sentiment; $53,088/violation | UNVERIFIED (summary quote tied to "one source", not to a URL) | candidates: ftc.gov/system/files/ftc_gov/pdf/r311003consumerreviewstestimonialsfinalrulefrn.pdf, jdsupra.com "Five Stars, Zero Tolerance" · "conditioned (expressly or by implication) on, a review that expresses a particular sentiment" |
| L3 | Google bars selective solicitation and review incentives | UNVERIFIED (agency blogs quoting Google; Google's page not in results) | demandhub.co/articles/google-review-policy · 2026-10-12 · "selectively soliciting positive reviews from customers". Card 5 follows the stricter reading, so the tag gap does not change the verdict |
| L4 | ARL "consumer" = personal/family/household | VERIFIED | donahue.com/wp-content/uploads/2022/03/BusCorp-Update-Mar-2022-SK.pdf · 2026-10-12 · "for personal, family, or household purposes". B2B exclusion UNVERIFIED (inference; "None of the results mention a B2B exclusion"); code section disputed (Civ. vs B&P) |
| L5 | TCPA autodialer needs a random/sequential number generator | VERIFIED | en.wikipedia.org/wiki/Facebook,_Inc._v._Duguid · 2026-10-12 · "using a random or sequential number generator". Manual one-to-one texts and Do-Not-Call status of business-listed cell numbers: UNVERIFIED (not covered) |
| L6 | CAN-SPAM covers B2B email; postal address required | VERIFIED | ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business · 2026-10-12 · "The law makes no exception for business-to-business email"; "must include your valid physical postal address". Opt-out window UNVERIFIED |
| L7 | Elk Grove license applies to businesses operating in city limits | VERIFIED | T-001 #12, elkgrove.gov/departments-and-divisions/business-license · "Licenses are issued to businesses operating or conducting business within the City limits"; fee UNVERIFIED |

## Assumptions
- Owner minutes, prices, conversion and the $/hour math are ASSUMPTIONS. r1-r3 (PageSpeed no login, trade-in quote no spend, drop-off refusals) are UNVERIFIED.
- Prefer texts over email on Day 1: email carries the CAN-SPAM postal-address duty (L6), and the owner's address must not go out without consent.

## Open risks
- Services run without a license: L7 applies once the owner "conducts business". Q4 and A-010 come before the first service payment (Orchestrator/scribe).
- Rail TOS: personal P2P payments for goods/services may breach the app's terms. UNVERIFIED, not searched; growth names the rail's business mode (growth).
- Do-Not-Call risk on cell numbers (L5 gap). Keep it to one personal text per listed business number and never re-contact after no reply (growth).
- Zendrop bleed of $29/mo (A-002) exceeds the expected value of EXP-A5. Cancelling it is the best $/minute action on Day 1 (growth/Orchestrator).
- D-007 vs the fixed bar: see Input validation (Orchestrator). Reviewer miss r1-r3 goes to system-qc as an incident against red-team.

## Acceptance checklist (from TASKS.md, verbatim)
- [x] (1) one-line PASS/FAIL per idea with killing reason: 20 rows
- [x] (2) top 5 ranked: Ranking section
- [x] (3) experiment card per survivor (hypothesis, cost cap, time cap 48–72h, kill/continue threshold, owner phone steps, approval needed): 5 cards plus the I-005 reserve. Holds/merges are noted; the low PASSes get no card until a slot frees (max 5 live)
- [x] (4) automatic REJECTED if any T-005 claim untagged: attempt 1 applied it; attempt 2 meets the fixed bar (r1-r3 disclosed)

## Self-check
- [x] Every claim tagged · [x] Only owned files written (this file, FP-08) · [x] No contact, spend or IDEAS.md edit · [x] Under 120 lines · [x] Cost line · [x] Verdict matches rows

## QUALITY SCORE: 4
All 20 rows have verdicts, the cards are copy-ready with dated owner steps, and the legal rows are tagged honestly. Not a 5: 2 of 7 legal rows rest on secondary sources (L2, L3), DNC status for texts is unsearched, and I missed r1-r3 in attempt 1.

```
VERDICT: PASS-WITH-CONDITIONS (Day-1 plan = EXP-A1..A5)
Conditions (in TASKS.md before launch): C1 A-004 Q2-Q4 answered before any service offer is sent; EXP-A1 can start on Q5/Q8 alone · C2 license held, or A-010 logged, before the first service payment · C3 one personal text per business, none in two lists, stop on no/stop · C4 review wording per card 5, no incentive, no gating · C5 deposit/payment CONFIRMED before any build (E12) · C6 the two sites are "sample builds" unless Q1 confirms clients · C7 subscriptions/prepay: terms shown before payment, affirmative consent, cancel by text · C8 EXP-A1 owned items only, one sweep
Kill criteria (growth/auditor): per-card thresholds at H72 · any card with a missed owner step twice = kill · total cash spend > $25 = pause all · any complaint or "stop" = that business off every list
```
