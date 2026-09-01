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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
    state: 'Texas',
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
  {
    slug: 'los-angeles',
    name: 'Los Angeles',
    state: 'California',
    metro: 'Los Angeles',
    county: 'Los Angeles County',
    zips: ['90003', '90011', '90044', '90059', '90063', '91331', '91405'],
    neighborhoods: [
      'South LA',
      'Watts',
      'Boyle Heights',
      'Highland Park',
      'Sylmar',
      'Panorama City',
      'Pacoima',
    ],
    intro:
      'A lot of Los Angeles houses carry more value in the dirt than in the ' +
      'structure, and the ones that transfer through an estate are often on ' +
      'original 1950s systems with decades of unpermitted work behind them. ' +
      'Renovating to retail standard here costs more than most families want to ' +
      'front. We buy them as they are.',
    localNote:
      'Rent-controlled units, soft-story retrofit orders and unpermitted ADUs do ' +
      'not stop us. Those are the exact things that make a retail buyer walk, ' +
      'and they are ordinary for us.',
    market:
      'Probate and trust sales are a large share of what moves in this market. ' +
      'We work with the estate attorney and the court timeline rather than ' +
      'pushing you to close before you legally can.',
  },
  {
    slug: 'riverside',
    name: 'Riverside',
    state: 'California',
    metro: 'Inland Empire',
    county: 'Riverside County',
    zips: ['92501', '92503', '92504', '92507', '92509'],
    neighborhoods: [
      'Casa Blanca',
      'Eastside',
      'Arlanza',
      'La Sierra',
      'Northside',
    ],
    intro:
      'The Inland Empire has long commutes, hard summers on aging HVAC, and a ' +
      'lot of owners who bought at the wrong point in a cycle. When a house here ' +
      'needs a roof and a system replacement at once, the repair bill often ' +
      'exceeds what the owner can raise.',
    localNote:
      'Behind on payments? California runs a non-judicial foreclosure timeline ' +
      'that moves on notice deadlines. The earlier you call, the more choices ' +
      'you still have.',
    market:
      'We buy owner-occupied homes and small rentals alike, including properties ' +
      'with permit problems from additions done without the county.',
  },
  {
    slug: 'san-bernardino',
    name: 'San Bernardino',
    state: 'California',
    metro: 'Inland Empire',
    county: 'San Bernardino County',
    zips: ['92404', '92405', '92407', '92410', '92411'],
    neighborhoods: [
      'Muscoy',
      'Del Rosa',
      'Arrowhead',
      'Highland border',
      'Waterman Gardens area',
    ],
    intro:
      'San Bernardino has more vacant and code-flagged property than almost ' +
      'anywhere else in the region. A house sitting empty here collects ' +
      'citations, copper theft and an insurer who will not renew — and the ' +
      'longer it sits the fewer buyers will touch it.',
    localNote:
      'Open code cases and city citations transfer to us at closing. Bring the ' +
      'letter; it is not the obstacle you have been told it is.',
    market:
      'Wildfire risk has made insurance hard to place across parts of this ' +
      'county. If your carrier non-renewed you, that alone is a reason a retail ' +
      'buyer cannot finance the house.',
  },
  {
    slug: 'sacramento',
    name: 'Sacramento',
    state: 'California',
    metro: 'Sacramento',
    county: 'Sacramento County',
    zips: ['95815', '95820', '95821', '95823', '95838'],
    neighborhoods: [
      'Del Paso Heights',
      'Oak Park',
      'North Highlands',
      'Arden-Arcade',
      'Meadowview',
    ],
    intro:
      'Sacramento is full of post-war tract housing that has been rented for ' +
      'thirty years and never updated. Those are the properties we buy most: ' +
      'tired rentals, inherited homes, and houses where the make-ready would ' +
      'cost more than a year of rent.',
    localNote:
      'Statewide tenant protections make removing a tenant slow and expensive. ' +
      'Sell to us with the tenant in place instead — the lease comes with the ' +
      'house and we honor it.',
    market:
      'Parts of the county sit behind aging levees, and flood-zone status alone ' +
      'narrows the buyer pool. It does not change our offer process.',
  },
  {
    slug: 'fresno',
    name: 'Fresno',
    state: 'California',
    metro: 'Central Valley',
    county: 'Fresno County',
    zips: ['93701', '93702', '93703', '93706', '93728'],
    neighborhoods: [
      'Tower District',
      'Southwest Fresno',
      'Sunnyside',
      'Central Fresno',
      'Pinedale',
    ],
    intro:
      'Fresno housing is older and more affordable than the coast, which means ' +
      'nearly every retail buyer here is financed — and a lender will not fund a ' +
      'house with a failing roof, a red-tagged panel or an inoperable heater. ' +
      'That is the gap we fill.',
    localNote:
      'Expansive valley soil moves foundations the same way clay does elsewhere. ' +
      'We price it in rather than sending you to get piers installed.',
    market:
      'We buy inherited homes, tired rentals and vacant properties across the ' +
      'county, including houses that already fell out of escrow once.',
  },
  {
    slug: 'bakersfield',
    name: 'Bakersfield',
    state: 'California',
    metro: 'Central Valley',
    county: 'Kern County',
    zips: ['93304', '93305', '93306', '93307', '93308'],
    neighborhoods: [
      'Oildale',
      'East Bakersfield',
      'Greenfield',
      'Old Town Kern',
      'Casa Loma',
    ],
    intro:
      'Kern County runs on an industry with hard cycles, and housing here ' +
      'follows it. We see owners who took a hit, landlords who are done, and ' +
      'families holding a parent\u2019s house from four hours away.',
    localNote:
      'Out of the area? Sign remotely with a mobile notary and we wire the ' +
      'funds. You never have to drive down for the closing.',
    market:
      'Much of the stock predates 1970. Original wiring, evaporative cooling and ' +
      'end-of-life roofs are normal here, and normal for us to buy.',
  },
  {
    slug: 'jacksonville',
    name: 'Jacksonville',
    state: 'Florida',
    metro: 'Jacksonville',
    county: 'Duval County',
    zips: ['32206', '32208', '32209', '32210', '32218', '32244', '32254'],
    neighborhoods: [
      'Northside',
      'Westside',
      'Arlington',
      'Murray Hill',
      'Springfield',
      'Southside',
    ],
    intro:
      'Jacksonville is geographically enormous and full of affordable, aging ' +
      'stock. The thing that kills sales here is not price, it is the roof: ' +
      'Florida insurers routinely refuse to write a policy on an older roof, and ' +
      'no policy means no mortgage means no retail buyer.',
    localNote:
      'Roof at end of life? That is a reason to call us, not a reason to spend ' +
      '$18,000 first. We buy the house with the roof it has.',
    market:
      'We buy inherited homes, tired rentals and storm-damaged property across ' +
      'Duval and the surrounding counties.',
  },
  {
    slug: 'tampa',
    name: 'Tampa',
    state: 'Florida',
    metro: 'Tampa Bay',
    county: 'Hillsborough County',
    zips: ['33604', '33605', '33610', '33612', '33614', '33619'],
    neighborhoods: [
      'Sulphur Springs',
      'East Tampa',
      'Seminole Heights',
      "Town 'N' Country",
      'Palm River',
    ],
    intro:
      'Tampa combines three things that scare retail buyers at once: flood zones, ' +
      'sinkhole history, and insurance premiums that have doubled for some ' +
      'owners. A house with any of that on its record sits, even in a strong ' +
      'market.',
    localNote:
      'Prior sinkhole activity or a remediated claim does not disqualify a house ' +
      'with us. You still disclose it — we still buy it.',
    market:
      'Elevation certificates and flood insurance requirements can add hundreds ' +
      'a month to a buyer\u2019s payment. We pay cash, so none of that applies.',
  },
  {
    slug: 'st-petersburg',
    name: 'St. Petersburg',
    state: 'Florida',
    metro: 'Tampa Bay',
    county: 'Pinellas County',
    zips: ['33701', '33705', '33711', '33713', '33714'],
    neighborhoods: [
      'Childs Park',
      'Lealman',
      'Historic Kenwood',
      'Bartlett Park',
      'Gulfport border',
    ],
    intro:
      'Pinellas is dense, low-lying and full of small mid-century bungalows and ' +
      'block homes. Many are lovely and many are one storm away from a claim ' +
      'their owner cannot afford the deductible on.',
    localNote:
      'Storm-damaged, tarped, or mid-claim — we buy in that condition. Talk to ' +
      'us before you sign anything with a restoration company that wants your ' +
      'claim assigned to them.',
    market:
      'Flood elevation rules mean substantial repairs can trigger requirements ' +
      'to elevate the structure. That stops most buyers cold. It does not stop ' +
      'us.',
  },
  {
    slug: 'orlando',
    name: 'Orlando',
    state: 'Florida',
    metro: 'Orlando',
    county: 'Orange County',
    zips: ['32805', '32808', '32811', '32818', '32822', '32839'],
    neighborhoods: [
      'Pine Hills',
      'Parramore',
      'Azalea Park',
      'Union Park',
      'Rosemont',
    ],
    intro:
      'Central Florida has an unusually high share of out-of-state owners — ' +
      'people who bought a rental near the parks, or inherited a parent\u2019s ' +
      'house after they retired here. Managing a tired property from another ' +
      'state is where most of our Orlando calls start.',
    localNote:
      'We buy occupied rentals and short-term-rental properties, including ones ' +
      'where the HOA or the county has changed the rules on you.',
    market:
      'Insurance and rising HOA assessments have flipped the math on a lot of ' +
      'these properties. If it no longer pencils, we will give you a number.',
  },
  {
    slug: 'cape-coral',
    name: 'Cape Coral',
    state: 'Florida',
    metro: 'Southwest Florida',
    county: 'Lee County',
    zips: ['33904', '33909', '33914', '33990', '33993'],
    neighborhoods: [
      'Southwest Cape',
      'Pelican',
      'Northeast Cape',
      'Gator Circle area',
      'Burnt Store corridor',
    ],
    intro:
      'Southwest Florida is still working through storm damage, and plenty of ' +
      'owners are holding a house they have neither the money nor the appetite ' +
      'to rebuild. Contractor waits are long and insurance settlements rarely ' +
      'cover the whole job.',
    localNote:
      'Storm-damaged, half-repaired, or gutted to the studs — those are ordinary ' +
      'purchases for us. So are vacant lots left after a teardown.',
    market:
      'Canal-front and flood-zone property comes with elevation and permitting ' +
      'complications that a cash purchase simply absorbs.',
  },
  {
    slug: 'lakeland',
    name: 'Lakeland',
    state: 'Florida',
    metro: 'Orlando',
    county: 'Polk County',
    zips: ['33801', '33803', '33805', '33810', '33815'],
    neighborhoods: [
      'Dixieland',
      'Webster Park',
      'North Lakeland',
      'Kathleen',
      'Combee Settlement',
    ],
    intro:
      'Polk County sits between Tampa and Orlando and has grown fast around a ' +
      'core of much older housing. The homes we buy here are usually the older ' +
      'ones: inherited, long-rented, or held by someone who has moved on and ' +
      'kept paying the taxes out of habit.',
    localNote:
      'Paying taxes and insurance on a house nobody lives in? That is money out ' +
      'the door every month. One call gets you a number to compare against it.',
    market:
      'Manufactured and mobile homes on owned land are common here. Tell us what ' +
      'you have and we will tell you straight whether we buy it.',
  },
];

