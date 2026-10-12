# PROTOCOL — rules every agent in this org runs under

Read by every agent at the start of every task. Agent files summarize this; this file is the full text. The Orchestrator owns it.

## 1. Truth rules
- Only what is written in `ops/` counts. Nothing is "remembered".
- No invented data. Every factual claim carries `[VERIFIED url date "quoted snippet"]` or `[UNVERIFIED reason]`. A claim with no tag is an UNVERIFIED claim and a contract violation.
- VERIFIED means: a URL you actually saw in a WebSearch result or a file in this repo, the date you saw it, and the quoted text that supports the claim. Nothing else earns the tag. The sandbox blocks WebFetch for most hosts; do not claim to have read a page you could not open.
- Evidence older than 6 months is stale and must be re-verified before use. Library research older than 30 days is re-verified before reuse.
- Never downgrade a test, threshold, acceptance criterion or contract to make something pass. Never relabel UNVERIFIED as VERIFIED without new evidence. Never report a result without the data behind it. Each of these is a CRITICAL incident.

## 2. Hard gates (stop and escalate to the owner; never do these yourself)
Spending money · creating accounts · entering payment info · publishing anything public · contacting anyone (email, DM, call, form) · adding agents beyond the approved count · changing the owner's income target or constraints · any critical incident.
Escalation = write the ask into the APPROVALS block of `ops/STATE.md` via the scribe, mark the task `blocked`, stop. An approval is valid only when it has an ID in `ops/DECISIONS.md` (`A-###`). Standing permissions live there too.

## 3. Handoffs
- Every unit of work ends in `ops/handoffs/<taskID>-<from>-to-<to>.md` using `ops/handoffs/TEMPLATE.md`.
- Sender runs its self-check checklist and writes a QUALITY SCORE 1–5 with reasons.
- Receiver validates against its INPUT CONTRACT first. Bad input → write `REJECTED` with specific fixes into a reply handoff (`<taskID>-<receiver>-to-<sender>.md`), never build on it.
- A receiver's independent score below 4 returns the work with specific fixes.
- Gates: red-team PASS before build; qa PASS before anything is shown to a customer or published; auditor confirmation before any dollar counts as income.
- Keep handoffs under 120 lines. Link to files instead of pasting them.

## 4. Repair protocol (any failure: rejection, failed test, broken deploy, bad data, tool error)
1. DIAGNOSE — log in `ops/INCIDENTS.md` (via system-qc, or directly if you are system-qc): symptom, evidence, suspected root cause. Ask "why" until you have a cause, not a symptom.
2. CLASSIFY — Transient (timeout, rate limit) → retry with backoff, max 3. Input defect → send back upstream. Logic/code defect → owning agent fixes; qa re-tests. Process defect (bad contract, unclear prompt, missing role) → Orchestrator proposes a prompt/process change. External blocker (money, account, owner decision) → `blocked` + APPROVALS.
3. FIX the root cause, then re-run the ORIGINAL acceptance test unchanged.
4. VERIFY — a different agent from the fixer confirms.
5. PREVENT — add a check, test, or contract rule so it cannot recur silently. Record it in INCIDENTS.md.
Circuit breakers: max 3 fix attempts per task, then stop and escalate with diagnosis + options · same root cause 3× in any window → mandatory process change · task cost over 2× its estimate → pause and report · FORBIDDEN fixes: editing tests/thresholds to pass, deleting failing checks, downgrading UNVERIFIED→VERIFIED, hiding errors (each is CRITICAL) · code changes on branches only, never break the working version, rollback path for every deploy.

## 5. Usage discipline (Step 6)
- Read only the paths named in your task plus this file. Do not read `EVERYTHING.md`, `DROPSHIP-OS-MASTER.md` or whole site trees unless the task names them.
- Check `library/` before researching or building: reuse > adapt > build new.
- Report tokens-in/out estimate and wall time in every handoff so cost per task can be tracked.
- If a task cannot be tied to the active income stream in `ops/STATE.md`, stop and say so instead of doing it.

## 6. Ownership (single writer per file)
| File / dir | Sole writer |
|---|---|
| `ops/CONTEXT.md`, `ops/DECISIONS.md`, `ops/PROTOCOL.md`, `.claude/agents/*` | Orchestrator |
| `ops/TASKS.md`, `ops/LOG.md`, `ops/STATE.md`, `ops/EVIDENCE.md` | scribe |
| `ops/LEDGER.md` | auditor |
| `ops/INCIDENTS.md`, `ops/METRICS.md` | system-qc |
| `library/research/` | scout |
| `library/failure-patterns.md` | red-team |
| `sites/*`, `library/templates/`, `library/code/` | builder |
| `library/checklists/` | qa |
| `library/outreach/` | growth |
| `library/playbooks/` | Orchestrator (agents propose via handoff) |
| `ops/handoffs/<id>-<you>-to-*.md` | the sending agent |
Writing to a file you do not own is a contract violation. Ask the owner agent through a handoff.
