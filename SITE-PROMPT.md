# The one prompt

Paste everything between the two rules into Claude, ChatGPT, Cursor, Lovable —
anything that writes code. It builds one site. Run it again for the next one.

It is written to be handed to a model cold, so it repeats context you already
know. That is on purpose: the model has not been in this conversation.

Everything in it was learned the hard way building the sites in this repo. The
**Traps** section in particular is a list of bugs that actually shipped — leave
it in.

---

You are a senior front-end engineer and art director. Build me one complete,
production-ready website as a **single self-contained HTML file**.

## Step 1 — ask me these first, then stop and wait

Ask all of it in one message, as a short numbered list. Do not start building
until I answer. If I skip something, use the fallback in brackets and say which
fallbacks you used.

1. Business name, and in one line what it does.
2. City and state, or "nationwide". [nationwide]
3. Phone, email. Street address, or "none public".
4. Google rating and review count — **or "none yet"**.
5. Three to six real review quotes with first names — **or "none yet"**.
6. The 5–12 services or products to feature.
7. A brand colour as a hex, ideally sampled from their logo. [warm gold
   `#F5A623` into deep orange `#F26419`]
8. The domain. [`replace-with-your-domain.com`]
9. Where the form should send — a FormSubmit / Formspree endpoint. [a clearly
   marked placeholder, plus a one-line warning in your handover that until it
   is replaced every enquiry is silently discarded]
10. Photos I can supply: how many, of what. [none — use CSS and inline SVG]
11. One long page, or a multi-page site? [one long page]
12. What is the single action a visitor should take? [call the phone number]

## Step 2 — the look

The benchmark is a hand-built restaurant site: near-black ground, one hot
accent, enormous condensed caps, full-bleed imagery, and the whole page
reacting to the scroll. Cinematic, confident, expensive-looking. Not a
template, not corporate blue, not a SaaS landing page.

### Type

- **Display:** `Anton` (400 only), uppercase, `letter-spacing:.004em`,
  `line-height:.98–1.02`.
- **Body:** `Manrope` 500–800, `17px`, `line-height:1.62`, body weight 500.
- Both from Google Fonts, one `<link>`, `display=swap`, with `preconnect`.
- Maximum contrast between the two: heavy tight caps for headlines against a
  wide-tracked uppercase micro-label (`.eyebrow`, `.2em`) for kickers. That
  contrast is most of the effect.

Anton is condensed, so if it fails to load the headline reflows into the next
section. Ship a metric-matched fallback:

```css
@font-face{
  font-family:"Anton Fallback";
  src:local("Haettenschweiler"),local("Arial Narrow Bold"),local("Arial Narrow"),
      local("Impact"),local("Arial Bold"),local("Arial"),
      local("Liberation Sans Bold"),local("DejaVu Sans");
  size-adjust:78%; ascent-override:98%; descent-override:22%; line-gap-override:0%;
}
--display:"Anton","Anton Fallback",Impact,sans-serif;
```

### Colour

One hue family. Near-black ground, one accent ramp, and neutrals **biased
toward the accent hue** — never neutral grey. That bias is why it reads as one
designed system instead of a template with the colour swapped.

```css
:root{
  --void:#08080D; --void-2:#14100C;
  --paper:#FFFFFF; --paper-2:#F7F5F1;
  --ink:#15110C; --ink-2:#4B443A; --neutral:#7B7268; --rule:#E5E0D7;
  --accent:#F5A623; --accent-2:#F26419; --accent-dk:#C2590A; --accent-lt:#FFC078;
  --on-void:#F2EEE8; --on-void-2:#B0A79C; --rule-void:#2C241D;
  --grad-accent:linear-gradient(135deg,var(--accent),var(--accent-2));
  --grad-void:linear-gradient(162deg,#0B0A10 0%,#1E1712 54%,#08080D 100%);
  --ease:cubic-bezier(.2,.8,.3,1);
  --r:14px; --r-lg:22px; --wrap:1180px;
}
```

