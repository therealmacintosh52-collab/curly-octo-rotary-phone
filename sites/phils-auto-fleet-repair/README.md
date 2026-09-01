# Phil's Auto and Fleet Repair — website

A fast, conversion-focused, SEO-ready static site for **Phil's Auto and Fleet Repair**,
103 E Elm St, Lodi, CA 95240 · (209) 647-4953.

No frameworks, no build toolchain, no runtime dependencies. One Python script generates
25 indexable pages plus `sitemap.xml`, `robots.txt`, a web app manifest and the redirect
rules into `public/`, which you can drop on any host.

---

## Quick start

```bash
python3 build.py                      # regenerate ./public
python3 -m http.server 8000 -d public # preview at http://localhost:8000
```

Use the local server for previewing — the pages use root-relative paths (`/assets/...`),
so opening the HTML files directly with `file://` will not load CSS.

## What's in the site

| Page | URL | Job it does |
|---|---|---|
| Home | `/` | Ranks for "auto repair Lodi", converts on call + form |
| Services index | `/services/` | Hub linking the ten service pages |
| 12 service pages | `/services/<slug>/` | One page per money keyword (see below) |
| About | `/about/` | Trust, differentiation from dealerships |
| Reviews | `/reviews/` | Social proof, funnels new reviews to Google |
| Service areas | `/service-areas/` | Captures nearby-city searches |
| Contact | `/contact/` | NAP, hours, map, directions, quote form |
| Advice guides | `/advice/`, `/advice/<slug>/` | Four in-depth guides answering what people search before they call |
| Spanish | `/es/` | Full Spanish landing page with hreflang — roughly two in five Lodi residents speak Spanish at home |
| Privacy | `/privacy/` | Required once a form collects data |
| Thank you / 404 | `/thank-you/`, `/404.html` | Post-submit and error handling (noindex) |

Service pages: auto repair · check engine & diagnostics · brakes · engine repair ·
transmission · diesel repair · fleet services · oil change & maintenance · tires ·
electrical & batteries · AC & heating · suspension & steering.

## Conversion features

- **Call is the primary action everywhere** — top bar, sticky header, hero, every section CTA,
  footer, and a fixed mobile call bar (Call / Directions / Get a Quote) pinned to the bottom
  of every page on phones.
- **Quote form above the fold** on the homepage, and again on every service page pre-filled
  with that service.
- **Objection handling built into the copy**: diagnosis before parts, no upsells, you approve
  every repair, second opinions welcome, dealership comparison table.
- **Fleet/B2B path** kept distinct from the consumer path — fleet work is higher value and
  buys on uptime, not price.
- **Tracking hooks already wired** (`assets/js/site.js`): `click_to_call`, `get_directions`
  and `generate_lead` push to `dataLayer` and `gtag`, so leads are measurable the moment you
  add GA4 or Google Ads.

## SEO built in

- Unique `<title>` (≤60 chars) and meta description (70–160 chars) per page; one `<h1>` each.
- Canonical URLs, Open Graph and Twitter cards, geo meta tags, generated `sitemap.xml`
  and `robots.txt`.
- **Structured data** (JSON-LD, validated): `AutoRepair` LocalBusiness with address, geo,
  opening hours, service catalog and areas served on every page; `Service` on service pages;
  `BreadcrumbList`; `FAQPage` on the home page and each service page.
- Local keyword targeting per page (city + service), internal linking hub-and-spoke from
  `/services/`, breadcrumbs, descriptive link text.
- `sameAs` links tying the Google, Yelp, Nextdoor, MapQuest and Carfax profiles to one entity,
  and `hreflang` between the English and Spanish pages.
- `Article` schema on the advice guides.
- Fast by construction: the home page is ~10 KB gzipped and makes four local requests (stylesheet,
  script, logo, illustration) plus the lazy-loaded map. No webfonts, no icon fonts, no CDN, no
  tracking pixels, no cookie banner to need.
- Accessible: skip link, semantic landmarks, labelled form fields, visible focus states,
  keyboard-operable nav and FAQ, reduced-motion support.

`aggregateRating` is deliberately **not** in the structured data. Google discourages
self-serving review markup on your own business, and it can cost you the rich result.
The 4.4/83 rating is shown on-page and linked to Google instead, which is safe.

---

## Before you launch — verify these

These came from public listings, not from the shop. Confirm each one, then edit `build.py`
and re-run it.

