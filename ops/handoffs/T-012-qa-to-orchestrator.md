# T-012 — qa → orchestrator

**Status:** DELIVERED (VERDICT: FAIL, back to growth with paste-ready fixes)
**Task:** T-012 qa gate on T-010 templates (audit, one-page agreement, weekly client report)
**Attempt:** 1 of 3
**Cost:** ~90k/14k tokens, ~12 min wall · model sonnet

VERDICT: FAIL
Input contract: T-010 handoff has DELIVERED + evidence table + checklist, no code (no commit/gates apply). Met.
Checklist used/updated: library/checklists/mos-template.md (new)

## Per-file verdict
| File | Verdict | Reason in one line |
|---|---|---|
| service-agreement-one-page-2026-10-12.md | PASS (advisories) | All 9 required elements present, text version 217 chars |
| client-weekly-report-2026-10-12.md | FAIL | 10-minute fill not shown; light rule turns n/a rows red; pipe table unreadable by SMS |
| free-growth-audit-2026-10-12.md | FAIL | l.23 contradicts l.21; own time budget sums to 15 without the fill step; 4 smaller items |

## Criteria (proof lines)
1. Tags: PASS for report and agreement; FAIL audit l.23. `grep -n "VERIFIED(\|HYPOTHESIS\|UNVERIFIED"` on all three; every Google claim at audit l.16/21/22/26/35 is tagged, sources are search-result summaries (pages not opened; I could not re-check them, no WebSearch tool and egress returns 403 for google/ddg/bing). No UNVERIFIED stat is phrased as fact: audit l.26 and l.36 label the photo-click and 8% vs 68% claims "UNVERIFIED, do not quote". Agreement l.32 mintz source is 2018 = STALE, tag should say so (advisory).
2. Agreement: PASS. l.1 DRAFT/attorney header; scope l.8; price l.9; month-to-month and cancel anytime l.10; no guarantee l.11; Manager/partner only, no passwords l.12; ownership l.14; California law l.17. Text version l.24-27: 88+1+128 = 217 raw (214 with a 4-digit price), `python3 len()`, under 320; ends with STOP.
3. Report: FAIL on time and phone use, PASS on content. Columns: 19 rows l.12-30 match MOS l.181 (Phase is in the header l.7), footer l.32 has top 3 / bottom 3 / bottleneck / gate; "—" defaults; 🟢🟡🔴 l.31; 3 wins l.35-37; 1 fix l.41; ROI sentence ESTIMATE-labeled l.44; 1 quest l.47. Dummy fill (Dummy Tint Co, 19 rows, 3 wins, fix, ROI, quest): 123 characters in cells + 491 free text = 614 typed. Typing at 125 chars/min = 4.9 min. Plus lookups in three apps (GBP performance, Meta insights, client log) about 4 min (my estimate) plus table-cell navigation 1-2 min = 10-11 min. I cannot run a phone stopwatch; the agent clock (0 s) is meaningless. The file's own claim "scoreboard 5 min, rest 5" (l.2) is not demonstrated. Found while filling: the light rule (l.31) makes CAC/ROAS/CPL "red" forever (missing 2 weeks) and treats lower CPL as bad.
4. Audit walk: UNVERIFIED. This agent has no WebSearch tool and curl to search engines returns 403 (egress policy); `library/` holds no listing data (reviews, hours) for any business. I did not invent one and contacted no one. TOOLING INCIDENT for system-qc: qa cannot run criterion 4 without WebSearch. Re-run: scout (WebSearch) writes one public listing's visible numbers to a handoff, qa then walks it with a stopwatch. Paper budget (computed from the file): prep 2 + checklist 10 + delivery 3 = 15 (l.5, l.10, l.58) and the fill-in step §3 (l.42-55, about 430 typed chars = 3.5 min) is in none of them. So 15 min fails by its own arithmetic. My per-section estimate for a phone: prep 1, A-D 5, E (3 cards x 5 data points) 4, F (two AI queries incl. waits) 3, fill 3.5, deliver 3 = 19.5 min. UNVERIFIED until a real stopwatch.
5. PASS/FAIL with file:line and fixes: below.

