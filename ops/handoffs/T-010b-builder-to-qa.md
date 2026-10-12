# T-010b — builder → qa

**Status:** DELIVERED
**Task:** T-010b: fix the five qa defects (D1–D5, T-011 handoff) in the review-card kit and the shared lint.
**Attempt:** 1 of 3
**Cost:** ~110k in / ~14k out, ~25 min wall · model sonnet (estimate; no meter available to me)
**Tools used:** Bash (python3, Chromium via render_card.py, pdftoppm, git, sed, grep), Read (qa handoff section, 3 owned files, one PNG crop). Nothing outside builder's list.

## What was done
- D1: lint fails closed. No markers, one marker, duplicate or empty DESC block = FAIL (exit 1). New explicit opt-out `--no-desc` for the AI-search report (it has no GBP description); its README, template and sample invocation updated.
- D2: wording lint extended (regex, case-insensitive; digit and word forms): top/first/number-one/#1/No. 1 + ranking/position/spot/result; "top of the search results", "top of google", "page one of google"; 5/5, five out of five, 5 or five stars, star glyph, "rate us 5/5"; "only happy/satisfied customers", "happy customers only"; "enter our draw/raffle/giveaway"; incentive word + review on one line (negated "no reward" is allowed). Docs state it is pattern-based and the owner read stays mandatory.
- D3: root cause was the screenshot window (816x1056 loses ~0.9 in to window chrome). Now window 816x1300, cropped to exactly 2550x3300. New ink-bounds check compares PNG with the PDF raster (tolerance 0.03 in) plus fixed floors (sheet 10.45 in, sign 9.2 in) when pdftoppm is missing. Exit 4 on mismatch.
- D4: kept the 120-char cap and made the layout honor it: link text over 55 chars is set at 5 pt under the QR (`.link.long` in card.html). Fit check still fails closed. Cap message and README say so.
- D5: `-h`/`--help` prints help, exit 0. Also: unknown options and unreadable files exit 2 with a message, no traceback.

## Outputs
- `library/templates/check_deliverable.py` (D1, D2, D5)
- `library/templates/review-card/render_card.py`, `card.html` (D3, D4)
- `library/templates/README.md`, `review-card/README.md`, `ai-search-check/{README.md,report-template.md,sample-report-SAMPLE.md}` (docs, --no-desc)

## Evidence (all reproduced this run; commands in the gate list)
| # | Claim | Tag | Source |
|---|---|---|---|
| 1 | Old bug caught: with window 1056 restored in a scratch copy, render exits 4: "ink ends at 10.12 in" and bounds differ from PDF raster (0.74,0.49,7.76,10.51) | VERIFIED | scratchpad run |
| 2 | Fixed SAMPLE: card-sheet.png ink (0.75,0.5,7.75,10.5) in = PDF raster; row 5 text and SAMPLE line present (viewed crop) | VERIFIED | render output + image |
| 3 | Links of 90/100/104/108/112/120 chars fit under B for glyph mixes A, W (widest), mixed | VERIFIED | fit check "ok" x18 |
| 4 | Google link format and Google wording | UNVERIFIED | unchanged from T-011 (owner screenshot) |

## Gate results (exit codes, verbatim)
- py_compile both scripts: 0 · SAMPLE render: 0 (fit ok, QR 0 mismatches on 10 cards + sign)
- Lint SAMPLE report --allow-sample --no-desc: 0 · without --allow-sample: 1 · gbp-pack template unfilled: 1 (48 FAIL) · report template unfilled: 1 (26 FAIL) · `-h`: 0 · missing file: 2
- Desc: 750 chars: 0 · 751: 1 · 760: 1 · markers removed (760): 1; also removed (short): 1, START only: 1, empty: 1, duplicated: 1
- D2 paraphrases all exit 1: top of the search results · Guaranteed number-one ranking · Rate us 5/5 · Only happy customers please review us · Write a review and enter our draw · Five Stars · Number 1 in Google rankings · rank #1 · page one of Google · If you had a great experience. Benign lines ("Rank the options in order of priority", "Our team reviews every job") exit 0.
- Renderer negatives: bit.ly 2 · http 2 · variant A with 101-char link 2 · variant D 2 · business "Five Stars Cafe" 2 · business "Top of Google Plumbing" 2 · 121-char URL 2 · 120-char URL (B) 0 · g.page link (C) 0

## Assumptions
- 5 pt link text is acceptable as a fallback; the QR is the primary path and README prefers the short g.page link.
- Business names like "First Position Realty" may now be refused (exit 2). Fail-closed on purpose; owner can rename.

## Open risks
- Lint is still line-by-line patterns: a sentence split across lines, or a paraphrase not listed, passes. Owner read mandatory (qa: keep as a standing condition).
- `--no-desc` is a deliberate bypass of the 750 check; only the report docs use it. qa may prefer to restrict it.
- No PDF viewer opened for the 120-char link layout; judged by the fit check, not by eye. qa could view one.
- QR decode with a real phone and Google wording remain owner-side (T-011 UNVERIFIED item).

## Rollback
Revert to `6faadec` (state before any T-010b change). `86cabac` is an auto-checkpoint holding half of the render_card.py edits; do not roll back to it. Command: `git revert 3b024c6 86cabac`.

## Self-check
- [x] Gates run and pasted · [x] no invented facts · [x] branch-only (claude/affectionate-brown-h3wfam) · [x] rollback named · [x] nothing published · [x] under 80 lines · [x] no test or threshold edited (only lint patterns extended per qa)
QUALITY SCORE: 4/5 (all five reproduced and fixed with negative tests; lint remains pattern-based; 120-char layout not viewed by eye)
