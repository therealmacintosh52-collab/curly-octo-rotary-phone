# METRICS — chain health (system-qc is the sole writer)

One row per session. Trend line rewritten each session. Weekly report names the slowest and most expensive link with a fix for each.

| session | date | tasks done | avg cycle time (h) | rejection rate by link | rework rate | incidents (by agent) | cost per task (API-equiv $) | session cost | time-to-first-dollar (days) | revenue / owner-hour | library reuse rate | slowest link | most expensive link |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-10-12 | 6 of 7 (T-001, T-002 folded, T-003, T-005, T-006, T-007; T-004 in progress) | 0.41 (5 timed tasks; agent wall minutes from handoff Cost lines, not first-doing to done; T-002 untimed) | scout→red-team 1 of 3 (T-005 attempt 1; T-001 accepted by waiver) · red-team→growth 0 of 1 · growth→Orchestrator 0 of 1 · auditor→Orchestrator 0 of 1 · overall 1 of 6 deliveries (17%) | 2 of 6 tasks with attempts >1 (T-005 rejected, T-006 attempt 1 blocked by it) = 33%; the one rejection cycle cost about $1.02 of $3.06 metered subagent spend = 33% | 11 total, 0 CRITICAL, 1 closed, 10 open. Involvement: Orchestrator 6, scribe 3, red-team 2, growth 2, auditor 2, scout 1, system-qc 1 | Metered subagents $3.06 / 6 done = $0.51. With Orchestrator estimate $6.56 / 6 = $1.09 | $7.40 estimate (subagents $3.06 + Orchestrator ~$3.50 est. + system-qc ~$0.84 est.). Scribe S1/S1b unmetered; scout T-005 attempt 1 unrecorded (lower bound) | n/a (nothing launched; no CONFIRMED inflow, LEDGER section 4) | n/a (no revenue; no owner hours used) | n/a (no per-task reuse log; T-001 checked library, 0 reusable of 1 check) | red-team on T-006 (0.7 h, incl. blocked first pass) | Orchestrator (~$3.50 est., 53% of $6.56). Among subagents: red-team $1.78 (58% of $3.06) |

## Scoreboard (daily; Revenue Sprint)
| date | revenue today / week / month | profit (confirmed) | cash collected vs pending | cost per test | revenue per owner-hour | active tests (ID: status) | winners | killed (ID: lesson → library path) | allocation balances (tax / buffer / scale / tests / owner) |
|---|---|---|---|---|---|---|---|---|---|
| 2026-10-12 | $0 / $0 / $0 | $0 | collected $0 / pending $0 (memo: Zendrop $29 Oct 9 invoice pending, $58 billed UNCONFIRMED; both outflows, not revenue; LEDGER section 4) | n/a (no test launched) | n/a (no revenue, 0 owner hours) | EXP-A1..EXP-A5: planned (0 running; cap 5 respected; none past its time cap) | none | none | $0 / $0 / $0 / $0 / $0 |

## Cost detail, session 1 (tokens are agent self-estimates from each handoff Cost line; rates from ops/CONTEXT.md line 28: fable $10/$50, opus $4/$20, sonnet $2/$10, haiku $0.10/$0.50 per MTok in/out)
| agent | runs | tokens in / out | $ |
|---|---|---|---|
| scout (sonnet) | T-001 150k/16k; T-005 attempt 2 120k/14k (attempt 1 unrecorded) | 270k / 30k | 0.84 |
| red-team (opus) | T-006 attempt 1 (T-005 reject) 110k/10k; T-006 attempt 2 210k/15k | 320k / 25k | 1.78 |
| growth (sonnet) | T-007 75k/28k | 75k / 28k | 0.43 |
| auditor (haiku) | T-003 30k/5k | 30k / 5k | 0.01 |
| scribe (haiku) | S1, S1b: "not metered" | n/a | n/a (immaterial: 300k/30k would be $0.05) |
| Orchestrator (fable) | not metered; ~250k/20k per Orchestrator instruction | ~250k / ~20k | ~3.50 |
| system-qc (sonnet) | this check; estimate, uncached upper bound | ~350k / ~15k | ~0.85 |

By task: T-001 $0.46 · T-002 $0 (folded) · T-003 $0.01 · T-005 $0.38 scout + $0.64 red-team reject = $1.02 (scout attempt 1 unrecorded) · T-006 $1.14 (attempt 2) · T-007 $0.43 · T-004 ~$0.85 (est.).

## Trend
(not enough data: 1 session.) Baselines set: cost per done task $0.51 (subagents, metered), rejection rate 17%, cycle time 0.41 h, tag-form defects seen from 4 agents (scout, red-team, growth, auditor; INC-001, 003, 007). Watch in S2: whether named agent types remove the tool-overreach class (INC-005/006) and whether the A-ID swap (INC-008) is fixed before the owner answers.
