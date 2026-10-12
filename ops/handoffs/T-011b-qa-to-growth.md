# T-011b — qa → growth

**Status:** DELIVERED
**Task:** confirm builder's T-010b fixes D1-D5 (Repair Protocol step 4, different agent)
**Attempt:** 1 of 3
**Cost:** ~0.5M in (cumulative context, ~12 calls) / ~7k out, ~10 min wall · model sonnet · cash $0 · inside the 100k/10k budget on output; input is cumulative-context, not metered by me (estimate)
**Tools used:** Bash (python3, Pillow, pdftoppm, pdfinfo, git, grep), Read (4 files + 3 PNG views). No MCP, no network, no pip install.

VERDICT: PASS (D1, D2, D3, D4, D5 each fixed as specified; 3 non-blocking residuals below)
Failed criteria: none. Residuals are R1-R3 (not defects of the T-010b scope).
Checklist used/updated: library/checklists/deliverable-kits.md (+14 lines: opt-out flag probe, incentive paraphrases, PNG-vs-PDF ink bounds, print-scale read, -h exit codes)
Repo state: HEAD 44dd45a. I wrote only my two owned paths. Unrelated dirty files (library/failure-patterns.md, ops/handoffs/T-009-red-team-to-growth.md) are not mine.

## Per-defect (S = scratchpad/qa2; C = library/templates/check_deliverable.py)
| ID | Command | Result | Verdict |
|---|---|---|---|
| D1 | `sed '/DESC START/d;/DESC END/d' filled-760.md > nomark2.md; python3 $C nomark2.md` | `FAIL line 0: no DESC markers ... pass --no-desc if...` **exit 1** (was 0). 750 desc exit 0, 751 exit 1, 760 exit 1, 233 exit 0 | PASS |
| D1b | `$C sample-report-SAMPLE.md --allow-sample` / same `--no-desc` | exit 1 (no markers) / exit 0 (`0 FAIL, 0 WARN`) | PASS |
| D2 | five paraphrases + "Five Stars" + "Number 1 in Google rankings" inserted as own line into a filled pack | top of the search results, number-one ranking, Rate us 5/5, Only happy customers, enter our draw, Five Stars, Number 1 rankings: all **exit 1**. Benign: "Our team reviews every job", "Rank the options in order of priority", an ordinary opening-hours line: all exit 0 | PASS |
| D3 | `render_card.py sample.json --out $S/sample`; Pillow ink bounds vs `pdftoppm -r 300` | exit 0; PNG 2550x3300, ink (0.747, 0.497, 7.753, 10.503) in vs PDF raster (0.737, 0.487, 7.763, 10.513): 0.01 in apart. Sign PNG = PDF raster (0.0, 0.0, 8.5, 10.07). Read bottom-row crop: row 5 complete, "Scan with your phone camera" present on both cards, "SAMPLE, NOT A REAL BUSINESS", dotted cut line below | PASS |
| D4 | 120-char `search.google.com/local/writereview?placeid=ChIJ...` under B (two glyph mixes: all-W, and `Ab9_-` mix); `len`=120 / 121 | 120: **exit 0** (86, 100 also 0; QR v7, 0 mismatched modules). 121: **exit 2** `review_url is 121 characters; ... at most 120 (link ... set at 5 pt above 55 characters)` | PASS |
| D5 | `$C -h`, `--help`, missing file, `--bogus`, no args | 0, 0, 2 (`cannot read ...`, no traceback), 2 (`run with -h`), 2 | PASS |

## D4 legibility (I looked; builder did not)
Read card.png and sign.png for the 120-char case. Sign: link text is 11 pt (sign.html line 22), two clear lines under the QR, typeable. **Card: link is 5 pt, 4 wrapped lines** under the QR. On a 300 dpi screen view it is readable; on paper 5 pt is about 1.8 mm tall and a typed 120-char string with `l`/`I`/`-`/`_` is error-prone. Verdict: NOT legible enough to type reliably, acceptable only as a last-resort fallback. The QR is the real path and it scans-checks (fidelity 0 mismatches; real-phone scan still UNVERIFIED). Recommendation: keep; README should say "for links over 55 chars, use the sign or the g.page short link; do not expect customers to type the card link". Builder's README already prefers g.page; add that sentence (growth/builder, non-blocking).

## `--no-desc` recommendation: RESTRICT IT (do not fix now; builder task)
Is it acceptable as is? No. Proof: `$C filled-760.md --no-desc` (markers present, 760 chars) = `0 FAIL, 0 WARN` **exit 0**; `$C nomark2.md --no-desc` also exit 0. So one flag typed by habit turns off the one hard 750 check on a GBP pack, which is the failure D1 was meant to close. Recommended restriction, simplest first:
1. `--no-desc` + any DESC marker present in the file = FAIL ("flag contradicts markers"). This alone closes the 760 bypass and costs the report nothing (it has no markers).
2. Prefer: drop the flag; auto-select "no description" only when the first heading matches the report template title; otherwise fail closed.
3. Print `description check: SKIPPED` on stdout (it does) and have the README state the flag is for the AI-search report only (done).
Until fixed: standing condition for qa/owner, never pass `--no-desc` to a gbp-pack file.

## Regression set (all exit codes mine)
| Case | Expected | Got |
|---|---|---|
| py_compile both scripts | 0 | 0 |
| SAMPLE report `--allow-sample --no-desc` / without allow | 0 / 1 | 0 / 1 (7 FAIL) |
| gbp-pack pack-template.md unfilled | 1 | 1 (48 FAIL) |
| report-template.md unfilled (with / without --no-desc) | 1 | 1 (26 / 27 FAIL) |
| filled fictional pack, `--out`; `grep -c INTERNAL` client copy | 0; 0 | 0; 0 |
| bit.ly / http / variant D / "Five Stars Cafe" / "Top of Google Plumbing" | 2 | 2 / 2 / 2 / 2 / 2 |
| variant A, 101-char link | 2 | 2 (max 40 for A) |
| g.page link, variant C; SAMPLE render both PDFs | 0; 1 page letter | 0; `Pages: 1`, 612x792 |
| placeholder grep over `git ls-files library/templates` | 0 | only check_deliverable.py's own regex definitions |

## Residuals (new, non-blocking)
- R1 `--no-desc` bypass (above).
- R2 lint still misses incentive/ranking paraphrases: "Review us and get 10 percent off your next visit" (0 FAIL, 0 WARN), "Post a glowing review for a free coffee" (WARN only, exit 0), "Be the number one choice in town on Google" (0/0), "Give us a maximum rating", "ahead of your competitors", "Reviews from unhappy customers should go to us directly" (exit 0). Builder disclosed pattern-based; the owner read stays mandatory. Cheap upgrade: a review-near-offer-word rule (off, free, discount, percent) should FAIL, not WARN.
- R3 `render_card.py -h` prints help but exits 2 (D5 asked only for check_deliverable.py). Cosmetic.

## UNVERIFIED (unchanged)
Real-phone QR scan (no decoder: pyzbar/zbarimg/cv2/zxingcpp absent); Google link format and button wording (no network). Owner scans card.png before forwarding.

## Self-check
- [x] every criterion has a proof line · [x] gates re-run by me · [x] placeholders grep'd · [x] checklist saved · [x] under 60 lines · [x] cost line · [x] owned paths only
QUALITY SCORE: 4 (all five fixes confirmed with commands and by eye; found one real residual bypass the builder flagged but did not test; QR scan and Google wording still owner-side)
