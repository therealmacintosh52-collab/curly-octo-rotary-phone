# S2 (T-013) — system-qc → orchestrator

**Status:** DELIVERED
**Task:** T-013 session-2 quick check, spot audit 20%, METRICS + Scoreboard rows
**Attempt:** 1 of 3
**Cost:** ~300k in (cumulative context) / ~14k out, ~25 min wall · model sonnet · 2 WebSearch · ≈$0.74 uncached upper bound
**Tools used:** Read, Grep, Glob, WebSearch (2), Write. No Bash and no Edit: no `git log --stat`, no `wc` (line counts via Grep count), and INCIDENTS/METRICS had to be rewritten whole (INC-021).

## Verdict
- **Gaming: NO. CRITICAL incidents: 0.** Checked: pre-gate cut-offs and kill thresholds in EXPERIMENTS.md are the red-team cards copied verbatim (lines 28-29, 61-75 of T-009); D-019/D-021 only tightened EXP-A4; no UNVERIFIED relabeled VERIFIED (scribe left 15 failing rows UNQUOTED; scout's F7/F18 added quotes that exist in the repo cache and red-team re-checked 5 of 5); D-026 accepted malformed handoffs on content with the shortfall kept visible; no A-### acted on (nothing sent, posted, created, spent; 0 running).
- **False VERIFIED: 0 found.** Spot audit passed. Quote-confirmed 9 of the 15 UNQUOTED rows by Grep too.
- Gates: all clean except one ambiguity (INC-016). No income claimed.

## Findings ranked (full rows in ops/INCIDENTS.md)
1. **HIGH · INC-012 approval text diverges (Orchestrator).** A-012..A-015 are account-creation and payment-info gates. DECISIONS.md lines 48-51 have no expiry, no background-check consent, no "no paid Connects or membership", no "bank account only"; T-009 lines 78-81 and T-012 lines 37-41 have them. Second occurrence of the INC-008 root cause (wording authored in two places). Fix before the owner answers (Wed 20:00): replace the four DECISIONS rows with T-009's text verbatim.
2. **MED · INC-016 no qa gate on customer-facing copy (Orchestrator).** PROTOCOL §3: qa PASS before anything is shown to a customer. qa reviewed kits only; Grep of T-011/b/c for the offer, listing and profile files returns nothing. Nothing shown yet. Rule before the first send (Wed 12:00): one qa pass (budget 60k/6k) on the four texts, or amend §3 by D-###.
3. **MED · INC-017 tag lint half applied (Orchestrator, builder, qa, growth).** 15 of 25 session-2 rows UNQUOTED. See table below. TODAY.md line 8 tags "$29/mo and $0.00 lifetime revenue" VERIFIED citing ops/STATE.md, a derived record, same as E-029 (INC-007). TEMPLATE line 30 still says only "Every claim tagged"; builder/qa/growth files have no tag rule. This is the 4th+ occurrence of the INC-007 family; D-018 reached only the receivers.
4. **MED · INC-015 builder cost breaker (Orchestrator, builder).** T-010 $8.70 vs $0.70 (T-010 line 6; confirmed T-011 line 71). Breaker cannot trip because agents have no meter. Fix effective: T-010b $0.36 and T-010c $0.13 (35k/6k under a stated 80k/8k cap). But the budgets sit only in dispatch prompts, TASKS rows T-010b/c name none (D-022 said TASKS.md), T-010b has no stated budget so "within budget" is UNVERIFIED, and T-010b says model sonnet against D-002/builder.md opus with no D-###.
5. **MED · INC-013 red-team reviewer miss (red-team).** I-031's VERIFIED quote ("restaurant menu templates appear in that same list") covers menu templates, not niche social kits; IDEAS.md line 48 still carries VERIFIED. Red-team's rejection said "full sweep done" and spot-checked repo rows only. D-016: charged to red-team. Second reviewer miss (INC-003 first).
6. **LOW-MED · INC-018 INC-010 recurred (scribe, Orchestrator).** No UTC time on any S2 LOG row; scout T-008 attempt 1 overwritten (no LOG row, cost unrecorded); PROTOCOL §6 still lacks the scribe IDEAS column exception; S2b says 14 LOG rows, it added 13. Three-line fix, apply now.
7. **LOW-MED · INC-021 system-qc has no git (Orchestrator).** Ownership check relied on self-statements and reflog subjects.
8. **LOW · INC-019** T-010c "8/10", T-011c "Status: VERIFIED", no Attempt lines; accepted on content by D-026. **INC-020** EXP-B1/B2 launched cells both say A-012..A-015 (B1 needs 014/015, B2 needs 012/013; neither names C10) and the EXP-A4 "48 h extension inside 72 h total" has no arithmetic. **INC-022** live board published as an artifact with ledger data, no A-### and visibility unrecorded (UNVERIFIED).
9. **CLOSED INC-014** (T-008 round trip #2), monitor S3.

## Your checks a) to i)
- **a) Round trip #2: CONFIRMED.** T-008 REJECTED (12 defects F1-F12, T-008-red-team-to-scout lines 15-29). Att.2 accepted at the pre-set bar (T-009 lines 10-11). Scout found F13-F22 itself, including I-026 2.45 → 2.25 (I recomputed: 0.70+0.75+0.40+0.40 = 2.25; I-021 3.55 and I-039 2.95 also match). Same root cause as INC-001 (sweep narrower than §1), so the 2× change was applied: `.claude/agents/scout.md` line 37 carries the D-023 text (read). Scout's att.1 "every claim tagged" tick rested on "go-decision numbers only" (quoted by red-team; att.1 file overwritten, so I cannot read it). Cost ≈$1.50.
- **b) Builder cost: CONFIRMED with caveats** (finding 4). T-010c within budget (35k/6k vs 80k/8k). T-010b unverifiable. D-022 not in builder.md or TASKS.md.
- **c) I-031: CONFIRMED** (finding 5).
- **d) Format and CONFLICTs: CONFIRMED.** T-010c score 8/10, T-011c Status VERIFIED, no Attempt lines (INC-019). EXP-B2/B1 cells (INC-020). APPROVALS wording and deadlines (INC-012).
- **e) Tag lint.** 15 UNQUOTED by author (source-handoff column): red-team 2 (E-039, E-041 WebSearch link counts); builder 7 (E-043..E-046 from T-010; E-047..E-049 from T-010b); qa 3 (E-050..E-052); growth 3 (E-055, E-057, E-058). By cause: 7 quote present, date missing (E-044, 045, 046, 051, 052, 055, 057); 4 test-run results the URL/file/quote lint does not fit (E-047..E-050); 2 tool counts; 2 derived-record sources (E-043, E-058). **False VERIFIED: none. Incomplete: all 15.** Quote exists for 9 (Grep: T-006 line 22; review-card-kit lines 19, 21; MASTER-BLUEPRINT lines 25, 27, 200; lane-a-ideas line 23; what-works W6 line 17; T-011b line 28). Not re-checkable: E-039, E-041, E-047..E-050 (tool output and scratchpad runs). Defects: E-041 date recorded "not stated" but T-009 S8 says 2026-10-12 (scribe); E-058 now stale because T-010c removed `--no-desc` (T-011c lines 9-10); E-034/E-035 duplicate E-005/E-008 without a new live read (no harm).
- **f) Ownership: no violation found, with a blind spot.** Growth's whole-file Write of two offer files is in library/outreach (owned). Scribe's IDEAS edits are the verdict/status columns, allowed by scribe.md line 13 but absent from PROTOCOL §6 (INC-018). Builder T-010c left `library/checklists/` to qa (its note, line 38), qa updated it (T-011c line 33). Orchestrator edited scout.md and DECISIONS (owned). No `git log --stat` available (INC-021).
- **g) Gates: CLEAN.** T-010 kits are EXP-A2/A3/A5 (T-006 PASS-WITH-CONDITIONS, Day-1 cards); gbp-pack and ai-search-check reused for B1 which T-009 passed; qa PASS chain T-011 → T-011b → T-011c. No publish, send, spend. 0 running.
- **h) Caps: CLEAN.** STATE.md 49 lines. Planned: A1, A2, A4, B1, B2 = 5 (A3 shelved, A5 merged); no slot left, so any replacement needs a kill first. Longest handoffs T-009 117 and T-008-scout 108 lines (cap 120). "Tools used" on 13 of 13 session-2 handoffs; none outside the owner's list. Scoreboard: no experiment past a time cap, none unlogged.
- **i) Commit b793abc:** external activity (reflog line 27, merge commit before the D-023 commit). Files it touched UNVERIFIED (no git). A `clipforge/` tree exists (D-005 says parked). No session-2 handoff or ops/library row attributes a change to it. Not an incident.

