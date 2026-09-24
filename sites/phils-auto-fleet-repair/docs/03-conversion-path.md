# 3. Conversion path and copy

One primary action everywhere: **call (209) 647-4953**. The quote form is the secondary action for
people who cannot call right now (at work, after 5 PM, on a job site). Nothing else competes.

## Sitemap

| Page | Purpose | Primary CTA | Proof beside the ask |
|---|---|---|---|
| `/` | Rank for "auto repair Lodi"; route the two buyers | Call | Rating line (Google + CARFAX), three Google quotes |
| `/services/` | Hub. Every profile item findable in one scroll | Call | Stat band |
| `/services/<slug>/` ×13 | One money keyword each; answer "is this my problem?" | Call, then pre-filled quote form | Rating line under H1, "Listed on our Google profile as" row |
| `/services/differential-repair/` | New. Captures "differential repair Lodi" which no page held | Call | Same |
| `/services/tire-repair/` | Re-scoped: new tires, run-flats, rims, free rotation | Call | Same, plus the free-rotation callout |
| `/about/` | Trust, dealership contrast | Call | Reviews |
| `/reviews/` | Social proof; send new reviews to Google | Leave a Google review | Google, CARFAX, Yelp links |
| `/service-areas/` | Nearby-city searches (now includes French Camp) | Call | Rating |
| `/contact/` | NAP, hours, map, directions, form | Call | Hours panel |
| `/advice/*` | Pre-call research; earns links | Call | Guide byline |
| `/es/` | Spanish landing | Llamar | Reseñas |
| `/thank-you/`, `/404/` | Post-submit; recovery | Call | none |

## Entry-point flows

- **Google Maps / Business Profile:** the profile drives more calls than the site. Website link →
  `/`; profile "Products" link to the matching `/services/<slug>/#…`; appointments link → `/contact/#quote`.
  The `/services/` "Everything we do" section mirrors the profile so a visitor who came from a
  specific product finds the same wording.
- **Organic:** service query → service page → call. Symptom query ("why does my tire keep losing air")
  → advice guide or service FAQ → call.
- **Social / Nextdoor:** share image (`og-cover.png`) → `/` → reviews → call.
- **Referral:** name search → `/` → rating line and Google quotes confirm → call. Sticky header phone
  and the mobile call bar mean the number is never more than one thumb away.

## Homepage, section by section

1. **Hero.** H1 "Honest auto, diesel & fleet repair in Lodi, California". Rating line (Google and
   CARFAX). Four proof points. Call button, quote-form anchor. Quote form beside it on desktop, below
   on mobile. Objection handled: *will they upsell me?* ("No upsells — you approve every repair").
2. **Stat band.** Rating, "Diagnosis first", "Auto · Diesel · Fleet", "Open six days".
3. **What we fix.** Thirteen services as a work-order list (see `02-visual-world.md`), link to the
   full list. Objection: *do they do my kind of vehicle?*
4. **Dealership contrast.** Table. Objection: *why not the dealer?*
5. **Three steps.** Objection: *what happens after I call?*
6. **Fleet band.** Dark section, real-photo slot. Buyer 2 path.
7. **Reputation.** Seven attributed quotes, links to Google, CARFAX, Yelp. Objection: *can I trust them?*
8. **Find us.** Address, hours table, map, directions.
9. **FAQ.** Objections in the visitor's words.
10. **CTA band.** Call.

## Final copy

### Home hero (as built)

> **Honest auto, diesel & fleet repair in Lodi, California**
> A value-driven alternative to the dealership. We diagnose the problem properly, explain it in
> plain language, and quote it before we touch a wrench — so you never pay for parts your vehicle
> didn't need.
> · Domestic, import, diesel and commercial fleet vehicles
> · Known for fixing what other shops misdiagnosed
> · No upsells — you approve every repair before it happens
> · Open Monday through Saturday, 8:00 AM – 5:00 PM
> [Call (209) 647-4953] [Get a free quote]

### Top service page: Diesel repair (as built, with this change's additions)

> **Diesel Repair in Lodi, CA**
> Diesel work is its own discipline. Fuel systems run at pressures gas engines never see, emissions
> systems fail in patterns that look like engine problems, and a truck that's down is usually costing
> somebody money every hour it sits.
>
> **What this service covers:** diesel engine diagnosis and drivability; fuel system service; hard-start
> and glow plug diagnosis; turbo and boost leaks; DPF, EGR cleaning and warning lights; diesel head
> gasket replacement; water pump and timing cover replacement; cooling system; diesel A/C; diesel
> suspension and electrical for loaded trucks; PM intervals; brakes, suspension and driveline under load.
>
> **Own an LML Duramax?** 2011–2016 Chevy / GMC Duramax 6.6. We work on these trucks regularly.
> `[NEEDS: the shop's Duramax offer]` Call the shop and ask about it by name.

### Contact (as built)

NAP block, hours table, map, directions, quote form with five fields. Copy under the form: "No
obligation. We'll never sell your information. Prefer to talk it through? Call (209) 647-4953."

## Objection placement map

| Objection | Where it is answered |
|---|---|
| They'll replace parts I don't need | Hero point 3; "We test before we replace" checklist; every service page intro |
| They'll quote low and add on | "Nothing happens without your approval"; three-steps section; FAQ |
| They can't do my diesel / my fleet | Stat band; fleet band; diesel and fleet pages; sign says "Fleet" |
| They'll send me elsewhere for tires or the diff | Tires & Wheels and Differentials pages; "Everything we do" list |
| How much is this going to cost | "$89 A/C diagnosis" published; "price before work" on every page |
| Are they any good | Rating line under every H1; seven attributed quotes; CARFAX and Google links |
| I don't have time | Open six days; sticky phone; five-field form |

## Form spec

Fields: name (required), phone (required, `type=tel`, `autocomplete=tel`), vehicle (optional, placeholder
"2016 Ram 2500 diesel"), what do you need (select, pre-filled on service pages, "Not sure — please
diagnose" option), when could you bring it in (optional), message (optional). Two honeypots. Labels
are visible, every control ≥ 44 px tall, error and success states in a `role="status"` `aria-live`
region. Posts to FormSubmit; on network failure the status line says to call instead of failing
silently. Post-submit: `/thank-you/` states the next step (the shop calls back, or call now) and
repeats the number. Subject line "Quote request from philsautoandfleet.com".

## Conversion events (already wired in `assets/js/site.js`)

| Event | Trigger | Parameter |
|---|---|---|
| `click_to_call` | any `tel:` link | `data-loc` (hero, header, callbar, service-head, …) |
| `get_directions` | Maps directions link | page |
| `generate_lead` | successful form post | form id (home-quote, `<slug>`-quote, contact) |

Mark `click_to_call` and `generate_lead` as conversions in GA4 once the tag is added to `render()`.
