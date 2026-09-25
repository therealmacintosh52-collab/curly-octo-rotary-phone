# Launch checklist

Tick in order. Anything marked **owner** cannot be done from this repo.

## 1. Before the domain is pointed

- [ ] **owner** Real email in `src/data/site.json` → `site.email`, then `npm run build`.
      Until this is done the quote form tells visitors to call instead of pretending to send.
- [ ] **owner** Submit the form once on the live site and click the FormSubmit
      confirmation email. Until that link is clicked, submissions are held and never arrive.
- [ ] **owner** Verify the old site's URL list (Search Console → Indexing → Pages,
      exported) against `old_url_map` in `src/data/site.json`. Add anything missing.
      Only `/services`, `/aboutus` and `/contact` were confirmed indexed from outside.
- [ ] `npm run build && node scripts/audit.mjs` — must exit 0.
- [ ] `node scripts/lh.mjs` — perf ≥ 90, a11y/BP/SEO 100, CLS 0.
- [ ] Check every phone number on the built site is `(916) 686-5277`. The audit does this.

## 2. Deploy

- [ ] Netlify: base directory `sites/automotive-solutions-v2`, build `npm run build`, publish `dist`.
- [ ] Confirm `_headers` and `_redirects` are live (`curl -I` a known old URL, expect 301).
- [ ] Confirm HTTPS and that one hostname is canonical (www vs bare — the site is
      built for `www`; if you prefer the bare domain, change `site` in
      `astro.config.mjs` and `base_url` in `site.json`, then rebuild).
- [ ] Test the 404 page at a made-up URL.

## 3. Search engines

- [ ] Google Search Console: verify the property, submit `/sitemap-index.xml`.
- [ ] Bing Webmaster Tools: verify, submit the same sitemap.
- [ ] `node scripts/indexnow.mjs --send` (only once the domain serves this build).
- [ ] Confirm `https://<domain>/93b454627c24d574e2c22bd1612551ce.txt` returns the key.
- [ ] Rich Results Test on the home page, one service page and one guide.
      Expect LocalBusiness/AutoRepair, Service, FAQPage, Article, BreadcrumbList.
      **Expect NO review snippet** — aggregateRating is deliberately not published.

## 4. Listings (owner)

- [ ] Google Business Profile: same name, address, phone and hours as this site,
      exactly. Categories: Auto repair shop (primary) + Brake shop, Transmission
      shop, Auto air conditioning service. Add the twelve services. Add photos.
      Set the website link to the new domain.
- [ ] Replace `maps_listing` in `site.json` with the profile's own share link
      (currently a Maps search URL) and rebuild.
- [ ] Bing Places, Apple Business Connect: claim and match.
- [ ] Yelp, NAPA AutoCare directory, BBB, Nextdoor: confirm name/address/phone match.
      Any mismatch across these costs local ranking.

## 5. After launch

- [ ] Watch Search Console coverage for a week; any old URL 404ing means a
      missing redirect.
- [ ] Re-run `node scripts/lh.mjs` on the live domain, not just locally.
- [ ] Start the review engine — see `marketing/review-request-templates.md`.

## Still outstanding (see README)

- **Hero video is AI-generated, not the real shop.** Used whole by the owner's
  decision — including the neon logo animation over the opening, which is
  deliberate branding and must not be trimmed. The painted sign on the building
  in the shot reads `916-000-5277` against the real (916) 686-5277, and the clip
  now runs its full 16:9 uncropped, so it is in view at every width. Ten seconds shot at the real shop replaces it:
  `npm run video -- real-clip.mov`. Nothing else changes.
- Three more real reviews to quote. Only one verified quote exists.
- Full-resolution shop photos. The two in use are ~200px originals.
