# Business card: build notes

Rebuilt from the owner's printed card (`inputs/916-card-front.pdf`, `916-card-back.pdf`; both viewed at 300 dpi). The originals are single flattened raster images; this version is vector except the logo and the owner's script lettering. Trim **3.5 x 2 in**, bleed **0.125 in** each side (page 3.75 x 2.25 in, same page size as the owner's PDFs), safe area **0.125 in inside the trim** (so live text sits 0.25 in from the page edge). The PDFs carry TrimBox and BleedBox. They have no crop marks; the printer adds those.

## Files (`out/`)

| File | What it is |
|---|---|
| `front.svg / .pdf / .png` | Front: logo lockup, gold diagonal stripes with hex texture at top-left and bottom-right, tagline. Same for every variant |
| `back-faithful-qr-none.*` | **Faithful**: the owner's wording and layout, no QR. Closest to the printed card |
| `back-faithful-qr-vcard.*` | Faithful wording + QR that saves the contact (name, phone, Instagram only) |
| `back-faithful-qr-site.*` | Faithful wording + QR to the site with UTM. **Not produced as final until `--domain` is given**; the files present are `SAMPLE-do-not-print-back-faithful-qr-site.*` (dummy domain, red "SAMPLE URL" band over the QR) |
| `back-compliant-qr-none / -vcard / -site` | **Compliant**: wording that passes `COMPLIANCE.md` (below). Same QR options |
| `card-<variant>-qr-<option>.pdf` | Two-page print file: page 1 front, page 2 back |
| `*-guides.png` | Review images with the trim (magenta) and safe area (cyan dashed). Not for print |

Regenerate: `python3 card.py --domain yourdomain.com --phone-confirmed --guides` (real; without `--phone-confirmed` every file is named `DRAFT-phone-unconfirmed-do-not-print-*` and the back has a red band; with no domain every file is `SAMPLE-do-not-print-*`; added in Stage 6 verification) or `python3 card.py --sample --guides`. The domain is a bare hostname; the script refuses tokens, `example` and `invalid`. QR target: `https://<domain>/photo-quote/?utm_source=card&utm_medium=print&utm_campaign=business-card`. Both QR kinds were decoded back from the rendered PNGs with OpenCV: the site URL and the vCard text came back exactly.

## Variants: what changed and why

| Spot | Faithful (owner's print) | Compliant | Rule (COMPLIANCE.md) |
|---|---|---|---|
| Row 1 sub-line | Remove Dents  •  Restore Your Ride | Dent Removal  •  No Paint, No Body Shop | 2: "Remove Dents" is an absolute result claim that must be paired with the honest limit; the compliant line uses the owner's own plain-language name, which is a method statement. "Restore Your Ride" implies restoration |
| Row 2 sub-line | Interior & Exterior  •  Showroom Finish | Interior & Exterior  •  Paint Care | 2: "Showroom Finish" must be qualified ("results depend on paint condition"); no room on a card |
| Row 3 | ASK ABOUT OUR / ADDITIONAL SERVICES / Protection • Enhancement • Maintenance | ASK ABOUT OUR / COATING & PROTECTION / Gloss Shield • Swirl & Scratch Erase | 2: "Enhancement" and "Maintenance" are on HOLD until the owner lists them; "Protection" is named only as "ask about coating and protection options". Gloss Shield (ceramic coating) still needs TO-CONFIRM #8 |
| Location | Sacramento, CA & Surrounding Areas | Sacramento, Elk Grove, Roseville, Folsom | 2 and ENTITY-PLAN 1: "surrounding areas" may not be the only area statement. Four names fit on a card; the full 14 places are on the site (the QR leads there). |

**Decision on the area wording (as asked):** `ENTITY-PLAN.md` section 7 says the printed card "remains" the owner's "Sacramento, CA & Surrounding Areas" and web copy uses the named list. So the **faithful variant keeps the owner's exact wording** and nothing new is invented; the compliant variant uses four of the 14 named places. A card is not a GBP, site or schema field, so the conflict with GBP (named places) does not block the faithful print, but it is recorded here and TO-CONFIRM #15 asks the owner to choose which variant to print. Phone, Instagram, tagline and "Your Vehicle Our Passion" are identical in both.

## What is on the card (verified or owner-supplied only)

Name; phone `916-868-2447`; `@916dentanddetail`; area wording (above); the three service rows (above); "Precision • Care • Perfection"; "Your Vehicle Our Passion". **Not on the card:** address, email, website text, hours, prices, "licensed", "insured", reviews, years. The site is reached by the QR (and can be added as printed text later once the domain exists).

**Phone flag (TO-CONFIRM #1):** the digits were read from the card artwork and re-read at 300 dpi (916-868-2447). They are not yet confirmed by the owner, nor confirmed to receive text messages with photos. **Do not send any variant to print, and do not use the vCard QR, until the owner confirms the number.** The number is on every variant including the faithful reproduction.

## Build notes and honest limits

- **Logo:** keyed from `inputs/logo.jpg` by luminance (`../_shared/key_logo.py`): `assets/logo-lockup.png` (front), `assets/logo-wordtext.png` (back wordmark), `assets/logo-mark.png`. Sparkle particles and glow above the roof were removed (small isolated specks dropped); a few faint pixels remain near the roof peak. At 232 units (2.32 in) wide on the front the source is about 520 px/in effective; fine for print. Not traced and nothing taken from other sources. If a vector logo from the original designer exists, use it instead.
- **Script "Your Vehicle Our Passion":** no script font was available or licensed, so the owner's own lettering was colour-keyed out of their printed card (`prep_assets.py`), at 300 dpi. Nothing else is raster from the card.
- **Right-hand photo (dark headlight) is not reproduced.** Its origin is unknown (like the hero video, TO-CONFIRM #4) and cropping it from a flattened PDF would be low resolution. A vector glossy panel with soft reflections stands in, split by the same diagonal gold line. If the owner owns a high-resolution original of that photo, it can drop into the right panel.
- **Icons** (dent with tool, polisher, shield, phone, pin, Instagram glyph) are redrawn as vector line art in the same gold; they are similar to the originals, not copies. The Instagram glyph is a generic camera-in-rounded-square outline, not the Instagram logo file.
- **Typography:** the back uses Inter Bold, SemiBold and Regular (OFL) in place of the original sans. All text is converted to outlines, so no font files are needed at the printer. Smallest text is 5.6 units (about 4 pt) for the QR caption and 5.8 for "ASK ABOUT OUR"; both are all-caps and widely tracked. Everything else is 7.5 units (5.4 pt) or larger. Ask the printer for a hard proof.
- **Colors:** RGB artwork using the brand hex values (Onyx #0B0B0C, Gold #C9A24A, Light Gold #E8CB7A, Ivory #F3EEE3). Ask the printer to convert to CMYK and to proof the black and gold. Metallic gold is simulated with gradients; foil or spot gold is optional and costs extra.
- **QR:** error correction M; quiet zone 4.2 modules (spec minimum 4) on an ivory plate; printed 0.54 in square. The site QR is a version 6 or 7 code (about 41 to 45 modules), so each module is about 0.012 in (0.3 mm), which is near the lower limit for reliable phone scanning. If the real domain makes the URL longer, test a printed proof with two phones, and if it fails shorten the path (for example a `/q` redirect on the site).
- **Safe area:** every text and icon is inside the cyan safe box in the guides; the stripes and diagonal line deliberately run through trim and bleed. The right panel and the gold diagonal bleed off the page.

## Printing checklist

1. Owner confirms the phone (TO-CONFIRM #1) and picks faithful or compliant (TO-CONFIRM #8 and #15).
2. Run `card.py --domain <real domain>` (only if choosing a site-QR variant); open the PDFs; scan the QR from the screen.
3. Send `card-<variant>-qr-<option>.pdf` (page size already includes bleed). Ask for a printed proof before the run.
4. Do not print anything named `SAMPLE-do-not-print`.