Rebuild the accent ramp around my hex if I gave you one. Include a dark-mode
block: bare `:root`, then `@media (prefers-color-scheme:dark)` guarded by
`:root:not([data-theme="light"])`, then `:root[data-theme="dark"]`.

### The dark-scene recipe

Every dark section is the same three layers. Reusing one recipe is what makes
the page feel authored:

1. `--grad-void` as the base.
2. One or two offset `radial-gradient` spotlights in the accent, 30–45% alpha,
   positioned off-centre (`at 80% 2%`, `at 6% 92%`).
3. A 58px grid mesh from two 1px `linear-gradient` stripes at 8–12% opacity,
   faded diagonally with `mask-image:linear-gradient(115deg,#000 10%,transparent 70%)`.

Contain it with `isolation:isolate` and negative `z-index` pseudo-elements.

### Signature devices — use most of these

- `.hl` — one word of every `h2` in the accent gradient, via
  `background-clip:text;color:transparent`.
- `.eyebrow` — uppercase micro-label preceded by a 28px gradient rule.
- **Angle wipe** out of the hero: an inline SVG
  `<path d="M0 80 1440 0v80z">` filled with the next section's colour.
- **Stat band** overlapping the hero on a negative `margin-top`, with the next
  section's `padding-top` reduced to compensate.
- **Rotated sticker** — a circular gradient badge at `rotate(-12deg)`, pinned
  to the corner of a figure.
- **Floating card** — a white card breaking out of a figure's lower corner.
- **Chip row** — pills with a small gradient dot.
- **Masonry wall** with `columns:3 260px` and gradient-scrim captions, plus a
  lightbox — *only if I gave you real photos*.
- **Promo band** — a dark full-bleed strip carrying one enormous number.
- **Glossy buttons** — gradient fill plus a white-to-transparent `::after`
  inset `2px 2px auto` at 44% height, radius `9px 9px 20px 20px`.
- **Finale** — the wordmark at `clamp(2.4rem,1.2rem+5vw,5rem)`, a tagline,
  one button.
- **Sticky frosted header**, **mobile call bar**, **floating CTA**.

### Section order

Treat these as scenes, not a stack. Cut any that has no real content — an
empty section is worse than a missing one.

1. Top bar — address · hours · phone
2. Sticky header — logo, nav, phone, one loud CTA
3. **Hero** — eyebrow, H1 revealed line by line with one phrase in the accent,
   sub, two CTAs, three trust bullets, and on the right either the lead form or
   a framed figure. Angle wipe at the bottom.
4. Stat band, overlapping
5. The problem, or why-us — two columns, chips, sticker, floating card
6. Services or pricing — cards
7. **Head-to-head comparison table** — "us" column header in the accent
   gradient, the alternative in neutral. The most persuasive block on the page
   and the one most sites leave out.
8. Proof — reviews or masonry. **Omit entirely if there is nothing real.**
9. Promo band — one number
10. FAQ — native `<details>`, 8–12 questions, written as the questions people
    actually ask
11. Finale, footer, mobile call bar, floating CTA

## Step 3 — the motion

The page must come alive as I scroll. All of it native. **No GSAP, no
ScrollTrigger, no Lenis, no AOS, no framer-motion** — that is 100KB+ of
JavaScript on a page whose whole pitch is that it loads fast.

**The reveal bootstrap.** Inline in `<head>`, before anything paints:

```html
<script>
(function(d,w){try{
  if(!('IntersectionObserver' in w))return;
  if(w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var sel=['.sec-head','.card','.plan','.term','.review','.inc>div','.split>*',
           '.table-scroll','.compare tbody tr','.faq details','.masonry .item',
           '.statband-inner','.fig','.promo-inner','[data-rv]'];
  var e='cubic-bezier(.2,.8,.3,1)';
  var st=d.createElement('style');
  st.textContent=sel.map(function(x){return '.reveal '+x}).join(',')
    +'{opacity:0;transform:translateY(26px) scale(.985)}'
    +'.reveal .rv-in{opacity:1;transform:none;'
    +'transition:opacity .62s '+e+',transform .62s '+e+'}';
  d.head.appendChild(st);
  d.documentElement.className+=' reveal';
  w.__rv=sel;
}catch(err){}})(document,window);
</script>
```

