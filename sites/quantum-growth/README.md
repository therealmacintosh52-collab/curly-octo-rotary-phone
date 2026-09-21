# Quantum Growth — the agency site

One static page. No build step, no framework, no dependencies.

## Before you launch

Three things, in order. Skip any of them and the page is broken in a way that
costs money rather than looking wrong.

1. **Wire up the form.** `public/index.html` posts to
   `https://formsubmit.co/REPLACE-WITH-YOUR-FORMSUBMIT-CODE`. Until that
   placeholder is replaced, every enquiry is silently discarded. Create the
   endpoint at [formsubmit.co](https://formsubmit.co), swap the code in, submit
   the form once yourself, then click the confirmation email. Nothing arrives
   until that click.
2. **Stamp the domain.** `python3 set-domain.py yourdomain.com`
3. **Check the share card.** Paste the live URL into a text message to yourself
   and confirm the picture appears.

## Deploy

```bash
python3 set-domain.py yourdomain.com     # stamps canonical, OG and schema
# then upload public/ to Cloudflare Pages and attach the domain
```

`set-domain.py` is not optional. Canonical tags, Open Graph URLs and the
schema `@id` all carry an absolute domain; shipping the placeholder tells
Google the page lives somewhere else. It rewrites nine references in
`index.html` plus `robots.txt` and `sitemap.xml`.

## Design

Two typefaces: **Anton** for display, **Manrope** for body, both from Google
Fonts. One hue family — gold `#F5A623` running into deep orange `#F26419` —
with warm-biased neutrals so nothing reads as an unrelated stock grey. Blue
survives only in the logo, as a cool counterpoint.

Anton is condensed, so a missing webfont would reflow the headline into the
next section. An `@font-face` block named `"Anton Fallback"` maps the local
condensed faces with `size-adjust:78%` to keep the metrics close and remove
the layout shift.

Sections reveal on scroll. The hidden state (`.reveal .rv`) is only applied
once an inline head script has confirmed this browser has
`IntersectionObserver` and the visitor has not asked for reduced motion — so a
blocked script costs the effect, never the content. There is also a belt-and-
braces pass on `load` that un-hides anything still on screen.

## Assets

- `public/og.png` — the 1200x630 card that renders when the link is shared.
  Regenerate with `python3 tools/make-og.py` after changing the wordmark,
  palette or headline. Open Graph will not accept SVG, so this has to be a
  raster file; the script builds it as HTML and screenshots it with Chromium.
- `public/favicon.svg` — the logo mark on a dark rounded square.

## What is in the head

- Meta description, canonical, robots, theme-color, favicon
- Open Graph and Twitter card, both pointing at `og.png`
- `ProfessionalService` schema — name, phone, service types, and all five
  plans as priced offers
- `FAQPage` schema built from the ten questions on the page, so it can earn
  rich results
- `WebSite` schema

The FAQ schema is generated from the page copy rather than written twice, so
the two cannot drift apart. If you edit a question or answer in the HTML,
regenerate the block rather than hand-editing the JSON.

## Still missing before this converts

- **Social proof.** No testimonials, case studies or client names. This is the
  ceiling on the whole page and no redesign fixes it — one client with real
  before-and-after numbers does. The comparison table and the ownership
  argument are doing the work social proof should be doing.
- **A face.** The one-person section carries the logo mark. Deciding whether to
  put a real name and photo on it is a live trade-off: anonymity looks bigger,
  a name converts better and is the thing the incumbent cannot offer.
- **The competitor figures.** Everything in the right-hand column of the
  comparison table, and the "Others charge..." lines in the plan cards, come
  from a single sales call. They are now stated in a table, which raises the
  stakes on being right. Confirm them before treating them as fact. The
  footnote under the table says explicitly that it is one call, not a survey.

## Do not expect this to rank

It is one page for a nationwide business, competing against every agency in
the country. The head tags stop it looking like a hypocrite selling schema
markup, and they help it show up when someone searches the business by name.
They will not win competitive terms. Traffic has to come from somewhere else.

## Careful when editing

`public/index.html` is the source of truth. The head — meta, canonical, Open
Graph and the three schema blocks — lives only in this file. Overwriting it
with a copy from anywhere else silently drops all of it, which has happened
twice. If you regenerate the page, re-add the head, and check with:

```bash
python3 -c "import re,io;print(len(re.findall(r'ld\+json', io.open('public/index.html',encoding='utf-8').read())))"
```

Three is correct. Zero means the head is gone.

Two CSS traps worth knowing, both already hit once:

- `.hero-grid` also carries `.wrap`. Setting `padding` as a shorthand there
  resets the wrap's side gutters to zero and the hero runs to the screen edge
  below about 1224px. Use `padding-top` / `padding-bottom`.
- `set-domain.py` lowercases its input, so the placeholder constant must stay
  lowercase. A case mismatch once left `index.html` and `sitemap.xml` holding
  different domains, and the next run silently skipped the sitemap.

## Answer engine files

`robots.txt` names sixteen AI crawlers explicitly and allows them — GPTBot,
OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended and the rest. A
blanket `User-agent: *` already permits them, but several are blocked by
default by hosts and plugins, so naming them removes the doubt.

`llms.txt` is a plain-text index of the plans, terms, consulting options and
the head-to-head comparison, for answer engines to read. **It is a proposed
convention, not a standard.** Google has confirmed its systems do not read it.
Ship it because it is free and some crawlers do fetch it — never sell it as a
ranking factor.
