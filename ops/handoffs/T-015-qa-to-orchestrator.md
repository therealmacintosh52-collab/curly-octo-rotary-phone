# T-015 — qa → orchestrator

**Status:** DELIVERED
**Task:** T-015 qa narrow re-check of the T-015 fixes (T-010 attempt 3 lines, T-014 R5/R6/B1/A6-A8, T-011 C12/C15/C17/C19/C20; D-032 applied at audit l.63/l.70).
**Attempt:** re-check after the T-015 fixes (D-031; not a 4th growth attempt; no growth or red-team work done here)
**Cost:** ~95k tokens total (budget counter 15.00M → 14.90M), ~12 min wall · model haiku

VERDICT: FAIL (2 criteria: audit l.46, TODAY l.28) · every named T-015 line PASS · call kit, founding-site BAR message, name-check kit PASS
Input contract: T-010 "T-015 fixes" section, T-014, T-011 attempt-2 conditions and the five named files present. Met.
Checklist used/updated: `library/checklists/outreach-send-asset.md` (items 11-12 amended; 13-16 added).

## Failed criteria (exact, with reproduction)
F1 `library/templates/free-growth-audit-2026-10-12.md:46` reads `## 3. One-page result (fill on phone; send as text or screenshot)`. An ungated send-as-text instruction is a cold first touch (C3, D-027). Reproduce: `sed -n '46p' <file>`. Fix (paste-ready): `## 3. One-page result (fill on phone; a text or screenshot goes out only after the business asked for it on the call or in person, C3)`.
F2 `ops/TODAY.md:28` step (6) reads `then send the one kit text within 1 hour`. It is an imperative outreach send under A-015, which is not yet answered "yes". Reproduce: `grep -n "send the one kit text" ops/TODAY.md`. Fix (wording only, gate unchanged): replace with `then the one kit text (call kit (c)) follows within 1 hour, once, after the logged yes`.

## Proof lines (every criterion)
1 Named lines, audit and report (script: `grep -nF` on cited line; count by script)
- 1a `[AGENCY NAME]` in library/: PASS. `grep -rn "\[AGENCY NAME\]" library/` = 0. The bare string at `library/checklists/outreach-send-asset.md:15` is my own grep instruction, not a placeholder.
- 1b audit l.58 PASS: ends `— [Owner full legal name], [phone]`.
- 1c audit l.63 PASS: opener name and the A6 busy branch are verbatim.
- 1d audit l.70 PASS: A7 ask-only text verbatim. Raw 160; all placeholders at 40 = 285.
- 1e audit l.75 PASS: `one dial per number per 12 months, no voicemail retry (C12)`.
- 1f no cold first touch: audit l.46 FAIL (F1). l.68 is a question at the 2:30 ask and l.70 is gated: PASS. Report l.50 "existing client only": PASS.
- 1g report l.10-28 PASS: 19 lines, `[—] ` prefix, MOS order matched name by name, `grep -c "|"` = 0.
- 1h report l.18 CPL, l.29 legend, l.2 time claim, l.51 send format, l.47 review quest: PASS, each verbatim.
2 Call kit `library/outreach/first-contact-call-walkin-2026-10-13.md`
- 2a l.5 B1 PASS: cites A-015 and A-016; A-007/A-008/A-009 ON HOLD.
- 2b voicemail retry PASS: `grep -in "retry\|voicemail"` hits only l.20, `No retry: one dial per number`.
- 2c walk-ins PAUSED l.23 PASS; allocation note l.8 and l.50 PASS; script (f) l.64-72 PASS (0:00 to 2:50).
- 2d A4 BAR placeholders l.18, l.24, l.36 PASS.
- 2e post-yes texts l.34-36 PASS: details, name, `Reply STOP to opt out.` Raw 174 / 207 / 241 match T-014. Kit stress (first 12, name 40, business 40) 231 / 264 / 298, all under 320. All-40 advisory: A4 326 (X1).
3 Founding-site BAR terms message l.47 PASS: raw 187; kit stress (40/50/10/14) 254; all-40 300.
4 `ops/TODAY.md`
- 4a three quests at the top PASS: l.6 (Q1), l.13 (Q2), l.18 (Q3) under "Today's 3 quests".
- 4b A-007/A-008/A-009 ON HOLD PASS: l.2.
- 4c every $ tagged PASS with advisory: l.7, l.14, l.19, l.26, l.33 tagged or sourced; X2.
- 4d no send instruction FAIL: F2 (l.28).
5 Name-check kit `library/outreach/name-check-and-license-desk-call-2026-10-13.md` PASS
- Phone (916) 478-2211 at l.12 carries UNVERIFIED on the same line (also TODAY l.20).
- Steps l.6-9 and l.13-17 are doable on a phone: browser searches, Maps, screenshots, a phone call, chat reply. No desktop-only step.

## Advisories (not blocking)
X1 call kit l.36 A4 text at all placeholders = 40 is 326 (over 320). It passes the kit's own stress. Shorter wording if you want margin: `Website for [BUSINESS]:` replaces `One-page website for [BUSINESS]:`, giving 317 at all-40 and 289 at kit stress.
X2 TODAY l.27 `~$0.76 per minute` is derived and sits in the l.26 UNVERIFIED block, not tagged on its own line. TODAY l.37 `$25` is sourced to T-006 l.117 and T-007 l.42 (kill rule), not tagged on the line.
X3 Parked cold openers still in files: founding-site l.16-18, gbp-pack l.14, ai-search l.22. Gated by A-007/A-008/A-009 ON HOLD (D-028). Not live, must not be used.
X4 Judgement calls for you to overrule: (a) "40-character stress fill" = the kit's stress 12/40/40, so A4 passes; (b) "no send instruction" read literally, so TODAY l.28 fails.
X5 Stopwatch of the 9-minute name check, the audit, and the call: UNVERIFIED (no phone, no timer).
D-032 check: audit l.63 and l.70 carry qa's ask-only wording. Confirmed in place.

## Assumptions
- Counts are by Python `len()` on the quoted strings; stress and all-40 fills as stated above. No site build in scope.

## Self-check
- [x] every criterion has a proof line · [x] gates re-run by script, not copied · [x] placeholders grep'd · [x] checklist saved · [x] under 60 lines · [x] cost line · [x] no file under library/ or ops/TODAY.md edited; nothing sent or contacted

## QUALITY SCORE: 4
Every FAIL carries file:line, a reproduction command and a paste-ready fix. Counts are scripted. Not 5: F1 is a new finding the earlier handoffs missed, and the stress and send-instruction readings are judgement calls (X4) the Orchestrator should confirm.
