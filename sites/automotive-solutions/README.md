# Automotive Solutions by Single — website

Static site for [Automotive Solutions by Single](https://www.automotivesolutionsbysingle.com/),
a family owned auto repair shop at 9253 Elk Grove Blvd, Elk Grove, CA 95624.

One Python script generates every page. No framework, no npm, no database, no
webfonts, no CDN, no tracking pixels. The output is plain HTML, CSS, JS and
images that any host will serve.

```
python3 build.py                    # -> public/   root-absolute links (deploy at a domain root)
python3 build.py --relative         # -> public/   relative links (subfolder, staging, or a zip)
python3 build.py --relative --out X # build somewhere else; assets/ are copied in too

python3 tools/verify.py             # tags, JSON-LD, links, titles, descriptions, H1s, sitemap
python3 tools/shoot.py console      # load every page in Chromium, fail on JS errors
python3 tools/shoot.py contrast     # every text node vs the background it renders on
python3 tools/shoot.py interact     # mobile menu, tracking events, form submit, honeypot
python3 tools/shoot.py shots        # desktop + true-390px screenshots into tools/shots/
python3 tools/shoot.py og           # rebuild assets/img/og-cover.png from the real logo
python3 tools/make-preview.py       # -> preview.html, the whole site as one shareable file
python3 tools/make-download.py      # -> download/automotive-solutions-website.zip (verified)
```

Everything the shop needs to edit lives in the `SITE`, `SERVICES`, `REVIEWS`,
`GUIDES` and `OLD_URL_MAP` structures at the top of `build.py`.

---

## Confirm before launch

Nothing below is invented, but these came from public sources rather than from
the owner. Check each one before it goes live.

| # | Item | Where it came from | What to do |
|---|------|--------------------|------------|
| 1 | **Shop email address** | Not published anywhere we could find | **Blocking for the form.** Set `SITE["email"]` in `build.py`, rebuild. Until then the quote form tells visitors to call instead of pretending to send. |
| 2 | Hours: Mon–Fri 9:00 AM – 6:00 PM, closed Sat/Sun | NAPA's directory, Yelp and the shop's own site all agree | Confirm, especially whether Saturdays are ever worked |
| 3 | "Serving Elk Grove since 2001" | automotivesolutionsbysingle.com | Confirm the year — some directories loosely say "15 years" and "20 years" |
| 4 | Owners: Mike and Valerie Single | Public listings | Confirm the spelling and whether they want to be named |
| 5 | ASE certified technicians | The shop's own site, and a NAPA AutoCare requirement | Confirm current |
| 6 | NAPA AutoCare Center | NAPA's own facility directory, facilityId 1326381 | Confirm membership is current |
| 7 | Warranty: 24 months / 24,000 miles, nationwide | NAPA AutoCare's standard Peace of Mind Warranty | Confirm the shop honors the standard terms, and that no shorter in-house terms apply |
| 8 | Rating 4.5 from 55 Google reviews | The Google listing | Update the numbers as they change (`SITE["rating"]`, `SITE["review_count"]`) |
| 9 | Google Business Profile link | A Maps *search* URL, not the profile's own link | Replace `MAPS_LISTING` with the share link from the GBP dashboard |
| 10 | Geo coordinates 38.4094, -121.3558 | Geocoded from the street address | Fine-tune from the Google listing if it matters |
| 11 | Towns served | Neighboring communities around Elk Grove | Confirm the shop actually wants customers from all of them (`SITE["areas"]`) |
| 12 | Old-site redirects | Only `/services`, `/aboutus` and `/contact` were confirmed indexed; the rest are informed guesses | **Verify against the live site** — see below |
| 13 | Reviews | Only one verbatim quote was supplied, with no reviewer name | Paste more real reviews into `REVIEWS`, with the name and the platform |

### Reviews policy

`REVIEWS` in `build.py` holds verbatim customer text only, attributed to the
person and the platform it was left on. **Never add an entry that cannot be
pointed at.** The three cards beside it are clearly labelled statements about
the business, not quotes, and are styled differently so they cannot be mistaken
for one.

The site also does **not** publish `aggregateRating` in its structured data.
Google's guidelines disallow self-serving review markup and sites that do it
risk losing the rich result entirely, so the rating is stated in plain text and
linked to Google instead. `tools/verify.py` fails the build if it ever appears.

### Verifying the redirects

`OLD_URL_MAP` in `build.py` becomes both `.htaccess` (Apache/cPanel) and
`_redirects` (Netlify/Cloudflare Pages). A 301 passes the old page's ranking on
to the new one; a 404 throws it away.

Get the real list before launch — Search Console → Indexing → Pages, exported;
or a crawl of the old site; or the old site's own menu — then add anything
missing to `OLD_URL_MAP` and rebuild.

---

## Only the owner can do these

1. **Confirm the hours**, and whether Saturdays are ever worked.
2. **Provide the shop's email**, then click the one-time FormSubmit confirmation
   link the first submission triggers. Until that link is clicked, submissions
   are held and never arrive.
3. **Verify the old page addresses** against the live site so the redirects are
   complete (table row 12).
4. **Update the Google Business Profile link** — replace the Maps search URL with
   the profile's own share link, and check the profile itself lists the same
   name, address, phone and hours as this site. Mismatched citations cost local
   ranking.
5. **Supply real photos** — the shop front, the bay, the team, work in progress.
   Every photo slot in the HTML carries a comment showing exactly what to
   replace and what size to use. The illustration is a stand-in, not a goal.
6. **Ask customers for reviews.** 55 is decent; the shops that outrank you in
   Elk Grove mostly just have more.

---

## Structure

```
build.py                 the generator; all business facts live at the top
assets/                  hand-maintained; copied into the output on every build
  css/site.css           the whole design system, tokens sampled from the logo
  js/site.js             mobile nav, dataLayer/gtag events, form handling
  img/logo.png           the shop's real logo, cropped from the supplied file
  img/shop-scene.svg     custom illustration drawn for this site
  img/favicon.svg        mark built from the logo's two colors
  img/og-cover.png       social card, generated by tools/shoot.py og
tools/
  verify.py              static checks; exits non-zero so it can gate a deploy
  shoot.py               browser checks and screenshots
  make-preview.py        bundles the site into one shareable HTML file
  make-download.py       builds and verifies the upload zip
public/                  generated — do not edit by hand
download/                the upload-ready zip
preview.html             generated — the whole site as one file
```

## Design

The palette is sampled from the logo file, which is drawn in exactly two
colors: an orange fill `#eb712d` inside a royal-blue outline `#0c27f5`.
Everything derives from those — the darks are blue-black rather than neutral
navy and the greys carry the same blue bias.

Two working rules came out of measuring rather than guessing:

- **Orange carries calls to action, blue carries text.** The logo orange is
  only 3.0:1 against white, so button text sits on a deeper `#c85214 → #a94208`
  ramp where both ends clear 4.5:1, and the vivid logo orange is kept for
  graphics that hold no text. Links, nav state and eyebrows use the blue, which
  clears 10:1.
- **Review stars stay gold.** That is what a rating looks like.

`tools/shoot.py contrast` walks every text node on every page and checks it
against the background it actually renders on; it currently reports zero
failures. It caught a real bug this way — `.hero p` outranking `.form-note` on
specificity, which had turned the quote form's fine print near-white on white.

## Deploying

- **cPanel / shared hosting** — use the zip. `READ-ME-FIRST.txt` inside it has
  the steps, including turning on "Show Hidden Files" so `.htaccess` is not
  silently skipped.
- **Netlify / Cloudflare Pages** — deploy `public/` as-is. `_redirects` and
  `_headers` are picked up automatically.
- **GitHub Pages** — fine for staging only. Pages deploys from the default
  branch by default and cannot serve `_redirects` or `_headers`, so the 301s
  and the security headers will not work there.
