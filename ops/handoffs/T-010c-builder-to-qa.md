# T-010c — builder → qa
Task: close qa residuals R1-R3 from T-011b, plus README link note. Preview/local only, nothing published.
Rollback: commit `94efc8f` (HEAD before this task). Revert T-010c commit to restore `--no-desc`.

## Paths changed (library/templates/)
- `check_deliverable.py` (R1, R2), `render_card.py` under review-card/ (R3)
- `README.md`, `ai-search-check/README.md`, `report-template.md`, `sample-report-SAMPLE.md` (flag removed from invocations)
- `review-card/README.md` (link-length note)

## What changed
- R1 (Fix 2, ~10 lines): flag dropped. Description check is skipped only when the file has NO `<!-- DESC` text anywhere AND its first heading is exactly `# AI-search readiness check`. Anything else keeps failing closed. `--no-desc` now prints a removal message and exits 2 (not silently ignored).
- R2: new FAIL rule: "review*" and an offer word (off, free, discount*, percent, %, coffee, draw, gift*) on one line, either order. New FAIL rule: "number one/1 choice|pick|option|spot|name|provider", "maximum rating|score|stars|marks", "ahead of your/the/all competitors".
- R3: `render_card.py -h/--help` prints help, exit 0. No args or bad flag still exit 2.
- README: links over 55 chars go on the sign or use the g.page short link; 5 pt card link is a last-resort fallback.

## Gates (exit codes, mine; scratch files in session scratchpad)
| Check | Result |
|---|---|
| py_compile check_deliverable.py + render_card.py | exit 0 |
| GBP file with DESC markers, 759 chars (fixture; not exactly 760) | exit 1 (over 750) |
| same file + `--no-desc` | exit 2 (flag removed), no bypass |
| no-marker non-report file | exit 1 (fails closed) |
| AI-search SAMPLE `--allow-sample` | exit 0, 0 FAIL 0 WARN, "SKIPPED" printed |
| SAMPLE without `--allow-sample` / unfilled report-template | exit 1 (7 FAIL) / exit 1 (26 FAIL), same as before |
| titled report, clean sentence | exit 0 |
| "Review us and get 10 percent off" (+ "your next visit") | exit 1 |
| "Post a glowing review for a free coffee" | exit 1 (was WARN) |
| "Be the number one choice in town on Google" / "maximum rating" / "ahead of your competitors" | exit 1 each |
| Benign: "Leave us a review if you have a moment, it helps neighbours find us" | exit 0 |
| Benign: "Reviews help other people find a good local shop" | exit 0 |
| Benign: "We are open 9 to 5 and offer free parking" | exit 0 (no review word) |
| `render_card.py -h` / `check_deliverable.py -h` | exit 0 / exit 0 |
| `render_card.py review-card/sample.json` (SAMPLE render) | exit 0 |

## For qa to check
- Gating paraphrase "Reviews from unhappy customers should go to us directly" still exits 0 (not in the R2 ask; not fixed). Pattern lint stays a first filter; owner read mandatory.
- New review+offer rule is broad: a legit line like "Reviews: free parking" would FAIL. Judged right (fail closed); qa may probe for false positives in gbp-pack/pack-template text.
- `library/checklists/deliverable-kits.md` line 32-34 still says the `--no-desc` item is "still open". Not my path; scribe/qa to update.
- Mutation test suggested: take a GBP pack, add the title line `# AI-search readiness check` and delete markers. That passes the skip by design (deliberate edit); decide if acceptable.

## Owner still has to supply
Nothing new for this task (tooling only). Existing: client Google review links, A/B/C choice per client, verified ratings/listings.

## Tools used
Read/Grep/Bash (python3 py_compile, heredoc edits, sed), git. No network, no Chromium beyond the SAMPLE render.

Cost: about 35k tokens in / 6k out, under the 80k/8k cap (est. unchanged).
QUALITY SCORE: 8/10 (all asked cases verified; lint remains pattern-based).
