# T-014 — qa → orchestrator

**Status:** DELIVERED
**Task:** T-014 qa. Part A = T-012 attempt-2 re-check of growth repairs (T-010 attempts 2 and 3). Part B = first gate of `library/outreach/first-contact-call-walkin-2026-10-13.md` (T-013).
**Attempt:** Part A re-gate 2 of 3 · Part B first gate
**Cost:** ~75k in / 13k out tokens, ~15 min wall · model sonnet

VERDICT: FAIL (Part A: report and audit return to growth; agreement PASS) · PASS (Part B)
Input contract: T-010 and T-013 handoffs DELIVERED, no code (no commit/gates). Met.
Checklist used/updated: `library/checklists/outreach-send-asset.md` (items 10-12 added), `library/checklists/mos-template.md` (time-claim rule added)

## Per-file verdict
| File | Verdict | One line |
|---|---|---|
| service-agreement-one-page-2026-10-12.md | PASS | texts 270 / 247 chars filled; $297 prepaid; no retainer quote |
| client-weekly-report-2026-10-12.md | FAIL | R1-R4 applied verbatim; but R3 adds a second artefact and the 10-minute sum no longer holds |
| free-growth-audit-2026-10-12.md | FAIL | A1-A5 applied; two first-contact conflicts with C3 and a brand placeholder against C7/D-027 |
| first-contact-call-walkin-2026-10-13.md | PASS (advisories) | all Part B checks met |

## Part A proof lines
1. R1-R4 verbatim: `grep -c` of each paste-ready sentence in the report = 1 each (R1 l.31, R2 l.2, R3 l.52, R4 l.44).
2. A1-A5: A1 l.24 (growth tightened my wording to "does not publish weights ... UNVERIFIED absence claim", acceptable, stronger). A2 l.5/l.10/l.43, F one query l.35, log line l.74. A3 l.70 "[n] green, [n] red". A4 Legal sentence in l.75. A5 l.63 text present, see FAIL below.
3. Agreement texts by script (`len()` on fenced lines l.37, l.41; sender 25 chars, price "$1500"): Starter 268 raw / 270 filled; Monthly 244 raw / 247 filled. Both under 320 with room for a sender name up to 75 / 98 characters. Both end "STOP = no more texts." and carry a separate "Reply YES" cue. Starter text says "one-time $297, paid before work, delivered in 7 days or full refund" = D-027 (l.34). No retainer figure anywhere in the Starter text; the Monthly text holds only "$[X]" and l.43 says "Monthly is not quoted this week". Audit l.67/l.71 quote $297 prepaid only; `grep '/mo\|retainer\|\$500'` on the audit = 0 hits.
4. Report re-time from its own step list. Lookups 4.0 min (my earlier estimate, unchanged). Typed: cells 123 (my dummy, includes lights) + free-text caps 330 (3x50 wins, 70 fix, 60 footer, 50 quest) + ROI values 10 to 60 + header dates/gate 18 = 481 to 531 chars; / 125 per min = 3.9 to 4.2 min. Navigation 1 to 2 min. Owner copy = 4.0 + 3.9..4.2 + 1..2 = 8.9 to 10.2 min. Growth's 9.1 sits inside that range. But R3 now requires a client copy in line form (17 data rows x about 27 chars = 455 chars, of which about 60 are numbers already typed): 395 chars / 125 = 3.2 min more. Ready-to-send = 12.1 to 13.4 min. Stopwatch: UNVERIFIED (no phone). By arithmetic the "under 10 minutes" claim fails once the client copy is counted; growth's note already says "assembling the R3 line copy ... untimed".
5. Audit re-time from its own step list: prep 1 + A-D 5 + E (3 competitors x 3 data points = 9 x 0.27) 2.4 + F one query 2 + fill 350 chars (one-pager caps: header 35, 6 phrases/values about 140, 3 fixes x 40 = 120, signature 40, emoji taps) / 125 = 2.8 = 13.2 min. Stated budget 1 + 10 + 3 = 14: PASS by arithmetic, margin 0.8 min. End to end with delivery 3 = 16.2; the title says "15-minute" (advisory: say "14 minutes to ready-to-send"). Stopwatch and real listing walk: UNVERIFIED (no WebSearch, no phone).
6. Delivery script spoken length by script: 0:00 opener 35 words (14 s of a 30 s slot), pitch l.67 89 words = 36 s of a 45 s slot. Fits.

