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
| 2026-10-12 | D-009 | Adopt the owner's Revenue Sprint Module; it replaces the Focus Rule. Lanes A/B/C concurrent, experiment cards, daily TODAY.md, profit allocation, scoreboard, never-stop rule (`ops/PROTOCOL.md` §7) | Owner directive 2026-10-12 | Active |
| 2026-10-12 | D-010 | New records: `ops/IDEAS.md` (scout), `ops/EXPERIMENTS.md` (scribe, from red-team cards), `ops/TODAY.md` (growth). Agent definitions updated accordingly | Required by D-009 | Active |
| 2026-10-12 | D-011 | VERIFIED extended to live MCP tool reads (tool+field+value+date). Ledger status enum fixed: CONFIRMED / UNCONFIRMED / PENDING / VOID; auditor's `UNVERIFIED-LIVE` renamed UNCONFIRMED | Raised by auditor in T-003 | Active |
| 2026-10-12 | D-012 | T-001 accepted at score 3 with criterion 3 (25 prospects) waived: WebSearch cannot prove a business lacks a website, so the criterion was unachievable as written (process defect, mine). Replacement rule: prospects list what the snippet shows; has-website is UNKNOWN until the owner checks the Google Maps card. T-002 (red-team lane review) folded into T-006 (idea filter) to save one opus call; the website-service lane is reviewed there as an idea | Scout's honest shortfall report; sprint makes a standalone lane ranking less central | Active |
| 2026-10-12 | D-013 | QUALITY SCORE rates the work, not the owner's open questions. Correctly flagged UNKNOWNs do not lower a score; untagged or mis-tagged claims do | Red-team T-006: scoring down for owner-gated unknowns would loop forever | Active |
| 2026-10-12 | D-014 | Receiver validation lives in the receiver's own file (reply handoff on REJECTED; "Input validation" section of the forward handoff on ACCEPTED). TEMPLATE.md updated. T-003's validation, filled by scribe on my behalf, stands as a one-off | Red-team T-006: the template conflicted with single-writer ownership (§6) | Active |
| 2026-10-12 | D-015 | First Repair Protocol round-trip confirmed working: T-005 REJECTED by red-team under D-007 (11 tag defects), re-dispatched as attempt 2 with the fix list unchanged, re-score bar fixed in advance at 4 | Deliberate test passed; system-qc logs it as INC-001 (input defect) | Active |
| 2026-10-12 | D-016 | T-005 attempt 2 ACCEPTED at red-team's pre-set bar (no *new* untagged claim). Three phrases red-team missed in attempt 1 are recorded UNVERIFIED in its own file (FP-08); they do not affect any go decision. D-007 is clarified: the auto-reject applies to the receiver's first validation; a receiver's own later miss is logged as an incident against the receiver, not charged against the sender's attempts | Red-team's request; burning scout's last attempt on the reviewer's miss would be perverse | Active |
| 2026-10-12 | D-017 | A-008/A-009 corrected to match T-006/T-007/TODAY.md (A-008 = EXP-A3 AI-search check; A-009 = EXP-A4 site). Orchestrator made the matching two-line fix in STATE.md directly (scribe-owned) as an emergency sync before the owner could answer; disclosed here for system-qc | INC-008 (HIGH, launch-blocking) | Closed |
| 2026-10-12 | D-018 | Mandatory process change (INC-007, 3× rule): tag lint. A VERIFIED row needs date + quoted snippet + a primary source (URL, repo file, or live tool field); scribe marks failing rows UNQUOTED and flags CONFLICT instead of copying them as VERIFIED. PROTOCOL §3 and TEMPLATE updated ("Tools used" line added). Waiver clause added as PROTOCOL §8. Scribe's out-of-scope tool call (INC item c) was reported in its hand-back message, not in a file; recorded here so it exists in ops/ | system-qc S1 findings 2, 3, 4 | Active |
| 2026-10-12 | D-019 | Session 2 opens with: scribe copies C1–C8 into the EXPERIMENTS.md header (INC-009); auditor renames UNVERIFIED-LIVE → UNCONFIRMED and fills agent-usage (INC-011); scout tags r1–r3 in IDEAS.md (INC-004); EXP-A4's built-in extension capped at 72 h total; named agent types used (D-008 ends) | system-qc S1 fixes 5–8 | Queued |

## Owner approvals (`A-###`)
| ID | Asked | Item | Owner answer | Date answered | Scope / expiry |
|---|---|---|---|---|---|
| A-001 | 2026-10-12 | Choose stream #1 after reading T-001/T-002 | — | — | Until stream target met |
| A-002 | 2026-10-12 | Cancel Zendrop subscription (owner does it in the Zendrop app; agents cannot) | — | — | One-time |
| A-003 | 2026-10-12 | Standing permissions below | — | — | Until revoked |
| A-004 | 2026-10-12 | Fill the UNKNOWNS block in `ops/CONTEXT.md` (9 questions, numbered in CONTEXT order) | — | — | One-time |
| A-006 | 2026-10-12 | Check Shopify billing for store ft6xi1-n1: were the Jun and Jul $29 Zendrop charges actually collected? (owner-only; agents cannot see it) | — | — | One-time |
| A-007 | 2026-10-12 | Send the EXP-A2 ($99 Google Business Profile pack) text once to each listed business (wording: `library/outreach/gbp-pack-offer-2026-10-13.md`) | — | — | One send per business |
| A-008 | 2026-10-12 | Send the EXP-A3 ($49 AI-search readiness check) text once to each listed business (`library/outreach/ai-search-check-offer-2026-10-13.md`) | — | — | One send per business |
| A-009 | 2026-10-12 | Send the EXP-A4 ($450 site / $150 deposit, or $590 annual) text once to each listed Elk Grove prospect (`library/outreach/founding-site-offer-2026-10-13.md`) | — | — | One send per business |
| A-010 | 2026-10-12 | Apply for a business license (Elk Grove or Sacramento per your address), fee up to $25 | — | — | One-time |
| A-011 | 2026-10-12 | Activate a payment rail for business payments (only if you have none; name the app) | — | — | One-time |
| A-005 | 2026-10-12 | Tax reserve % (placeholder 25% until confirmed with a tax pro) | — | — | Until changed |

## Standing permissions (proposed; inactive until A-003 = yes; strike any line you disagree with)
- SP-1 builder may commit to the session branch and push to GitHub (private repo, no public surface).
- SP-2 builder may trigger the existing GitHub Pages preview workflow for a client site preview (public but unlisted URL, no client branding claims beyond the intake).
- SP-3 growth may create Gmail **drafts** (never send).
- SP-4 auditor may read Zendrop and Shopify billing/orders tools.
- SP-5 scout/red-team/system-qc may run WebSearch freely.
- SP-6 Nobody may send, post, buy, pay, create accounts, or publish to a production URL without a one-time `A-###`.
