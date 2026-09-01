/**
 * City pages. Each one must earn its place: unique copy, real local detail,
 * real ZIPs. Thin, find-and-replace city pages are the #1 way local service
 * sites get filtered out of Google's index — do not clone these.
 *
 * TODO: verify every local detail before launch, and add a city only when you
 * genuinely buy there.
 */
export const cities = [
  {
    slug: 'dallas',
    name: 'Dallas',
    metro: 'Dallas–Fort Worth',
    county: 'Dallas County',
    zips: ['75201', '75208', '75216', '75224', '75228', '75232', '75241'],
    neighborhoods: [
      'Oak Cliff',
      'Pleasant Grove',
      'East Dallas',
      'Casa View',
      'Lake Highlands',
      'South Dallas',
      'Vickery Meadow',
    ],
    intro:
      'Dallas has two housing markets running side by side: renovated homes ' +
      'that sell in a weekend, and everything else. If your house needs a roof, ' +
      'foundation work, or a full interior update, it competes against move-in ' +
      'ready listings — and buyers with FHA financing often cannot close on it ' +
      'at all. We buy those houses directly, as-is, in cash.',
    localNote:
      'Foundation movement is normal in North Texas clay soil. We price it into ' +
      'the offer instead of asking you to fix it — no piers, no engineer report, ' +
      'no repair escrow.',
    market:
      'Dallas County median days on market runs meaningfully longer for homes ' +
      'listed in "needs work" condition, and every extra month is another ' +
      'mortgage payment, tax bill and insurance premium out of your pocket.',
  },
  {
    slug: 'fort-worth',
    name: 'Fort Worth',
    metro: 'Dallas–Fort Worth',
    county: 'Tarrant County',
    zips: ['76104', '76105', '76110', '76112', '76119', '76133', '76140'],
    neighborhoods: [
      'Poly',
      'Como',
      'Riverside',
      'Stop Six',
      'Wedgwood',
      'Meadowbrook',
      'Northside',
    ],
    intro:
      'A lot of Fort Worth housing stock is pre-1970, and older homes come with ' +
      'older problems: cast iron sewer lines, aluminum wiring, original HVAC. ' +
      'Those are the exact items that blow up a traditional sale at inspection. ' +
      'We buy them anyway, and we do not renegotiate after the inspection.',
    localNote:
      'We regularly buy Fort Worth rentals with tenants still in place. You do ' +
      'not have to evict anyone or wait for a lease to end.',
    market:
      'Tarrant County tax bills and rising insurance premiums have pushed a lot ' +
      'of long-time owners to sell. Holding a vacant house through a six-month ' +
      'listing is often more expensive than the discount on a cash sale.',
  },
  {
    slug: 'arlington',
    name: 'Arlington',
    metro: 'Dallas–Fort Worth',
    county: 'Tarrant County',
    zips: ['76001', '76010', '76011', '76013', '76015', '76017'],
    neighborhoods: [
      'East Arlington',
      'Dalworthington Gardens area',
      'Southeast Arlington',
      'North Arlington',
      'Pantego area',
    ],
    intro:
      'Arlington is a landlord-heavy market, and we buy a lot of tired rentals ' +
      'here — properties with deferred maintenance, mid-lease tenants, or a ' +
      'turnover bill the owner does not want to pay. Sell it occupied, as-is, ' +
      'and let us handle the rest.',
    localNote:
      'Inherited a property near the entertainment district or UTA? We buy ' +
      'probate and estate properties and can wait on your court timeline.',
    market:
      'Between the stadiums and the university, Arlington rentals turn over ' +
      'constantly. If you are done being a landlord, you can be out in a week.',
  },
  {
    slug: 'plano',
    name: 'Plano',
    metro: 'Dallas–Fort Worth',
    county: 'Collin County',
    zips: ['75023', '75074', '75075', '75023', '75093'],
    neighborhoods: [
      'Old Towne Plano',
      'Douglass Community',
      'Hunters Glen',
      'Los Rios',
      'Central Plano',
    ],
    intro:
      'Plano homes sell — but the 1970s and 1980s original-condition houses in ' +
      'central Plano sell at a discount and only after months of showings. If ' +
      'you are relocating for work and cannot carry two mortgages, a cash close ' +
      'on your date is usually worth more than the extra list price.',
    localNote:
      'Corporate relocation on a deadline? Tell us your report date and we will ' +
      'close around it — including a short rent-back if you need to stay.',
    market:
      'Collin County property taxes make holding an empty house expensive. A ' +
      'seven-day close stops the bleeding.',
  },
  {
    slug: 'garland',
    name: 'Garland',
    metro: 'Dallas–Fort Worth',
    county: 'Dallas County',
    zips: ['75040', '75041', '75042', '75043', '75044'],
    neighborhoods: [
      'Downtown Garland',
      'Duck Creek',
      'South Garland',
      'Club Hill',
      'Camelot',
    ],
    intro:
      'Garland is full of solid mid-century homes owned by the same family for ' +
      'decades. When those houses transfer — usually through an estate — they ' +
      'need everything: kitchen, baths, systems, roof. Heirs rarely want to ' +
      'fund that renovation from out of state. We take it as-is.',
    localNote:
      'We can buy from multiple heirs and coordinate directly with your probate ' +
      'attorney and the title company so nobody has to fly in.',
    market:
      'Estate sales dominate this submarket. Clearing the house — furniture and ' +
      'all — is included in what we do.',
  },
  {
    slug: 'irving',
    name: 'Irving',
    metro: 'Dallas–Fort Worth',
    county: 'Dallas County',
    zips: ['75038', '75060', '75061', '75062', '75063'],
    neighborhoods: [
      'South Irving',
      'Valley Ranch',
      'Las Colinas area',
      'Bear Creek',
      'Northwest Irving',
    ],
    intro:
      'Irving sits on top of the DFW Airport job corridor, which means a lot of ' +
      'sudden moves. If a transfer, a job loss, or a family change means you ' +
      'need to be out fast, you should not have to spend $15,000 getting a ' +
      'house ready for strangers to walk through.',
    localNote:
      'Behind on payments? Contact us before the first Tuesday auction date — ' +
      'in Texas the foreclosure timeline moves fast and options narrow quickly.',
    market:
      'Irving has a wide mix of 1960s ranches and 1980s duplexes. We buy both, ' +
      'including small multifamily.',
  },
  {
    slug: 'mesquite',
    name: 'Mesquite',
    metro: 'Dallas–Fort Worth',
    county: 'Dallas County',
    zips: ['75149', '75150', '75180', '75181', '75182'],
    neighborhoods: [
      'Town East',
      'Creek Crossing',
      'Casa Linda area',
      'Northwest Mesquite',
      'Balch Springs border',
    ],
    intro:
      'Mesquite is an affordable, owner-occupied market where a failed ' +
      'inspection can kill a deal outright — most buyers here are financed and ' +
      'their lender will not fund a house with an active roof leak or a dead ' +
      'HVAC. A cash buyer removes the lender from the equation entirely.',
    localNote:
      'Storm damage is a recurring issue here. We buy hail- and water-damaged ' +
      'houses whether or not you filed an insurance claim.',
    market:
      'If your house has already fallen out of contract once, that history ' +
      'follows the listing. We do not care about days on market.',
  },
  {
    slug: 'grand-prairie',
    name: 'Grand Prairie',
    metro: 'Dallas–Fort Worth',
    county: 'Dallas & Tarrant Counties',
    zips: ['75050', '75051', '75052', '75054'],
    neighborhoods: [
      'Dalworth Park',
      'Central Grand Prairie',
      'South Grand Prairie',
      'Westchester',
    ],
    intro:
      'Grand Prairie straddles two counties, which means two tax offices, two ' +
      'sets of records, and title work that can get messy — especially on ' +
      'inherited property or houses with old liens. We buy through a local ' +
      'title company that untangles it.',
    localNote:
      'Liens, back taxes, or a clouded title do not automatically kill a sale. ' +
      'Most are paid out of proceeds at closing. Tell us and we will check.',
    market:
      'We buy in both the Dallas County and Tarrant County halves of the city, ' +
      'including properties with unpermitted additions.',
  },
  {
    slug: 'houston',
    name: 'Houston',
    metro: 'Houston',
    county: 'Harris County',
    zips: ['77016', '77026', '77033', '77051', '77076', '77087', '77093'],
    neighborhoods: [
      'Acres Homes',
      'Sunnyside',
      'Northside',
      'Third Ward',
      'Kashmere Gardens',
      'Denver Harbor',
      'Sharpstown',
    ],
    intro:
      'Houston has no zoning, gumbo clay under most of it, and a flood history ' +
      'that follows a house through every future sale. That combination puts a ' +
      'lot of otherwise sound homes outside what a financed retail buyer will ' +
      'touch. We buy those directly, flood history and all.',
    localNote:
      'Flooded before? We buy houses with prior flood damage whether or not you ' +
      'filed a claim, and whether or not the house has been remediated. You still ' +
      'need to disclose it — but with us it does not kill the deal.',
    market:
      'Insurance is the quiet problem here. Premiums and deductibles have climbed ' +
      'far enough that some owners are carrying a house they cannot afford to ' +
      'insure properly, which is its own reason to sell.',
  },
  {
    slug: 'pasadena',
    name: 'Pasadena',
    metro: 'Houston',
    county: 'Harris County',
    zips: ['77502', '77503', '77504', '77505', '77506'],
    neighborhoods: [
      'North Pasadena',
      'Golden Acres',
      'Red Bluff',
      'South Pasadena',
      'Deer Park border',
    ],
    intro:
      'Most of Pasadena went up between the 1950s and 1970s for refinery ' +
      'families, and much of that stock is still on its original systems. ' +
      'Aluminum wiring, cast iron drains and single-pane windows are the sort of ' +
      'thing an inspector finds and a lender balks at.',
    localNote:
      'Storm and hail damage is routine on this side of Harris County. We buy ' +
      'damaged houses as-is, and you keep any insurance proceeds you have already ' +
      'been paid unless the policy says otherwise.',
    market:
      'These are affordable, owner-occupied streets where nearly every buyer is ' +
      'financed. Remove the lender from the transaction and a house that could ' +
      'not sell suddenly can.',
  },
  {
    slug: 'katy',
    name: 'Katy',
    metro: 'Houston',
    county: 'Harris, Fort Bend & Waller Counties',
    zips: ['77449', '77450', '77493', '77494'],
    neighborhoods: [
      'Old Katy',
      'Cinco Ranch area',
      'Katy Mills area',
      'Nottingham Country',
      'Mason Creek',
    ],
    intro:
      'Katy is newer stock, so the houses we buy here are usually about ' +
      'circumstance rather than condition: a relocation on a deadline, a rental ' +
      'that stopped penciling, an estate nobody local can manage. We also buy in ' +
      'the reservoir-affected areas west of the city.',
    localNote:
      'Property inside or near the Addicks and Barker flood pools carries a ' +
      'history that scares off retail buyers. Bring it to us — we price it and ' +
      'we close.',
    market:
      'Three counties meet around Katy, which means three tax offices and title ' +
      'work that can get complicated. Our title company handles that, not you.',
  },
  {
    slug: 'san-antonio',
    name: 'San Antonio',
    metro: 'San Antonio',
    county: 'Bexar County',
    zips: ['78207', '78210', '78214', '78220', '78228', '78237', '78242'],
    neighborhoods: [
      'West Side',
      'South Side',
      'Denver Heights',
      'Highland Park',
      'Harlandale',
      'Government Hill',
    ],
    intro:
      'A lot of San Antonio housing has been in the same family for two or three ' +
      'generations, and it transfers through an estate rather than a listing. ' +
      'Those houses are usually original condition and often held by several ' +
      'heirs at once. That is the exact transaction we are built for.',
    localNote:
      'Military move? We work around PCS orders and can close on a date that fits ' +
      'your report date, including a short rent-back if you need it.',
    market:
      'Older Bexar County homes on pier-and-beam with 1950s systems rarely clear ' +
      'an FHA or VA appraisal without work. We do not use an appraisal at all.',
  },
  {
    slug: 'converse',
    name: 'Converse',
    metro: 'San Antonio',
    county: 'Bexar County',
    zips: ['78109', '78148', '78154'],
    neighborhoods: [
      'Converse proper',
      'Universal City border',
      'Schertz border',
      'Randolph AFB area',
    ],
    intro:
      'Converse is heavily rental, largely because of the bases nearby, and we ' +
      'buy a steady stream of tired rentals here — mid-lease, post-turnover, or ' +
      'simply owned by someone two states away who is done managing it.',
    localNote:
      'We buy with tenants in place and honor the lease. No eviction, no ' +
      'make-ready, no vacancy while you wait for a retail buyer.',
    market:
      'Out-of-state landlords are common in this submarket. Everything can be ' +
      'signed remotely and the funds wired — you never have to fly in.',
  },
  {
    slug: 'austin',
    name: 'Austin',
    metro: 'Austin',
    county: 'Travis County',
    zips: ['78721', '78723', '78724', '78741', '78744', '78745', '78753'],
    neighborhoods: [
      'East Austin',
      'Montopolis',
      'Dove Springs',
      'St. Johns',
      'Rundberg',
      'South Congress area',
    ],
    intro:
      'In much of Austin the land is worth more than the house standing on it, ' +
      'which changes the whole calculation. Owners of older east-side and ' +
      'south-side homes are often sitting on real value inside a structure that ' +
      'would cost a fortune to bring up to retail standard.',
    localNote:
      'Appraisal increases have pushed tax bills past what some long-time owners ' +
      'can carry, especially after an exemption is lost. If that is where you ' +
      'are, get a number before it becomes urgent.',
    market:
      'We buy tear-down candidates, lots with unpermitted additions, and houses ' +
      'where a retail listing would mean months of showings you do not want.',
  },
  {
    slug: 'round-rock',
    name: 'Round Rock',
    metro: 'Austin',
    county: 'Williamson County',
    zips: ['78664', '78665', '78681'],
    neighborhoods: [
      'Old Town Round Rock',
      'Chandler Creek',
      'Meadow Lake',
      'Forest Creek area',
    ],
    intro:
      'Round Rock sales are usually driven by a date rather than a defect — a ' +
      'transfer, a divorce, a job change at one of the big employers up the ' +
      'corridor. When you need certainty about when you close, a financed buyer ' +
      'is the wrong tool.',
    localNote:
      'Relocating and cannot carry two housing payments? Tell us your move date ' +
      'and we will work backward from it.',
    market:
      'The 1980s and 1990s stock here shows its age at inspection: original ' +
      'HVAC, aging roofs, and slab movement. We buy without asking you to fix ' +
      'any of it.',
  },
];

export const cityBySlug = Object.fromEntries(cities.map((c) => [c.slug, c]));

/** Metro name -> its cities, in the order they appear above. */
export const metros = cities.reduce((acc, c) => {
  (acc[c.metro] = acc[c.metro] || []).push(c);
  return acc;
}, {});

/** The first city listed for each metro — used where a short list is wanted. */
export const metroHubs = Object.values(metros).map((group) => group[0]);
