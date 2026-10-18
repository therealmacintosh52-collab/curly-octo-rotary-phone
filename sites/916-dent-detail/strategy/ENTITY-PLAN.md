# ENTITY PLAN: the one set of facts

This is the single source of truth. The site, JSON-LD, `llms.txt`, Google Business Profile, Apple Business Connect, Bing Places, Yelp, Facebook, Instagram bio and every directory copy these strings **character for character**. The build reads them from one `entity.json`; no page types its own copy of the phone or the area list. Anything not in this file is not a fact about the business.

## 1. Canonical NAP

| Field | Canonical value | Status |
|---|---|---|
| Name | **916 Dent & Detail** (ampersand in text; "916 Dent and Detail" is not used anywhere, to avoid a second variant) | Owner (authoritative) |
| Phone, display | **(916) 868-2447** | Owner-supplied from business card; I re-read the card art and the digits read 916-868-2447. **[CONFIRM]**: owner to confirm digits and that the number receives texts with photos |
| Phone, tel and schema | `+1-916-868-2447` (`tel:+19168682447`, `telephone: "+1-916-868-2447"`) | same |
| Address | **None published.** Service-area business; JSON-LD omits `address`; GBP address hidden | Owner |
| Base location | Never published. ZIP 95624 is internal and appears nowhere | Owner / compliance |
| Service area (canonical string) | **Sacramento, Elk Grove, Roseville, Folsom, Rancho Cordova, Citrus Heights, West Sacramento, Davis, Rocklin, Lincoln, El Dorado Hills, Granite Bay, Carmichael and Natomas** | Owner's 14 places, listed once in this order everywhere |
| Website | `https://{{DOMAIN}}/` | Not provided; stamped by script |
| Email | None. No email on the site or in schema until the owner supplies a business address (form replies go by phone) | Not provided |
| Hours | None. `openingHoursSpecification` omitted; no hours text | Not provided |
| Instagram | `https://www.instagram.com/916dentanddetail/` (handle `@916dentanddetail`) | **Owner-provided, not verified live** |
| Tagline | Precision · Care · Perfection. | Owner |
| Hero line | Dents gone. Paint glowing. We come to you. | Owner |
| Price range | omitted (`priceRange` only if verified) | Not provided |

"Surrounding areas" (card wording) is not a canonical phrase and is not used in schema or profiles. The place list above is. Natomas, Carmichael, Granite Bay and El Dorado Hills are communities rather than incorporated cities; the word used for the list is "places" or "cities and communities", never "cities" alone.

## 2. Schema.org entity

- **Type:** `AutomotiveBusiness` (the parent of `AutoBodyShop`, `AutoRepair`, `AutoWash`; confirm the type name on schema.org at build, rule 7). It is accurate for dent removal plus detailing without implying mechanical repair (`AutoRepair`) or a body shop (`AutoBodyShop`, which contradicts "no body shop" and touches the open BAR question). Single type, no `LocalBusiness` duplicate.
- **Properties on the home page:** `@id` (`https://{{DOMAIN}}/#business`), `name`, `url`, `telephone`, `description` (long copy below), `areaServed` (array of `Place` or `City` with `name`, one per canonical place, `containedInPlace` "Sacramento Metropolitan Area, California" omitted if unverified), `sameAs` (`[Instagram URL]`, see section 4), `image`/`logo` (the D-mark file), `slogan` = tagline, `knowsAbout` (paintless dent repair; ceramic coating; paint correction; interior detailing; hail damage repair), `hasOfferCatalog` listing the six services **without** `Offer` prices (no `offers`). **Omitted:** `address`, `geo`, `openingHoursSpecification`, `priceRange`, `email`, `aggregateRating`, `review`, `foundingDate`, `founder`, `employee`, `numberOfEmployees`, `hasCredential`, `hasMap` (no storefront to map).
- `WebSite` (`name`, `url`, `publisher` = the business `@id`), on home only.
- `Service` per service page: `serviceType` (real term), `name` (plain-language name), `provider` = business `@id`, `areaServed` (same list), `description` = the page's opening answer. No `offers`.
- `BreadcrumbList` on all non-home pages; `FAQPage` where an FAQ is visible (note: Google shows FAQ rich results for few site types; this is for other engines); `Article` on guides with `datePublished`/`dateModified` set **only** to the real review date ("Updated October 2026" if actually reviewed) and `author` = the business (no named person).
- City pages: `WebPage` with `about` = the place and `provider` = business `@id`; no `LocalBusiness` per city (that would imply a location).
- **Never:** `AggregateRating`, `Review`, per-city `LocalBusiness`, any address, any person.

## 3. Categories (Google Business Profile; Stage 5 finalizes)

Google's picker is authoritative; names below come from other profiles and third-party sources and **must be verified in the dashboard** (BP/TC sources: Unverified).

| Role | Category | Basis |
|---|---|---|
| Primary | **Auto dent removal service** | Seen on other PDR profiles (One-Up Dent Repair, PEAK); highest-ticket service; one clearly mobile PDR rival |
| Secondary 1 | **Car detailing service** | Core detailing; cited as the standard detailing primary by a third-party forum |
| Secondary (only if truly offered and present in the picker) | a mobile or auto detailing variant; Car wash (only if wash-only jobs are offered) | Do not pad |
| Excluded | Auto body shop, Auto repair shop, "Window tinting" and similar | Misleading or not offered; BAR risk |

