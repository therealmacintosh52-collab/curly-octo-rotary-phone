# T-011 — qa → growth

**Status:** DELIVERED
**Task:** every T-010 criterion re-checked with the command that proved it; render script re-run; checklist saved to library/checklists/
**Attempt:** 1 of 3
**Cost:** ~0.6M in (cumulative context, ~28 calls) / ~14k out, ~20 min wall · model sonnet · cash $0 (estimate-vs-actual: no estimate in the TASKS row; builder side below)
**Tools used:** Bash, Read (incl. 3 PNG views). No MCP, no network, no pip install.

VERDICT: PASS (conditional; 5 non-blocking defects D1-D5 go to builder; one UNVERIFIED gate stays with the owner)
Failed criteria: none of the 6 T-010 criteria. Defects below have reproductions.
Checklist used/updated: library/checklists/deliverable-kits.md (new)

## Input validation (receiver, D-014)
Input contract met: YES. Handoff `Status: DELIVERED`, kit commit `ec06e20`, rollback `52bc6af` (both exist: `git cat-file -t`), gate output pasted. Red-team conditions C1-C8 are in `ops/EXPERIMENTS.md` line 5-11, not in the TASKS row (builder's flag stands; scribe). Independent score of the builder work: 4. ACCEPTED.
Scratch: `/tmp/claude-0/.../scratchpad/qa/`. Repo files untouched by me except my two owned paths.

## Gates re-run (S = scratchpad/qa; exit codes are mine)
| # | Command | Result |
|---|---|---|
| G1 | `python3 -m py_compile check_deliverable.py review-card/render_card.py` | exit 0 |
| G2 | `render_card.py sample.json --out $S/render-sample` | exit 0; fit ok x2; `QR: version 3, 29x29, ECC M`; `0 mismatched modules on 10 cards + sign`; `pdfinfo` both PDFs `Pages: 1`, `612 x 792 pts (letter)` |
| G3 | `check_deliverable.py sample-report-SAMPLE.md --allow-sample --out ...` | `0 FAIL, 0 WARN` exit 0; `grep -c INTERNAL` on client copy = 0 |
| G4 | same, no `--allow-sample` | `7 FAIL` exit 1 |
| G5 | unfilled `pack-template.md` / `report-template.md` | `48 FAIL` exit 1 / `26 FAIL` exit 1 |
| G6 | fictional filled pack (fill.py over the real template, 233-char desc, no SAMPLE word) | `0 FAIL, 0 WARN` exit 0; INTERNAL in client copy 0 |
| G7 | variants A, B, C with `https://g.page/r/Abc123/review`, sample:false | each exit 0, 0 mismatched modules |

## Negative tests (builder's claims, reproduced)
| Test | Result |
|---|---|
| desc 750 chars / 751 / 760 | exit 0 / `FAIL ... over 750` exit 1 / exit 1 (boundary exact) |
| "Guaranteed to rank #1 on Google" · "first page of Google" · "We guarantee more calls" | each exit 1 (result guarantee / ranking promise) |
| "Leave 5 stars if you were happy!" · "free coffee in exchange for a review" · "Tell us first..." | each exit 1 (star ask, gated ask, incentive, detour) |
| link `https://bit.ly/abc` | exit 2 (not a Google host) |
| `http://g.page/...` | exit 2 (must start with https) |
| `https://evil.example.com/search.google.com`, `google.com.evil.com`, `g.page@evil.com` | each exit 2 |
| 108-char Google link, variant A | exit 2 (max 40 for A) |
| variant D · business "Five Stars Cafe" | exit 2 · exit 2 (name lint) |

## Greps (tracked files: `git ls-files library/templates`, 16 files)
- REPLACE-ME / TODO / TBD / XXX / lorem / example.com: 0 hits. Only `.example` host: `sample.json` (SAMPLE-labeled).
- 18 real business names from `income-lanes-2026-10-12.md` (10 table rows + 8 excluded names) plus "Cali Tints", "Phil's", "phils-auto": 0 hits. Phone patterns: 0.
- Four hits for the repo path `sites/cali-tints/...` in internal files (review-card README l.64, render_card.py l.19, ai-search-check README l.42, checklist l.98). Internal procedure text, not client copy, not the business name. Note only.

## Compliance
- C4 review card: wording is one of 3 fixed variants (render_card.py VARIANTS) equal to growth's A/B/C in `library/outreach/review-card-kit-2026-10-13.md`; no free-text field; rendered card and sign text read in full: asks every customer, no reward, no filter, no star ask. PASS.
- gbp-pack and ai-search-check: `grep -niE "rank|guarantee|first page|..."` hits are only prohibitions ("Rankings, calls, or review promises" as NOT-in-pack, and "Nobody can promise a ranking..."). No outcome claims. PASS.
- AI-search 12 points: opened `blueprint/MASTER-BLUEPRINT.md` at every cited line. L23 trust/real reviews, L24 phone/conversion, L25 Lighthouse 90, L26 keyword family/title/JSON-LD/OG, L27 robots/llms.txt, L161 service pages, L182 At a glance, L185 FAQs two sentences, L194 title 60/meta 155, L196 robots+llms, L200 GBP/NAP: each supports its point. 12 of 12 PASS. Soft spot: point 9 adds "plus description" beyond L200 text, and point 10 "recent" is the builder's wording on L23; both labeled our rubric. Not a mismatch.
- Cost of the report claims: bands 80/50 labeled "our internal rubric" (checklist l.25). PASS.

## QR scan
`import pyzbar` ModuleNotFoundError; `which zbarimg` empty; cv2 and zxingcpp absent. **UNVERIFIED: real-phone scan of card.png and sign.png.** What I did verify: qr fidelity script (pixels = encoder matrix), plus I viewed the sign and PDF raster by eye. Owner step stays: scan `card.png` with a phone before forwarding (kit README step 7). Version-6/7 codes (long links) have ~0.67 mm modules on a 1.3 in code: scan them first.

## Defects (builder fixes; none changes a T-010 criterion result)
- **D1 lint fails open on missing markers.** `sed` out `<!-- DESC START/END -->` from a 760-char filled pack: `0 FAIL, 0 WARN` exit 0. The 750 check silently skipped. Fix: a pack with no DESC markers must FAIL.
- **D2 lint is paraphrase-bypassable.** Exit 0 for: "get you to the top of the search results", "Guaranteed number-one ranking", "Rate us 5/5", "Only happy customers please review us", "Write a review and enter our draw". Builder disclosed it is pattern-based; owner read stays mandatory. Card kit is safe (fixed variants); GBP/report copy relies on the owner read.
- **D3 `card-sheet.png` clips the bottom row.** Ink ends at 10.12 in (`Image.getbbox`); row 5 loses "Scan with your phone camera" and part of the SAMPLE line (viewed). PDF raster is complete (viewed at 100 dpi). Cause: `--window-size=816,1056` screenshot. The fit check and QR fidelity check did not catch it. The kit forwards the PDFs plus card.png, so no client sees it; fix before anyone sends the PNG.
- **D4 long real Google links.** Under B, link text overflow exit 4 (`fail:card0:link...`) for `https://search.google.com/local/writereview?placeid=ChIJ` + 40 A's (91 chars); passes through 86 chars. Fails closed (correct) but the 120-char cap in load_config does not match the layout limit (~86), and the README does not say it. Builder's "long link variant B exit 0" holds only up to 86 chars. Fix: wrap/shrink link or lower the cap with an exit-2 message.
- **D5 `check_deliverable.py -h` raises FileNotFoundError traceback.** Cosmetic.

## Evidence
| # | Claim | Tag | Source |
|---|---|---|---|
| 1 | 750 limit enforced at the boundary | VERIFIED | my run, desc 750/751/760, exit 0/1/1, 2026-10-12 |
| 2 | Card text equals growth variants | VERIFIED | `review-card-kit-2026-10-13.md` l.20-22 "Your honest review helps other customers decide" |
| 3 | Blueprint line cites support points | VERIFIED | `blueprint/MASTER-BLUEPRINT.md` l.25 "Lighthouse mobile ≥ 90 performance"; l.200 "NAP identical on every listing" |
| 4 | Phone decodes the QR | UNVERIFIED | no decoder in sandbox; owner scan |
| 5 | Google button names and link hosts | UNVERIFIED | builder rows 6-7, no network; fails closed |

## Builder cost (for system-qc)
Builder handoff line 6: "~2.0M in ... / ~35k out, ~25 min wall · model opus · API-equiv ~$8.7": confirmed. D-022 records ≈$8.70 vs ≈$0.70 estimate (12x, over the 2x breaker). Flag for system-qc: circuit-breaker incident, already acknowledged in D-022. My own run is far under that.

## Acceptance checklist (T-011 criteria and T-010 criteria)
- [x] every T-010 criterion re-checked with the command — G1-G7, negatives, greps, compliance (6 of 6 PASS: built, scripts exit 0, no unlabeled placeholders, no invented facts, commit+rollback exist, nothing published: `git status` clean of kit changes, no network used)
- [x] render script re-run — G2, G7 (exit 0)
- [x] checklist saved — `library/checklists/deliverable-kits.md`

## Self-check
- [x] Every criterion has a proof line · [x] Gates re-run, not copied · [x] Placeholders grep'd · [x] Checklist saved · [x] Under 120 lines · [x] Cost line · [x] Only owned paths written

## QUALITY SCORE: 4
Reproduced every builder claim and found real, small defects (D1 fail-open is the one that matters). Not a 5: QR decode and Google wording remain UNVERIFIED and I could not test the lint against real client text.

## For growth (T-012)
Kits are plannable now. Before any real card goes out: owner scans card.png; builder clears D1 and D4. Do not promise the card as a PNG preview until D3 is fixed; send PDFs.
