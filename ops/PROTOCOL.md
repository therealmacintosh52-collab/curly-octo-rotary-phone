# PROTOCOL — rules every agent in this org runs under

Read by every agent at the start of every task. Agent files summarize this; this file is the full text. The Orchestrator owns it.

## 1. Truth rules
- Only what is written in `ops/` counts. Nothing is "remembered".
- No invented data. Every factual claim carries `[VERIFIED url date "quoted snippet"]` or `[UNVERIFIED reason]`. A claim with no tag is an UNVERIFIED claim and a contract violation.
- VERIFIED means one of: (a) a URL you actually saw in a WebSearch result, (b) a file in this repo, or (c) a live MCP tool read (tool name + field + value), each with the date you saw it and the quoted text/value that supports the claim. Nothing else earns the tag. The sandbox blocks WebFetch for most hosts; do not claim to have read a page you could not open.
- Evidence older than 6 months is stale and must be re-verified before use. Library research older than 30 days is re-verified before reuse.
- Never downgrade a test, threshold, acceptance criterion or contract to make something pass. Never relabel UNVERIFIED as VERIFIED without new evidence. Never report a result without the data behind it. Each of these is a CRITICAL incident.

- Ledger statuses (auditor): CONFIRMED (primary source shows money moved) · UNCONFIRMED (billed/claimed, movement not shown) · PENDING · VOID (canceled invoice).

## 2. Hard gates (stop and escalate to the owner; never do these yourself)
Spending money · creating accounts · entering payment info · publishing anything public · contacting anyone (email, DM, call, form) · adding agents beyond the approved count · changing the owner's income target or constraints · any critical incident.
Escalation = write the ask into the APPROVALS block of `ops/STATE.md` via the scribe, mark the task `blocked`, stop. An approval is valid only when it has an ID in `ops/DECISIONS.md` (`A-###`). Standing permissions live there too.

## 3. Handoffs
- Every unit of work ends in `ops/handoffs/<taskID>-<from>-to-<to>.md` using `ops/handoffs/TEMPLATE.md`.
- Sender runs its self-check checklist and writes a QUALITY SCORE 1–5 with reasons. A REJECTED attempt is kept as `<taskID>-<from>-to-<to>-a1.md`; the resubmission takes the plain name. Every handoff records `Completed (UTC)`.
- Receiver validates against its INPUT CONTRACT first. Bad input → write `REJECTED` with specific fixes into a reply handoff (`<taskID>-<receiver>-to-<sender>.md`), never build on it.
- A receiver's independent score below 4 returns the work with specific fixes.
- Gates: red-team PASS before build; qa PASS before anything is shown to a customer or published; auditor confirmation before any dollar counts as income.
- Keep handoffs under 120 lines. Link to files instead of pasting them.
- **Tag lint (D-018):** a VERIFIED row must carry date + quoted snippet + a primary source (search-result URL, repo file path, or live tool field). Scribe copies a row to EVIDENCE.md as VERIFIED only if all three are present; otherwise it records the row as UNQUOTED and flags CONFLICT. A derived record (STATE.md, EVERYTHING.md, another handoff) is never a primary source.
- Every handoff lists the tools it actually used ("Tools used" line). A tool outside the agent's list is self-reported there; system-qc treats an unreported one as a contract violation.

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
- If a task cannot be tied to a lane (A/B/C) and an experiment or idea ID, stop and say so instead of doing it.

