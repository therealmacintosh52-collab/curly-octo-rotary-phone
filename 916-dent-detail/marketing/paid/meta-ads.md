# Meta Ads (Facebook + Instagram): Angles, 10 Scripts, Targeting, Specs

Status: DRAFT. Nothing is created or spent. Creating the ad account, entering payment and publishing are hard gates. Retrieved 2026-10-15.

Policy basics (confidence low: Meta's own Transparency Center was not retrievable; sources are third-party summaries):
- Meta can reject, remove or restrict any ad at its discretion (https://conductatlas.com/platform/meta/meta-terms-of-service/advertising-and-commercial-content/, 2026-10-15).
- Targeting on sensitive characteristics is restricted (https://conductatlas.com/platform/meta-ads/meta-advertising-policies/ad-targeting-and-audience-restrictions/, 2026-10-15; the summary did not give verbatim rules). Do not target on any sensitive trait. Car owners in a geography is fine.
- Standard ad rules to follow (general, **verify in Meta Advertising Standards**): no misleading or exaggerated claims, no before/after that is not real, no personal-attribute callouts ("Are you broke?"), clear business identity, working landing page. Not a special ad category (not credit, housing, employment, social issues).
- Do not invent reviews, awards or years. Use [OWNER] items.

## Angles (one idea per ad)
1. No paint, no body shop (core promise). 2. We come to you (time). 3. Photo = price (low friction). 4. Satisfying reveal (visual). 5. Hail Fix (seasonal; only after a local hail event). 6. Water beading / Gloss Shield. 7. Swirl & Scratch Erase. 8. Dealer/fleet (B2B, separate ad set). 9. Honest "we say no" (trust). 10. Local pride (916).

## 10 scripts (hook / visual / VO / CTA)
Offer in every one: **Get a price from a photo** -> `[OWNER DOMAIN]/book?utm_source=meta&utm_medium=paid&utm_campaign=M#`. All visuals real jobs ([REAL JOB]); until then use shop-prep footage.

```
M1 No paint, no body shop
Hook (0-2s): "Your dent is not a body-shop job."
Visual: macro dent, light-board lines, pull, reveal
VO: "Most dents do not need sanding or repainting. We work the metal back from behind, so your original paint stays. We come to you."
CTA: Get a price from a photo.

M2 We come to you
Hook: "Stop losing a day to a dent."
Visual: truck pulls into a driveway, tech at work, car pulls out
VO: "Send a photo. We come to your home or work. You drive away fixed."
CTA: Get a price from a photo.

M3 Photo = price
Hook: "The only quote form that takes one photo."
Visual: phone camera, upload, price screen mock (no number shown)
VO: "Snap the dent. Send it. Get a price before you commit."
CTA: Get a price from a photo.

M4 Satisfying reveal
Hook: "Watch this door ding disappear."
Visual: close, no VO, lines straighten, same-angle final
VO: none, text overlay "Dent Removal (no paint, no body shop)"
CTA: Get a price from a photo.

M5 Hail Fix (seasonal)
Hook: "Hail hit your car?"
Visual: hail dents on a hood, pull sequence
VO: "Send photos of every panel. We tell you what paintless can do, and we work with your insurance estimate."
CTA: Get a price from a photo.
Gate: run only after a verified local hail event.

M6 Gloss Shield
Hook: "This is what water does on coated paint."
Visual: mist over hood, beading, roll-off
VO: "Gloss Shield ceramic coating. Water beads off and washing gets easier."
CTA: Get a price from a photo.

M7 Swirl & Scratch Erase
Hook: "These are swirl marks. Watch them go."
Visual: swirl light 50/50
VO: "Swirl & Scratch Erase polishes out the haze so the paint looks deep again."
CTA: Get a price from a photo.

M8 Dealers and fleets
Hook: "Recon dings are costing you days."
Visual: lot row, tech on car 3
VO: "On-lot dent removal and detailing with per-panel rates. Ask for a dealer quote."
CTA: Request a dealer quote ([OWNER DOMAIN]/dealers).
Audience: dealer/fleet decision makers via job titles (verify availability), or placement-based.

M9 We say no
Hook: "Sometimes we tell you it needs a body shop."
Visual: owner on camera inspecting a creased panel
VO: "If paintless will not do it, we tell you. That is why people trust our photo quote."
CTA: Get a price from a photo.

M10 Local pride
Hook: "Sacramento: your car lives in the sun."
Visual: parked car in sun, then clean coated beading
VO: "Triple-digit summers and tree sap are hard on paint. Gloss Shield makes it easier to keep clean."
CTA: Get a price from a photo.
```
Sourcing for M10: triple-digit heat is typical in Sacramento (CBS/ABC10 per `research/local-facts.md`); sap is general knowledge. No durability promise.

## Primary text, headline, description (paste per ad)
```
Primary (<=125 chars to avoid truncation): Dents gone. Paint glowing. We come to you. Send a photo and get a price before you book.
Headline (<=40): Dent Removal, No Paint
Description (<=30): Get a price from a photo
Button: Book Now (or Get Quote)
```
Limits above are Meta display guidance in common use, **verify in Ads Manager preview**.

## Targeting
- Location: Sacramento metro by city list or radius around base ZIP 95624, matching the booking engine travel area. People living in or recently in this location.
- Age/gender: broad, 25-65+. Let delivery learn; no sensitive targeting.
- Detailed targeting: start broad (Advantage+ audience) with creative as the targeting lever; optional interest layers: car enthusiasts, car care. Verify option names in the account.
- Placement: Advantage+ placements, Reels and Stories first. Exclude Audience Network at the start.
- Optimization: Leads (quote_requested) first; Schedule/Purchase when booking_completed has volume. Needs the pixel and CAPI (see `retargeting.md`).
- Dealer ad set: separate, small budget; optional.
- Budget: [OWNER decision D4]; same logic as `google-search.md` section 9. Run each creative for a fixed window, kill the bottom one weekly.

## Creative specs
| Format | Size | Length | Safe zones |
|---|---|---|---|
| Reels / Stories | 1080x1920, 9:16 | 6-30 s | Keep text out of the top and bottom ~14% (UI overlays) |
| Feed video/image | 1080x1350, 4:5 | 10-30 s | Center text |
| Square | 1080x1080 | any | |
| Carousel | 1080x1080 | 3-5 cards | Before/after, 3 steps |
Brand: Onyx #0B0B0C, Gold #C9A24A accents, Ivory #F3EEE3 text, Michroma/Inter. Logo corner. Native captions on, sound-off safe. Strip audio rights issues (licensed music only). Files named `M#_hook_v#.mp4`.
UTM: `utm_source=meta&utm_medium=paid&utm_campaign=M#&utm_content=<creative>` so /admin lead source reads Meta ads.
