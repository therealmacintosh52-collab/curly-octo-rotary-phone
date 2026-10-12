# T-011c — qa → growth (verifies builder T-010c; Repair Protocol step 4)
Status: VERIFIED. Rollback under test: `94efc8f`; commit under test: `5ac5869`. Local only, nothing published.
Gates re-run by qa with `python3 -I`, not copied from builder's table. Scratch: .../scratchpad/qa3/.

VERDICT: PASS (items 1-7 PASS, item 8 accepted with a note)

| # | Check | Result | Proof |
|---|---|---|---|
| 1 | GBP file, DESC markers, 760-char description, no flag | PASS exit 1 | "description is 760 characters, over 750" (exact 760, builder used 759) |
| 2 | same + `--no-desc` | PASS exit 2 | "--no-desc was removed (T-010c)", no bypass |
| 3 | non-report file, no markers | PASS exit 1 | "no DESC START / DESC END markers: ... cannot run" |
| 4 | AI-search SAMPLE `--allow-sample` | PASS exit 0 | "SKIPPED", 0 FAIL 0 WARN |
| 5a | "Review us and get 10 percent off" | PASS exit 1 | "review near an offer word (incentive)" |
| 5b | "Post a glowing review for a free coffee" | PASS exit 1 | same rule (plus 1 WARN) |
| 6 | benign lines (builder listed 3; I added "Review your own notes before sending") | PASS all exit 0 | 0 FAIL each; "offer free parking" gives 1 WARN only |
| 6b | false-positive probe, gbp-pack/{pack-template,intake-checklist,README}.md, ai-search-check/{report-template,checklist}.md | PASS: none | review+offer and ranking rules run per line on raw and comment-stripped text: 0 hits in every file. pack-template.md still FAILs only on [[FILL]] placeholders, as designed |
| 7 | `render_card.py -h` / SAMPLE render of sample.json | PASS exit 0 / exit 0 | help text printed; sign.pdf and sign.png written to out/SAMPLE-... |

## Item 8: title-spoof mutation (builder's caveat)
- Test A: pack-template.md with both DESC markers deleted and `# AI-search readiness check` prepended: description check SKIPPED, but the 48 placeholder FAILs still fire (exit 1).
- Test B: titled file, no markers, a 900-char "Description" section: exit 0, description not counted.
- Decision: ACCEPTABLE, no follow-up needed. It needs two deliberate edits (delete markers and retype the exact report title) on a file the growth/owner pipeline produces from templates; all other FAIL rules still run; owner read of every client file is mandatory (lint is a first filter). Optional hardening if ever wanted, low priority: refuse the skip when the text contains a "Description" heading or a `<!-- DESC` mention.

## Still-open observations (unchanged, not blockers)
- Gating paraphrase "Reviews from unhappy customers should go to us directly" still exits 0 (builder disclosed; outside R2). Owner read covers it.
- Review+offer rule is deliberately broad: a legit "Reviews: free parking" would FAIL (fail closed). No such line exists in current templates.
- My item-5/6 probes used the titled-report path (no markers), so only the pattern rules were exercised, which is what was asked.

## For system-qc
Builder's QUALITY SCORE was written as 8/10; the protocol scale is 1-5. Needs normalising (not qa's field to edit). Builder's "~35k in / 6k out" cost is within cap; qa could not verify it.

## Checklist updated
library/checklists/deliverable-kits.md: lines 32-35 now record the `--no-desc` item as RESOLVED (T-010c) with the accepted title-spoof residual; incentive-paraphrase note updated (all FAIL except the gating one). Uncommitted.

## Tools used
Bash (python3 -I check_deliverable.py / render_card.py, a short regex probe via importlib, heredoc edit of the checklist), Read (2 files). No network, no fixes to code.

Cost: about 35k tokens in / 4k out, under the 60k/6k cap.
QUALITY SCORE: 4/5 (every asked item reproduced; false-positive probe limited to current template text and regex-level).
