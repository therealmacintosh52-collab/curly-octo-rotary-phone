# Wholesale Price Sheet Template (Dealers and Fleets)

Status: TEMPLATE. Every dollar amount is an [OWNER] decision. No wholesale rate was found in research (`marketing/research/dealer-targets.md`: "Conclusion: NO sourced dealer wholesale per-panel/per-dent range found"). To set prices, ask 2-3 used-car managers what they pay now (gated owner action). Do not copy the scraped retail ranges in that file.

Reference only, not our price: an insurer PDR matrix shows oversize dents billed separately, aluminum panels +25%, corrosion protection $10 per panel up to $30 per vehicle (State Farm matrix, https://role-based-content-app-ui.digital.statefarm.com/b2b/pdr/docs/ss_paintless-dent-repair-matrix.pdf, via scout 2026-10-15; the per-panel base grid was not visible).

## One-page sheet (paste into a printable doc)
```
916 DENT & DETAIL  |  Dealer and Fleet Rate Sheet
Mobile dent removal and detailing, on your lot. Greater Sacramento.
Precision · Care · Perfection.

PER-PANEL DENT REMOVAL (no paint, no body shop)
Tier  Dents on the panel                         Rate per panel
A     1-3 small dings (up to [OWNER size])       $[OWNER]
B     4-8 small dings or 1 medium ([OWNER size]) $[OWNER]
C     9+ dings, creases, or large ([OWNER size]) $[OWNER]
D     Hail panel: quote from photos              $[OWNER] per panel, tiered by count
Add-ons: aluminum panel +[OWNER]%  |  roof/hood with bracing +[OWNER]%  |  repainted or damaged paint: no guarantee
[OWNER: define "small", "medium", "large" with a coin or card reference size. Do not use a size you do not use in the field.]

DETAIL ADD-ONS (by vehicle size class)
Interior Reset (full interior)            $[OWNER] S / $[OWNER] M / $[OWNER] L
Paint Deep-Clean (clay + decon)           $[OWNER] S / $[OWNER] M / $[OWNER] L
Swirl & Scratch Erase                     quoted from photos
Gloss Shield                              quoted from photos

TERMS
Minimum per visit: $[OWNER]  |  Travel: included within [OWNER] miles of ZIP [OWNER], $[OWNER] beyond
Volume: [OWNER]% off at [OWNER] panels per month (optional)
Payment: [OWNER: due on completion / net __ days]; card or ACH [OWNER]
Quotes: from photos or a lot visit; valid [OWNER] days
Scheduling: [OWNER: lead time and weekdays]; rain/heat reschedule at no charge
Warranty: [OWNER: state only what you will honor, in writing]
Not covered: pre-existing paint damage, rust, prior body work, glass, interior damage by others
Insurance: Certificate of insurance on request. [OWNER: CONFIRM coverage (general liability, garage keepers if offered) and policy limits before this line goes on a printed sheet]
W-9 on request.
Contact: [OWNER NAME]  [OWNER PHONE]  [OWNER EMAIL]  https://[OWNER DOMAIN]/dealers
```

## Pricing logic (for the owner)
1. Set Tier A so a quick lot visit at the minimum is still profitable after fuel and time.
2. Dealers expect a discount from retail; the gap is yours to set from your costs.
3. Keep tiers per panel, not per dent, so it is easy to quote from a photo.
4. Test two dealers at different tiers; keep what closes.

## COI line to confirm (owner action)
Call your insurance broker and ask: general liability limit, garage keepers (covers a customer car in your care), commercial auto, and whether you can issue a certificate of insurance naming a dealership as certificate holder. Blogs say many dealers/property managers require proof (BookingKoala, https://www.bookingkoala.com/blog/mobile-detailing-business-license/, 2026-10-15; blog, not official; scout flagged ~$1M GL as a blog claim). Do not print "insured" until confirmed.

## Other items to confirm before dealer work (UNVERIFIED in research)
City/county business license(s) for the cities served; possible California Bureau of Automotive Repair registration question for PDR; stormwater rules if any wash is done on lot (Sacramento prohibits wash water to storm drain; `research/local-facts.md` section C). Ask a CA business/insurance advisor and BERC (916) 649-0225 / sacberc.org per scout summary (not called).

## /admin tie-in
Dealer jobs in /admin: customer type dealer, per-panel line items, invoice and payment records (SPEC Phase 3, Phase 5 dealer portal bulk submission). Verify field names when live.
