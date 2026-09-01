# Porchlight Offers — cash home buyer website

A complete, conversion-focused, SEO-first marketing site for a company that buys
houses for cash. 34 static pages, zero dependencies, zero third-party JavaScript
by default.

```bash
npm run dev      # build + preview at http://localhost:8080
npm run build    # build into public/ and run the link/SEO checks
npm run images   # regenerate the social card + icons (needs Chrome/Chromium)
```

Deploy `public/` anywhere: Netlify, Cloudflare Pages, Vercel, S3, nginx. A
`netlify.toml` is included.

---

## The name

**Porchlight Offers** — from "we left the porch light on for you."

Why this one, judged against the things a name in this category has to do:

| Test | How it does |
| --- | --- |
| Says the product | "Offers" is literally what the visitor came for. Pairs cleanly in title tags: *We Buy Houses Dallas \| Porchlight Offers*. |
| Feels human | Most competitors sound like a fund (Opendoor, HomeVestors, Offerpad) or a billboard (*We Buy Ugly Houses*). A porch light is warmth and welcome — the exact opposite of the predatory-investor stereotype these sellers are afraid of. |
| Spellable & sayable | Two common English words, one syllable each root. Survives radio, direct mail, a bandit sign, and a phone call. |
| Google-friendly | Distinctive enough that brand searches resolve to you, generic enough that people remember it. Not a made-up word people mistype. |
| Visual | An instantly drawable logo — a glowing light under a roofline. |

**Alternates**, if the domain or a state trademark search rules it out:
Blue Door Offers · Front Porch Home Buyers · Hearthway Homes · Doorstep Cash
Offers · Keyway Home Buyers.

> Verify before committing: domain availability, a USPTO/state trademark search,
> and whether an established local firm already uses it in your market.

---

## What's in the site

**Money pages** — home, `/how-it-works/`, `/compare/` (cash vs. agent),
`/contact/`, `/about/`, `/reviews/`, `/faq/`.

**Local SEO** — `/locations/` plus one page per city at
`/we-buy-houses/<city>/`: 15 cities across 4 Texas metros (Dallas–Fort Worth,
Houston, San Antonio, Austin). Each city page has unique copy, real
neighborhoods, real ZIPs, its own FAQ set and its own `Service` + `FAQPage`
schema. Cities carry a `metro` field, and the locations page, the footer and
the "we also buy in" links group themselves by metro automatically.

**Situation pages** — `/situations/<slug>/` for the eight highest-intent
non-geo queries: inherited/probate, foreclosure, major repairs, tired landlord,
divorce, relocating, downsizing, vacant/hoarder. These are where the qualified
leads come from; a person searching "sell inherited house before probate closes"
is much closer to signing than one searching "home values".

**Guides** — four long-form articles, including the two that earn links and
trust: the actual offer formula, and how to spot a predatory buyer.

**Legal** — privacy policy and terms templates, plus a footer disclaimer that
states you are not agents, not advisors, and never charge sellers a fee.

## Conversion mechanics

- **Three-step form.** Step 1 asks only for the address. Asking for name, phone,
  email, condition and timeline in one screen is the single biggest leak in this
  industry's forms. Each step is a small commitment, and partial entries are
  saved to `localStorage` and restored on return.
- **A form on every page** — hero form above the fold, plus a CTA band at the
  bottom of every page.
- **Sticky mobile action bar** with tap-to-call and jump-to-form. It hides
  itself when a form is on screen so it never covers the submit button.
- **Click-to-call everywhere.** Most sellers in distress call rather than type.
- **Honest comparison content.** Saying plainly that a cash offer nets less than
  a good listing — and showing the math — converts *better* than hiding it, and
  keeps you clear of deceptive-advertising exposure.
- **No dark patterns.** No expiring offers, no countdowns, no fake urgency. Those
  are exactly the signals a distressed seller has been warned about.
- **Analytics events** pushed to `dataLayer`: `lead_form_step`, `generate_lead`,
  `phone_call_click`, `cta_click`. Wire them to GA4/Google Ads conversions in GTM.

## Design & interaction

- **Type**: Fraunces (a soft, slightly wonky serif) for headings, Plus Jakarta
  Sans for text, loaded from Google Fonts with full system fallbacks. To drop
  the third-party request entirely, download both families into `assets/fonts/`
  and swap the `<link>` in `src/layout.mjs` for local `@font-face` rules.
- **Hero artwork**: a hand-built SVG dusk scene — layered rooflines, lit
  windows, and a porch lamp whose glow breathes on a 5.5s loop. Vector, so it
  costs ~2KB and stays sharp anywhere. It is masked back to a backdrop so it
  never fights the headline.
- **Texture and depth**: layered radial gradients plus an SVG grain overlay on
  the dark sections; light sections lift over the dark trust bar like a sheet of
  paper (rounded top, negative margin).
- **A 24-icon custom set** (`src/lib/icons.mjs`) — one stroke weight, one grid.
  No emoji, no icon font, no extra request.
- **Motion**: scroll reveals with a staggered delay, stat counters that count
  up on entry, a pulsing "we're open" dot, and hover lift on cards. All of it
  is suppressed under `prefers-reduced-motion`, and the reveal styles are armed
  *by JavaScript itself*, so a script failure can never leave a section blank.
