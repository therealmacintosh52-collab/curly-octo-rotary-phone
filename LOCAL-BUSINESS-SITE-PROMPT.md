# Reusable prompt — local business website

Paste this into a new Claude Code session, fill in the top block, attach the logo.

---

Build a complete local-business website end to end. Make the routine calls yourself — only ask me
about facts you cannot verify. Keep your replies short: do the work, then give me the link.

## THE BUSINESS

- Name:
- Address:
- Phone:
- Email:
- Hours:
- Services (list everything they do):
- Towns they serve:
- Rating + review count, and from where:
- Real reviews (paste the text, first name, and which site it came from):
- Logo: (attached — sample it, do not guess the colours)
- Domain:
- Their current website, if any:
- Anything else true and worth saying (certifications, years open, warranty, languages spoken):

## HOW TO BUILD IT

One Python script (`build.py`) that generates static HTML into `public/`. No frameworks, no npm,
no database, no webfonts, no CDN, no tracking pixels. Every business fact lives in one `SITE` dict
at the top so it can be edited in one place.

Pages: home, services index, one page per service (10–14, each targeting "<service> in <city>"),
about, reviews, service areas, contact, privacy, thank-you, 404, plus 3–5 advice guides answering
what people search *before* they're ready to call.

If a meaningful share of the local population speaks another language, add a fully localised
landing page for it — header, footer, form and all, not just translated body copy — with hreflang.

Conversion: click-to-call in the top bar, header, hero, every section CTA and footer; a fixed
mobile bar (Call / Directions / Quote); a quote form above the fold and on every service page
pre-filled with that service; a comparison table against whatever they lose business to; copy that
answers the real objections. Wire dataLayer/gtag events for calls, directions and form submits.

SEO: unique title ≤60 characters and meta description 70–160 per page, one H1 each, canonical,
OG/Twitter, geo meta, sitemap.xml, robots.txt. JSON-LD: the right LocalBusiness subtype with
address, geo, hours, service catalog and areaServed, plus `sameAs` to their Google/Yelp/other
profiles; Service on service pages; BreadcrumbList; FAQPage; Article on guides. Do **not**
self-publish `aggregateRating` — show the rating on-page and link to the source instead.

Design: sample the actual logo file for the palette rather than guessing. Dark sections in the same
hue family, greys biased toward it, review stars stay gold. Give it depth — layered gradients and
shadows, a card overlapping a section edge, angled dividers — and draw a custom SVG illustration
rather than using stock. Add photo slots with an HTML comment showing exactly how to swap in real
photos.

## FACTS

Never invent reviews, certifications, years in business, warranties or prices. If I didn't give it
to you, leave it out and list it under "confirm before launch". Keep reviews I supply verbatim
apart from punctuation, attributed to the person and the site.

## MISTAKES THAT COST TIME LAST BUILD — DON'T REPEAT THEM

- Mobile header overflowed: hide the desktop CTA below the nav breakpoint and let the brand shrink.
  Test at a true 390px width **inside an iframe** — headless Chrome clamps its own viewport to ~485px.
- Root-relative links break anywhere but the domain root. Support a `--relative` build for
  subfolders, staging and zips; use absolute for a root deploy.
- If the build writes outside `public/`, copy the hand-maintained `assets/` folder too — and assert
  the zip actually contains the CSS, JS, images and `.htaccess` before calling it done.
- Headless screenshots: the real viewport is the window height minus ~87px. Render taller, then crop.
- Prose read as bullet lists because the renderer guessed from item count. Mark each section
  explicitly as prose or list.
- Figure captions belong under the image, not overlaying it.
- White text on a gradient needs a dark enough colour at *both* ends.
- GitHub Pages only deploys from the default branch by default, and can't serve `_redirects` or
  `_headers` — fine for staging, wrong for the live site.

## VERIFY BEFORE YOU SAY IT'S DONE

- Every page: balanced tags, valid JSON-LD, internal links resolve, titles and descriptions unique
  and in range, exactly one H1.
- Load it in a real browser: no JS errors, mobile menu opens, form submits, tracking fires.
- Screenshot desktop and mobile and actually look at them.

## DELIVER

1. A one-click preview link of the whole clickable site.
2. A zip built with relative links, containing a plain-English READ-ME-FIRST.txt: cPanel upload
   steps, and the reminder to show hidden files so `.htaccess` isn't skipped.
3. `_redirects` and `.htaccess` mapping the **old** site's URLs to the new ones with 301s, plus
   HTTPS and canonical-host rules. Tell me to verify the old URLs against the live site.
4. The contact form wired to an endpoint that needs no signup (FormSubmit) posting to their email,
   with honeypot fields — and tell me about the one-time confirmation email.
5. A short list of what only the owner can do: confirm hours, verify redirects, update the Google
   Business Profile link, supply real photos, and ask customers for reviews.