export const cityBySlug = Object.fromEntries(cities.map((c) => [c.slug, c]));

const slugify = (v) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** URLs are hierarchical: /we-buy-houses/<state>/<city>/ */
export const stateSlug = (stateName) => slugify(stateName);
export const statePath = (stateName) => `/we-buy-houses/${slugify(stateName)}/`;
export const cityPath = (c) => `/we-buy-houses/${slugify(c.state)}/${c.slug}/`;

/** Metro name -> its cities, in the order they appear above. */
export const metros = cities.reduce((acc, c) => {
  (acc[c.metro] = acc[c.metro] || []).push(c);
  return acc;
}, {});

/** State name -> { metro -> cities }. Drives every geographic grouping. */
export const statesTree = cities.reduce((acc, c) => {
  acc[c.state] = acc[c.state] || {};
  (acc[c.state][c.metro] = acc[c.state][c.metro] || []).push(c);
  return acc;
}, {});

/** State name -> flat city list. */
export const citiesByState = cities.reduce((acc, c) => {
  (acc[c.state] = acc[c.state] || []).push(c);
  return acc;
}, {});

export const stateNames = Object.keys(citiesByState);

/** The first city listed for each metro — used where a short list is wanted. */
export const metroHubs = Object.values(metros).map((group) => group[0]);

/** The first city listed for each state. */
export const stateHubs = Object.values(citiesByState).map((group) => group[0]);
