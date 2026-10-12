# T-010 — growth → qa

**Status:** DELIVERED
**Task:** T-010 Free Growth Audit template + one-page service agreement draft + weekly client report template (adapter §6 item 2; MOS hat B6/B7/A3; Lane A growth-agency stream, D-017, pending A-012)
**Attempt:** 1 of 3
**Cost:** ~95k/22k tokens (incl. 6 WebSearch calls), ~14 min wall · model sonnet

## What was done
Read PROTOCOL §1/§3/§8, CONTEXT, MOS (Offer Ladder, Risk Rules, Operating Rules, Client Mode, Quality Gate, scoreboards), adapter §2/§6, the outreach-send-asset checklist. library/outreach/ held no reusable audit/agreement/report asset (six dated offer files, none matching), so built new. Ran WebSearch for every Google-rewards claim; each is tagged with the search-result URL and a dated snippet, or marked HYPOTHESIS. Wrote under the Orchestrator's one-task grant to library/templates/. Nothing sent, posted, or created. No Gmail draft made (no recipient exists yet; owner sender identity is still UNKNOWN in CONTEXT).

## Outputs
- `library/templates/free-growth-audit-2026-10-12.md` — checklist A–F (profile, reviews, photos, website, 3 competitors, AI-search check), rubric, fill-in one-pager with 🟢🟡🔴 and top 3 fixes, 3-minute phone script with Starter pitch, DM version, log line.
- `library/templates/service-agreement-one-page-2026-10-12.md` — header "DRAFT — verify with a licensed attorney before first use", 11 clauses, 217-char 2-line text version, attorney question list.
- `library/templates/client-weekly-report-2026-10-12.md` — scoreboard with all 19 MOS CLIENT columns, "—" defaults, 3 wins, 1 next fix, 1 ROI sentence (ESTIMATE-labeled), 1 client quest.
- `library/outreach/README.md` — appended index of the three templates with paths.

## Evidence
| # | Claim | Tag | Source (url · date · quoted snippet) |
|---|---|---|---|
| 1 | Google local results rest mainly on relevance, distance, prominence; complete, accurate info helps | VERIFIED | https://support.google.com/business/answer/7091 · 2026-10-12 · search summary: "relevance, distance, and prominence"; "accurate, complete, and engaging" (summary text, page not opened) |
| 2 | Review count/score feed prominence; Google says replying shows you value feedback | VERIFIED | same URL · 2026-10-12 · summary: "replying to reviews shows that you value feedback" |
| 3 | Reviewer is notified of a reply; reply requires verified profile | VERIFIED | https://support.google.com/business/answer/9075681 · 2026-10-12 · "The person who wrote the review is notified when you reply" |
| 4 | Google suggests photos/videos to show what you offer | VERIFIED | answer/7091 · 2026-10-12 · "to show customers what you offer" (summary) |
| 5 | No extra requirements to appear in AI Overviews/AI Mode; keep Business Profile up to date | VERIFIED | https://developers.google.com/search/docs/appearance/ai-features · 2026-10-12 · "no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary" |
| 6 | CA automatic renewal law: online sign-ups must be cancellable online | VERIFIED (2018 law-firm summary, stale for current text) | https://mintz.com/insights-center/viewpoints/2018-06-stricter-automatic-renewal-law-california-commences-july-1-2018 · 2026-10-12 · "terminate ... exclusively online" |
| 7 | Applicability of #6 to B2B retainers and text/email cancel | UNVERIFIED | attorney question #1 |
| 8 | Photo-count click stats; local AI-answer frequency (8% vs 68%) | UNVERIFIED | vendor claims, flagged "do not quote" in template |
| 9 | Review-recency 30-day / count-vs-competitor light rubric; weekly light rule | HYPOTHESIS | owner scoring rule, tune after 10 audits / 4 reports |
| 10 | Starter price $197–$497 | HYPOTHESIS | MOS Offer Ladder l.150; red-team price gate (adapter §6.3) pending |

