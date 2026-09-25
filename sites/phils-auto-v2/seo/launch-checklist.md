# Launch checklist — Phil's Auto & Fleet Repair v2

Work through this in order on launch day. Everything here is outside the codebase.

## 1. Before pointing the domain

- [ ] Re-check the review figures against the live Google Business Profile and update `src/data/site.json` (`site.rating`, `site.review_count`) if they moved. The site, the JSON-LD and the OG images all read from that file.
- [ ] Confirm the four quoted reviews are still public on Yelp and MapQuest.
- [ ] Open `public/_redirects` and check each old URL against the current live site (or Search Console's Pages report). Add any old URL that is missing. A 301 keeps the ranking; a 404 throws it away.
- [ ] Submit the quote form once yourself. The first submission triggers FormSubmit's one-time confirmation email to phil@philsautofleet.com; click the link, then submit again and confirm it lands as a table in the inbox.
- [ ] Tap every phone number on a real phone (header, hero, call bar, footer) and confirm it dials.
- [ ] Open the home page on an iPhone in Low Power Mode: the still frame, the tap-to-play cue and the buttons should show; one tap starts the loop.

## 2. Deploy (Netlify)

- [ ] New site → Import from Git → this repository. Base directory `sites/phils-auto-v2`, build `npm run build`, publish `dist`. `netlify.toml` already says this.
- [ ] Add the custom domain `philsautofleet.com` and the `www` alias; let Netlify issue the certificate. Set the apex as primary so `www` redirects to it.
- [ ] After the first deploy, open `/services/brakes` (an old URL) and confirm it 301s to `/services/brake-repair/`.
- [ ] Confirm `/_headers` applied: `curl -I https://philsautofleet.com/` should show the CSP and cache headers.

## 3. Google Business Profile

- [ ] Website field → `https://philsautofleet.com/`.
- [ ] Appointment link → `https://philsautofleet.com/contact/#quote`.
- [ ] Services list on the profile mirrors the 12 service pages, each with its URL where GBP allows a link.
- [ ] Hours match the site (Mon–Sat 8:00–17:00, Sunday closed). Any change to hours must also go in `src/data/site.json`.
- [ ] Upload the lift photo and the shop front (the video poster frame) as profile photos.

## 4. Search Console and Bing

- [ ] Add the property `https://philsautofleet.com/` (URL-prefix). Verify with the DNS record or by uploading the HTML file to `public/`.
- [ ] Submit `https://philsautofleet.com/sitemap-index.xml`.
- [ ] Request indexing for the home page, `/services/`, and the diesel and fleet pages.
- [ ] Bing Webmaster Tools: import from Search Console, submit the same sitemap. Bing is what ChatGPT search and Copilot read; the site is invisible to them until this is done.
- [ ] Confirm `https://philsautofleet.com/d3949c9607ed1d5fc65705366ef0d7a9.txt` loads (the IndexNow key), then run `npm run indexnow` from `sites/phils-auto-v2` after every deploy. Confirm `https://philsautofleet.com/llms.txt` and `/robots.txt` load too.
- [ ] Ask ChatGPT, Perplexity and Google "best diesel repair shop in Lodi CA" and note the answer. Repeat monthly (see `marketing/plan.md` §2).
- [ ] Two weeks in: check the Pages report for old URLs still returning 404 and add redirects.

## 5. Analytics

- [ ] Create a GA4 property. Add the snippet to `src/layouts/Base.astro` inside `<head>` (the CSP in `public/_headers` already allows `googletagmanager.com` and `google-analytics.com`).
- [ ] The site already pushes three events to `dataLayer`: `click_to_call` (with `link_location`), `get_directions`, `generate_lead`. Mark all three as conversions in GA4 and import them into Google Ads if ads run.
- [ ] Add a phone-call conversion in Google Ads using the number on the site if call tracking is wanted; do not swap the number for a tracking number on the site itself (NAP consistency).

## 6. Citations and reviews

- [ ] Yelp, Nextdoor, MapQuest, Carfax: update the website URL on each to `https://philsautofleet.com/` and make sure name, address and phone read exactly `Phil's Auto and Fleet Repair · 103 E Elm St, Lodi, CA 95240 · (209) 647-4953`.
- [ ] Apple Business Connect and Bing Places: claim if not already, same NAP.
- [ ] Review link to hand to customers: the "Leave a Google review" button on `/reviews/` opens the Google listing; shorten it with the GBP "Get more reviews" link and put it on invoices.

## 7. First month

- [ ] Search Console → Performance: note which queries the home and `/services/auto-repair/` pages both appear for. If the same query shows both, adjust the copy per the cannibalization notes in `keyword-map.md`.
- [ ] Core Web Vitals report: confirm LCP, CLS and INP are green on mobile with real users. If LCP on the home page is over 2.5 s in the field, the next lever is a smaller poster (the AVIF is 30 KB) or moving the video source attach later.
- [ ] Replace the hero clip when a shot without the push-in exists; same filenames, no code change.
