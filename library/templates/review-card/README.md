# Review-request card kit, $29 (EXP-A5)

Internal kit. Built by builder for T-010, 2026-10-12.
Offer and wording rules: growth's
`library/outreach/review-card-kit-2026-10-13.md`.

## The rules are the product (red-team C4)
- The card asks EVERY customer.
- No reward, discount or entry. Ever.
- No "if you were happy", no "5 stars",
  no "tell us first" detour.
- The QR holds ONLY the business's own
  Google review link.
The script enforces these. Wording is fixed
to growth's 3 variants (A, B, C); there is
no free-text field to break them.

## Owner steps on your phone (after payment)
1. Payment shows in your balance (C5).
2. Text the client (copy-paste):
```
Thanks! One step: send me your Google review link.
On your phone, signed in to the Google account that
manages your business, open your profile in Google
Maps or Google Search and look for "Ask for reviews"
or "Share review form". Copy the link and text it
to me. Stuck? Send me a screenshot of that screen.
```
   Button names are UNVERIFIED (growth kit);
   the client may see different words.
3. Tap the link they send. It must open a
   Google review box for THEIR business.
   If not, ask again. Never build the link
   yourself from a search result.
4. Ask which wording they want: A, B or C
   (texts in growth's kit). Default: B.
5. Text the agents in chat: business name
   exactly as on Google, the link, A/B/C.
6. Agents run the script (below) and send
   you `card-sheet.pdf`, `sign.pdf`,
   `card.png`.
7. Scan test before forwarding: open
   `card.png` on one screen, scan it with
   your phone camera. It must open the same
   review box as step 3.
8. Forward the 2 PDFs and the link within
   24 h of payment. The shop prints them.

## Agent steps (sandbox)
Copy `sample.json` to `out/<client>.json`
(`out/` is gitignored: client data stays out
of the repo). Set business, review_url,
variant, `"sample": false`. Then:
`python3 library/templates/review-card/render_card.py library/templates/review-card/out/<client>.json`
Exit 0 = files listed with paths. Exit 2 =
config refused (message says why).
Exit 3 = no Chromium. Exit 4 = a self-check
failed; do not send anything.

## What the script checks (no new dependencies)
- reportlab's QR encoder + Pillow (as in
  `dropship-os/assets/render_gift_note.py`),
  headless Chromium (same binary as
  `sites/cali-tints/scripts/og-images.mjs`).
- https + Google host only (`GOOGLE_HOSTS`;
  extend it only from a real screenshot).
- Variant A only if the link is 40 chars or
  less (it is printed inside the sentence).
- Business name passes the wording lint
  (`../check_deliverable.py` patterns).
- Text fits each card and the sign.
- Every QR module on all 10 cards and the
  sign, in the PNG and the 300 dpi raster of
  the PDF, matches the encoder (0 misses).
- SAMPLE configs must use a reserved
  `.example` host and say SAMPLE.

## Files
- `card.html` sheet of 10 cards, 3.5 x 2 in,
  letter page, dashed cut lines
- `sign.html` letter counter sign
- `render_card.py` the renderer
- `sample.json` fictional SAMPLE config
- `.gitignore` keeps `out/` out of git
