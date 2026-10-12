# S1 — system-qc → orchestrator

**Status:** DELIVERED
**Task:** T-004 quick check (items 1-9a) for session 1, run during session 2. Incidents INC-001..INC-009, first METRICS row, scoreboard row.
**Attempt:** 1 of 3
**Cost:** ~95k tokens in / ~9k out (estimate, not metered), 3 WebSearch, 1 session · model sonnet

## Findings, ranked
1. HIGH · INC-004 · A-008/A-009 mean different tests in different files. TODAY.md lines 23/26/36 and T-006/T-007 say A-008 = EXP-A3 ($49), A-009 = EXP-A4 ($450 site). DECISIONS.md lines 34-35 and STATE.md lines 12-13 say the reverse. The owner is told to reply "A-009 yes" for the site text; the register would read that as the $49 text. Fix before the owner replies.
2. HIGH · INC-003 · Acceptance criteria changed after the fact by the Orchestrator: D-012 (T-001 accepted at score 3 with criterion 3 waived; §3 says under 4 returns the work), T-002 never run as written, D-016 (D-007 re-read to pass T-005 a2 with three known untagged phrases). Disclosed with reasons, so not concealment, but PROTOCOL §1 line 10 names criterion downgrades CRITICAL and none was owner-approved. Needs an owner ruling (A-###).
3. HIGH · INC-008 (item d) · Red-team's conditions C1-C8 ("in TASKS.md before launch", T-006 line 116) are not in TASKS.md or EXPERIMENTS.md. A card could launch without C2 (license before first payment) or C5 (deposit before build).
4. MED · INC-007 · Five VERIFIED rows lack a quote or primary source: E-009, E-010, E-029, E-032, E-033. Treat as UNVERIFIED until re-tagged.
5. MED · INC-005 · §6 single-writer breaks: scribe wrote IDEAS.md verdict/status cells and the T-003 receiver block, both on Orchestrator instruction.
6. MED · INC-008 (a,b,c,e) · T-002 done with no handoff or LOG row; S1b has no LOG row; T-005 a1 and T-006 a1 files overwritten; T-001 receiver validation left blank.
7. LOW · INC-002 · Red-team missed r1-r3 in attempt 1 (self-disclosed, T-006 line 11).
8. LOW · INC-006 · Scout reports Bash use and in-place edits though scout.md lists no Bash/Edit (D-008, expires session 2).
9. LOW · INC-009 · No timestamps or metered cost, so cycle time and cost are estimates.
10. CLOSED · INC-001 · T-005 round-trip worked as designed (D-015).

## Quick check, item by item (evidence)
1. **Unlogged actions: FINDING.** Handoff files vs LOG: T-001, T-003, T-005 (REJECTED row + DELIVERED row), T-006, T-007, S1 each have a LOG row (ops/LOG.md lines 6-12). S1b has none (S1b line 30 says so deliberately); T-002 has TASKS `done` but no handoff and no LOG row (TASKS.md line 8). T-004 appears in TASKS as `todo`, STATE says "running" (STATE line 27): both disclosed by scribe (S1b line 20). See INC-008.
2. **Contract violations: FINDING.** Handoff lengths: T-006 is the longest at 119 lines (under 120, but with 500-700 character lines in the cards); T-001 97, T-005 a1 77, T-005 a2 95, T-003 79, T-007 82. Untagged claims: none found in the handoffs I read beyond r1-r3 (INC-002). Non-owner writes: INC-005. Receiver validation: T-001 blank (T-001 lines 93-96); T-003 filled (line 78); T-005 a2 and T-006 in forward handoffs (D-014). Score under 4 accepted: T-001 at 3 (LOG line 8) with no fixes, only a waiver (INC-003).
3. **Gates: clean.** No build, so no red-team PASS needed yet. Nothing shown to a customer or published (T-007 line 14: "Nothing was sent, posted or drafted in Gmail"; T-007 line 74). Income: $0, no CONFIRMED inflow (LEDGER.md line 61). Red-team gate on ideas ran (T-006 verdict table lines 18-39). Note: qa has not been invoked; the 6 outreach drafts under library/outreach/ need qa PASS before the owner uses them (T-007 line 10 says no qa-PASSED deliverable exists).
4. **Drift: clean.** Every task ties to Lane A and an IDEA/EXP ID (TASKS.md T-005..T-007; EXPERIMENTS.md). T-001 over search budget by 2 (T-001 line 6, 14 vs 12), self-disclosed, trivial. Tool-scope drift: INC-006.
5. **Loops/rejections: clean on loops.** One rejection only (T-005), resolved on attempt 2. Root-cause tally for the 3x rule: "claim tagged by reference/blanket" appears twice (INC-001, and the E-0xx rows in INC-007); one more occurrence triggers a mandatory process change.
6. **Stale evidence: clean.** Everything is dated 2026-10-12. Caveat: E-031 carries a "status may be stale" note (articles years old, EVIDENCE.md line 35); keep owner confirmation as a condition. Search "snippets" are tool summaries, not page text (T-001 line 67).
7. **Gaming: no hidden gaming found.** Candidates, all disclosed in DECISIONS: D-012, D-016 (INC-003, owner ruling requested). No test or threshold edited to pass; no UNVERIFIED relabelled VERIFIED (T-005 M3 went the other way, VERIFIED to UNVERIFIED). APPROVALS bypass: none; all A-### answers are "—" (DECISIONS lines 28-38) and nothing was sent.
8. **Spot audit: clean, 0 false VERIFIED.** Sample stated below.
9a. **Scoreboard: done.** Row appended in METRICS.md. 5 experiments planned, 0 running (not above 5), none past time cap because no clock has started.
9. **STATE.md cap: clean.** 47 lines (cap 60).

## Spot audit
Population: 33 VERIFIED rows in EVIDENCE.md (E-001..E-033). Selection rule: every 5th row starting at E-003, 7 of 33 (21%): E-003, E-008, E-013, E-018, E-023, E-028, E-033.
| Row | Method | Result |
|---|---|---|
| E-003 | Re-open ops/LEDGER.md | Line 28 carries invoice 1015584 `"status":"canceled"`. Matches. The live Zendrop tool is not in system-qc's tool list, so the original tool read was not re-run. |
| E-008 | Re-open ops/LEDGER.md | Lines 45-47 carry `"grossRevenue":{"value":0,"delta":"0%"}` and the orders block. Matches. Tool read not re-run (same reason). |
| E-013 | WebSearch (CDTFA Pub 107) | Result returned https://www.cdtfa.ca.gov/formspubs/pub107; text confirms "no more than two sales in a 12-month period". Nuance: Reg 1595 also tests size and character of sales, not only the count. Confirmed. |
| E-018 | WebSearch | Result returned coloradowebimpressions.com page listing setup-only work at $250-$750 one-time. Confirmed, but the same result says it is one provider's price; other sources give $300-$700 (Slashpost, eCreations), consistent with the 'asking price' framing. |
| E-023 | WebSearch (same search) | pub107 confirmed; cdtfa410d.pdf appears in results. Its second quote ("disposing of unwanted household items ... twice") was not independently seen in the summary. Partial, not false. |
| E-028 | WebSearch | elkgrove.gov "About Business Licenses" page returned; wording matches. Nuance: another city page says licenses go to businesses with a physical location in city limits, which may matter for a home-based owner (L7 / A-010). Confirmed. |
| E-033 | Re-open library/research/income-lanes-2026-10-12.md | Lines 86-99 list the 10 prospects and the excluded list incl. Rob And Sons Soft Wash. Matches. |
Limits: my searches quoted the claim back, so they test corroboration, not discovery. Web results are summaries (same limit the scout disclosed). 6 of 7 confirmed, 1 partial, 0 false. No agent is demoted to default-UNVERIFIED.

## Additional checks beyond the list
- Arithmetic rechecked: T-006 unit math $99+$49+$150+$29 = $327; 109 owner-min gives ~$180/h (matches). T-007 expected-$ lines sum to ~$98 and 1 - 0.94^11 = 49%. TODAY.md line 11 says "~$90 total expected": small mismatch with T-007's $98, no verdict impact. TODAY owner minutes 3+5+15+20+20 = 63 (matches T-007).
- TODAY.md ordering: #2 (A-004, $0 by itself) sits above #3 (~$0.90/min) because it gates them. Defensible, but the file's own rule is "ranked by $/min"; note it in DECISIONS.
- A-004 question count 9 vs 10: resolved (STATE line 8, DECISIONS line 31).

## Recommended fixes (owners fix; I did not edit any file but my own)
- INC-004 Orchestrator: renumber so DECISIONS/STATE match TODAY (or re-issue TODAY). Today, before the owner replies.
- INC-008d scribe: copy C1-C8 into the T-006 TASKS row and EXP cards before any launch.
- INC-003 Orchestrator: put D-012 and D-016 to the owner as an A-### ratification; add a change-control rule for acceptance criteria.
- INC-007 auditor/growth: re-tag E-009, E-010, E-029, E-032, E-033 with quote + primary source, or mark UNVERIFIED.
- INC-005/006/008/009 Orchestrator: amend §6 for IDEAS.md derived columns; use named agent types from session 2; attempt-suffixed handoff names; add Started/Finished UTC and metered-cost fields to TEMPLATE.
- Run qa on library/outreach/* before the owner uses any of it.

## Approvals needed
- Owner ruling on INC-003 (ratify or reverse D-012, D-016): new A-### to be minted by the Orchestrator. Under CLAUDE.md "any CRITICAL incident" is a hard gate; I classed it CRITICAL-candidate, so the Orchestrator decides whether to escalate it as one.
- No other approvals.

## Self-check
- [x] Every finding has evidence (path + line or quote)
- [x] Spot-audit sample stated
- [x] METRICS row complete; estimates labelled; unmetered items named
- [x] No fixes applied by me; wrote only INCIDENTS.md, METRICS.md and this file
- [x] Cost line · [x] under 120 lines

## QUALITY SCORE: 4
Every quick-check item has evidence and the spot audit is stated, but I did not read IDEAS.md cell by cell or the 6 outreach assets, I could not re-run live Zendrop reads, and METRICS cost and time figures are estimates inherited from handoffs.
