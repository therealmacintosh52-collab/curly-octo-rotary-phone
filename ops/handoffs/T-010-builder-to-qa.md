# T-010 — builder → qa

**Status:** DELIVERED
**Task:** library/templates/{gbp-pack,ai-search-check,review-card}/ built; scripts run with exit 0 pasted; no unlabeled placeholders; no invented facts; committed with rollback hash; nothing published
**Attempt:** 1 of 3
**Cost:** ~2.0M in (cumulative context, ~40 calls) / ~35k out, ~25 min wall · model opus · API-equiv ~$8.7 · cash $0
**Tools used:** Bash, Read (incl. 3 rendered PNGs). No MCP, no WebSearch, no network.

## Input validation
TASKS row T-010 present (doing). Red-team T-006: PASS-WITH-CONDITIONS; C4 (review wording) and C5 (payment before work) are built into the kits; C1-C3, C6-C8 govern sending, not building. Not a site, so no intake; nothing publishes, so no A-### needed (D-020). ACCEPTED.
Note: the TASKS row does not list C1-C8 by name; the brief pointed to them. Flag for scribe.

## What was done
Three delivery kits plus a shared lint, all under `library/templates/`. Reused: growth's offer files (promises, the 750 limit, wording variants), MASTER-BLUEPRINT §1/§7/§8 lines, reportlab + Pillow (render_gift_note.py), and headless Chromium at the same path og-images.mjs uses. No dependency added.
Two deviations from the brief, both to keep red-team and growth terms:
- D1 "5 Q&A entries" are delivered as 5 customer FAQs marked not for Google Q&A posting. Red-team T-006 I-003: "Pack leaves out Q&A items"; growth: "NOT in the pack: Q&A entries". **Orchestrator to confirm.**
- D2 4 post slots, not 3. Growth's text promises the client "4 post drafts".

## Outputs
- `library/templates/README.md` — index + conventions (`[[FILL: ...]]`, INTERNAL notes, SAMPLE rule)
- `library/templates/check_deliverable.py` — lint: strips internal notes, fails on fills/placeholders/SAMPLE/ranking promises/review gating, desc ≤750
- `library/templates/gbp-pack/` — README, intake-checklist.md (10 min), pack-template.md (desc, categories, 8-10 services, 5 FAQs, 4 posts, hours list, 10-shot list, phone paste guide)
- `library/templates/ai-search-check/` — README (blueprint lines 23-27,161,182,185,194,196,200 cited), checklist.md (12 points, 0/1/2/N/A, bands, fix text, top-3 rule), report-template.md, sample-report-SAMPLE.md
- `library/templates/review-card/` — card.html (10 x 3.5x2in, letter), sign.html, render_card.py, sample.json (SAMPLE), README (owner phone steps), .gitignore (`out/`)

## Gate results (verbatim; repo site gates N/A: no site touched)
- G1 `python3 -m py_compile check_deliverable.py render_card.py` → exit 0
- G2 `python3 library/templates/review-card/render_card.py library/templates/review-card/sample.json` → exit 0
  `layout fit card-sheet: ok` · `layout fit sign: ok` · `PDF raster check: done (pdftoppm, 300 dpi)`
  `QR: version 3, 29x29 modules, ECC M` · `QR fidelity: 0 mismatched modules on 10 cards + sign`
  pdfinfo both PDFs: `Pages: 1` `Page size: 612 x 792 pts (letter)`
  Output: `library/templates/review-card/out/SAMPLE-sample-corner-bakery-fictional/` {card-sheet.pdf, sign.pdf, card-sheet.png, sign.png, card.png, qr.svg, qr.png, *.html} (gitignored)
- G3 lint SAMPLE report `--allow-sample --out` → `0 FAIL, 0 WARN` exit 0; INTERNAL lines in client copy: 0
- G4 same without `--allow-sample` → `7 FAIL` exit 1 (refuses to ship a SAMPLE)
- G5 raw templates → pack-template `48 FAIL` exit 1; report-template `26 FAIL` exit 1 (unfilled = blocked)
- G6 fictional filled GBP pack (scratchpad) → `description: 197 characters` `0 FAIL` exit 0; 760-char desc → `FAIL ... over 750` exit 1; "Guaranteed to rank #1. Leave 5 stars if you were happy!" → `4 FAIL` exit 1
- G7 renderer negatives (scratchpad configs): bit.ly host exit 2 · variant D exit 2 · "Five stars" name exit 2 · http exit 2 · variant A + 79-char link exit 2 · overflowing name exit 4 (`fail:card0:text...`) · long Google-style link, variant B → exit 0, version 6, 0 mismatches. Wrong-matrix check: `11 of 11 regions flagged`.
- G8 scans: no REPLACE/TODO/XXX/TBD; no single-bracket caps placeholder (one hit is the `[UNVERIFIED]` tag); 0 hits for the 13 real business names in the research cache, Cali Tints, Phil's.
- Fixed during build (root causes): Chromium fit check read viewport height (600 px) not page bottom → false fail on a valid sign; the template comment held a literal token → the unfilled-token guard fired; "cheap" in my report text → lint WARN, reworded.