Why it is built this way, and do not restructure it:

- The hidden state is written **by the same code that can undo it**. If
  IntersectionObserver is missing, or the visitor asked for reduced motion, or
  the script is blocked, nothing is ever hidden. A section stuck at
  `opacity:0` is a catastrophic failure; a section that does not animate is
  nothing at all.
- **One selector list**, handed to the observer as `window.__rv`, so the CSS
  and the JavaScript cannot drift apart and orphan an element.
- It runs in `<head>` so content never flashes in and back out.
- Do **not** use `animation-timeline:view()` for this. It resolves to zero
  progress in real cases and leaves whole sections invisible.

Then at the end of `<body>`:

- Observe `window.__rv.join(',')`, add `rv-in`, `unobserve` each one.
- **Belt and braces:** on `load`, after ~400ms, force `rv-in` onto anything
  matching the list that is on screen and still missing it.
- **Stagger** — `transition-delay` of 60ms per grid child up to 6, 40ms per
  table row. Two-column sections come in from their own side:
  `translate(-20px,14px)` and `translate(20px,14px)`.
- **Count-up numbers.** Animate any element whose text starts with a digit
  (optionally after a currency symbol) from 0 to its value over ~850ms, ease
  `1-(1-p)³`, preserving decimals, thousands separators and any suffix, then
  restore the original string exactly. The real figure is already in the HTML,
  so no-JS and reduced-motion both show it. The leading-digit rule is what
  stops it mangling "ES" and "A11y".
- **Header shrink** past 60px; **floating CTA** and **call bar** slide in past
  ~300px. One `scroll` listener, `{passive:true}`, guarded by a
  `requestAnimationFrame` tick.
- **Hero H1** reveals line by line on load: wrap each line in a
  `overflow:hidden` block and animate the inner span from
  `translateY(106%)`, staggered 90ms.

**Scroll-driven ornament**, inside `@supports (animation-timeline:scroll())`
so it simply does not run where unsupported:

```css
body::before{content:"";position:fixed;top:0;left:0;right:0;height:3px;z-index:200;
  background:var(--grad-accent);transform:scaleX(0);transform-origin:0 50%;
  animation:prog linear both;animation-timeline:scroll(root block)}
@keyframes prog{to{transform:scaleX(1)}}
.hero::before{animation:drift linear both;animation-timeline:scroll(root block);
  animation-range:0 95vh}
@keyframes drift{to{transform:translate3d(0,8%,0) scale(1.06)}}
```

A reading-progress bar with no JS and no extra markup, and hero spotlights
that drift so the background is not a still image.

**Reduced motion.** One global kill switch — and then put back by hand
anything that starts off-screen in plain CSS, or the CTA never appears:

```css
@media (prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  body::before{display:none}
  .fab,.callbar{transform:none;opacity:1;pointer-events:auto}
  .hero h1 .line>span{transform:none}
}
```

## Step 4 — the parts that are not decoration

**Head.** `<title>`, meta description, canonical, `robots`, `theme-color`,
Open Graph + Twitter with a 1200×630 image, favicon.

**Schema — three JSON-LD blocks.** The right `LocalBusiness` subtype
(`AutoRepair`, `Plumber`, `Roofer`, `Restaurant`…), `FAQPage` **generated from
the FAQ copy actually on the page** so the two cannot disagree, and `WebSite`.
Emit `aggregateRating` **only** if I gave you a real rating.

