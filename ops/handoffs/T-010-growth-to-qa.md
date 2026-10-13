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

## Repair (attempt 3)
Source: ops/handoffs/T-011-red-team-to-orchestrator.md §3 (M1–M9), U6, U8, U9, ruling 2 and D-027. Files edited under the Orchestrator's repair grant (library/templates/, builder-owned). Wording is red-team's, verbatim. Nothing sent, no draft made. DRAFT/attorney header kept (agreement l.1); red-team's "attorney still needed" list is now agreement l.3–9. Line numbers are in the files as they now stand (attempt-2 line numbers above refer to the earlier versions).
Agreement (library/templates/service-agreement-one-page-2026-10-12.md):
- M7 l.14 Parties: "[Owner full legal name], sole proprietor ("Agency", [city], CA, [email/phone])"; l.12 now says no trade name until A-013 / FBN decision.
- M8 l.16 clause 1, appended: "Starter is delivered within 7 days of payment; if not, Client may cancel for a full refund." (the audit pitch uses the same 7).
- M2 l.17 clause 2: price-change sentence replaced with "Starter is paid in full before work starts; monthly is paid in advance. A new monthly price applies only after 30 days' notice and Client's reply "I agree"; otherwise service ends at the end of the paid month."
- M1 l.18 clause 3 "Term." replaced with the full red-team text (Starter one-time; Monthly auto-renews at $[X] on the [day]; cancel by texting CANCEL or emailing; Agency confirms within 1 business day; "I agree" kept 3 years).
- M4 l.20 clause 5: added "Client keeps the Owner role; Agency asks only for Manager."
- M5 l.23 clause 8: "No fake, bought, filtered, or incentivized reviews" replaced with "No fake or bought reviews. Agency never asks only happy customers, never discourages negative reviews, and never offers anything for a review."
- M3 l.26 clause 11: added "Both parties agree to make, sign and receive this agreement and all notices electronically by text or email."
- M6 l.27 new clause 12: red-team text verbatim.
- M9 l.32–43: two separate texts. Starter l.37: "one-time $297, paid before work, delivered in 7 days or full refund" inside the full text. Monthly l.41: "$[X]/mo, renews monthly until you cancel by text/email". Both start "From [Owner full legal name]." and end "STOP = no more texts." Send note (l.43) adds red-team C3: only if the business asked for the terms on the call.
- M9 notes: old 2018 Mintz note (was l.32) deleted; l.47 now E1 (btlaw.com, "same channel used to initiate the subscription", AB 2863, effective 2025-07-01) and l.48 E2 (california.public.law, "personal, family, or household purposes"; no case law). Added E6, E7, E8, E4/E5 notes (l.49–52), each tagged with URL, date and quote from red-team's table (red-team's search summaries; I did not re-open pages).
Character counts (regex count on saved text in the scratchpad, `^.{N}$`; sender name set to 25 chars, monthly price to 5 chars "$1500"):
- Starter text: 270 characters (budget 320; 50 spare).
- Monthly text: 247 characters (budget 320; 73 spare). With "$[X]" in place of "$1500" it is 1 shorter in the file.
Audit (library/templates/free-growth-audit-2026-10-12.md):
- M9 l.67 pitch: "No contract" replaced with "No long-term contract: one page, one-time or month-to-month."
- D-027 l.67 and l.71: pitch now "It's $297 one time, paid before I start, and delivered in 7 days or you get a full refund"; no retainer quote anywhere in the pitch. l.71 Pricing note replaced: Starter $297 prepaid; no monthly price quoted this week; no $99 pack to the same business; $397 only after 3 closes in 5 pitches. Old "$197–$497" range and "[X] days" removed.
- U6 l.17: "Google gives no weights per factor..." now tagged [UNVERIFIED: absence claim; no 2026-10-12 search summary showed per-factor weights, pages not opened].
- U8 l.20–24: l.20 reworded to Google's own wording ("review count and review score factor into local search ranking"); l.21 new VERIFIED(onelocal.com/google-reviews-local-rankings, 2026-10-12, quoted; Google text quoted by a third party, page not opened); l.24 "publishes no weights" now "does not publish weights ... (UNVERIFIED absence claim)".
- l.68 pointer updated to the Starter text in "Text-message versions" (FP-10 consistency).
Open items for qa (not changed by me): audit l.63 "(If they say they are busy: ... I'll text it over once)" and the DM/text line l.70 may conflict with red-team C3 (no cold text/DM; text only on request). The busy-text wording is qa's own A5 text, so I left it; qa or red-team to rule. Evidence rows #6 and #10 above are superseded by the E1/E2 notes and D-027 price. Re-gate: red-team checks the listed lines; qa runs C6 (price/term word diff, scripts vs agreement).

