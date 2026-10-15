# GBP Business Description (max 750 characters)

Status: DRAFT. Owner pastes it into the profile (Edit profile > About > Description). Nothing here has been posted.

Rules applied (sources: BrightLocal summary of Google's description rules, https://www.brightlocal.com/learn/google-business-profile-description/, retrieved 2026-10-15; third-party, so confirm in the dashboard): 750 character cap, no links or HTML, no prices or promotions, describe the business itself. Only the first ~250 characters show before "more" (Vendasta via search, retrieved 2026-10-15), so the offer leads.

## Copy (paste this block only)

```
916 Dent & Detail comes to you across Greater Sacramento. We remove dings and dents with no paint and no body shop, so your car keeps its original finish. We also erase swirls and light scratches, apply Gloss Shield ceramic coating, deep-clean paint, and reset interiors. Hail damage, door dings, parking-lot creases: send a photo and get a price before you book. We work at your home, your office or your lot in Sacramento, Elk Grove, Roseville, Folsom, Rancho Cordova, Citrus Heights, Natomas, West Sacramento, Davis and nearby. Dealers and fleets: ask about wholesale programs. Precision. Care. Perfection. Tap Book to get a price from a photo.
```

## Character count check
Run this (the repo's final check does it too):

```
python3 -c "import re,sys;t=open('916-dent-detail/marketing/gbp/description-750.md').read().split('```')[1].strip();print(len(t));assert len(t)<=750"
```

## Notes
- The city list is a draft. Owner removes any city beyond a realistic drive from the base (Google: service areas should be within about 2 hours of driving, up to 20 areas; https://support.google.com/business/answer/3038177, retrieved 2026-10-15 via scout).
- Do not add years in business, awards, or review counts unless [OWNER] confirms them as true.