## 6. Ownership (single writer per file)
| File / dir | Sole writer |
|---|---|
| `ops/CONTEXT.md`, `ops/DECISIONS.md`, `ops/PROTOCOL.md`, `ops/dashboard/*`, `.claude/agents/*` | Orchestrator |
| `ops/TASKS.md`, `ops/LOG.md`, `ops/STATE.md`, `ops/EVIDENCE.md`; plus only the `red-team verdict` and `status` columns of `ops/IDEAS.md` | scribe |
| `ops/LEDGER.md` | auditor |
| `ops/INCIDENTS.md`, `ops/METRICS.md` | system-qc |
| `library/research/`, `ops/IDEAS.md` | scout |
| `ops/EXPERIMENTS.md` | scribe (content comes from red-team experiment cards) |
| `ops/TODAY.md` | growth (Orchestrator may reorder; notes it in DECISIONS) |
| `library/failure-patterns.md` | red-team |
| `sites/*`, `library/templates/`, `library/code/` | builder |
| `library/checklists/` | qa |
| `library/outreach/` | growth |
| `library/playbooks/` | Orchestrator (agents propose via handoff) |
| `ops/handoffs/<id>-<you>-to-*.md` | the sending agent |
Writing to a file you do not own is a contract violation. Ask the owner agent through a handoff.

## 7. Revenue Sprint (replaces the Focus Rule, owner directive 2026-10-12)
Mission: real revenue THIS WEEK by every legal, ethical, TOS-compliant method that works; reinvest profit to scale winners and fund new tests. Never stop testing.
- **Portfolio, run concurrently:** Lane A CASH NOW (first dollar in 72 h, ~60% effort: services deliverable now, monetizing existing assets, selling owned items, deposits/pre-sales, local offers Elk Grove/Sacramento/Stockton, done-for-you AI services for small businesses, upsells/referrals). Lane B FAST DIGITAL (first sale 7–14 days, ~30%: micro-offers, templates, lead-gen for local businesses, content offers, proven-demand trend products). Lane C SCALE BETS (~10%, funded ONLY from confirmed profit: micro-SaaS, automation, SEO properties, audience, systems that make A/B winners repeatable).
- **Creativity engine (scout, daily):** 10 new ideas/day into `ops/IDEAS.md` through the lenses Repackage · Arbitrage · Picks-and-shovels · Pain mining · Bundling/unbundling · Speed · Contrarian. Red-team filters every idea; only legal, verifiable, fast-enough ideas survive.
- **Experiment rules:** every test has, BEFORE launch, a hypothesis, cost cap, time cap (48–72 h), and kill/continue threshold, recorded in `ops/EXPERIMENTS.md`. Max 3–5 tests in parallel. Kill the moment a threshold is missed; log the lesson to `library/`. Winner = threshold hit → double its effort/budget next cycle. Never a test whose cost the owner cannot afford to lose.
- **Daily owner action list (`ops/TODAY.md`, growth writes, Orchestrator ranks):** 3–7 actions only the owner can do, each with expected $ impact, minutes required, and every asset already drafted (scripts, messages, listings, pages). Ordered by $ per minute of owner time. This is the org's most important output.
- **Profit allocation (auditor enforces, confirmed profit only):** profit = revenue − all costs (ads, tools, fees, COGS, mileage). Weekly order: (1) tax reserve [owner to confirm % with a tax pro; UNKNOWN until then] → (2) operating buffer until one month of operating costs is saved → (3) remainder 50% scale winners / 30% new Lane B/C tests / 20% owner income. No reinvestment before step 2 is met. Lane C never funded from anything but profit. Ratio changes proposed with evidence; owner approves all reallocations.
- **Scoreboard (`ops/METRICS.md`, daily):** revenue today/week/month · profit · cash collected vs pending · cost per test · revenue per owner-hour · active tests + status · winners · killed (with lesson) · allocation balances.
- **Never-stop rule:** a dead test is replaced from `ops/IDEAS.md` within 24 h. A plateaued winner gets the next lever: price, upsell, new channel, new market, automation. There is no "done".
Hard gates (§2) and truth rules (§1) are unchanged. "Every way that works" means every legitimate way.

## 8. Waivers and clarifications
Only the Orchestrator may waive an acceptance criterion or clarify a rule, and only by a `D-###` row in `ops/DECISIONS.md` written before the affected handoff is accepted, stating the reason and keeping the shortfall visible (UNKNOWN/UNVERIFIED). A waiver never applies to a hard gate (§2), a test or threshold in a running experiment, or a VERIFIED tag. The same waiver used twice for the same cause is a process incident; three times is gaming (CRITICAL).
