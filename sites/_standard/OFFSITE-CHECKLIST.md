# Off-site: where local ranking actually lives

Blunt framing: **Google Business Profile is ~32% of local pack ranking.** On-page
signals are ~19%, reviews ~16%, links ~15%. Everything in `GEO-AEO-STANDARD.md`
is necessary and is not sufficient. A perfect site with a thin GBP loses to a
mediocre site with a strong one.

None of this is code. It is the list that has to be worked anyway.

## 1. Google Business Profile — do this first

- [ ] Claim and verify the listing
- [ ] Primary category exactly right; secondary categories added
- [ ] NAP **byte-identical** to `SiteConfig` — same abbreviations, same suite format
- [ ] Hours, including special hours; overnight closes entered correctly
- [ ] Website link → the canonical domain
- [ ] Products / menu / services populated
- [ ] 20+ real photos, geotagged, added on an ongoing basis
- [ ] Q&A seeded with the real questions from the site's FAQ
- [ ] Posts weekly
- [ ] Review responses within 48h, every one, including the bad ones

## 2. Bing Places — the ChatGPT lever

ChatGPT's search has a very high citation overlap with the Bing index. If a
business is not in Bing, it is largely invisible to ChatGPT.

- [ ] Bing Places claimed (can import from GBP)
- [ ] Bing Webmaster Tools verified, sitemap submitted

## 3. Apple Business Connect

- [ ] Claimed — drives Apple Maps and Siri
- [ ] Photos, hours, ordering links

## 4. The platform listings

- [ ] Yelp claimed, hours and menu current
- [ ] DoorDash / Uber Eats / Grubhub — name and address identical to GBP
- [ ] Facebook page NAP matches
- [ ] Every one of these URLs is in `SiteConfig.profiles` so it lands in `sameAs`

## 5. NAP citation parity

Pick the canonical format once. Audit for divergence across: GBP, Bing, Apple,
Yelp, Facebook, delivery platforms, chamber of commerce, any aggregator.

Common silent killers: "St" vs "Street", "Ste 4" vs "#4", a tracking phone
number on one listing, an old suite number on another.

## 6. One domain

Two domains for one brand splits link equity and dilutes the entity. Pick one,
301 the other at the page level (not all to home), and update every listing to
the winner.

> **Open for Stark's Hot Chicken:** `starks-hot-chicken.com` and
> `starkshotchicken.com` both resolve, and the first links to the second for
> pickup. This needs a decision before launch.

## 7. Being mentioned where models already read

Citations come from third-party corroboration more than from your own copy.

- [ ] Local press / neighbourhood blogs
- [ ] "Best X in <city>" roundups — ask to be considered
- [ ] Reddit and local forums, honestly, without astroturfing
- [ ] Wikidata entry if the business is notable enough
- [ ] Structured data on the site matching what those sources say

## 8. Review velocity

Steady beats spiky. A burst of reviews after silence reads as manipulation.
Ask every satisfied customer, respond to all of them, never gate by sentiment.
