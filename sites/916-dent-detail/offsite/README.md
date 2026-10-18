# offsite/: the off-site kit for 916 Dent & Detail

Nothing here has been published, posted, mailed or sent; no accounts exist. Every profile is created later, by the owner, in the owner's name. Facts are from `../strategy/ENTITY-PLAN.md` and `../inputs/`. Limits and claims follow `../COMPLIANCE.md`.

## What each file is

| File | What it is |
|---|---|
| `GBP-KIT.md` | Google Business Profile: categories, services, 711-character description, attributes, hours and holidays, Q&A answers, 8 postable posts + 2 held templates, UTM links, suspension risks for a service-area business |
| `CITATIONS.csv` | 48 directories ranked P0 to P3 with claim URLs, category to choose, paid or free, NAP to paste, and `url_check` (surfaced vs unverified) |
| `CITATIONS-CLEANUP.md` | The cleanup list: none found in stage 1 (unverified absence) and the 8 checks a human must run before claiming anything |
| `PROFILE-COPY.md` | Paste-ready text for Yelp, Bing, Apple, Facebook, Instagram, TikTok, YouTube, Nextdoor, LinkedIn within platform limits |
| `REVIEWS-KIT.md` | Review-link build, SMS/email/in-person scripts, cadence, 5-to-1-star replies, texting consent (attorney review) |
| `PHOTO-SHOTLIST.md` | 22 shots in priority order, with consent, plate-blur and the hero-video rule |
| `tap-to-review/` | `make.py --url <review link> [--short <link>]` builds the 4x6 in plate (SVG, PDF with TrimBox, PNG preview, `nfc-url.txt`). Only the SAMPLE is built: `SAMPLE-do-not-print.*` with a dummy link. The generator refuses placeholder or example URLs for a real run |
| `business-card/` | `card.py`: front + 2 back variants (faithful, compliant) x 3 QR options; SVG, PDF (TrimBox/BleedBox), PNG; `BUILD-NOTES.md` explains every choice |
| `check_limits.py` | Re-checks every character limit and that master copy equals `ENTITY-PLAN.md` |
| `_shared/` | Fonts (OFL), `textpath.py` (outlined text), `key_logo.py` (luminance key) |

## Check results (run 2026-10-18)

`python3 offsite/check_limits.py`: all 16 tagged blocks within limits (GBP description 711/750; Apple 217/250; Facebook intro 96/101; Instagram bio 138/150; TikTok 74/80) and short, medium and long copy identical to `ENTITY-PLAN.md`. Plate and card QR codes decoded from the rendered PNGs (OpenCV) return the exact intended payloads.

## Order of operations

1. Owner confirms the phone and that it receives photo texts (TO-CONFIRM #1). Nothing prints and no profile goes live before this.
2. Run the cleanup checks (`CITATIONS-CLEANUP.md`); decide about duplicates.
3. Buy and point a domain (site stage), then stamp `{{DOMAIN}}`.
4. Create the Google Business Profile (`GBP-KIT.md`), hidden address, verify.
5. Copy the review link from the verified profile; make the `/review` redirect on the domain; run `tap-to-review/make.py`; order the plate and an NFC tag.
6. Apple Business Connect, Bing Places, Yelp, Facebook, Instagram (`PROFILE-COPY.md`), then Nextdoor, BBB basic, aggregators (`CITATIONS.csv` P0 and P1).
7. Take the P1 photos (`PHOTO-SHOTLIST.md`); settle the hero video; upload to GBP.
8. Run `business-card/card.py --domain <domain>`; choose faithful or compliant; get a printed proof.
9. Start review requests (every customer, no gating) once the link exists.
10. Fill `status`, `live_url`, `nap_matches` in `CITATIONS.csv` as each listing goes live; recheck NAP monthly.

## Blocked by `../TO-CONFIRM.md`

| Item | Blocks |
|---|---|
| #1 phone digits and texting | Card print, vCard QR, GBP/profile phone field, review SMS, every profile |
| #3 hours | GBP hours and holiday hours, hours attribute, Q&A answer 10 |
| #5 prices and fees | No price anywhere; Q&A 11; offers (P9 held) |
| #6 domain, form destination | `{{DOMAIN}}` in all UTM links; site QR on the card; short review link |
| #8 services and wording | Gloss Shield / coating, hail, "Additional Services", "Remove Dents" and "Showroom Finish" on the card (faithful vs compliant), secondary GBP categories |
| #9 water and power | Q&A 4 answer; no eco claims |
| #11 Google review link | `{{GOOGLE_REVIEW_URL}}`, `tap-to-review/make.py` final run, review requests |
| #12 existing listings | Any profile creation (cleanup checks) |
| #13 Instagram live | Instagram bio, post P7, `sameAs` |
| #4 hero video origin | Hero or any video on profiles; labelled illustration until settled |
| #14 owner names and photo | Team photo shot 18; owner name nowhere |
| #15 card details | Choice of variant and logo file |
| #17 texting wording | SMS review requests (attorney) |
| #2 BAR registration, #7 insurance | No "licensed" or "insured" anywhere; GBP verification answers must stay honest |

## Verified vs unverified in this stage

- **Could not open any web page** (DNS and proxy blocks), so no URL was fetched. "Verified" in `CITATIONS.csv` means the domain surfaced in a 2026-10-18 search result; `K` rows are well-known domains not re-surfaced; `U` rows are guesses to confirm.
- Character limits: Instagram 150 and TikTok 80 (several third-party tables agree), Google 750 (Google text via search), Apple 250 (Apple guide via search; a vendor says 500). **Unverified:** Facebook 101/255, Yelp, Bing, Nextdoor, YouTube 1,000, LinkedIn 120/2,000, GBP service description 300, GBP post 1,500, service-area count 20, and every category name.
- Google Business Profile Q&A is reported removed (third-party reporting, late 2025 to 2026); not confirmed from Google.
