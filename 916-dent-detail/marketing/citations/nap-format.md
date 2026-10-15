# NAP Format (Name, Address, Phone)

Status: DRAFT spec. Every listing must match this exactly. NAP is placeholder-driven: `src/config/site.ts` currently holds a fictional phone (555-0100) and `hello@example.com`. **Never publish those in any listing.** Replace with real values first (`npm run check:owner` lists them).

## The canonical block (copy-paste after owner fills the brackets)
```
Name:     916 Dent & Detail
Address:  (hidden; service-area business). Area label: Greater Sacramento, CA
Phone:    [OWNER PHONE]   format: (916) NNN-NNNN
Email:    [OWNER EMAIL]
Website:  https://[OWNER DOMAIN]/
Hours:    [OWNER HOURS]   (site.ts hours are unset)
Category: see gbp/categories.md
```

## Exact format rules
- Name: `916 Dent & Detail`. Ampersand, not "and". Capital D twice. No keywords appended ("916 Dent & Detail Sacramento Paintless Dent Repair" is stuffing and a suspension risk; third-party consensus, UNVERIFIED on Google).
- Phone: `(916) 555-0123` style: parentheses, space, hyphen. One primary number everywhere, the same number on the website footer and the `tel:` link (`site.phone.e164` format +1916NNNNNNN for code). Use a tracking number only as an additional number on GBP, with the real number primary. Avoid mixing `916-555-0123` and `(916) 555-0123`.
- Website: one canonical URL, https, the same trailing-slash style everywhere. Add UTM only to the website field of a profile if the owner wants source tracking (note: tracking parameters on the primary GBP website link are common practice, UNVERIFIED in policy).
- Email: a business-domain address, not a personal one if avoidable.
- Hours: identical wording and days.

## Service-area business (no storefront)
- Google: hide the address; only the service area shows (https://support.google.com/business/answer/10514137, retrieved 2026-10-15 via scout). One profile per metro area.
- Bing Places: SABs can hide the address and show service cities; Bing accepts City-type service areas only (Yext help, https://help.yext.com/hc/en-us/articles/360001130466, retrieved 2026-10-15; third-party, verify in dashboard).
- Yelp: BrightLocal says the address step can be skipped for SABs; Uberall lists Yelp as supporting a hidden address (retrieved 2026-10-15; third-party, verify in dashboard).
- Apple Maps: community reports say Apple Business Connect may not allow hiding the address, and some no-storefront businesses were denied listings (localsearchforum, retrieved 2026-10-15). Treat as UNVERIFIED. See `setup-apple-business-connect.md` for the decision.
- Directories that require a street address: **do not invent or borrow one.** Do not use a virtual office, a coworking desk nobody staffs, or a PO box as a "storefront" (Google disallows virtual offices unless staffed, https://support.google.com/business/answer/3038177, 2026-10-15 via scout). Options: skip the directory, or the owner chooses to use the real operating address. That is an owner decision (D2).
- Do not put the owner's home address on any public listing unless the owner explicitly chooses to.

## Variants to avoid (kill these everywhere)
| Bad | Why |
|---|---|
| 916 Dent and Detail | "and" vs "&" splits citations |
| 916 Dent & Detail LLC / Inc. | Only if that is the legal name and used everywhere |
| 916 Dent & Detail - Sacramento Dent Repair | Keyword stuffing |
| 916DentDetail / 916 D&D | Unmatched variant |
| Nine-One-Six... | Same |
| 916-xxx / 916.xxx / +1 916 xxx / 9165550123 | Phone format drift |
| http:// or www. mixed | URL drift |
| Different phone on Facebook vs Google | Classic cause of duplicate profiles |

## Audit routine (monthly)
1. Search the exact name and phone in quotes; list every hit.
2. Compare to the canonical block. Fix or request fix.
3. Merge or report duplicates (Yelp duplicate pages can be reported via "suggest an edit"/support, anecdotal, localsearchforum).
4. Log in `citations/` tracker (below), note date and who changed it.

## Tracker (copy to a sheet)
`Directory | URL | Claimed? | Name OK | Phone OK | Website OK | Hours OK | Date | Notes`
