# Checklist: delivery kits (templates, scripts, sample deliverables)

Writer: qa. First used on T-011 (library/templates/{gbp-pack,ai-search-check,review-card}).
Reuse for any kit whose output a customer will see. Re-run every gate; never copy pasted output.
Set S=<scratchpad>/qa and write all test inputs there, never into the repo.

## A. Build and run
1. `python3 -m py_compile` every .py. Exit 0.
2. Run each script on its SAMPLE input with `--out <scratch>` (never the repo out/). Exit 0.
3. Run the shared lint on: SAMPLE with allow-sample (0) and without (1); every unfilled
   template (1); one fictional filled deliverable you write with no SAMPLE word (0).
4. Confirm artifacts: page count and size (`pdfinfo`), `pdftotext` for text present.
5. LOOK at every rendered image/PDF page (Read the PNG; rasterize PDFs with `pdftoppm`).
   Layout self-checks have missed a clipped PNG before. Compare PNG against PDF.
   Measure ink bounds of PNG vs a 300 dpi `pdftoppm` raster (Pillow getbbox on
   threshold 250); agree within 0.03 in. Crop the bottom row and Read it.
6. Overlong inputs: render the maximum allowed input and Read the output at print scale.
   A fit check says "fits", not "can be read": judge the point size (under 6 pt on paper
   is not typeable) and note which artifact (card vs sign) carries the small text.
7. `-h` and `--help` exit 0 on every script; missing file, unknown option, no args exit 2
   with a one-line message, no traceback. (T-011b: render_card.py -h exits 2.)

## B. Negative tests (each must fail with the right exit code)
- Length limit: exactly N passes, N+1 fails (boundary), far over fails.
- Ranking/result promise wording, review reward, gating, star ask, "tell us first".
- Non-allowed host, http, shortener, look-alike hosts (`google.com.evil.com`,
  `host@evil`), disallowed variant, banned words in the business name.
- Overlong inputs against the layout (find the pass/fail boundary, note the exit code).
- Probe the lint for bypasses with 4-5 paraphrases of banned wording. A pattern lint
  is a first filter only; record which paraphrases pass.
- Remove the structural markers (DESC START/END): the check must fail, not skip silently.
- Opt-out flags (e.g. `--no-desc`): run the opt-out on a file that HAS the markers and a
  760-char description. If it exits 0 the flag is a bypass. T-011c: RESOLVED. `--no-desc` was
  removed in T-010c (exit 2); skip is automatic only for no-marker + exact title. Residual:
  retitling a GBP pack `# AI-search readiness check` and deleting markers skips the check (accepted).
- Incentive paraphrases to try each time: "10 percent off" (digits spelled out), "free
  coffee for a review", "perfect score", "maximum rating", "ahead of your competitors",
  "number one choice on Google", "unhappy customers go to us directly". T-011b: these
  exit 0 (WARN at most). T-011c: all but the gating paraphrase ("unhappy customers go to
  us directly", still exit 0) now FAIL. Pattern lint stays a first filter only.

## C. Placeholders and facts
- `git ls-files <kit>` then grep: REPLACE-ME, TODO, TBD, XXX, lorem, example.com
  (only `.example` hosts inside SAMPLE-labeled files).
- Grep every real business name, phone and client name in library/research/* (0 hits),
  plus the owner's own client names. Slug paths in internal docs: note, not fail.
- Every number/claim traces to a file or is tagged UNVERIFIED (PROTOCOL section 1).

## D. Compliance
- Review kits: asks every customer, no reward, no filter, no star ask, wording is a
  fixed approved variant, QR encodes only the business's own review link.
- Offer kits: no ranking, calls, traffic or citation promises; no price/award/year
  the client did not give; no login requested; internal notes stripped from client copy.
- Citation audits: open the cited file at each cited line and confirm the text supports
  the point. Record each as PASS or the mismatch.

## E. Tooling limits (mark UNVERIFIED, do not pip install)
- QR decode: `python3 -c "import pyzbar"`, `which zbarimg`, cv2, zxingcpp. None = the
  real-phone scan stays an owner step and is UNVERIFIED.
- No network: UI wording of third-party apps (Google buttons) stays UNVERIFIED.

## F. Handoff
- Per-criterion PASS/FAIL with the command. Cost line vs estimate (2x rule, PROTOCOL
  section 4). Defects with reproduction. Tools used. Under 120 lines.