- [ ] **Hours** — the site says Mon–Sat 8:00 AM–5:00 PM, closed Sunday (`SITE["hours_rows"]`
      and `SITE["hours_schema"]`). Yelp and Google should match exactly.
- [ ] **Email** — set to `phil@philsautofleet.com`. The domain was inferred from the shop's
      website; confirm it is right before launch, since a wrong address loses leads silently.
- [ ] **Warranty wording** — `SITE["warranty_text"]` is deliberately non-specific. If the shop
      offers a defined warranty (e.g. 24 months/24,000 miles), say so — it converts.
- [ ] **Map coordinates** — `SITE["lat"]` / `SITE["lng"]` are approximate for the address.
      Copy the exact pin from Google Maps.
- [ ] **Yelp URL** — `YELP_URL` is the expected slug; paste the real one.
- [ ] **Rating and review count** — update `SITE["rating"]` / `SITE["review_count"]` at launch
      and every few months.
- [ ] **Form endpoint** — set `FORM_ENDPOINT` (see below), or the form falls back to email.
- [ ] **Certifications** — nothing about ASE, years in business, or technician credentials is
      claimed anywhere, because none of it was verified. Add it if it's true; it's strong
      trust content.
- [ ] **A higher-resolution logo** — the logo in use is 80x80 px, which is sharp on ordinary
      screens but soft on phones and laptops with retina displays. An SVG, or a PNG of about
      512 px, would fix that everywhere at once (see below).

## Colour

The palette is taken from the logo, not chosen alongside it. The badge is drawn almost entirely
in **#2418cc**, a blue-violet, so that value is the brand colour (`--accent-dk`), the buttons run
a gradient from it (`#2f22e0` to `#6a5bff`), the dark sections are deep indigo rather than neutral
navy, and even the greys carry the same hue bias so nothing reads as an unrelated stock blue.
Review stars stay gold, because that is what a rating looks like everywhere else on the web.

Everything is defined once as custom properties at the top of `assets/css/site.css`. Changing the
brand colour is a matter of editing `--accent`, `--accent-dk`, `--accent-lt`, `--grad-accent` and
`--grad-dark` — the rest of the stylesheet reads through those.

## The logo

The shop's badge logo is installed at `public/assets/img/logo.png` (80x80, transparent
background). It appears beside the shop name in the header, on a white disc in the dark footer,
as the browser-tab icon, and on the social share image.

**Please replace it with a larger version when you can.** At 80 px it is sharp on a standard
display and slightly soft on a retina screen, where the header alone wants ~92 px. An SVG is
ideal — it stays crisp at any size, including on printed material. Drop the new file in
`public/assets/img/`, point `SITE["logo"]` at it in `build.py`, and re-run the build. Nothing
else changes.

The related settings, all in the `SITE` block at the top of `build.py`:

- `SITE["logo"]` — path to the logo. Empty falls back to a placeholder monogram.
- `SITE["logo_lockup"]` — `"badge"` (current) keeps the shop name in text beside the mark, which
  a round badge needs; `"full"` uses the logo alone, for a logo that already reads as a wordmark.
- `SITE["logo_dark_bg"]` — optional light/reversed logo for the dark footer. Without one, the
  footer puts the normal logo on a white disc so the dark line-art stays legible.
- `SITE["favicon"]` — browser-tab icon, currently the logo itself.

## Sharing a preview before launch

`tools/make-preview.py` bundles every page, the stylesheet, the script and the images into one
self-contained HTML file with a small hash router:

```bash
python3 tools/make-preview.py preview.html
```

The result opens in any browser with no web server, and the whole site can be clicked through from
that single file — useful for showing the shop the site before the domain is pointed anywhere, or
for emailing a reviewable copy. The map is a placeholder in the bundle (it needs a live
connection) and the quote form says so instead of submitting.

## Regenerating the social share image

`public/assets/img/og-cover.png` (1200x630) is what Facebook, LinkedIn, iMessage and WhatsApp
show when someone shares the site. It is built from `tools/og-cover.html`, so editing the wording
means editing that file and re-rendering:

```bash
cd tools
chrome --headless --hide-scrollbars --window-size=1200,717 \
       --screenshot=/tmp/og-raw.png og-cover.html
python3 png_crop.py /tmp/og-raw.png ../public/assets/img/og-cover.png 1200 630
```