**Answer engines.** Write FAQ and some H2s as real questions. Include a
`robots.txt` allowing GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot,
Perplexity-User, ClaudeBot, Claude-User, Claude-SearchBot, Google-Extended,
Applebot-Extended, meta-externalagent, Bingbot, Amazonbot, cohere-ai, YouBot,
and an `llms.txt`. Tell me plainly that `llms.txt` is a proposed convention,
not a standard, and that Google has confirmed its systems do not read it.

**Lead form.** A real form, not just `tel:` links — name, phone, and two
fields that fit the business. Honeypot, real `<label>`s, `autocomplete`, and a
loud comment at the endpoint if it is still a placeholder.

**Accessibility.** Skip link. `:focus-visible` ring. `aria-expanded` on the nav
toggle. FAQ opens with no JS. Everything keyboard reachable. Icons
`aria-hidden`. Real alt text, empty `alt` on decoration.

**Performance.** Compressed first load under 30KB. Total JS under 8KB. No
third-party scripts, no trackers, no analytics unless I ask. Relative asset
paths so it works from a subfolder.

**Responsive.** 375px and 1440px both correct. 16px side gutters, no horizontal
scroll, buttons full-width on phones.

## Step 5 — honesty rules, which override everything above

- **Never invent a rating, a review count, a review quote, a testimonial, a
  client name, a certification, a year founded or an award.** If I said "none
  yet", omit the whole block. Do not render an empty one, and do not write
  "4.9 stars" as a placeholder — that is the mistake that gets a Google
  Business Profile suspended.
- **No stock photos of premises.** A stock photo of somebody else's building is
  the fastest way to lose a local visitor. No photos means CSS gradients and
  inline SVG.
- Any competitor comparison gets a footnote saying where the numbers came from.
- If a section has no real content, cut it and tell me what it needs.

## Traps — every one of these actually shipped

1. A `padding` **shorthand** on an element that also carries the container
   class resets the container's side gutters to zero, and text runs to the
   screen edge below about `max-width + gutters`. Use `padding-top` /
   `padding-bottom`.
2. **Uppercase display type runs 15–20% wider** than sentence case at the same
   size. Cap the `h1` `clamp()` so the phone button is still above the fold at
   1440×900. The call button beats bigger type, every time.
3. Keep section `h2`s **sentence case** if they are question-form headings.
   Caps wrecks "How much does a brake job cost?".
4. A **sticky header** needs `scroll-padding-top` on `html`, or anchor targets
   land underneath it.
5. `position:absolute;left:-9999px` honeypots need a positioned,
   `overflow:hidden` ancestor or they create a horizontal scrollbar.
6. Regenerate the `FAQPage` schema whenever the FAQ copy changes. Never
   hand-edit the JSON.
7. If any text is templated, check that no literal from the example business
   survives into the output — a name, a town, a phone number, a highway.

## Deliver

One `.html` file, plus `robots.txt`, `llms.txt`, `sitemap.xml`, and a 1200×630
`og.png` if you can produce one. Inline `<style>` and `<script>`. No build
step, no framework, no dependencies, no CDN except Google Fonts.

Then give me, in under 200 words:

- What I must replace before launch, in order, with the consequence of each.
- Anything you faked or left out, and what you need from me to finish it.
- What will actually stop this converting.

## Before you hand it over, verify

- [ ] Every price, phone number and address matches what I gave you exactly.
- [ ] No invented rating, review, testimonial or credential anywhere.
- [ ] Three JSON-LD blocks, all parsing, `FAQPage` matching the page copy.
- [ ] With JavaScript disabled: all content visible, FAQ opens, form submits.
- [ ] With every section on screen at once, nothing is left at `opacity:0`.
- [ ] Under `prefers-reduced-motion`, nothing moves and the CTA is visible.
- [ ] At 375px: no horizontal scroll, the phone CTA is above the fold.
- [ ] Tab through it: every link and button reachable, focus always visible.
- [ ] If the display webfont is blocked, the hero still holds its shape.

---
