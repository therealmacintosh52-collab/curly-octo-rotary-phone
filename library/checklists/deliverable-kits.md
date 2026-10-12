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

## B. Negative tests (each must fail with the right exit code)
- Length limit: exactly N passes, N+1 fails (boundary), far over fails.
- Ranking/result promise wording, review reward, gating, star ask, "tell us first".
- Non-allowed host, http, shortener, look-alike hosts (`google.com.evil.com`,
  `host@evil`), disallowed variant, banned words in the business name.
- Overlong inputs against the layout (find the pass/fail boundary, note the exit code).
- Probe the lint for bypasses with 4-5 paraphrases of banned wording. A pattern lint
  is a first filter only; record which paraphrases pass.
- Remove the structural markers (DESC START/END): the check must fail, not skip silently.

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
