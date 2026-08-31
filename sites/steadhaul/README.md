# Steadhaul Dispatch — landing page

Single-file static landing page (`index.html`). No build step. Drop the folder on
Netlify, Cloudflare Pages or any static host.

## Before you launch — required

The page ships with two clearly-marked placeholder blocks. Both are wrapped in a
yellow dashed `.ph` banner so they cannot be missed.

1. **Phone number.** `(000) 000-0000` appears in the nav, the form's call/text box,
   the sticky mobile bar, the footer, the thank-you panel and the JSON-LD.
   Replace every instance, including the `tel:+10000000000` and `sms:+1...` hrefs.
2. **Testimonials** (`#proof`). Replace the three bracketed quotes with real carrier
   quotes you have written permission to publish. Ask for a growth number, not
   adjectives. Then delete the `.ph` banner and the `ph` class.
3. **Recently booked table** (`#proof`). Replace with real loads from your TMS.
   No competitor in this space publishes real linehaul/RPM figures — doing so is
   the most persuasive thing on the page. Update weekly, or wire it to your TMS.

Do not publish invented testimonials or load figures. Beyond the FTC endorsement
rules (16 CFR Part 465), one carrier recognising a fake quote ends your referral
pipeline in a business that runs on referrals.

## Also check

- **Claims to verify against your own operation:** "8 trucks per dispatcher",
  "25+ brokers", the six named load boards, "24–48 hours", "answered within one
  business day", and the first-week-free / truck-down-you-owe-nothing terms.
  Every one of these is a promise a carrier will hold you to. Make them true or
  edit them.
- **Prices** ($300 / $425 / $550) appear in the hero, the calculator, the pricing
  table, the FAQ and the JSON-LD. Change all of them together.
- The FAQ copy and the `FAQPage` JSON-LD are duplicates of each other — edit both,
  or Google will flag the mismatch.

## Form

Wired for **Netlify Forms** (`data-netlify="true"`, honeypot on `company`). It
posts via `fetch` and shows the thank-you panel regardless, so it degrades safely
on other hosts. To use a different backend, change the `fetch('/')` target in the
form script near the bottom of the file.

The form is three steps: equipment → authority age + truck count → name + phone.
Contact details come last on purpose — the easy qualifying questions first is what
lifts completion.

## Brand assets

| File | Use |
|---|---|
| `icon.svg` | favicon — simplified mark, no centreline (legible at 16px) |
| `logo-square.svg` | full mark with road centreline, navy badge |
| `mark.svg` | mark alone, transparent ground, for dark backgrounds |
| `apple-touch-icon.png` | 180×180, square (iOS applies its own mask) |
| `og.png` | 1200×630 social card |

The mark is an "S" drawn as a banked highway receding to a horizon — the stroke
tapers from near to far and the centreline dashes taper with it. Two variants
ship because the centreline turns to mush below ~40px: the detailed mark for
large use, the solid one for nav, favicon and anything small. Both are the same
silhouette, so they read as one logo. Inline in the page they are `<symbol
id="shmark">` (detailed) and `#shmarkS` (solid).

Colours: navy `#0F2237`, orange `#F4711F`, amber `#FFB347`, cream `#FAF7F2`.
Type: Barlow Condensed 600–800 for display, Inter 400–700 for body.

## Load boards

The page deliberately does **not** name which boards we run. It says "the major
national boards" and, in the FAQ, that the exact mix and the broker list stay
private because working out where the good freight is took years.

Naming them (DAT, Truckstop, Amazon Relay and so on) is the category norm and it
was in the first draft, but it hands a prospect the shopping list for doing it
themselves, tells competitors your sourcing stack, and — for Relay in
particular — implies an access arrangement that dispatchers do not straightforwardly
have. If you would rather name them, the copy to edit is the trust bar bullet, the
Core tier's first list item, and the "Which load boards do you use?" FAQ answer.

## Notes

- The hero runs a three.js scene (r128, CDN). Behind it is a pure-CSS dusk
  highway — horizon glow, converging edge lines, receding centre dashes — so the
  hero still reads as a road when the CDN is blocked, the visitor is offline, or
  the script is just slow. The CSS road fades out only once the WebGL scene has
  actually rendered its first frame (`.hero.has3d`), so there is never a gap.
  The road plane's height is a fixed `1600px` on purpose: the projected band is
  `perspective / tan(rotateX)` at the limit, so a percentage height collapses the
  road to a sliver on tall viewports.
- The 3D scene is skipped entirely under `prefers-reduced-motion` and when the
  canvas scrolls out of view.
- The calculator is deliberately honest: below break-even it tells the visitor a
  percentage dispatcher is cheaper. That is the point — it is why the tool is
  credible, so don't "fix" it.
