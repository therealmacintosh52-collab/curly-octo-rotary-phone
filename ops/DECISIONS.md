# DECISIONS — Orchestrator's log of decisions and owner approvals

Two tables. Approvals carry IDs `A-###`; an agent may act on a hard-gate item only by citing one.

## Decisions (Orchestrator)
| Date | ID | Decision | Why | Status |
|---|---|---|---|---|
| 2026-10-12 | D-001 | Org of 8 subagents (scout, red-team, builder, qa, growth, auditor, system-qc, scribe) + Orchestrator; single-writer file ownership (`ops/PROTOCOL.md` §6) | Minimum set covering every required function with separation of duties; scribe added so the fable-tier orchestrator stops paying for bookkeeping | Owner approved the design 2026-10-12 |
| 2026-10-12 | D-002 | Model tiers: opus for red-team and builder; sonnet for scout, qa, growth, system-qc; haiku for auditor, scribe; system-qc deep review every 5th session at opus | Cheapest adequate model per task; escalate only when quality fails | Active |
| 2026-10-12 | D-003 | Recommend stream #1 = local-business website service; test against reselling in T-001/T-002 | Only lane where agents do ~90% of the work, bills recurring, and reuses a finished asset | Pending A-001 |
| 2026-10-12 | D-004 | Recommend parking Trendlift and cancelling Zendrop | $0 in 4 months, store frozen, 0/19 products viable, $29/mo bleed | Pending A-002 |
| 2026-10-12 | D-005 | ClipForge parked | Needs a PC; owner is phone-only | Active |
| 2026-10-12 | D-006 | "Viral" is not an optimization target; growth optimizes deposits per owner-hour | Virality without a payment path is a vanity metric | Active |
| 2026-10-12 | D-007 | Red-team auto-rejects any handoff with an untagged claim | Deliberate test that the Repair Protocol round-trips on the first cycle | Active |
| 2026-10-12 | D-008 | Session 1 runs agents as general-purpose subagents with the matching model tier, each told to adopt its `.claude/agents/<name>.md` definition | Claude Code loads custom agent types at session start; files created mid-session are not invocable by name until the next session. From session 2 use the named types directly | Active (session 1 only) |

## Owner approvals (`A-###`)
| ID | Asked | Item | Owner answer | Date answered | Scope / expiry |
|---|---|---|---|---|---|
| A-001 | 2026-10-12 | Choose stream #1 after reading T-001/T-002 | — | — | Until stream target met |
| A-002 | 2026-10-12 | Cancel Zendrop subscription (owner does it in the Zendrop app; agents cannot) | — | — | One-time |
| A-003 | 2026-10-12 | Standing permissions below | — | — | Until revoked |
| A-004 | 2026-10-12 | Fill the UNKNOWNS block in `ops/CONTEXT.md` | — | — | One-time |

## Standing permissions (proposed; inactive until A-003 = yes; strike any line you disagree with)
- SP-1 builder may commit to the session branch and push to GitHub (private repo, no public surface).
- SP-2 builder may trigger the existing GitHub Pages preview workflow for a client site preview (public but unlisted URL, no client branding claims beyond the intake).
- SP-3 growth may create Gmail **drafts** (never send).
- SP-4 auditor may read Zendrop and Shopify billing/orders tools.
- SP-5 scout/red-team/system-qc may run WebSearch freely.
- SP-6 Nobody may send, post, buy, pay, create accounts, or publish to a production URL without a one-time `A-###`.
