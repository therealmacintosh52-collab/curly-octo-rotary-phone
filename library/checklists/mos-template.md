# Checklist: Growth Agency (MOS) templates: free audit, one-page agreement, weekly client report
Owner: qa · Created 2026-10-12 from T-012 (T-010 templates, round 1). Re-verify Google/AI-search wording after 2027-04-12.

1. Fresh `cat -n` of every file; cite file:line only from it (see outreach-send-asset.md #9).
2. Tags: every Google/platform/law claim is VERIFIED(url, date, snippet), CONSENSUS, HYPOTHESIS or UNVERIFIED. Grep `VERIFIED(`, `HYPOTHESIS`, `UNVERIFIED`. Source older than 6 months gets "STALE" in the tag. A negative claim ("Google does NOT...") needs its own source; absence in a summary is not evidence.
3. Internal consistency: no two lines may contradict (e.g. reviews feed prominence vs reviews are not a ranking lever).
4. Hard numbers hard-coded in sendable copy ("1 green") must be fill-ins, not facts.
5. Agreement (MOS RISK RULES l.41-47): line 1 DRAFT + attorney; scope; price; month-to-month; cancel anytime + how; no guarantee of specific results; Manager/partner access, no passwords; account + content ownership; California law; one page. Text version: count with `python3 -c len()`, raw and after a 4-digit price, must be under 320; ends with STOP; no "guarantee" except in the negative.
6. Report (MOS CLIENT list l.181): rows = Reach, Engagement rate, Followers gained, GBP views, GBP calls, GBP directions, Site visits, Leads, CPL, Booked jobs, Close rate, Customers, Revenue, AOV, Margin, CAC, ROAS, Reviews (count + avg), Referrals (19) plus Phase in header; footer = top 3 winners, bottom 3, #1 bottleneck, gate X/5. "—" defaults, 🟢🟡🔴, 3 wins, 1 next fix, ROI sentence with ESTIMATE label (actuals never labeled estimate; known numbers shown as measured), 1 client quest.
7. Dummy fill: fill every field with dummy data; count typed characters (cells + free text); time = typing at 125 chars/min (25 wpm, conservative, UNVERIFIED rate) + one lookup per source app. Under 10 min or FAIL. Check the light rule against the dummy data: not-applicable rows (CAC, ROAS) must not go 🔴 by the literal rule; cost rows invert.
8. Phone readability: a pipe table sent by SMS is unreadable; client-facing send block must be line-based.
9. Audit walk: need a real public listing from WebSearch (not invented). Stopwatch per section; section budgets must add to 15 min INCLUDING the fill-in step. If WebSearch is unavailable mark UNVERIFIED and log a tooling incident; do not substitute invented data.
10. Compliance: STOP line on every cold DM/text/script; "no/stop/silence = never contact again" must not be contradicted by a follow-up line; TCPA/DNC/CAN-SPAM/CA ARL reads carry "verify with a professional"; qa never rules on them.
11. Line count under 120 per handoff; placeholders: grep REPLACE-ME (none allowed); [BRACKETS] are intentional owner fill-ins.

(added T-014) Time claims: add up EVERY artefact the owner must produce before send (owner copy AND client copy, header, lights), not only the table. Report arithmetic = lookups + typed chars / 125 + navigation; state the range. A repair that adds a new artefact (e.g. line-form client copy) must re-run the time sum.
