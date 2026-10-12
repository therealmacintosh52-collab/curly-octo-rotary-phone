# Growth Game Board — the owner's live view

URL: https://claude.ai/artifact/XamS5YHiL4nxM4PMu6EVSC (private to the owner). Page source: `growth-game-board.html` (republish only when the page itself changes). Data lives in the artifact's database and is read/written with the `ArtifactData` tool; the page updates live on the owner's phone.

## Every session (Orchestrator, after scribe's STATE rewrite)
1. **Read first**: `list approvals` → any `status: yes|no` with `answeredAt` newer than the last run is the owner's answer; transcribe it into `ops/DECISIONS.md` (Owner answer + date). `list quests` → `status: done` and `credited: false` → the owner did it: credit XP (state.xp += quest.xp, set `credited: true`), count it (pitches, audits), and advance the matching TASKS/EXPERIMENTS row.
2. **Write back** (one batch, pin `if_version`): `board/state` (session, phase, gate, level, xp, streak, revenueConfirmed from LEDGER CONFIRMED only, burnMonthly, pitches, clients, bossGoal/bossDone/bossTotal, tip + tipTag, nextAction, updatedAt); replace `quests` with the top 3 rows of `ops/TODAY.md` (delete done/stale ones; ids q1..q3 + session); `approvals` = every open `A-###` from DECISIONS (status open), hard-gate items on hold as `hold`, answered ones updated; append ≤3 `feed` rows (kind: moved | fixed | incident | money) and prune to the newest 30.

## Schema
- `board/state`: session, mode, phase, gate, level, xp, streak, revenueConfirmed, burnMonthly, burnNote, pitches, clients, bossGoal, bossDone, bossTotal, tip, tipTag, nextAction, updatedAt
- `quests/q#`: order, title, minutes, xp, expected, why, steps[], asset, status (open|done), doneAt, credited, session
- `approvals/A-###`: item, why, scope, status (open|yes|no|hold), note, answeredAt
- `feed/f-<date>-<n>`: ts, kind, text
- `agents/<name>` (one per agent, ids scout, red-team, builder, qa, growth, auditor, system-qc, scribe): hat, status (idle|working|done|blocked|rejected), task, result, score, updatedAt. **Write `working` + task at every dispatch and the result when the handoff lands**, so the owner sees the team move in real time.
- `tasks/T-###`: title, status (working|blocked|rejected|ready|done), now (the step lit now), passed[] and failed[] (subset of scout, red-team, builder, qa, growth, owner, auditor), note. Keep the newest 8; delete older done rows.
- `board/state.orchestrator`: one line on what the Orchestrator is doing now, or "Idle; next run <time>".

## Rules
Numbers come only from LEDGER (money), METRICS (counts) and TODAY (quests). XP is credited only for quests the owner marked done; money XP only after auditor CONFIRMED. The page never sends, spends or contacts anyone; a tap on Yes is an approval the Orchestrator logs, nothing more.
