# Adapter — running the Growth Agency MOS inside this org

Owner of this file: Orchestrator. Source text: `library/playbooks/growth-agency-mos.md` (owner directive 2026-10-12, verbatim). Decision: D-017. Approval to run it as the Lane A stream: A-012.

The MOS describes one Director and 13 named specialists. This org is capped at 8 agents (hard gate, `CLAUDE.md`). Nothing new is created; every MOS role is a *hat* an existing agent wears, named in the task row's inputs. Where the MOS and `ops/PROTOCOL.md` disagree, PROTOCOL and the hard gates win; the rest of the MOS applies as written.

## 1. Role map (MOS role → org agent that wears the hat)
| MOS role | Agent | Notes |
|---|---|---|
| DIRECTOR (CGO / Watchdog / Game Master) | Orchestrator | Sets goals, Boss Battle, Quests; names the #1 bottleneck; ends every report with the single next action. Quality Gate = red-team (plans) + qa (deliverables), not the Orchestrator's own judgment |
| A1 PROBLEM HUNTER | scout | Pain-point research with source + date; output goes into `ops/IDEAS.md` with the MOS scores (Pain, Frequency, Willingness to pay, Competition, Speed, Fit) as a column set |
| A2 OFFER ARCHITECT | scout drafts → red-team gates | Offer cards use the experiment-card fields in `ops/EXPERIMENTS.md` (hypothesis, cost cap, time cap, kill threshold) plus the MOS fields (who, outcome, deliverables, price logic, risk reversal, margin, upsell) |
| A3 DELIVERY & AUTOMATION ENGINEER | builder (SOPs, templates, code) + growth (onboarding, checklists) | Only after red-team PASS; only at the current Reinvestment Level |
| B1 BRAND STRATEGIST | scout (research, name-conflict search) + growth (positioning copy) | Name-conflict search is a scout task with WebSearch evidence before any name is used in outreach |
| B2 ALGORITHM & TRENDS INTEL | scout | Every claim tagged VERIFIED(url,date,snippet) / CONSENSUS / HYPOTHESIS; >6 months = STALE (same as PROTOCOL §1) |
| B3 CONTENT ENGINE | growth | Drafts only, under `library/outreach/` |
| B4 SOCIAL & COMMUNITY MANAGER | growth (plan) → owner (posts) | Posting is a hard-gate action; owner executes from `ops/TODAY.md` |
| B5 FREE ADVERTISING HACKER | scout (ranked channel list, evidence) → growth (assets) | |
| B6 LEAD GEN SPECIALIST | scout (lists from public listings) + growth (lead magnet, free-audit template, Sheets CRM layout) | No personal-data scraping (CONTEXT hard constraint) |
| B7 SALES CLOSER | growth | Scripts, objections, 7-touch follow-up as drafts; owner sends |
| C1 PAID MEDIA BUYER / C2 PAID BLUEPRINT | dormant | Blueprint may be drafted by growth after red-team PASS; no spend before the Graduation Gate and an `A-###` |
| DIVISION D ANALYTICS & FINANCE | auditor (money, tax reserve, Reinvestment Level) + system-qc (scoreboard rows in `ops/METRICS.md`) | Actuals only; "—" for missing data |

