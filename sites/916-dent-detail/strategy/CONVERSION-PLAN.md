# CONVERSION PLAN: 916 Dent & Detail

## 1. The buying moment

Someone has a dent (or a dull, swirled, dirty car), wants a number and wants to know "can you fix this?" without driving anywhere. Competitors answer with "call or text for an estimate" (TC-C02). Nobody surfaced a page that tells the visitor exactly how to send a photo and what happens next (research gap 10). The primary action is therefore:

**PRIMARY: "Get a price from a photo."** Secondary: tap-to-call (916) 868-2447. Tertiary: text. Everything else (guides, service pages) exists to move a visitor to one of these three.

Honesty constraints: no price, no "free", no turnaround, no hours, no reply-time promise (COMPLIANCE sections 1 and 3). The promise is only: "Send photos. We look at them and tell you what we can do, including when a dent is not a PDR job."

## 2. The three paths (all work on day one, before any form backend exists)

| Path | What it is | Needs a backend? | Where |
|---|---|---|---|
| A. Text photos | `sms:+19168682447?&body=...` opens the messaging app with a short pre-filled message ("Hi 916 Dent & Detail, here are photos of my dent. Vehicle: ___. Location: ___.") and the visitor attaches 2 to 4 photos. The page shows the exact shot list first | **No.** Works the moment the phone digits are confirmed | `/photo-quote/` hero action, sticky bar, header button |
| B. Call | `tel:+19168682447` | No | Everywhere; sticky bar; header on desktop |
| C. Quote form | Name, phone, vehicle (year, make, model), service (select), city (select of the named places plus "Other"), notes (optional), photos (optional file inputs, up to 4) | **Yes.** Until `{{FORM_ENDPOINT}}` is stamped, the form shows "This form isn't connected yet. Please text or call instead", disables submit, and sends nothing | `/photo-quote/` below path A |

