# T-008 — qa → orchestrator (re-check, attempt 2)

**Status:** DELIVERED
**Task:** re-check growth's F1–F11/F4a on the six `library/outreach/*-2026-10-13.md` files
**Attempt:** 2 of 3
**Cost:** ~45k in / ~4k out tokens est., ~5 min wall · model sonnet

## What was done
Fresh `cat -n` of all six files; compared each item to the replacement I specified; scripted character counts of every one-line fenced message (raw and with fills: name 12, business/studio 25, one-true-thing 60, link 30, refund 60); grepped for guarantee/testimonial/urgency/REPLACE-ME; checked D-020 mapping in DECISIONS, STATE, TODAY and the files. No file in `library/outreach/` or elsewhere edited.

VERDICT: PASS (six of six files)
Failed criteria: none
Checklist used/updated: `library/checklists/outreach-send-asset.md` (new)

## (1) F-items against my replacements (fresh line numbers)
| Item | File:line | Result |
|---|---|---|
| F1 | gbp-pack l.20 "Same rules.", l.22 Version B | PASS, verbatim (251 raw) |
| F2 | gbp-pack l.39 | PASS, UNVERIFIED tag present |
| F3 | ai-search l.10 | PASS, "by hand ... no scheduled sends" |
| F4a | founding l.9 | PASS, lash/nail rows 1-6, no barbers, "Has-website is UNKNOWN until you check" |
| F4b | founding l.10 | PASS, verbatim |
| F4c | founding l.19-22 | PASS, lead-in + 290-char add-on text, STOP line included |
| F4d | founding l.32 | PASS, ends "Reply STOP anytime." |
| F5 | review-card l.8 | PASS (see mismatch note) |
| F6 | owned-items l.7 | PASS, UNCONFIRMED + verify with CDTFA/tax professional BEFORE first sale |
| F7 | owned-items l.37 | PASS, VERIFIED url/date/snippet; marked stalls/camera UNVERIFIED |
| F8 | care-plan l.18 | PASS, 257 chars (see advisory) |
| F9 | care-plan l.8 | PASS, verbatim |
| F10 | care-plan l.23 | PASS, "Reply STOP anytime." appended |
| F11 | care-plan l.28 | PASS, "Reply STOP and I won't ask again." appended |

Review-card line mismatch: my "l.61/80/82/88" were wrong (file is 35 lines; my error, now logged in the checklist). Growth's edit at l.8 satisfies F5 in substance: the Sale line has add-on-inside-approved-text-only, no stand-alone cold text, and "you type and send every message yourself from your own phone: no bulk app, no automation, no scheduled sends". The STOP-bearing send asset is l.29 (reply-only), l.27 offer line rides inside approved texts. PASS.

## (2) Opening send texts, fresh count (raw / after fills)
| File:line | Raw | After fills | Under 320 |
|---|---|---|---|
| gbp-pack l.16 opening | 229 | 283 | yes |
| gbp-pack l.22 Version B | 251 | 305 | yes |
| ai-search l.24 | 240 | 250 | yes |
| founding l.17 | 290 | 308 | yes |
| founding l.21 add-on variant | 290 | 308 | yes |
| founding l.32 annual (follow-up) | 225 | 225 | yes |
| care-plan l.18 | 257 | 257 | yes |
| care-plan l.23 / l.28 | 184 / 216 | 200 / 216 | yes |
Largest after fills is 308 (founding, both variants). Margin 12 chars: a studio name over ~37 chars or a long observed fact would cross 320. Owner should keep names short; not a fail. review-card and owned-items have no cold text (owned-items buyer replies are inbound-only).

Advisory, accepted per orchestrator ruling: follow-ups over 320 after fills: gbp l.27 (279/342), ai-search l.29 (324/387), founding l.26 (299/362), founding terms l.37 (511/510). Per D-022 the founding terms go as two messages, not a hosted page; the file still says "in the message or a linked page" (l.35), so scribe/growth should align the wording when next edited. Noted, not failed.

