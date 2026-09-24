# 2. Visual world

## Concept: "Sign Panel"

Source: the facade at 103 E Elm St as it stands. A white rectangular sign with heavy condensed navy
capitals ("PHIL'S AUTO & FLEET REPAIR" over "(209) 647-4953", a gear-and-wrench emblem each side),
screwed onto tan vertical-rib corrugated steel, above a roll-up bay door with an oxblood-painted
header, over an asphalt lot with painted white stripes. Four materials, four jobs:

| Material | Role on the site | Where |
|---|---|---|
| Panel: white, 3 px navy rule, hard 6 px offset shadow | Anything you read closely or fill in | quote form, stat band, photo frame |
| Siding: tan with a 28 px rib pitch | Ground for alternating sections | `.bg-alt`, the "Everything we do" list, faint ribs behind the hero |
| Door header: oxblood | The one action, call | top bar, primary button, mobile call bar, the 8 px rule capping every dark block |
| Lot: asphalt, white stripes, stencil numerals | Wayfinding | footer, step numbers, service-board numbering |

Anti-generic test: every colour is sampled from this building, the header lockup reproduces the
physical sign line for line (name over phone), and the hero is literally a white panel on a navy wall.
A competitor cannot lift it without lifting Phil's sign. The previous palette's #2418cc blue-violet
came from an 80 px scan of the emblem; the sign lettering is navy, so navy is the brand.

## Colour tokens and contrast

Flat fills only. Ratios computed with the WCAG relative-luminance formula (script in the audit).

```css
--panel:#ffffff;
--navy-900:#141b3a;  --navy-700:#1f2b5c;  --navy-500:#34478f;  --navy-100:#e6e9f3;
--tan-100:#f4f0e6;   --tan-200:#e9e2d1;   --tan-300:#d9d0ba;   --tan-500:#c4b596;  --tan-800:#6b5c3c;
--red-700:#7a2a2a;   --red-800:#632121;   --red-300:#f0a19c;
--asphalt:#24262b;
--text:#161a2e;  --slate:#4f556e;  --on-dark:#c9cde0;  --on-dark-muted:#b9bed6;
--on-asphalt:#c4c7d1;  --on-asphalt-muted:#a3a7b3;
--star:#f5a623;  --ok:#0f7a4a;  --ok-bg:#e3f2ea;  --err:#7a2a2a;  --err-bg:#f8e8e6;
```

| Pair | Ratio | Use |
|---|---|---|
| text on white / tan-100 | 17.2 / 15.1 | body |
| slate on white / tan-100 / tan-200 | 7.4 / 6.5 / 5.7 | secondary text |
| navy-700 on white / tan-100 | 13.5 / 11.8 | headings, links |
| navy-500 on white | 8.6 | link hover |
| tan-800 on tan-100 / white | 5.7 / 6.5 | numerals, muted labels |
| red-700 on white / tan-100 | 9.6 / 8.4 | price, callout rule, focus ring |
| white on red-700 / red-800 / navy-700 / navy-900 / asphalt | 9.6 / 11.9 / 13.5 / 16.8 / 15.1 | buttons, dark blocks, footer |
| on-dark on navy-900 / navy-700 | 10.7 / 8.5 | dark-block text |
| tan-500 on navy-900 / navy-700 | 8.3 / 6.7 | eyebrows and the H1 accent on dark |
| on-asphalt / on-asphalt-muted on asphalt | 9.0 / 6.3 | footer links / legal line |
| ok on ok-bg; err on err-bg | 4.7; 8.1 | form status |
| red-700 on navy-900 | 1.8 | **never as text**: the 8 px bar and fills under white only |
| star on white | 2.0 | decorative, `aria-hidden`; the rating text carries the value |

## Type

Two faces. **Barlow Condensed Bold 700** for display (h1–h3, eyebrows, stat numbers, service names,
step numerals, the brand lockup, button-free), because it is drawn after California DMV and highway
signage, the same vernacular as the shop's own sign. Self-hosted, Latin subset, 18 KB woff2 at
`public/assets/fonts/`, SIL OFL 1.1 (`OFL.txt` beside it), preloaded, `font-display: swap`, with a
metric-matched local fallback (`size-adjust`, ascent/descent overrides) so the swap does not shift
layout. Body stays on the system stack. Tradeoff, one line: the font costs 18 KB on the critical path
and the site otherwise makes zero third-party requests, but performance ranks below truth and
conversion in the brief and a site that looks like the sign is the point, so one bounded file wins.

