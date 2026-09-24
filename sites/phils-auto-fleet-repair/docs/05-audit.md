# 5. Hostile audit

Run against the build of 2026-09-24 after this change. Critical and High rows marked **applied** were
fixed in this change; the rest are the owner's or a later change's.

| Issue | Severity | Location | Fix |
|---|---|---|---|
| Site built on `philsautofleet.com`; the Google profile links `philsautoandfleet.com`. Canonical, OG URLs, form subject, email and Apache canonical host all pointed at the wrong domain. Form leads went to a mailbox on the wrong domain. | Critical | `build.py` `SITE`, `render()`, `quote_form()`, `build_deploy_files()`, `site.js` fallback | **Applied.** `base_url`, `host`, `legacy_hosts`, `email` switched; `.htaccess` and `_redirects` now 301 both older hosts and `www` to the canonical one, path preserved. Mailbox still `[NEEDS: confirm]`. |
| The quote form's `_subject` hidden field carried a literal domain in a `%`-formatted template | High | `quote_form()` | **Applied.** Reads `SITE["host"]`. |
| Google lists ~100 service lines; the site named none of new tires, run-flats, rims, differentials, vintage work, auto parts, performance brakes, spark plugs, wipers, EGR cleaning, diesel head gaskets | High (SEO, conversion) | `SERVICES`, no catalog | **Applied.** `CATALOG` (79 deduplicated items) renders on `/services/`, on each page as a tag row, and as `OfferCatalog` schema. New Differentials page. Tires page re-scoped. |
| Published price on the profile ($89 A/C diagnosis) absent from the site | High | AC page | **Applied.** First checklist line, FAQ, priced `Offer` in schema. Credit policy `[NEEDS]`. |
| Purple-blue gradients on buttons, hero, cards, steps, callbar; five `backdrop-filter` uses; default 3-icon card grid: all banned by the brief | High (brand) | `site.css`, `service_cards()` | **Applied.** Flat sign-panel tokens, zero `backdrop-filter`, zero gradients except the two rib patterns, service board replaces the grid. |
| `.listed span.src` 3.09:1 on its background | High (a11y) | `site.css` | **Applied.** `--tan-800` on `--tan-100`, 5.7:1. |
| White on the light end of the button gradient 4.61:1, varying per pixel | Medium (a11y) | `.btn-accent` | **Applied.** Flat oxblood, 9.6:1. |
| Top bar, footer legal, breadcrumb and form-note links under 24 px tall | Medium (a11y, WCAG 2.2 2.5.8) | `site.css` | **Applied.** `display:inline-block;padding:4px 0`. |
| Duplicate "Open in Google Maps" link on the home map | Low | `build_home()` | **Applied.** |
| Duplicate `.brand-badge` declarations in CSS | Low | `site.css` | **Applied.** |
| Old-site URLs indexed by search engines (`/services/vehicle-inspection`, `/services/car-maintenance`, `/services/auto-electrical-repair`, `/areas-of-service/…`, `/gallery`) had no redirects | Medium (SEO) | `OLD_URL_MAP` | **Applied.** Mapped to the nearest new page. |
| Service area copy omitted French Camp, which the profile names | Low (SEO) | `SITE["areas"]`, home copy | **Applied.** |
| Share image carried the old email and the violet gradient | Medium (brand) | `tools/og-cover.html` | **Applied.** Re-rendered. |
| The display font adds one 18 KB request on the critical path | Low (perf) | `render()` | Accepted per the brief's priority order; preloaded, `swap`, metric-matched fallback, immutable cache. Verify LCP in the field after launch. |
| Real photos absent; the hero uses a line illustration | Medium (conversion) | `photo_slot()` | Owner: shoot the list in `02-visual-world.md`. Street View frames are Google's. |
| Logo is an 80 px scan; soft on retina | Low | `public/assets/img/logo.png` | `[NEEDS: 512 px PNG or SVG]`. |
| No warranty statement while two local competitors advertise 12 months parts and labor | High (conversion) | `SITE["warranty_text"]` | `[NEEDS: terms]`. Do not invent. |
| `--slate-light` and the violet `favicon.svg` placeholder were dead assets | Low | `site.css`, `public/assets/img/favicon.svg` | Token deleted. The SVG is unreferenced and left in place. |
| `aggregateRating` absent from schema | None | schema | Deliberate; Google discourages self-serving review markup. Rating shown on-page and linked. |
| GitHub Pages cannot serve `_redirects` or `_headers` | Medium (SEO) | deploy route | Documented: use Netlify or Apache for the live site. |

## Checks run on this build

| Check | Result |
|---|---|
| `python3 build.py` and `python3 build.py --relative` | 28 pages, clean |
| Every `application/ld+json` block parses | 0 failures across 29 HTML files |
| `/services/` carries one `OfferCatalog` | 79 offers, one with `price: 89.00 USD` |
| Internal links resolve to files | 0 broken (the only miss is a path inside an HTML comment in `photo_slot()`) |
| `philsautofleet.com` in `public/` | only in the redirect rules |
| Contrast, every declared text/background pair | all ≥ 4.5:1; `red-700` on `navy-900` is 1.76 and used only as a non-text bar |
| `backdrop-filter` / `border-radius` above 2 px / old violet hex in CSS | 0 / 0 / 0 |
| `document.scrollWidth` at 390 px (Playwright): `/`, `/services/`, `/services/tire-repair/`, `/contact/`, `/es/` | 390 on all; the dealership table scrolls inside its own container |
| `prefers-reduced-motion: reduce` | kills every animation and transition |
| `[NEEDS]` markers rendered on the site | 8 distinct, listed below |

## Truth check: every claim on the site and its source

| Claim | Source |
|---|---|
| Name, address, phone, hours Mon–Sat 8–5 | Google Business Profile |
| 4.4 from 83 Google reviews | Profile header, 2026-09-24 |
| 4.6 from 26 on CARFAX | Profile "Reviews from the web" |
| Quotes from Eric G., Anthony P., Alan F. | Profile review snippets, verbatim, initials for surnames |
| Quotes from Tracey P., Hannah K., Michael D., "Verified customer" | Yelp and MapQuest, verified in a prior change |
| Services listed under "Everything we do" | Profile "Products" list, deduplicated |
| "A/C diagnosis $89" | Profile price line under "A/C diagnosis"; owner confirmed the pairing |
| Serves Lodi, Stockton, French Camp, Galt | Profile description |
| Sells brand-new tires, run-flats, replaces rims | Profile items |
| Differential rebuilds, front and rear | Profile items |
| "Known for fixing what other shops misdiagnosed" | Theme of the verified Yelp reviews (carried over) |
| "Diagnosis first, price before work, no upsells" | Shop policy as stated on the previous verified site copy |
| Free tire rotation | Profile item; terms `[NEEDS]` |
| 2011–2016 Duramax 6.6 | Profile item; offer `[NEEDS]` |
| Warranty | Not claimed. `SITE["warranty_text"]` is non-specific by design |
| Years in business, ASE, certifications | Not claimed |

## `[NEEDS]` still rendered

1. Tire brands stocked or ordered, and lead time (Tires page, twice).
2. Free tire rotation qualifying service and limits (Tires and Oil Change pages, catalog).
3. Whether the $89 A/C diagnosis is credited toward the repair (AC FAQ).
4. What the 2011–2016 Duramax 6.6 offer is (Diesel callout, catalog).

`grep -rn "NEEDS" build.py` finds each; fill it or delete the line, rebuild, and `grep -rn "NEEDS"
public/` must return nothing before launch.