## FAIL items with paste-ready fixes
Audit (library/templates/free-growth-audit-2026-10-12.md)
A1 l.23 contradicts l.21 (reviews feed prominence) and asserts a negative from a summary. Replace the whole line with:
` Google lists review count and score under prominence (VERIFIED above) but publishes no weights; do not quote "N reviews = rank N" or any third-party weighting (UNVERIFIED). Pitch reviews as trust + visibility.`
A2 l.5, l.10 and l.38 budget. Replace l.5 with `## 0. Before you start (1 min)`, l.10 with `## 1. Checklist (10 min: A-D 5 on the prospect, E 3, F 2 with ONE query)`, and insert before l.42: `## 2b. Fill the one-pager (3 min, type only the bracketed parts). Budget: 1 + 10 + 3 = 14 min to ready-to-send; delivery (§4, 3 min) is separate.` In F (l.34) replace "and 'who does [service] near [neighborhood]'" with nothing (one query). Append to the log line l.70: ` · minutes prep/checklist/fill/deliver [n/n/n/n]`.
A3 l.66 hard-coded "1 green". Replace `1 green, [n] red` with `[n] green, [n] red`.
A4 l.58/l.71 legal read without the professional tag (outreach-send-asset #7). Append to l.71: ` Legal: whether TCPA, do-not-call or CAN-SPAM rules reach a business's public number is UNVERIFIED; verify with a professional before the first send. qa does not rule on it.`
A5 l.59 "I'll text it over once" can read as texting someone who said no, contradicting l.64 and PROTOCOL contact rules. Replace the parenthetical with:
`(If they say they are busy: "No problem, I'll text it over once. Say STOP and I won't contact you again." If they say no, not interested or stop: "Understood, thank you." End, log "never contact", send nothing.)`

Report (library/templates/client-weekly-report-2026-10-12.md)
R1 l.31 light rule defect. Replace with:
`Light rule (HYPOTHESIS, adjust after 4 reports): 🟢 up more than 10% or on plan · 🟡 within 10% or unknown · 🔴 down more than 10%, or missing 2 weeks where the client should have it. Cost rows (CPL, CAC): down is 🟢. Rows that do not apply this phase (CAC, ROAS, CPL with $0 ads): write "n/a" and leave Light "—".`
R2 l.2 untested time claim. Replace `(stopwatch: scoreboard 5 min, rest 5)` with `(qa estimate, not yet stopwatched: lookups 4 min + about 550 typed characters 4.5 min). Phone method: copy last week's file, cut This into Last, type only This week; first report: Last = "—".`
R3 l.50 table unreadable by text. Insert in the Send block a line-based client copy:
`Send format (no table): one line per row, "🟢 GBP calls 21 (was 25)". Put the "Where I read it" column in the owner copy only.`
R4 l.44 estimate of known actuals. Insert before it: `If Revenue and Booked jobs are in the table, write "You paid $[X]; the table shows [Y] leads, [J] booked jobs and $[R] revenue you reported (client-reported)." Use ESTIMATE only for revenue the client has not reported.`

## Advisories (not blocking)
- Agreement: l.10 month-to-month wording also covers the one-time Starter; text version l.25 says "/mo" (Starter users need a one-time variant); mintz 2018 source (l.32) add "STALE"; CA ARL question stays an attorney item (UNVERIFIED).
- Audit l.17 "Google gives no weights" untagged (tag CONSENSUS or UNVERIFIED); l.36 repeats the 8%/68% numbers though labeled; consider dropping the figures.
- Report "Where I read it" UI paths (GBP performance, Meta insights) are UNVERIFIED, not marked in-file.
- Audit l.2 and report l.2 status lines say DRAFT/not gated; growth updates after PASS.

## Placeholder grep
`grep -n REPLACE-ME` on all three: 0 hits. [BRACKETS] and [AGENCY NAME] are intentional owner fill-ins (A-013 pending).

## Assumptions
- 125 chars/min phone typing (25 wpm) is conservative and UNVERIFIED; lookups time is my estimate.
- Google sources not re-opened (no WebSearch for qa); tags judged on form, not re-confirmed.

## Open risks
- Criterion 4 UNVERIFIED until a WebSearch-capable run; the agreement still needs attorney review (owner), a hard-gate item.
- No outreach may use these templates before a re-gate (qa PASS on the fixed files).

## Next
Growth applies A1-A5, R1-R4 (growth to request builder/Orchestrator edit rights for library/templates/ if the grant has lapsed), then qa re-gates unchanged criteria; scout supplies one real public listing for the audit stopwatch.

## Self-check
- [x] Every criterion has a proof line · [x] re-run (counts, greps, dummy fill) not copied · [x] placeholders grep'd · [x] checklist saved · [x] under 120 lines · [x] cost line
- [x] No file in library/templates/ edited; nothing contacted or published

## QUALITY SCORE: 4
Specific, reproducible findings and paste-ready fixes for every FAIL. Not 5: criterion 4 and the phone stopwatch are estimates, not measurements, because qa had no WebSearch and no phone.