```css
--step--1: clamp(0.8125rem, 0.79rem + 0.15vw, 0.875rem);  /* 13–14  eyebrow, caption, crumbs */
--step-0:  clamp(1rem,      0.96rem + 0.2vw,  1.0625rem); /* 16–17  body */
--step-1:  clamp(1.125rem,  1.05rem + 0.4vw,  1.25rem);   /* 18–20  lede, brand, stat numbers */
--step-2:  clamp(1.5rem,    1.3rem  + 0.9vw,  1.875rem);  /* 24–30  h3, service names */
--step-3:  clamp(2rem,      1.5rem  + 2.2vw,  3rem);      /* 32–48  h2 */
--step-4:  clamp(2.75rem,   1.9rem  + 3.8vw,  4.5rem);    /* 44–72  h1 */
```

## Spacing, radius, shadow

```css
--space-1..9: 4 8 12 16 24 32 48 64 96 px;  --section: clamp(48px, 6vw, 96px);
--radius: 0;  --radius-sm: 2px (buttons, inputs, tags);  50% for the emblem chip only
--rule: 1px solid tan-300;  --rule-heavy: 3px solid navy-700;
--shadow-panel: 6px 6px 0 navy-700;  /* the sign on the siding: hard, one direction */
--shadow-float: 0 8px 24px rgba(20,27,58,.16);  /* mobile menu and the open FAQ only */
```
No soft diffuse shadows, no glow, no radii above 2 px. The sign world is rectilinear.

## Signature motifs

1. **Corrugated siding.** `repeating-linear-gradient(90deg, …)` at a 28 px pitch: a shadow edge and a
   highlight edge per rib. Ground of `.bg-alt` and the "Everything we do" list; faint white ribs behind
   the hero and page heads.
2. **Sign panel.** White, 3 px navy border, 6 px hard offset shadow. Quote form, stat band, photo frame.
3. **Door header.** Oxblood, the only warm colour. Top bar, primary button, mobile call bar, the 8 px
   rule capping the hero, page heads, dark sections, CTA band and accent panels.
4. **Work order.** Numbered ledger rows with hairline rules: the service board on home and
   `/services/` (`<ol class="svc-board">`, counter numbering `01`–`13`), the grouped catalog
   (`.ro-groups`), the three steps as bay numbers, the footer headings underlined like lot stripes.

## Photo shot list (owner shoots; Street View frames are Google's and never used)

Shoot on a phone, landscape, mid-morning with the bay door up.

1. The sign, straight on, filling the frame. Replaces the hero illustration.
2. The open bay from the lot: lift, a van up, the tire rack visible. Fleet band.
3. A work van or pickup on the lift, from the front quarter. Fleet page.
4. The tire rack with new tires and a set of rims. Tires & Wheels page.
5. A differential open on the bench. Differentials page.
6. A/C gauges on a dash. AC page.
7. The office door and the customer-parking sign. Contact page.
8. Phil or a technician at the scan tool, from the shoulder, no faces required. About.

Never use: stock handshake, stock laptop, a stock mechanic with a clipboard, a stock sports car on a
white background, any Street View frame, any image with another shop's signage.

## Motions

| Name | Where | Trigger | Spec | Reduced motion |
|---|---|---|---|---|
| Arrow lead | service board and card arrows | hover, focus-visible | `translateX(4px)` 200 ms `cubic-bezier(.2,.7,.2,1)` | none |
| Panel press | every button | `:active` | `translate(3px,3px)` into its own hard shadow, 150 ms ease-out | none |
| Door roll | mobile menu | toggle | opacity 0→1 + `translateY(-10px→0)` 220 ms ease-out | instant |
| Chevron turn | FAQ summary | open | `rotate(45→-135deg)` 200 ms ease | instant |
| Nav stripe | nav links | hover, current | `scaleX(0→1)` 180 ms ease | instant |

Nothing animates on load. The stylesheet's `prefers-reduced-motion: reduce` block kills every
animation and transition, so each motion degrades to its end state.

## Five template choices rejected

| Rejected | What we do instead |
|---|---|
| Purple-blue gradient buttons and hero glow | Flat oxblood button with a hard navy shadow on a flat navy wall |
| 3-icon feature card grid | The numbered service board: ruled rows like a posted price board |
| Rounded 16–22 px cards with soft shadows | 0 px radius panels with 3 px rules and one hard offset shadow |
| Glassmorphism header and pills (`backdrop-filter`) | Solid white header with a 3 px navy rule; a 1 px bordered rating strip |
| Slanted SVG section dividers | Hard edges; the oxblood rule is the only transition device |