## (3) D-020 mapping and prices
A-007 = EXP-A2 ($99, $29 add-on), A-008 = EXP-A3 ($49), A-009 = EXP-A4 ($450 / $150 / $300, $590 annual) unchanged in all six files. DECISIONS.md l.39-41, STATE.md l.10-12 and TODAY.md agree (the earlier STATE.md ACTION is closed). Grep: no guarantee, testimonial claim, REPLACE-ME or "limited spots" as a claim (matches are prohibitions in compliance lines).

## Advisory (not a fail)
- care-plan l.18 is my own replacement and reads ambiguously: "Want details? Reply STOP and I won't message about this again." Suggest: "Want details? Reply YES. Reply STOP and I won't message about this again." (269 chars). File is reserve-only and gated, so fix before promotion.
- gbp l.12 "Say so if asked" on AI-assisted drafting: still suggest disclosing in the follow-up.
- Legal/tax items (CDTFA, TCPA/DNC, payment-app TOS) remain "verify with a professional"; this gate does not resolve them.
- EXPERIMENTS.md C1-C8 gap (INC-008) is not mine to verify here.

## Acceptance checklist
- [x] All eleven items plus F4a checked at growth's lines · [x] fresh counts, all openings under 320 · [x] D-020 mapping and prices unchanged · [x] review-card mismatch addressed

## Self-check
- [x] Proof line per item · [x] Counts re-run by script, not copied · [x] Placeholder grep done · [x] Checklist saved · [x] Under 80 lines · [x] Cost line

## QUALITY SCORE: 4
Every item verified against fresh line numbers with scripted counts, and the checklist is saved. Not 5: legal reads remain unresolved, and I found a wording flaw in my own F8 replacement only on this pass.

## Attempt 3 (post-PASS lines): PASS
Run by qa, 2026-10-12. Script run with `python3 -I` on the fdfc3ce originals vs HEAD working copies (scratch: `scratchpad/t008a3/check.py`). Counts are Python `len()` on code points; the target lines have no non-ASCII characters. No file in `library/` was edited.

| Item | File:line | Count as typed | Result |
|---|---|---|---|
| (1) heading names two text messages | founding l.35 | n/a | PASS: "## Terms line (must appear in the two text messages BEFORE payment, C7)" |
| (2) Terms message 1 of 2 | founding l.39 (fence l.38-40) | 281 | PASS, under 320 |
| (2) Terms message 2 of 2 | founding l.43 (fence l.42-44) | 241 | PASS, under 320 |
| (2) no term lost or added | founding l.39 + " " + l.43, markers "(1/2) " and "(2/2)" removed | 511 = original | PASS: byte-identical to fdfc3ce l.37 |
| (3) care-plan message | care-plan l.18 | 243 (was 257, -14) | PASS: ends "Want details? Reply YES. To opt out, reply STOP." |

Diff check: `git diff -U0 fdfc3ce -- library/outreach/` gives exactly three hunks and nothing else. Care-plan l.18 (one line replaced). Founding l.35 (heading replaced). Founding l.37 replaced by l.38-44 (label, fence, msg 1, fence, label, fence, msg 2, fence; 2 lines deleted, 7 added).

Wording diff: the only added text is the labels "Terms message 1 of 2:" and "Terms message 2 of 2:" (outside the fences, not sent) and the "(1/2)" and "(2/2)" markers. No new factual claim. Care-plan change: "Reply STOP and I won't message about this again." becomes "Reply YES. To opt out, reply STOP."

Notes, not failures:
- Counts include the markers as typed. Without them: 275 and 235.
- Terms messages still carry placeholders ([OWNER DECIDES…], [YOUR NUMBER], [OWNER CONFIRMS]). Counts are as typed, not filled. Filled counts were not re-measured.
- Founding l.26 and the other follow-ups over 320 were not re-measured (outside the three named lines).

Failed criteria: none.
Checklist used/updated: `library/checklists/outreach-send-asset.md` (unchanged in this pass).
Cost: ~12k in / ~2k out tokens est., ~3 min wall, model claude-haiku-5-5.
QUALITY SCORE: 4. Every line is proven by a scripted count and a full diff. Not 5: the script lives in scratchpad and was not saved to the checklist, and filled counts were not measured.