## Spot audit
Population E-034..E-058 (25 rows: 10 VERIFIED, 15 UNQUOTED). 20% = 5, every 5th row, start E-036 (stated before opening): E-036, E-041, E-046, E-051, E-056.
- E-036 TaskRabbit Sacramento IKEA: WebSearch 2026-10-13 returned "Prices begin at a $52" at taskrabbit.com/locations/sacramento/assemble-ikea-furniture. **Confirmed.**
- E-056 TaskRabbit two-hour minimum: WebSearch returned the support.taskrabbit.com article text "as long as you first confirm this with your Client and the Client agrees within the task's chat thread in writing". **Confirmed.**
- E-046 chromium path: Grep sites/cali-tints/scripts/og-images.mjs line 20, string present. **Confirmed.**
- E-051 card text: Grep review-card-kit-2026-10-13.md line 21 "Your honest review helps other customers decide." **Confirmed.**
- E-041 WebSearch count: not re-performable; present at T-009 line 93; date mismatch noted. **No snippet to test.**
Result: 2 of 2 VERIFIED rows in the sample confirmed, 0 false VERIFIED. Extra: E-034/E-035 match T-003b lines 27-28; I did not re-run the Zendrop tool (auditor-only).

## Recommended fixes and owners
| # | Fix | Owner | When |
|---|---|---|---|
| 1 | Reconcile A-012..A-015 in DECISIONS (T-009 text, expiry) | Orchestrator, then scribe re-syncs STATE | before Wed 20:00 |
| 2 | Rule on qa review of customer-facing copy (qa task or §3 amendment) | Orchestrator, then qa | before first send Wed 12:00 |
| 3 | Sender-side tag lint: TEMPLATE line, builder/qa/growth rule, RAN tag for test results, TODAY line 8 re-point, E-041 and E-058 fixes, 7 dates | Orchestrator; growth; scribe | S3 |
| 4 | Budget line in each TASKS row, fresh vs cumulative input in cost lines, builder pause at ~20 calls; record the T-010b tier | Orchestrator, scribe | S3 |
| 5 | Red-team spot-checks include 2 URL-quoted VERIFIED rows for semantic support; scout re-tags I-031 | red-team, scout | next batch |
| 6 | TEMPLATE "Completed (UTC)", `-a2` suffix, §6 scribe exception, fold D-016 into §3 (INC-004) | Orchestrator | S3 |
| 7 | Read-only git for system-qc, and Edit | Orchestrator | S3 |
| 8 | Exact launch cells and a numeric A4 extension rule; board visibility note | Orchestrator, scribe | S3 |

## Errata for ops/INCIDENTS.md (system-qc has no Edit; will fix at next rewrite)
INC-017 evidence cell says "Grep VERIFIED in builder.md/qa.md/growth.md: 0 hits". Correct reading: no tag-lint rule exists in those files; the only hits are the word UNVERIFIED at growth.md line 37 and qa.md line 42.

## Approvals needed
None new. Existing A-012..A-015 are blocked on finding 1.

## Self-check
- [x] Every finding has a path and line or quote · [x] Spot-audit sample stated · [x] METRICS row and Scoreboard row complete (n/a fields give a reason) · [x] No fixes applied by me (owners fix) · [x] Cost line · [x] Under 120 lines · [x] Tools used listed

## QUALITY SCORE: 4
All twelve checks were run against files and 2 live searches, and the numbers re-add. Not a 5: no git means ownership and the ClipForge commit are unverified, scout attempt 1 and several scratchpad runs could not be re-read, and one evidence cell in INCIDENTS.md needs the erratum above.