If the first 90 days are mostly detailing, the owner may swap primary and secondary. Ceramic coating has no found category; list it under Services.

## 4. sameAs and profile policy

| Profile | Include in `sameAs`? | Rule |
|---|---|---|
| Instagram (@916dentanddetail) | Yes, **owner-provided, not verified live**. The visible footer and contact page link to the same URL | Owner confirms the account is live and public before launch; if not, remove from schema, footer and contact in one edit (single `entity.json` field) |
| Google Business Profile, Apple, Bing, Yelp, Facebook | Added only after each is claimed and live, in the client's name | None exist today (search found none; unverified absence) |
| Directories (Lantern, Poyst, ZoomInfo, etc.) | Never in `sameAs` | Business-supplied third-party data; claim and correct, do not endorse |

## 5. Descriptions (identical wherever used)

All three contain only owner-supplied or method-true statements; no phone, URL, price, year, license, guarantee, hours or address.

**Tagline (all places):** Precision · Care · Perfection.

**Short, 153 chars (meta description on home, Instagram bio line 2, directory short fields):**
Mobile paintless dent repair and auto detailing that come to you in Sacramento, Elk Grove, Roseville, Folsom and nearby cities. Send a photo for a price.

**Medium, 217 chars (Facebook About, Apple, Bing short, schema fallback):**
916 Dent & Detail is a mobile service for paintless dent repair and auto detailing in the Sacramento area. Two owner-technicians and a crew come to your home, workplace or lot. Send photos of your dent to get a price.

**Long, 711 chars (GBP description limit 750; Yelp, Bing long, `llms.txt` intro, schema `description`):**
916 Dent & Detail is a mobile service in the Sacramento area. We remove dents without paint or a body shop where the metal and paint allow it, and we tell you plainly when a dent is not a candidate. We also detail cars inside and out, including paint deep-clean, swirl and scratch removal, ceramic coating, interior cleaning and hail damage repair when it happens. Two owner-technicians and a crew come to your home, workplace or lot in Sacramento, Elk Grove, Roseville, Folsom, Rancho Cordova, Citrus Heights, West Sacramento, Davis, Rocklin, Lincoln, El Dorado Hills, Granite Bay, Carmichael and Natomas. Dealerships, fleets, rental lots and body shops are served too. Text photos of your dent to get a price.

Owner-approval items inside the long copy (each flagged in TO-CONFIRM): "home, workplace or lot" (reasoned from "we come to you"), "ceramic coating" and "hail damage repair" (named owner services, products and capacity unconfirmed), "tell you plainly when a dent is not a candidate" (a promise of behavior consistent with the brand voice).

## 6. Services list (names must match everywhere)

| Plain-language name (label) | Real term (title, H1, schema `serviceType`) | Page |
|---|---|---|
| Dent Removal (no paint, no body shop) | Paintless dent repair | `/paintless-dent-repair/` |
| Hail Fix | Hail damage repair | `/hail-damage-repair/` |
| Paint Deep-Clean | Paint decontamination (clay and iron removal) | section of `/mobile-detailing/` |
| Swirl & Scratch Erase | Paint correction | `/paint-correction/` |
| Gloss Shield | Ceramic coating | `/ceramic-coating/` |
| Interior Reset | Interior detailing | `/interior-detailing/` |
| (parent) | Mobile auto detailing | `/mobile-detailing/` |

## 7. Where each fact appears (consistency matrix)

| Fact | Site visible | JSON-LD | `llms.txt` | GBP | Directories | Business card / print |
|---|---|---|---|---|---|---|
| Name | header, footer, contact, about | yes | yes | yes | yes | yes |
| Phone (916) 868-2447 | footer, contact, sticky bar, header, tel/sms links | yes (E.164) | yes | yes | yes | yes |
| Service area string | footer, service-area hub, contact | `areaServed` | yes | service areas (up to the platform limit) | yes | "Sacramento, CA & Surrounding Areas" remains on the printed card; web copy uses the named list |
| Instagram | footer, contact | `sameAs` | yes | link | yes | yes |
| Description | home (short), about (long) | long | long | long | by field length | n/a |
| Address | **nowhere** | **nowhere** | **nowhere** | hidden | hidden/none | none |
| Hours | **nowhere** until supplied | omitted | omitted | set when supplied | when supplied | none |
| Email | **nowhere** until supplied | omitted | omitted | optional | optional | none |

Call-tracking numbers, if ever added, never replace the number in markup, schema, GBP or directories.

## 8. NAP inconsistency log

Nothing external exists yet to be inconsistent with (no listing found; unverified absence). The one internal inconsistency is the printed card ("Surrounding Areas") versus the named list; resolved by using the named list online. Cleanup list for Stage 5: none known; a human checks Google Maps, Yelp, Facebook, Apple, Bing, BBB, CA Secretary of State and phone reverse lookups before claiming anything.

## 9. `llms.txt` outline

Plain markdown: H1 name; blockquote with the short description; sections for Services (six, with real terms and URLs), Service area (canonical string), Contact (phone, Instagram; "no storefront; no address published"), Key pages (photo quote, dealers and fleets, guides), Notes ("No prices are published; a price needs photos" and "PDR cannot fix every dent"). A courtesy file; no major engine has confirmed it as a ranking input.
