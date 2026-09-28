# Phase 1 — Input resolver and NAP cross-check

Written 2026-09-28 before the build (master plan §0 rule 1). Verification log at the end.

## Goal (master plan §4 step 1, §6)

Turn whatever the admin pastes into one canonical business entity, then compare
name, address and phone (NAP) across the website, Google Business Profile and Yelp.
Mismatches are findings. Done when five real businesses resolve correctly.

## Inputs accepted (`/admin/audits/new`)

- Website URL (any form: bare domain, http, www).
- Google Business Profile: `maps.app.goo.gl/…` or `g.co/kgs/…` short links (expanded by
  following redirects), `google.com/maps/place/<name>/@lat,lng…` URLs (name, coordinates,
  feature id and knowledge-graph id are parsed out), `?cid=`, `?q=place_id:…`, or plain
  text "name, city".
- Yelp business URL → alias.
- Optional extra URLs (Facebook, Instagram, TikTok, YouTube, LinkedIn, X, Nextdoor, BBB,
  Angi, Thumbtack, HomeAdvisor, Yellow Pages, Apple Maps, Bing Places): classified now,
  stored in `audits.inputs`, consumed by Phases 5–6.
- Optional service area, main services, average ticket.

## Resolution steps (all through provider adapters)

1. **Website** → `website.resolveCanonical`: follow up to 10 redirects with an identified
   user agent, record the chain, prefer https, take the final host as the canonical
   domain. Then `website.fetchPage` on the home page (and `/contact` if linked), honoring
   `robots.txt`, and extract NAP: `tel:` links, phone patterns, `<address>`,
   `LocalBusiness` JSON-LD `telephone` / `address`, US street-address patterns.
2. **GBP** → parse the link; expand short links; `google-places.searchText` with the
   parsed name (or the website's name) biased to the parsed coordinates, else the
   website's city; pick the candidate whose name and coordinates/phone/website agree;
   `google-places.getPlace` for the full record with a narrow field mask.
3. **Yelp** → alias from the URL; `yelp.getBusiness(alias)` for name, phone, address,
   rating, review count, claimed flag. Derived fields only are stored (licence terms).
4. **Cross-check** → normalize phones to E.164, addresses to a comparable form
   (case, punctuation, street-type abbreviations, unit tokens), names (strip LLC/Inc,
   punctuation). Every disagreement becomes an `identity_nap.*` finding with the two
   values as evidence. GBP website ≠ canonical domain is its own finding. A source that
   could not be fetched is recorded as UNAVAILABLE on the audit, never as a mismatch.
5. **Persist** → `businesses` row updated (name, canonical_domain, phone, address,
   lat/lng, place_id, yelp_alias, primary_category), `evidence` rows (`api_field` /
   `html`), `findings` rows, `audits.current_step` / `progress_pct`, and the raw API
   responses in `raw_snapshots` with their cost.

## Paid APIs switched on in this phase (rule 6: approved by the owner on 2026-09-28)

| Call | Estimated cost per call (unverified; see `verified` flags in code) | When it runs |
|---|---|---|
| Places API (New) Text Search, Pro field mask | ~$0.032 | once per audit when a GBP input or website name exists |
| Places API (New) Place Details, Pro field mask | ~$0.017 | once per audit after a match |
| Yelp Fusion business details | plan-based, ~$0.005 recorded | once per audit when a Yelp URL is given |

Snapshots are cached for 24 h per identical request, so re-runs inside a day are free.
PageSpeed, DataForSEO, social and crawler-with-screenshots stay stubs until their phases.

## Checks added (`src/lib/checks/identity/`)

| id | severity | when |
|---|---|---|
| `identity_nap.phone_mismatch` | high | website / GBP / Yelp phones disagree |
| `identity_nap.address_mismatch` | high | normalized addresses disagree |
| `identity_nap.name_mismatch` | medium | normalized names disagree |
| `identity_nap.website_missing_nap` | medium | website shows no phone or no address |
| `identity_nap.gbp_website_mismatch` | medium | GBP website points somewhere other than the canonical domain |
| `identity_nap.gbp_not_found` | critical | a GBP input was given but no confident match was found |

## UI

- `/admin/audits/new`: one textarea per input plus the optional fields; the action
  creates the business (placeholder name from the best input), the audit with
  `inputs`, and sends `audit/requested`.
- `/admin/audits/[id]`: status and progress, the resolved entity with per-source NAP
  table, findings, cost, and the list of sources that were UNAVAILABLE and why.
- `/admin` rows link to the detail page.

## Not in this phase

Crawling beyond home + contact, screenshots, PageSpeed, competitors, rankings, AI
visibility, citations, backlinks, social activity, scoring beyond what the registry
already does, solutions.

## Acceptance protocol (owner, needs the keys)

Create five audits with real businesses you know, at least one of each: short link only,
full Maps URL only, website only, website + Yelp, name + city. For each, the detail page
must show the right business (name, address, phone, place id) and only real mismatches
as findings. Record the five in the verification log below.

## Verification log (2026-09-28, build container)

| Step | Result |
|---|---|
| `pnpm lint` | 0 problems |
| `pnpm typecheck` | 0 errors |
| `pnpm test` | 14 files, 93 tests: input parsing, Maps URL parsing, NAP normalization/comparison/extraction, live adapters with injected fetch (Places request shape + cost, Yelp bearer + cost, redirect chain, robots.txt, bot walls, short links), identity checks, resolve step end to end on fixtures (3 sources agree → 0 findings; Google not configured → `gbp_not_found`; seeded Google phone ≠ website phone → `phone_mismatch` with two evidence rows), Inngest function with the resolve step |
| `pnpm db:test` | unchanged schema; Phase 0 suite still applies (re-run in CI) |
| `pnpm build` | ok: 12 routes incl. `/admin/audits/new` and `/admin/audits/[id]` |
| Live resolution of 5 real businesses | **not done here**: no API keys in the build container and Supabase is unreachable from it. Owner protocol above. |

## Exit criteria

- [x] Resolver + NAP cross-check implemented and tested against fixtures
- [x] `/admin/audits/new` creates and enqueues; `/admin/audits/[id]` shows sources, findings, cost
- [ ] Five real businesses resolve correctly (owner, with `GOOGLE_PLACES_API_KEY` and optionally `YELP_API_KEY` set)
