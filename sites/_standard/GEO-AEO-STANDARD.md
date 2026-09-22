# The bar every site in this repo ships at

Every rule here is checked by `sites/_engine/audit.py`, or it does not belong in
this document. A rule nobody enforces is a preference.

```
python3 sites/_engine/audit.py sites/<site>/public
```

Exit code 1 on any ERROR. The build is not done until this is clean.

---

## 1. The thing that matters most: content must be in the HTML

**No major AI crawler executes JavaScript.** Measured in 2026: GPTBot fetches JS
files in ~11.5% of requests and executes none; ClaudeBot fetches in ~23.8% and
executes none. They read the raw HTML once and move on — no render wait, no
retry. Googlebot is the only major crawler that renders, so a client-rendered
page can be visible in Google AI Overviews and invisible to ChatGPT, Claude and
Perplexity simultaneously. ChatGPT's search also leans on the Bing index, and
Bingbot's rendering is limited.

Therefore:

- Every price, menu item, opening hour, answer and heading ships in the HTML the
  server sends.
- JavaScript may only *enhance* — filter, animate, toggle. It may never be the
  only source of a fact.
- CSS reveal animations opt **in** behind a `.js` class set by script. Never
  `opacity: 0` by default, or a no-JS crawler reads a blank page.

**Test:** strip every `<script>` block and confirm the page still says everything.

## 2. One linked entity graph per page

Not several disconnected `<script>` blobs. Disconnected blobs are individually
valid and collectively meaningless — nothing states that the FAQ, the breadcrumb
and the business belong to the same entity.

Fixed `@id` conventions:

| `@id` | Node |
|---|---|
| `<base>/#organization` | the company as an entity |
| `<base>/#business` | the physical place (`LocalBusiness` subtype) |
| `<base>/#website` | the site |
| `<url>#webpage` | one page |
| `<url>#breadcrumb`, `<url>#faq`, `<base>/#menu` | page-level nodes |

Edges: `isPartOf`, `about`, `mainEntity`, `publisher`, `provider`,
`parentOrganization`. The audit fails on any `@id` reference that resolves to
nothing anywhere on the site.

## 3. Answer-first content

- Every page opens with a self-contained 40–60 word answer block before any
  prose. This is the passage an LLM lifts, and what `speakable` points at.
- Interior `<h2>`s are phrased as the questions people actually ask, not as
  nouns. "How hot is Stark Hot?" beats "Heat Levels".
- One `<h1>` per page.

## 4. Name, address, phone — stated once

NAP lives in `SiteConfig` and is rendered from there everywhere: page text,
schema, `tel:` links, footer. The audit fails the build if the phone or street
address in any schema node diverges from the config. Divergence across listings
is an entity-fragmentation problem, and the cheapest fix is making it impossible
to express.

Name variants go in `brand_aliases` → `alternateName`, so an apostrophe
difference strengthens one entity instead of creating two weak ones.

## 5. Ratings: never self-serving

`aggregateRating` on your own business node is self-serving review markup.
Google discourages it and it is a common manual-action trigger. Default is
**off** (`SiteConfig.self_rating_markup = False`).

Instead: third-party ratings are emitted as `AggregateRating` nodes with an
explicit `author` naming the platform, and the business node's `sameAs` points
at the listing a crawler can verify against. If on-page copy states a rating, it
must name its source.

## 6. Hours, including past midnight

A venue closing at 00:45 gets **one** `OpeningHoursSpecification` with
`closes` (`00:45`) earlier than `opens` (`11:00`). Google reads that as spanning
midnight. Do **not** split into `23:59` / `00:00` pairs — that is older advice
that still circulates widely, and the audit warns when it sees the pattern.

## 7. Head requirements

Absolute `canonical` · absolute `og:image` (a relative one breaks every social
unfurl) · `og:` type/site_name/title/description/url/image + width/height/alt ·
`twitter:card` summary_large_image + image · `theme-color` · icon +
apple-touch-icon + manifest · geo meta where there is a physical location ·
`<title>` ≤ 60 chars · meta description ≤ 165 chars.

## 8. hreflang on every page, not just home

Reciprocal, with `x-default`. The most common failure is declaring alternates on
the home page only.

## 9. Performance

- No render-blocking third-party resources. Self-host fonts; do not link
  `fonts.googleapis.com`.
- Explicit `width`/`height` on every image (prevents layout shift).
- `loading="lazy"` below the fold, `fetchpriority="high"` on the LCP image.
- No animation library required for content to be readable.

## 10. Crawler access

`robots.txt` names the AI crawlers explicitly and allows them: GPTBot,
OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot,
PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, CCBot,
Bingbot, Amazonbot, meta-externalagent. A default-deny rule upstream (CDN, WAF)
is a common silent reason a site is never cited.

## 11. Sitemap honesty

Per-URL `lastmod` from the real file mtime. Stamping today on every URL claims
the whole site changed daily — a signal wrong enough to be worth less than none.
`datePublished` on an article must be fixed, never `date.today()`.

Indexable pages appear in the sitemap; `noindex` pages do not. The audit checks
both directions.

## 12. llms.txt — a cheap hedge, not a ranking factor

Ship `llms.txt` and `llms-full.txt`, generated from the same page registry as
the sitemap so they cannot drift.

**Be honest about what it buys.** Google stated in 2026 that llms.txt is not
used for AI Overviews or AI Mode, and no major model provider has committed to
reading it in production. Its real current value is developer tooling — IDE
agents, MCP servers, some in-product assistants. It costs one build step, so we
ship it. Nobody should spend a day on it.

---

## What the audit does *not* cover

Online validators need network access. Run these before launch:

- Google Rich Results Test
- Schema.org Validator
- PageSpeed Insights / Core Web Vitals

And see `OFFSITE-CHECKLIST.md` — Google Business Profile is roughly a third of
local pack ranking, which is more than everything in this document combined.