## 2. Concept map (MOS concept → org record)
| MOS | Org |
|---|---|
| Phase 0–3 + Graduation Gate | Lane A stream state, recorded in `ops/STATE.md` ("Phase: 0/1/2/3 · Gate: X/5"). Lanes A/B/C (PROTOCOL §7) stay; the agency is the Lane A stream, Phase 2 paid tests are Lane C bets funded only from confirmed profit |
| Reinvestment Ladder levels | auditor computes the level from `ops/LEDGER.md` CONFIRMED revenue only; the Orchestrator proposes level purchases as `A-###` items with cost, payback, and "not yet" list |
| Money rules (tax reserve → split) | Profit allocation in PROTOCOL §7; tax reserve % = A-005 (placeholder 25%) |
| Ideas Vault | `ops/IDEAS.md` with status `parked` |
| ICE score | Added as a column where scout ranks (IDEAS.md); red-team may override with its own verdict |
| Quests (max 3/day) | `ops/TODAY.md` top 3 rows, each with minutes + XP. Rows 4–7 stay in the file as "after the quests" |
| Boss Battle | One line in `ops/STATE.md` under Next action: goal + progress bar from real counts |
| XP / Rank / Achievements | system-qc keeps an `XP` column in `ops/METRICS.md`. XP is credited only for actions the owner reports as done ("done 1"), and money-linked XP (Sale closed, Retainer signed) only after auditor CONFIRMED. Nobody self-awards XP |
| Weekly CLIENT REPORT | growth drafts under `library/templates/client-report-<slug>-<date>.md`; qa checks every number against the client's own data; owner sends |
| Scoreboards (AGENCY / CLIENT) | `ops/METRICS.md` (system-qc) and `ops/LEDGER.md` (auditor); never estimated |
| Quality Gate 7 questions | Added to red-team's plan review and qa's deliverable review checklists (`library/checklists/`) |
| Service agreement, no guarantees, Manager-role access only | red-team FAIL condition for any offer or onboarding that breaks them |

## 3. Modes and commands (how the owner steers)
- `/owner` (default) — the session loop runs as in `CLAUDE.md`; TODAY.md quests are agency-building actions.
- `/client <name>` — one client stream: `clients/<slug>/` holds intake (`blueprint/intake.md` copy), diagnosis, phase state, weekly reports. Tasks for that client carry the slug in the TASKS row. Never mix two clients in one task. Client money is the client's; only the owner's fees enter `ops/LEDGER.md`.
- `/deep` — the owner report may exceed 8 lines for that one reply (agent sections shown).
- `/simple off` — report in the plain 8-line format from `CLAUDE.md` until `/simple on`.
- Remaining MOS commands: unknown until the owner supplies the cut-off text (A-013).

## 4. Owner report in Simple Mode (replaces the 8-line report's layout, same cap)
```
🎮 Owner | Phase 0 | Level 0 | XP 0 | Streak 0
📊 Revenue $0 CONFIRMED · Audits sent 0 · Pitches 0 · Clients 0 · Burn $29/mo
🎯 Quests: 1) … (min, XP) 2) … 3) …
🐉 Boss Battle: <this week's goal> ░░░░░ 0/N
💡 <one verified tip>
⚠️ Approvals: A-###, A-### · Incidents: INC-### or none
➡️ Reply 'done 1', 'done 2'… · Next action: <one line>
```
Numbers come from LEDGER / METRICS / TODAY only. Nothing in the scoreboard is estimated.

## 5. Where the MOS is overridden (and why)
| MOS says | Org does | Why |
|---|---|---|
| Director checks every output | red-team and qa are the gates; Orchestrator routes and decides | Separation of duties, D-001 |
| 13 specialists | 8 agents wearing hats | Hard gate: no agents beyond 8 without owner approval |
| Agents sign sections in `/deep` | Handoff files under `ops/handoffs/` are the signed sections; `/deep` quotes their paths | Single-writer ownership, PROTOCOL §6 |
| XP for actions "I report" | XP for reported actions; money XP only after auditor CONFIRMED | Truth rules, PROTOCOL §1 |
| "Use my own business as the first case study" | Allowed; the existing site builds (`sites/`) count only once A-004 settles whether they were paid | UNKNOWN cannot become a case study |

## 6. First run (what this unlocks once A-012 = yes)
1. scout: niche shortlist (top 3, MOS scoring) from the Lane A evidence already in `library/research/`; owner picks one.
2. growth: free 15-min Growth Audit template + delivery script (phone-first), the one-page service agreement draft (flag: verify with a professional), and the weekly client report template.
3. red-team: gate the offer ladder prices against local competitor pricing (WebSearch, dated).
4. Then the 30-day launch, days 1–3, as TODAY.md quests.