The odd height and the crop step are deliberate: headless Chrome reserves about 87 px of window
for browser chrome, so rendering at 717 and trimming to 630 is what produces a full-bleed image.
`tools/png_crop.py` does that with the standard library alone — no image packages to install.

## Connecting the quote form

Set `FORM_ENDPOINT` in `build.py` and rebuild:

- **Formspree** — `https://formspree.io/f/xxxxxxx`
- **Basin** — `https://usebasin.com/f/xxxxxxx`
- **Netlify Forms** — add `netlify` and `name="quote"` attributes to the `<form>` tag in
  `quote_form()`, and point `FORM_ENDPOINT` at `/thank-you/`.
- **Your own handler** — any endpoint accepting `multipart/form-data` POST and returning 2xx.

Until it's set, submissions open a prefilled email to `SITE["email"]` so no lead is dropped.
A honeypot field blocks the common spam bots.

## Migrating from the current site — do not skip this

The existing site has earned rankings that a new site does not inherit automatically. Two things
protect them:

**1. Redirect the old URLs.** `public/_redirects` (Netlify, Cloudflare Pages) and
`public/.htaccess` (Apache, cPanel) map the current site's page URLs to their new equivalents with
301s. A 301 passes ranking authority to the new page; a 404 throws it away. The map in
`build.py` (`OLD_URL_MAP`) is based on the URL shapes the current site appears to use —
**check every one against the live site or Search Console's page report before launch**, and add
anything missing. This is the single highest-value item on this page.

**2. Pick one domain.** The business currently appears at more than one address
(`philsautofleet.com` and `philsautoandfleetrepair.com`). Two domains serving similar content
split the ranking signals between them and compete with each other. Choose one — `philsautofleet.com`
is what the site is configured for — and 301 the other to it at the DNS/host level. Same for
`www` versus the bare domain and http versus https; `.htaccess` handles both on an Apache host,
and Netlify and Cloudflare do it in their domain settings.

## Deploying

`public/` is the web root. Any of these work:

- **Netlify / Cloudflare Pages** — drag the `public` folder in, or connect the repo with
  build command `python3 build.py` and publish directory `sites/phils-auto-fleet-repair/public`.
- **GitHub Pages** — publish `public/` from the branch.
- **Traditional host / cPanel** — upload the contents of `public/` to `public_html`.

Point `philsautofleet.com` at the host, force HTTPS, and 301-redirect the old URLs to the
matching new pages. Keep one canonical hostname (`https://philsautofleet.com`) and redirect
the rest — the current listings show more than one domain in use, which splits ranking signals.

## After launch — the local SEO that actually moves the needle

1. **Google Business Profile** is worth more than the site for a shop like this. Confirm the
   category (Auto repair shop), add Diesel and Fleet as secondary services, post photos of
   the shop and the team monthly, and answer every question.
2. **NAP consistency** — name, address and phone must match this site character-for-character
   on Google, Yelp, Apple Maps, Bing Places, Nextdoor, Carfax, MapQuest and the Chamber
   listing. Mismatches are the most common local-ranking problem.
3. **Reviews** — ask every satisfied customer, in person, at pickup. Link straight to the
   Google review form. Reply to all of them, including the critical ones.
4. **Photos** — replace nothing on this site, but do add real shop photos to the hero and
   about page when you have them (`public/assets/img/`). Real photos of the bays, the team and
   the sign outperform stock every time.
5. **Add pages over time** — one page per service you want to rank for. Copy an entry in
   `SERVICES`, write real content, rebuild. The sitemap, schema and navigation update
   themselves.

## Adding analytics

Paste your GA4 or Google Tag Manager snippet into the `render()` head block in `build.py`
and rebuild. The conversion events are already firing — you'll only need to mark
`click_to_call` and `generate_lead` as conversions in GA4.

## File map

```
build.py                  all content + templates (edit here)
public/                   generated site — deploy this
  index.html, services/, about/, reviews/, contact/, ...
  sitemap.xml, robots.txt, 404.html
  assets/css/site.css     design system
  assets/js/site.js       nav, form handling, tracking hooks
  assets/img/             logo, favicon fallback, social share image, shop illustration
  _redirects, .htaccess   301s from the old site's URLs (verify before launch)
  _headers                caching and security headers
  site.webmanifest        name, colours and icon for add-to-home-screen
tools/
  og-cover.html           source for the 1200x630 social share image
  png_crop.py             crops a PNG to an exact size (standard library only)
  make-preview.py         bundles the whole site into one shareable HTML file
```