- **Sticky offer rail** beside the long-form process page, so a form stays in
  reach while someone reads.
- **Scroll shadows** on wide tables that appear only while there is more to
  scroll to, plus a swipe hint on small screens.

## Technical SEO built in

- Clean, keyword-shaped URLs; one `<h1>` per page (enforced by the build).
- Title ≤ 62 chars, meta description 70–165 chars (enforced by the build).
- One JSON-LD `@graph` per page with stable `@id`s: `LocalBusiness` +
  `RealEstateAgent`, `WebSite`, `BreadcrumbList`, plus `Service`, `FAQPage`, and
  `BlogPosting` where they apply.
- Canonical URLs, Open Graph + Twitter cards, a real 1200×630 social image.
- `sitemap.xml`, `robots.txt`, `site.webmanifest`, security + cache `_headers`.
- Dense internal linking: cities ↔ situations ↔ guides ↔ money pages.
- Fast by construction — one CSS file, one deferred JS file, vector artwork, no
  frameworks, and no third-party scripts unless you add a tag ID.
- `node build.mjs --check` fails the build on a broken internal link, a missing
  or oversized title/description, a wrong `<h1>` count, a duplicate element id,
  or invalid JSON-LD.

---

## Before you launch — required

1. **`src/config.mjs`** — replace every `TODO`: real domain, phone (the current
   number is a reserved-for-fiction 555 number), email, address, coordinates,
   legal entity, market and profile URLs.
2. **`src/content/testimonials.mjs`** — the four reviews shipped here are
   **clearly-labeled placeholders and must not be published**. Publishing
   invented testimonials is deceptive advertising under FTC Act §5, and the
   FTC's 2024 fake-reviews rule carries per-violation civil penalties. Replace
   them with real permissioned reviews or delete the section. The site
   deliberately emits **no** `aggregateRating` markup — don't add star ratings
   until you have real reviews behind them.
3. **`src/config.mjs` → `stats`** — `400+ houses bought`, `12 years` and the
   timelines are placeholders. Substantiate them or change them.
4. **City pages** — only keep cities you actually buy in, and verify every
   neighborhood, ZIP and local claim before launch. Cloned city pages with the
   name swapped are the #1 way local service sites get filtered out of Google.
   The 15 shipped here are written from general market knowledge, not local
   research: treat every specific as a claim to check.
5. **One office, four metros** — the address in `config.mjs` is a single Dallas
   office. If you genuinely operate statewide, a local phone number and a real
   address per metro (each with its own Google Business Profile) is what makes
   those city pages rank; without them, expect the home metro to outrank the
   rest.
6. **Form destination** — set `formAction` to `'netlify'` (works as-is on
   Netlify) or to your CRM / Formspree / Zapier endpoint URL.
7. **Legal review** — have counsel check `/privacy/`, `/terms/`, the footer
   disclaimer, and the TCPA consent language on the form against your actual
   practices and your state's rules (several states regulate "we buy houses"
   marketing and equity-purchase contracts specifically).
8. **Analytics** — add `gtmId` or `gaId` in config, then mark `generate_lead`
   and `phone_call_click` as conversions.

## After you launch — the local SEO that actually moves the needle

The on-page work is done; ranking for "we buy houses \<city\>" is mostly
off-page from here:

1. **Google Business Profile**, verified, with the *identical* name, address and
   phone as `config.mjs`. This is the single largest local ranking factor.
2. **Real reviews, continuously.** Ask every closed seller. Reply to all of them.
3. **Citations** — Bing Places, Apple Business Connect, BBB, Yelp, chamber of
   commerce, local directories. Same NAP everywhere, character for character.
4. **Submit `sitemap.xml`** in Google Search Console and Bing Webmaster Tools.
5. **Local links** — sponsorships, local news, contractor and attorney
   relationships. The scam-red-flags guide is written to be linkable by consumer
   and housing-counseling sites.
6. **Add city pages only as you genuinely expand**, with fresh local detail.

## Adding content

- **A city**: add an entry to `src/content/cities.mjs` (unique intro, market
  note, local note, neighborhoods, ZIPs, and the `metro` it belongs to) and
  rebuild — page, footer, locations grouping, sitemap and internal links
  generate themselves. A new `metro` value creates a new group with no other
  changes.
- **A whole new market**: set `marketName` in `src/config.mjs`, then write the
  city entries. Note that the state-specific content — the Texas probate guide
  and the governing-law clause in `/terms/` — is written for Texas and needs
  rewriting if you expand beyond it.
- **A situation**: add an entry to `src/content/situations.mjs`.
- **A guide**: add an entry to `src/content/posts.mjs`.
- **Global FAQs**: `src/content/faqs.mjs` (drives both `/faq/` and the schema).

## Layout

```
build.mjs               generator + link/SEO checker
netlify.toml            deploy config and redirects
src/config.mjs          brand, NAP, market, form + analytics settings
src/layout.mjs          HTML shell, header, footer, JSON-LD graph
src/components.mjs      lead form, CTA bands, tables, FAQ, hero blocks
src/content/            cities, situations, FAQs, posts, testimonials
src/pages/              core, local, guides
src/lib/icons.mjs       the inline SVG icon set
assets/                 styles.css, main.js, img/ (+ img-src/ for the OG card)
tools/                  image renderer, local preview server
public/                 build output (committed, so it deploys with no build)
```