## Evidence
| # | Claim | Tag | Source |
|---|---|---|---|
| 1 | GBP description limit 750 | VERIFIED | `library/outreach/gbp-pack-offer-2026-10-13.md` · 2026-10-12 · "750-character limit" (growth, brightlocal.com URL) |
| 2 | Pack excludes Q&A | VERIFIED | `ops/handoffs/T-006-red-team-to-growth.md` l.22 · "Pack leaves out Q&A items" |
| 3 | Card wording A/B/C + banned list | VERIFIED | `library/outreach/review-card-kit-2026-10-13.md` · "Card text, three variants" |
| 4 | Standards reused | VERIFIED | `blueprint/MASTER-BLUEPRINT.md` l.25 "Lighthouse mobile ≥ 90 performance"; l.27 "`robots.txt` allowlist for AI crawlers, `llms.txt`"; l.200 "NAP identical on every listing" |
| 5 | Chromium path | VERIFIED | `sites/cali-tints/scripts/og-images.mjs` · "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" |
| 6 | Google button names ("Edit profile", "Ask for reviews", "Add update") | UNVERIFIED | not searched; guides say "look for", fallback = screenshot |
| 7 | Google review-link hosts in `GOOGLE_HOSTS` | UNVERIFIED | fails closed; extend only from a real screenshot |
| 8 | Free checkers work on a phone without login | UNVERIFIED | scout r1; sign-in asked = N/A |
| 9 | llms.txt affects AI answers | UNVERIFIED | report says "not proven" |

## Assumptions
- Rubric bands (80/50), review-velocity and speed cut-offs are our rubric, labeled as such in the report.
- Description length is counted in Python characters; Google's counting of emoji etc. UNVERIFIED.

## Open risks
- **No QR decoder in the sandbox.** G2 proves the printed pixels equal reportlab's matrix, not that a phone decodes them. qa: scan `card.png` and `sign.png` with a real phone (README step 7 makes the owner do this per client). Version-6 module ≈0.67 mm on the card.
- Lint is pattern-based; the owner's read before forwarding is still required (kit step 5).
- Client format is Markdown/plain text pasted into a message; no PDF path for the GBP pack/report (pandoc exists in the sandbox but not in the repo). Growth decides.
- Rollback caveat: Orchestrator checkpoints `47e3fc6` (mixed with scout T-008) and `c696179` already hold earlier copies of these files. Do not reset the branch.

## Owner still has to supply (per kit, only after a yes + payment)
GBP: Maps screenshots A1-A7 + 5 facts · AI check: S6-S12 screenshots · Card: the client's Google review link (from the client), wording A/B/C, phone scan test. Before any sale: A-004 Q2-Q4, A-007/A-008, license or A-010 (C1, C2).

## Commits
Kit commit `ec06e20` (plus the Orchestrator checkpoints above). This handoff: the next commit, message "T-010 builder handoff".
**Rollback** (path-scoped; verified in a throwaway worktree: 0-line diff vs `52bc6af`, 0 other paths):
`git rm -r library/templates/{gbp-pack,ai-search-check,review-card} library/templates/check_deliverable.py library/templates/.gitignore && git checkout 52bc6af -- library/templates/README.md`

## Acceptance checklist (from TASKS.md, verbatim)
- [x] library/templates/{gbp-pack,ai-search-check,review-card}/ built — Outputs
- [x] scripts run with exit 0 pasted — G1, G2, G3, G6
- [x] no unlabeled placeholders — G5, G8; one `[[FILL: ...]]` convention, linted
- [x] no invented facts — G8; only SAMPLE/.example fiction; UNVERIFIED rows 6-9
- [x] committed with rollback hash — Commits
- [x] nothing published — no push, no deploy, no network

## Self-check
- [x] Every claim tagged · [x] Only `library/templates/` + this handoff written · [x] No hard-gate action, no push · [x] Under 120 lines · [x] Cost line · [x] Gates pasted

## QUALITY SCORE: 4
All three kits are usable today, the scripts gate themselves (each negative test fails as it should), and nothing about a real business is stated. Not a 5: no real-phone scan yet; Google UI wording is unverified; deviation D1 needs the Orchestrator's confirmation.

## Receiver validation
Not written here (PROTOCOL §6). qa writes it in T-011.