Path A is the headline because it is the lowest-friction path that needs no infrastructure and matches how competitors already quote (text). Path C exists for people who will not text, and for the owner to receive structured leads once a destination exists (owner decision, TO-CONFIRM #6).

**Why not an upload-first form as the headline:** a static site with no backend cannot receive photos; shipping a form that appears to work and does not would break the Blueprint's Stage 4 forms rule (an unconnected form must say so and send nothing). Path A is real now.

## 3. Placement map

| Surface | 390px mobile | Desktop |
|---|---|---|
| Sticky bottom bar (every page except `/photo-quote/` where it shows only Call and Text) | Three equal 48px targets: **Call**, **Text**, **Get price** (gold, primary). Respects `env(safe-area-inset-bottom)`. Hidden while the keyboard is open on form pages | Not shown; header holds the buttons |
| Header | Logo, Call icon (44px), menu | Logo, nav, gold "Get a price from a photo", phone number text |
| Hero (home) | Gold primary button "Get a price from a photo" then outline "Call" below the sub-headline, both inside the thumb zone (lower half) | Same, left column |
| Service pages | Action row after the opening 40-60 word answer; second action at the end; inline "Send a photo of your dent" card after the "what we can't fix" block | Same |
| Guides | Soft action card after the answer and at the end, anchored to the matching service | Same |
| City pages, service-area hub | Action row under H1; end card | Same |
| Dealers and fleets | Primary is **Call** and **Text** (B2B buyers call), secondary "Send a vehicle list or photos" linking to `/photo-quote/` with `?for=fleet` (select pre-set to "Dealer / fleet") | Same |
| Footer | Call and Text links, IG link | Same |
| 404 | Home, photo quote, call | Same |

All three actions are real `<a>` links or buttons with 44px minimum targets and a visible label (no icon-only controls, except the header call icon, which has an accessible name).

## 4. Form specification (`/photo-quote/`)

Minimum fields: the fewest that let a technician look at a dent and reply.

| Field | Type | Required | Notes |
|---|---|---|---|
| Name | text, `autocomplete=name` | Yes | |
| Phone | tel, `autocomplete=tel` | Yes | Replies go by text or call |
| What do you need? | select: Dent removal; Hail damage; Detailing or interior; Coating or paint correction; Not sure; Dealer / fleet | Yes | Pre-set from `?for=` or the referring page |
| Vehicle | text (year, make, model) | Yes | |
| City | select: the 14 named places plus "Somewhere else nearby" | Yes | Never asks for a street address; text says "we don't need your address yet" |
| Photos | file input, `accept=image/*`, multiple, up to 4, `capture` not forced | No (strongly suggested) | Shot list above the field |
| Notes | textarea, 500 chars | No | |
| Text-consent | checkbox, unchecked, optional | No | COMPLIANCE section 8 wording |
| Honeypot | hidden text field (CSS-clipped, `tabindex=-1`, `aria-hidden`) | n/a | Non-empty submissions are silently dropped client-side and flagged server-side |

Behavior: labels visible above fields, inline error text tied with `aria-describedby`, error summary focused on failed submit, success state replaces the form with "Thanks. We got your photos." plus what happens next in plain words that make no timing promise, and a Text button. Privacy link and one-line notice under the submit. Photos are resized client-side (long edge 1600 px) before upload to keep mobile data light; if resizing fails, the original is sent.

**Unconnected state (until `{{FORM_ENDPOINT}}` is stamped):** a visible, non-dismissable notice at the top of the form, "This form isn't connected yet, so nothing you type here is sent. Please use Text or Call above." Submit button disabled with `aria-disabled`. The production lint fails while the token remains, so a live site cannot ship in this state by accident.

**Destination options for the owner (decision, no account created here):** a form-to-email service, a Cloudflare Pages Function with R2/email, or similar. Photos make this a multipart upload, so the choice must support files. Recorded in TO-CONFIRM.

## 5. Photo-quote walkthrough (content of the page)

1. Opening answer (40 to 60 words): what to send, what we do with it, that the answer can be "PDR can't fix this".
2. **Shot list** with simple drawn diagrams (SVG, ours): (1) the whole panel from 6 feet, (2) the dent from straight on, (3) the dent from a low angle with light raking across it, (4) a close-up of the paint edge if it looks cracked.
3. Path A button, then Path B, then the form (path C).
4. "What we need to know" list: vehicle, where it is parked (city only), anything about the dent (how it happened, whether paint looks cracked).
5. "What we'll tell you" list: whether it looks like a PDR job, what drives the price on your car, what the next step is. No price here.
6. Honest block: "PDR can't fix everything" (short; links to the guide).
7. Privacy note and text-consent.

## 6. Hours-aware messaging

No hours exist. The site therefore carries **no "open now", "closed", "we reply within" or business-hours line**, and no JavaScript clock logic. Copy uses time-neutral phrasing: "Send photos any time." When the owner supplies hours (TO-CONFIRM #3), the build adds one `HOURS` data block that feeds the footer, contact page and schema together, and optionally a small "Calls are answered..." line. Until then `openingHoursSpecification` is omitted from JSON-LD.

## 7. B2B conversion

Dealers, fleet managers, rental lots and body shops call first. The `/dealers-and-fleets/` page leads with **Call** and **Text** and a short intake: company type, approximate vehicle count, location (city), what they need (dents, detail, both), contact. The same unconnected-form rule applies. No price sheet, no COI, no net terms, no same-day claim (COMPLIANCE section 13). The page says what the owner confirmed in the spec: retail and B2B work, mobile, no body shop; and invites a vehicle list or photos.

## 8. Measurement (no scripts shipped by default)

The build ships **no third-party analytics**. Conversion events are defined so any later tool can attach through one `{{ANALYTICS_ID}}` hook and `data-event` attributes already on the elements:

`call_click`, `text_click`, `photo_quote_cta_click`, `form_submit_attempt`, `form_submit_success`, `dealer_intake_submit`, `ig_click`.

Before launch, measurement relies on: Google Business Profile call and message insights, Search Console clicks, Bing Webmaster, and the form host's submission count. If call tracking numbers are ever used, the main number stays in markup and schema (Blueprint entity rule).

## 9. What each kind of visitor sees first

| Visitor | Lands on | First action offered |
|---|---|---|
| "dent repair near me" (map pack click) | Home | Get a price from a photo; Call |
| "paintless dent repair Sacramento" | `/paintless-dent-repair/` | Opening answer, then send a photo |
| Hail-struck owner | `/hail-damage-repair/` | What to photograph, then send a photo |
| "should I file a claim" | Guide | Soft card: send a photo to see the repair side of the choice |
| Dealer manager | `/dealers-and-fleets/` | Call, Text |
| Detailing / coating shopper | Service page | Text a photo of the car and the goal; Call |
| Someone who found the card | Home or `/contact/` | Call, Text, Instagram |
