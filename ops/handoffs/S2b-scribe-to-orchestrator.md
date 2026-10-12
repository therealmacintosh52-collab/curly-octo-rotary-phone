# S2b — scribe → orchestrator

**Status:** DELIVERED · **Attempt:** 1 of 3 · **Cost:** ~30k in / ~4k out tokens est., wall not metered · model haiku-5-5
**Task:** S2b scribe pass (T-008 qa a1, growth repair, qa a2, S2)

## Rows changed
- LOG.md: 4 rows added (rows 17-20), one per handoff
- TASKS.md: T-008 done, attempts 2, output ops/handoffs/T-008-qa-to-orchestrator-a2.md, cycle time n/a (no timestamps)
- EVIDENCE.md: 0 rows added, not written (no evidence table in the 3 T-008 handoffs)
- STATE.md: 2 lines changed, 57 lines (cap 60)
Files written: LOG, TASKS, STATE only (full Write; Edit tool unavailable).

## Malformed items (logged as instructed; open risk for system-qc)
- T-008-qa-to-orchestrator.md: no Evidence section
- T-008-growth-to-qa.md: no Evidence section
- T-008-qa-to-orchestrator-a2.md: no Outputs, Evidence, Assumptions, Open risks
- S2-scribe-to-orchestrator.md: no What was done, Outputs, Evidence, Assumptions, Acceptance checklist, QUALITY SCORE

## Conflicts / gaps for Orchestrator
1. CONFLICT: input contract says MALFORMED for missing sections; your instruction set DELIVERED/REJECTED. Kept your actions (S1b precedent). T-008 done rests on a2, which lacks 4 sections. Ruling needed.
2. Attempts = 2 (qa a1 + a2) per your instruction. PROTOCOL §3 "+1 per DELIVERED/REJECTED" gives 3 if the growth repair counts. Confirm.
3. Growth's Post-PASS edits (founding terms split, care-plan l.18) came after qa PASS and were not re-checked by qa, yet STATE says "assets qa-PASSED". Your call on a qa re-run.
4. Growth header says "Attempt: 1 of 3"; its Post-PASS section is labelled attempt 2. Logged as one row.

## Self-check
- [x] 4 inputs, 4 LOG rows · [x] owned files only · [x] STATE 57 lines · [x] cost line
