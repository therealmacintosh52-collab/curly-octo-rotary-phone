# T-006 — red-team → growth

**Status:** BLOCKED (input REJECTED)
**Task:** (1) one-line PASS/FAIL per idea with killing reason; (2) top 5 ranked; (3) experiment card per survivor; (4) automatic REJECTED if any T-005 claim untagged
**Attempt:** 1 of 3
**Cost:** counted in `ops/handoffs/T-005-red-team-to-scout.md` (one pass, ~110k/~10k tokens est., opus, 0 WebSearch)

## What was done
Input contract check failed. T-005 has 6 untagged claims and 5 mis-tags. Under D-007 it is REJECTED and returned to scout with exact fixes in `ops/handoffs/T-005-red-team-to-scout.md`. I produced no PASS/FAIL verdicts, no ranking and no experiment cards. **No I-### row is red-teamed yet. Growth must not build TODAY.md actions from IDEAS.md until T-006 attempt 2 delivers.**

## Outputs
- `ops/handoffs/T-005-red-team-to-scout.md`: REJECTED, fixes U1-U6 and M1-M5, re-score bar fixed at 4
- `library/failure-patterns.md`: FP-07 blanket citation appended

## Evidence
| # | Claim | Tag | Source (url · date · quoted snippet) |
|---|---|---|---|
| 1 | Bad input is never built on | VERIFIED | repo ops/PROTOCOL.md §3 · 2026-10-12 · "Bad input → write `REJECTED` with specific fixes into a reply handoff" |

## Assumptions
- None.

## Open risks
- Next steps: (1) Orchestrator re-dispatches T-005 attempt 2 (scout, ~15 min, no searches). (2) T-006 attempt 2 runs on the corrected input. (3) T-007 follows. (Orchestrator)
- Owner action is independent of this block: A-004 answers (payment rail, did the two sites pay, owned items) decide most verdicts anyway. Asking for them now saves a day. (Orchestrator/scribe)

## Acceptance checklist (from TASKS.md, verbatim)
- [ ] (1)-(3): not done, input rejected
- [x] (4) automatic REJECTED if any T-005 claim untagged: applied

## Self-check
- [x] Every claim tagged · [x] Only owned files written · [x] No hard-gate action taken · [x] Under 120 lines · [x] Cost line filled

## QUALITY SCORE: 4
This is a status stub. The substance is in the T-005 reply.

## Receiver validation (filled by the receiving agent)
- Input contract met: YES / NO — 
- Independent score: — 
- Action: ACCEPTED / REJECTED (fixes: …)
