# S2 — scribe → orchestrator

**Status:** DELIVERED
**Task:** S2 scribe pass, session 2 (Orchestrator instruction steps 1–7)
**Attempt:** 1 of 3
**Cost:** ~70k/7k tokens (estimate, not metered), wall not metered · model haiku

## Rows added / changed
- LOG.md: 4 rows added (system-qc T-004 MALFORMED · orchestrator T-002 FOLDED · scribe S1b DELIVERED · orchestrator PLAYBOOK-ADOPTED)
- TASKS.md: T-004 set to done (attempts 1, cycle time n/a); T-008 added (qa, doing, attempts 0)
- EVIDENCE.md: 0 rows added; 5 status cells set to `UNVERIFIED (D-021, INC-007)`: E-009, E-010, E-029, E-032, E-033
- EXPERIMENTS.md: EXP-A1..A5 rows; column `red-team conditions` added, T-006 line 116 pasted whole (D-021)
- STATE.md: rewritten, 57 lines (cap 60)

## Files rewritten
- ops/LOG.md, ops/TASKS.md, ops/EVIDENCE.md, ops/EXPERIMENTS.md, ops/STATE.md (full rewrites; only the cells above differ). This handoff: new file, no LOG row (output, not input; S1b precedent).
- Not touched: input handoffs, IDEAS, DECISIONS, INCIDENTS, LEDGER, TODAY, METRICS, library/

## Malformed items
- S1-system-qc-to-orchestrator.md: TEMPLATE sections missing: Outputs, Evidence table, Assumptions, Open risks, Acceptance checklist. Logged MALFORMED; nothing guessed; listed for system-qc.
- S1b-scribe-to-orchestrator.md: same five sections missing. Logged DELIVERED because step 2b was instructed; flagged here.

## Conflicts / gaps for Orchestrator
1. CONFLICT · T-004: instruction sets `done`; S1 is MALFORMED. Kept `done` as instructed. Rule needed: keep `done`, or `review` until S1 is re-issued in template form.
2. GAP · INC-008(d) TASKS side: T-006 TASKS row does not carry C1–C8. EXP cards carry the line; its text says "(in TASKS.md before launch)". Not added (not in instruction).
3. Cosmetic: DECISIONS lists A-005 after A-011; STATE uses ID order.
4. A-008 = EXP-A3 and A-009 = EXP-A4 (D-020) used as DECISIONS.md states.
5. library/playbooks/growth-agency-mos.md and growth-agency-mos-adapter.md exist (Glob); contents not read.

## Open risks (for system-qc)
- S1 and S1b outside TEMPLATE (see Malformed items).
- INC-008(c) overwritten attempt files unrecoverable; (e) T-001 receiver validation still blank. Not in S2 scope.
- EXPERIMENTS.md "launched" column reads "pending A-### (see card)" for all five rows; card IDs are not yet assigned.

## Self-check
- [x] Instructed LOG rows added (4); S1 handled as MALFORMED
- [x] STATE.md 57 lines (≤60)
- [x] Claims, scores, statuses and numbers copied, not changed
- [x] Only owned files written · [x] Cost line filled