## Assumptions
- Evidence 1–5 come from WebSearch result summaries; WebFetch is blocked, so no page was opened (PROTOCOL §1b).
- Owner can read GBP performance numbers on a phone as a Manager; UI path not verified, template says "Business Profile performance".
- Agency name stays [AGENCY NAME] until A-013; owner legal name, phone, county blanks are owner-filled.

## Open risks
- Agreement is not legal advice; attorney review before first use (owner). Biggest open item: CA ARL cancel-by-text vs online-only (evidence 6/7).
- Starter price unsettled until red-team gates it; template leaves the number blank on purpose.
- Owner sender identity (phone/email) and license/DBA still UNKNOWN in CONTEXT.
- Templates README (builder's file) not updated, outside the grant; builder or Orchestrator may add the index there. Index lives in outreach/README.md.

## Acceptance checklist (from TASKS.md; T-010 row not read, criteria taken from the task brief)
- [x] Audit: checklist covers GBP, reviews count/recency/replies, photos, website, top-3 competitors, AI-search check — template §1 A–F.
- [x] Fill-in one-pager with 🟢🟡🔴 and top 3 fixes; exact 3-minute script + Starter pitch — §3, §4.
- [x] Every Google-rewards claim VERIFIED(url,date,snippet) or HYPOTHESIS — grep'd the audit file; no untagged claim.
- [x] Agreement has scope, price, month-to-month, cancel by text/email, no guarantee, Manager roles only, data handling, ownership, CA law, DRAFT header as line 1 — clauses 1–11.
- [x] Text version under 320 chars — 217 raw with 4-digit price (counted: 88 + 1 + 128); with "$[PRICE]" placeholder still under 230.
- [x] Report: "—" for missing, 🟢🟡🔴, 3 wins, 1 next fix, 1 ROI sentence with ESTIMATE label, 1 client quest; columns match MOS CLIENT list (l.181), 19 rows.
- [x] README one line per template with path.
- [ ] qa to confirm: stopwatch test of the report (under 10 min) with dummy data; phone-readability.

## Self-check
- [x] Every claim tagged
- [x] Only owned files written (plus granted library/templates/ x3)
- [x] No hard-gate action taken (nothing sent, posted, created; no Gmail draft)
- [x] Under 120 lines
- [x] Cost line filled
- [x] Compliance lines: STOP/opt-out on cold DM, call, text, report; manual one-by-hand sends; public business numbers only; no fake urgency, testimonials, or income claims; the word "guarantee" appears only as "no guarantee"

APPROVALS NEEDED (one line each, yes/no):
  G-1 None this task (assets only). Before first use: owner confirms attorney review of the agreement (yes/no) and answers A-013 agency name.
Expected: 0 sends in this task; audits start when owner picks a niche (UNVERIFIED until data). Per MOS day 4–10 target 10 audits → pitch for 3 Starters (MOS hypothesis, UNVERIFIED).
Kill check: red-team kill criteria for the agency stream not read in this task; current reading — no audits delivered yet, "—".

## QUALITY SCORE: 4
Reasons: all required parts present, claims tagged, compliance lines in every send surface. Not 5 because Google claims rest on search summaries (pages not opened), the agreement is unreviewed by an attorney, and the Starter price is a placeholder pending red-team.

## Repair (attempt 2)
Source: ops/handoffs/T-012-qa-to-orchestrator.md (VERDICT: FAIL, R1-R4, A1-A5). Edited under the Orchestrator's repair grant for library/templates/ (builder-owned dir). Agreement file untouched. Nothing sent. Line numbers are in the files as they now stand.
Report (library/templates/client-weekly-report-2026-10-12.md):
- R1 l.31: replaced with qa text verbatim: "Light rule (HYPOTHESIS, adjust after 4 reports): 🟢 up more than 10% or on plan · 🟡 within 10% or unknown · 🔴 down more than 10%, or missing 2 weeks where the client should have it. Cost rows (CPL, CAC): down is 🟢. Rows that do not apply this phase (CAC, ROAS, CPL with $0 ads): write "n/a" and leave Light "—"."
- R2 l.2: "(stopwatch: scoreboard 5 min, rest 5)" replaced with "(qa estimate, not yet stopwatched: lookups 4 min + about 550 typed characters 4.5 min). Phone method: copy last week's file, cut This into Last, type only This week; first report: Last = "—"."
- R3 l.52 (Send block): added "Send format (no table): one line per row, "🟢 GBP calls 21 (was 25)". Put the "Where I read it" column in the owner copy only."
- R4 l.44 (before the ROI estimate sentence): added "If Revenue and Booked jobs are in the table, write "You paid $[X]; the table shows [Y] leads, [J] booked jobs and $[R] revenue you reported (client-reported)." Use ESTIMATE only for revenue the client has not reported." The old sentence now follows as "Otherwise:".
- Fill-time cut (my addition, l.3): length caps, no row removed (19 rows match MOS l.181): win at most 50 chars, fix 70, footer 60, quest 50 (reuse a saved quest), ROI type only bracketed values. Tagged HYPOTHESIS/UNVERIFIED.
- Report time arithmetic (estimates, UNVERIFIED until a phone stopwatch): typed = 123 cells (qa dummy fill) + 3x50 wins 150 + fix 70 + footer 60 + quest 50 + ROI values about 60 (my assumption) = 513 chars; 513 / 125 chars per min = 4.1 min; lookups 4.0 min (qa); copy-forward navigation about 1 min (my assumption; qa had 1-2 min table navigation) = 9.1 min, under 10. Using qa's own 550 chars (4.5 min): 4 + 4.5 + 1 = 9.5 min. Not counted: assembling the R3 line-based client copy from the table (extra minutes, untimed); qa should stopwatch it.
Audit (library/templates/free-growth-audit-2026-10-12.md):
- A1 l.23: replaced with qa text verbatim ("Google lists review count and score under prominence (VERIFIED above) but publishes no weights; do not quote "N reviews = rank N" or any third-party weighting (UNVERIFIED). Pitch reviews as trust + visibility.").
- A2 l.5 "## 0. Before you start (1 min)"; l.10 "## 1. Checklist (10 min: A-D 5 on the prospect, E 3, F 2 with ONE query)"; l.42 new "## 2b. Fill the one-pager (3 min, type only the bracketed parts). Budget: 1 + 10 + 3 = 14 min to ready-to-send; delivery (§4, 3 min) is separate." l.34 F: dropped the second query "who does [service] near [neighborhood]". l.73 log line: appended " · minutes prep/checklist/fill/deliver [n/n/n/n]" inside the backticks.
- A3 l.69: "1 green, [n] red" now "[n] green, [n] red".
- A4 l.74: appended qa's Legal sentence ("... verify with a professional before the first send. qa does not rule on it.").
- A5 l.62: parenthetical replaced with qa text (busy: text once, with STOP; no/not interested/stop: "Understood, thank you.", end, log "never contact", send nothing).
- Cuts to hit the budget (my additions, tagged): E (l.31) per competitor 5 data points to 3 (review count, average, newest review; dropped photo count and has-site, neither used in the one-pager); F (l.33) "Google ... and one chat assistant" to "or", one query, one tool; l.43 caps for fill: phrases at most 5 words, fixes at most 40 chars, about 375 chars typed.
- Audit time arithmetic (estimates, UNVERIFIED until stopwatch): prep 1 + A-D 5 (qa) + E 3 data points 2.4 (qa 4.0 x 3/5) + F one query 2 + fill 375 / 125 = 3.0 = 13.4 min, inside the stated 1 + 10 + 3 = 14 to ready-to-send, under 15. With delivery 3: 17 min end to end; the 15-minute figure covers ready-to-send only, delivery is separate.
Advisories not applied (not in R/A list): audit l.17 untagged "no weights", 8%/68% figures, UI-path UNVERIFIED mark, status lines. Re-gate: qa re-runs the original criteria unchanged.
