# Bing Places for Business: Setup (as of 2026-10-15)

Status: DRAFT. Owner executes. Sources: BrightLocal https://www.brightlocal.com/learn/how-to-add-or-claim-a-bing-places-for-business-listing/ ; Search Engine World https://www.searchengineworld.com/microsoft-introduces-the-new-bing-places-for-business ; Yext help https://help.yext.com/hc/en-us/articles/360001130466 (retrieved 2026-10-15; third-party). **Verify in dashboard.**

Time: ~15 min. Import from Google is the fastest path once the Google profile is verified.

## Steps
1. Finish and verify Google Business Profile first.
2. Go to https://www.bingplaces.com or bing.com/forbusiness (older guides use either). Sign in with a Microsoft account.
3. Search for the business name and phone. If a listing exists, choose Claim.
4. Otherwise choose "Import from Google", sign in to the Google account that owns the profile, pick the location, review the imported data (BrightLocal, 2026-10-15). A forum user reported no separate verification for imports; do not rely on that (anecdote).
5. Check the imported NAP against `nap-format.md`. Fix drift.
6. Service area: set as a service-area business with the address hidden if the form allows. Bing reportedly accepts City-type service areas only (Yext, third-party). Add the cities from `gbp/categories.md`.
7. Verify by phone, email (needs business-domain email) or postcard (BrightLocal: postcards slowest; 5-6 business days to 1-2 weeks, conflicting sources).
8. Add photos, hours, categories (Bing's own list: verify in dashboard).
9. Expect a publishing delay; one guide says 7-14 days (UNVERIFIED).

## Done check
Search Bing Maps for the business after publish. NAP matches. Log in tracker.
