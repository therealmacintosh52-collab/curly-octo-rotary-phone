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
];

export const cityBySlug = Object.fromEntries(cities.map((c) => [c.slug, c]));