## FAIL items with paste-ready fixes
Report (`library/templates/client-weekly-report-2026-10-12.md`)
R5 l.10-30 + l.52 + l.2: one artefact instead of two. Replace the pipe table (l.10-30) with 19 lines in the same MOS order, format `[🟢/🟡/🔴/—] <Measure>: — (was —)`, e.g. `[—] GBP calls: — (was —)`. Add under it one legend line: `Where to read: GBP rows = Business Profile performance (UNVERIFIED path); Reach, Engagement, Followers = page insights; Site visits = site stats; Leads, Booked jobs, Customers, Revenue, Margin, Referrals = client's log or books; CPL, AOV, Close rate = computed; Reviews = Google profile.` Replace l.52 with `Send format: send the 19 lines as they are, no table.` In l.2 replace "(qa estimate ... 4.5 min)" with `(qa estimate, not yet stopwatched: lookups 4 min + about 450 typed characters 3.6 min + navigation 1-2 min = 8.6 to 9.6 min, one artefact)`. Resulting sum 4.0 + 3.6 + 1..2 = 8.6 to 9.6 (typed: 60 numbers + 15 light taps x 2 + free-text caps 330 + ROI 10 + header 18 = about 450).
R6 l.20 contradicts l.31: row says `write "$0 ads"`, rule says `write "n/a"`. In the line format: `CPL (cost per lead): n/a when ad spend is $0`.
Audit (`library/templates/free-growth-audit-2026-10-12.md`)
A6 l.63 busy-branch (my own A5 text, now wrong under D-027/C3, no text unless they asked). Replace the parenthetical with:
`(If they say they are busy: "When is a better time?" Write the time down and call once then. If they say no, not interested or stop: "Understood, thank you." End, log "never contact", send nothing. Only if they ask you to send it: "Sure, I'll text it once. Reply STOP and I won't contact you again.")`
A7 l.70 is a cold DM/text first touch (T-011 C3 l.78 "no cold text/DM"; D-027 l.34). Replace the whole line with:
`Text/DM version (only after the business asked for it on the call or in person; never a first touch, C3): "Hi [name], [Owner full legal name] here, from our call. Your free Google listing check: [n] green, [n] red, 3 quick fixes. Reply STOP and I won't message again." (144 chars raw, 166 with name 25 and 10.)`
A8 l.58 and l.63 carry `[AGENCY NAME]`; D-027/C7: sender = owner's legal name, no trade name until A-013. l.58: replace `— [Owner name], [AGENCY NAME], [phone]` with `— [Owner full legal name], [phone]`. l.63: replace `it's [Owner] from [AGENCY NAME], a local marketing helper in Elk Grove` with `it's [Owner full legal name], a local marketing helper in Elk Grove`. Also l.3 header and `Agency name stays [AGENCY NAME]` wording in the T-010 handoff are superseded.
Agreement: no FAIL. Advisory: l.9 `"[Name] Growth"` names a brand in the attorney list; fine as a question, leave.
Circuit breaker: after this, T-010 has used 3 growth attempts; the next failure goes to the owner with diagnosis (PROTOCOL §4). The fixes above are mechanical.

## Part B proof lines (`library/outreach/first-contact-call-walkin-2026-10-13.md`, fresh `cat -n`)
1. Prices: A2 $99 (l.16, l.23, l.33, l.42), A3 $49 (l.17, l.23, l.34), A4 $450 / $150 deposit / $300 balance (l.18, l.23, l.35, l.42) = ops/EXPERIMENTS.md l.10-12 and the kits. The $297 Starter appears only in the C4 guard (l.8), never quoted. D-027 PASS. Scope auto shops = D-029 (A4 retarget, settles T-013 G-2).
2. Sender: `grep -i "growth\|agency\|studio"` shows only compliance text; every opener, walk-in and text uses [OWNER LEGAL NAME] (l.7, 16-18, 23, 33-35, 44). PASS.
3. Texts after yes by script, l.33/34/35: raw 233/262/227; filled (name 25, first 10, business 25) 258/287/252; stress fill (40/12/40) 290/319/284. All under 320, all end "Reply STOP to opt out." (growth's "~290" for A3 is high; real 287). PASS.
4. Claims: no guarantee (l.12, l.33-34 "No promise", l.43), no social proof (`grep` testimonial/other shops/clients = 0), no urgency, no Google ranking claim; "calling the number on your Google listing" is an owner-observed fact. REPLACE-ME = 0. PASS.
5. Speakable: opener word counts by script at fills (name 3 words, business 3 words): A2 82, A3 89, A4 83 with a 12-word fact = 33 / 36 / 33 s; with a 20-word fact 90 / 97 / 91 = 36 / 39 / 36 s at 150 wpm. Under 45 s. Walk-in base 46 words + one line of 8-14 words = 22-24 s. PASS.
6. Worksheet: 10 numbered rows by script, columns name / card facts / offer / best time / result. PASS. Manual-send line l.6, permission ask and spoken yes logged l.27-30, silence = never contact l.9/l.29. PASS.
7. Legal reads tagged UNVERIFIED, no ruling (l.6, l.10). PASS.

Part B advisories (paste-ready, not blocking):
B1 l.5 compliance box still says "a new A-### is logged". It exists: A-015 (`ops/DECISIONS.md` l.54) with no owner answer yet. Replace l.5 with `- [ ] A-015 is answered "yes" by the owner in ops/DECISIONS.md and red-team has re-gated this file (C11). A-007/A-008/A-009 are ON HOLD (D-028) and do not cover this. No yes = do not call, do not visit.`
B2 l.45 "I read every piece myself" is an owner commitment; add "if true" to the owner's own notes or drop the clause. Owner decides.
B3 l.18 and l.35 A4: the BAR name/address rule (C8) applies to the drafted site, not the call; carry C8 into the A4 kit when it is retargeted (D-029).
B4 Red-team re-gate (C11) is still required before any call. qa does not rule on §17538.41, DNC or TCPA.

## Placeholder grep
`grep -c REPLACE-ME` on all four files: 0. Bracketed fills are intentional owner inputs.

## Assumptions
125 chars/min and 150 words/min are conservative assumptions, UNVERIFIED; lookup minutes are my estimate. Google claims not re-opened (no WebSearch).

## Self-check
- [x] every criterion has a proof line · [x] gates re-run, not copied · [x] placeholders grep'd · [x] checklist saved · [x] under 100 lines · [x] cost line · [x] library/templates and library/outreach not edited; nothing contacted

## QUALITY SCORE: 4
Every FAIL has file:line and paste text; counts are script-run. Not 5: stopwatch and live-listing walk are still arithmetic only (no phone, no WebSearch), and A6 repeats a defect in my own earlier A5 text.