## T-015 fixes (2026-10-12; not a 4th attempt, D-031; nothing sent; no Bash tool, so every count is a hand count, UNVERIFIED by script)
Sources: red-team T-011 attempt-2 C12, C15, C16, C17, C19, C20; qa T-014 R5, R6, B1, A6, A7, A8. Line numbers are in the files as they now stand.
Audit (library/templates/free-growth-audit-2026-10-12.md):
- l.58 (A8): ends `— [Owner full legal name], [phone]` (was `[Owner name], [AGENCY NAME], [phone]`).
- l.63 (A8 + A6): opener `it's [Owner full legal name], a local marketing helper in Elk Grove.`; busy branch = qa A6 text verbatim (`"When is a better time?" Write the time down and call once then ... Only if they ask you to send it: "Sure, I'll text it once. Reply STOP and I won't contact you again."`).
- l.70 (A7): replaced with qa text: `Text/DM version (only after the business asked for it on the call or in person; never a first touch, C3): "Hi [name], [Owner full legal name] here, from our call. Your free Google listing check: [n] green, [n] red, 3 quick fixes. Reply STOP and I won't message again."` Hand count 160 raw, about 165 filled (qa said 144 / 166). Under 320.
- l.75 (my addition, flag): "one touch plus at most one follow-up" replaced with "one dial per number per 12 months, no voicemail retry (C12)" so the log line matches C12.
Report (library/templates/client-weekly-report-2026-10-12.md):
- l.10-28 (R5, R6): pipe table replaced by 19 lines `[—] <Measure>: — (was —)` in MOS order; l.18 = `[—] CPL (cost per lead): n/a when ad spend is $0` (R6, no "$0 ads"). l.29 legend `Where to read: ...` verbatim. l.9, l.30, l.31, l.43-44 say "lines" not "table" (my consistency edit, flag).
- l.2 (R5): `(qa estimate, not yet stopwatched: lookups 4 min + about 450 typed characters 3.6 min + navigation 1-2 min = 8.6 to 9.6 min, one artefact)`. l.51: `Send format: send the 19 lines as they are, no table.`
- l.47 (C19): `🎯 Ask your next 3 customers, every one, for a Google review today. Reply "done" and I'll count it.` (tail kept).
Call kit (library/outreach/first-contact-call-walkin-2026-10-13.md): l.5 (B1) A-015 yes + red-team re-gate, A-007/8/9 ON HOLD, and walk-ins paused until A-016; l.8 (C16) 5 audit + 5 GBP calls, A4 swap only, A3 parked; l.18 (C17) A4 opener adds BAR name/address/ARD/phone and no prices unless in writing; l.20 (C12) voicemail retry deleted, one dial per number; l.23-24 walk-ins marked PAUSED, A4 walk-in line carries the BAR items; l.31 (C15); l.34-37 texts; l.49-62 worksheet rows pre-allocated; l.64-72 (C20) named script (f) lifted from audit §4 (name placeholder is the kit's; 2:30 ask gets a log-the-yes note).
Texts under 320 (chars, hand count; fills first 10 / name 25 / business 25; stress 12 / 40 / 40): A2 174 raw, 199 filled, 231 stress · A3 (parked) 207, 232, 264 · A4 241, 266, 298 · audit text 160 raw, about 165 · BAR terms message in founding-site file l.47: 187 raw, about 222 filled, about 254 stress.
Founding-site file (library/outreach/founding-site-offer-2026-10-13.md): l.2 banner (A-009 on hold, retarget D-029, call kit only); l.14 compliance bullet with [BAR NAME], [BAR ADDRESS], [ARD NUMBER], [SHOP PHONE]; l.36 terms heading; l.47 BAR terms message. The studio text stays (parked, not deleted).
Judgement calls for the Orchestrator: (1) C19 says delete l.70 and use "Would it be okay if I text it to you?" at l.63; qa A6/A7 say replace with a stricter ask-only text. I used qa's, which also satisfies "text only on request". Say so and I revert to the red-team wording. (2) The kit has no A6 pre-audit opener; script (f) is the call, so each audit shop costs about 14 min of audit first (qa arithmetic).
Not applied (not in the T-015 list): C13 wording, qa B2 ("I read every piece myself"), C14 asking text beyond the walk-in banner.

## T-015 attempt 2
Source: ops/handoffs/T-015-qa-to-orchestrator.md (VERDICT FAIL: F1, F2; advisory X1). Orchestrator instruction applied exactly; nothing else changed. Nothing sent, called, posted or drafted.
- F1 · library/templates/free-growth-audit-2026-10-12.md:46 (builder-owned dir; edited under the Orchestrator's grant, as in attempts 2-3). New line 46: `## 3. One-page result (fill on phone; a text or screenshot goes out only after the business asked for it on the call or in person, C3)`
- F2 · ops/TODAY.md:28 step (6): "then send the one kit text within 1 hour" replaced with `then the one kit text (call kit (c)) follows within 1 hour, once, after the logged yes`. Step now reads: `(6) Only after a spoken "yes, text me": log it in your sheet, then the one kit text (call kit (c)) follows within 1 hour, once, after the logged yes (name, details they asked for, STOP).`
- X1 · library/outreach/first-contact-call-walkin-2026-10-13.md:36 (A4 post-yes text): "One-page website for [BUSINESS]:" replaced with `Website for [BUSINESS]:`. All-40 count 326 → 317 per qa X1 (qa's len() count; not re-counted here, no script run).
Open for Orchestrator: step (6) does not restate the A-015 gate in its own words. It sits under the "A-015 call day" section, which unlocks on "A-015 yes" (step 1). Say if you want "after A-015 yes" added to step (6).
Cost: ~25k tokens (Write-based rewrites; Edit tool not available in this session), ~3 min wall · model haiku.
