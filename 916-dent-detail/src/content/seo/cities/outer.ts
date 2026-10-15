import type { CityDoc } from '../types';

export const westSacramento: CityDoc = {
  slug: 'west-sacramento',
  name: 'West Sacramento',
  title: 'Fleet & Mobile Detailing West Sacramento CA | 916 Dent & Detail',
  description: 'Mobile detailing, fleet cleaning and dent repair in West Sacramento, CA. Commercial vans and work trucks, with care about where wash water goes.',
  h1: 'Fleet-friendly detailing and dent repair in West Sacramento.',
  lede: 'Across the river from downtown, West Sacramento is more warehouse, port and work-truck than cul-de-sac. The work here leans commercial, and so does our attention to water.',
  distance: 'near',
  driveNote: 'West Sacramento is just across the river from downtown, a short drive from the middle of our area, so travel fees are modest.',
  places: [
    { name: 'Tower Bridge', note: 'the span connecting the city to Sacramento', sourced: true },
    { name: 'Raley Field', sourced: false },
    { name: 'the Port of West Sacramento', sourced: false },
    { name: 'Interstate 80 and Highway 50', sourced: false },
  ],
  sections: [
    {
      id: 'water',
      h2: 'Wash water in West Sacramento: a note on the rules',
      paras: [
        'West Sacramento publishes its own stormwater guidance for mobile cleaning. As we read the city\'s sheet, the practical advice is to check where water flows before you start, and to direct wash water toward vegetation or gravel, or to the sanitary sewer where that is possible, rather than allowing it into storm drains. We read it as general guidance, not as legal advice for any specific job, and a property owner who hires a contractor can be affected by what that contractor does on their site.',
        'In practice, this is why we prefer low-water methods for exterior work in commercial areas, and why a property that has strict rules should tell us at booking. If you are a property manager, ask us how we handle rinse water, and we will explain it plainly.',
      ],
    },
    {
      id: 'fleet',
      h2: 'Vans, work trucks and delivery vehicles',
      paras: [
        'Commercial vehicles in West Sacramento work hard and get parked tight, in yards and lots where bumpers meet pallets and sliding doors meet posts. A tidy fleet is also a form of advertising, and we hear from operators who want their vans to look professional without taking them out of service for a day.',
        'We can detail several vehicles in one visit, repair door dings on a sliding side panel or a cab and tell you plainly where a body shop is the better choice. Fleet pricing is quoted case by case, so call or text with the number and type of vehicles.',
      ],
    },
    {
      id: 'bridge',
      h2: 'Between two downtowns',
      paras: [
        'The Tower Bridge connects West Sacramento to the capital city, and many residents commute across it or work on the other side. For those people, a visit at home or at work on either side of the river is possible, and the booking flow checks your ZIP.',
      ],
    },
  ],
  jobs: [
    { job: 'Fleet van wash and interior reset', service: 'mobile-detailing', why: 'Commercial vehicles that need to look professional.' },
    { job: 'Sliding-door dings on work vans', service: 'door-ding-repair', why: 'Tight yards, loading docks and posts.' },
    { job: 'On-site recon for lots', service: 'dealership-recon', why: 'Rental and used-car lots near the freeways.' },
  ],
  faqs: [
    {
      q: 'Do you clean fleet vehicles?',
      a: 'Yes. Tell us how many vehicles, what type and where they park, and we will propose a plan and a price.',
    },
    {
      q: 'Where does your wash water go?',
      a: 'We use low-water methods and keep rinse water out of storm drains. If your site has specific rules, tell us when you book.',
    },
    {
      q: 'Can you repair dents on a cargo van?',
      a: 'Often, yes, if the paint is intact and the panel is reachable from behind. Send photos, and we will tell you what we see.',
    },
    {
      q: 'Will you come to a warehouse or yard?',
      a: 'Usually, with permission from the property. Tell us about access, gate codes and safety requirements.',
    },
  ],
  neighbors: ['sacramento', 'davis', 'natomas'],
  blogs: ['is-a-mobile-detailer-legit', 'how-long-does-mobile-detailing-take'],
  services: ['mobile-detailing', 'door-ding-repair', 'dealership-recon'],
};

export const davis: CityDoc = {
  slug: 'davis',
  name: 'Davis',
  title: 'Mobile Dent Repair & Detailing Davis CA | 916 Dent & Detail',
  description: 'Mobile dent repair and detailing in Davis, CA. Campus parking lot dings, bike-town street parking and dealership recon on Chiles Road. Photo quote first.',
  h1: 'Mobile dent repair and detailing in Davis.',
  lede: 'A university town of bikes, tight lots and student cars. Davis is at the far edge of our area, so we group visits there, and we say so up front.',
  distance: 'far',
  driveNote: 'Davis is toward the far edge of our service area, so a travel fee is likely. We group Davis visits where we can, and the booking flow shows the fee for your ZIP.',
  places: [
    { name: 'UC Davis', sourced: false },
    { name: 'the Chiles Road dealerships', note: 'Hanlees Chevrolet, Nissan and Toyota', sourced: true },
    { name: 'downtown Davis', sourced: false },
    { name: 'Mace Boulevard', sourced: false },
  ],
  sections: [
    {
      id: 'campus',
      h2: 'Campus parking and student cars',
      paras: [
        'Davis revolves around the university, and student and staff cars fill the lots around it. Crowded lots mean dings, and student budgets mean that cheap, quick fixes matter. Paintless repair of a small dent is often the sensible choice for a car that is still worth keeping in good shape, while a deep clean can be what makes a used car feel decent again.',
        'If you are a parent helping a student with a car, a photo sent from the student\'s phone is enough to start. We will give an honest range and tell you if the damage is not worth fixing.',
      ],
    },
    {
      id: 'bikes',
      h2: 'Bike-town habits and street parking',
      paras: [
        'Davis has a strong cycling culture. Handlebars tip over onto doors, a rack scrapes a quarter panel and cars share narrow streets with bikes and pedestrians. Most of the marks that result are on the shallow side, which suits paintless work. Scrapes that go through the paint are different, and we will tell you which kind you have.',
      ],
    },
    {
      id: 'dealers',
      h2: 'Chiles Road and recon on the lot',
      paras: [
        'Davis has a cluster of dealerships along Chiles Road, including Hanlees stores selling Chevrolet, Nissan and Toyota. We name them only as a landmark, not as customers. If you manage a lot in Davis, ask us about visit days, since the town is far enough that grouped appointments make the most sense for everyone.',
      ],
    },
    {
      id: 'travel',
      h2: 'Why Davis visits are batched',
      paras: [
        'We are mobile, but Davis is a fair distance from the middle of our area, and travel time is time we cannot spend on work. So we try to bundle jobs in one day, and a travel fee reflects the distance. If a friend or a neighbor also wants work done, tell us. Booking together can make the day more efficient and sometimes lower the cost for both.',
      ],
    },
  ],
  jobs: [
    { job: 'Campus-lot door dings', service: 'door-ding-repair', why: 'Crowded lots and student parking.' },
    { job: 'Rescue detail for a used car', service: 'interior-detailing', why: 'Student and shared cars that need a reset.' },
    { job: 'Dealer-lot prep on Chiles Road', service: 'dealership-recon', why: 'Grouped visits make sense for distance.' },
  ],
  faqs: [
    {
      q: 'Do you come all the way to Davis?',
      a: 'Yes, though it is near the edge of our area, so a travel fee is likely. The booking flow shows the exact amount for your ZIP.',
    },
    {
      q: 'Can a parent book for a student?',
      a: 'Yes. A photo and a car description are enough to start, and we coordinate the time with the student.',
    },
    {
      q: 'Can you fix a dent caused by a bike?',
      a: 'If the paint is intact, often yes. If the paint is scraped through, the dent can be reduced but the paint would need separate work.',
    },
    {
      q: 'How can I keep the travel fee down?',
      a: 'Book with a neighbor or on a day we are already in Davis. Ask when you contact us, and we will tell you if there is a visit day coming up.',
    },
    {
      q: 'Do you work in campus lots?',
      a: 'Campus lots may restrict outside contractors, so check the rules. We can usually work at a private address instead.',
    },
  ],
  neighbors: ['west-sacramento', 'sacramento'],
  blogs: ['dent-repair-cost-sacramento', 'dealership-trade-in-prep'],
  services: ['door-ding-repair', 'interior-detailing', 'dealership-recon'],
};

export const carmichael: CityDoc = {
  slug: 'carmichael',
  name: 'Carmichael',
  title: 'Tree Sap Removal & Detailing Carmichael CA | 916 Dent & Detail',
  description: 'Mobile detailing in Carmichael, CA, including safe tree sap removal, paint decontamination and dent repair. We come to your driveway. Photo quote first.',
  h1: 'Tree sap, shade and detailing in Carmichael.',
  lede: 'Mature trees are lovely, and they drop things on cars. If you park under a canopy in Carmichael, sap and canopy grime are the usual trouble.',
  distance: 'near',
  driveNote: 'Carmichael is a short drive east of the city of Sacramento, so travel fees are modest.',
  places: [
    { name: 'Fair Oaks Boulevard', sourced: false },
    { name: 'the American River', sourced: false },
    { name: 'shaded older neighborhoods', sourced: false },
  ],
  sections: [
    {
      id: 'sap',
      h2: 'Parking under trees, and what lands on the car',
      paras: [
        'General guidance on tree sap is consistent: sap on paint, in heat and sun, hardens and can etch the clear coat if it is left. Oak is often named as especially sticky, and sap tends to fall from spring into summer. We have no Carmichael-specific data, and we are not claiming any, but if you park under old trees you have probably seen the sticky dots on your hood and roof.',
        'Removing sap safely means softening it with the right solvent, lifting it without scrubbing and then neutralizing and protecting the paint. Rubbing hard with a dry cloth is how people put scratches in their paint. Our blog has a step-by-step explanation.',
      ],
    },
    {
      id: 'shade',
      h2: 'The upside of shade, and its hidden cost',
      paras: [
        'Shade is good for paint, and for you on a hot day. Cars parked under trees see less direct UV and stay cooler. The cost is the debris: leaves, pollen, bird droppings and sap that stay wet under the canopy and bake when the sun hits them. A coating or a sealant helps keep that mess from bonding, and regular washing keeps it from sitting.',
      ],
    },
    {
      id: 'older',
      h2: 'Older neighborhoods, long-kept cars',
      paras: [
        'If your car is a long-kept one from an older neighborhood, it has probably gained character and a few dents, and perhaps oxidized headlights and tired paint. A package that suits it is a decontamination wash, a light polish where the paint allows, headlight restoration and a dent or two removed paintlessly. It will not make a fifteen-year-old car look new, but it can take years off it.',
        'Some of the streets are narrow and some driveways steep. Tell us about access when you book, and if a large vehicle or a narrow drive makes parking close difficult, we will plan the setup.',
      ],
    },
  ],
  jobs: [
    { job: 'Sap removal and paint decontamination', service: 'paint-correction', why: 'Cars parked beneath mature trees.' },
    { job: 'Headlight clean-up on a long-kept car', service: 'headlight-restoration', why: 'Years of sun on older lenses.' },
    { job: 'Driveway detail', service: 'mobile-detailing', why: 'Leaf and pollen buildup under a canopy.' },
  ],
  faqs: [
    {
      q: 'Can tree sap damage my paint?',
      a: 'It can. Sap that bakes in the sun can etch the clear coat if left for a long time. Removing it promptly and gently is best.',
    },
    {
      q: 'Can I remove sap myself?',
      a: 'Small, fresh spots often come off with the right product and a soft cloth. Hard, old sap and large areas are riskier, and we can do it for you.',
    },
    {
      q: 'Will a coating stop sap sticking?',
      a: 'A coating or sealant can make sap easier to remove, but does not prevent it landing. Prompt cleaning is still needed.',
    },
    {
      q: 'Can you work on a steep or narrow driveway?',
      a: 'Usually. Tell us about the access, and we will plan the setup and tell you if anything is a problem.',
    },
  ],
  neighbors: ['sacramento', 'citrus-heights', 'rancho-cordova'],
  blogs: ['tree-sap-removal', 'how-often-to-wax-or-coat-central-valley'],
  services: ['paint-correction', 'headlight-restoration', 'mobile-detailing'],
};

export const graniteBay: CityDoc = {
  slug: 'granite-bay',
  name: 'Granite Bay',
  title: 'Ceramic Coating & Paint Correction Granite Bay | 916 Dent & Detail',
  description: 'Mobile ceramic coating, paint correction and dent repair in Granite Bay, CA. Careful work on high-value cars, done in your garage or driveway.',
  h1: 'Careful paint work for Granite Bay.',
  lede: 'Garage space suits patient work. For higher-value cars the usual requests are correction and coating, and dents removed without disturbing the finish.',
  distance: 'far',
  driveNote: 'Granite Bay is toward the far edge of our service area, so a travel fee is likely. The booking flow shows the amount for your ZIP.',
  places: [
    { name: 'Folsom Lake', sourced: false },
    { name: 'Douglas Boulevard', sourced: false },
    { name: 'Eureka Road', sourced: false },
  ],
  sections: [
    {
      id: 'garage',
      h2: 'The garage advantage',
      paras: [
        'A roomy garage suits the slowest, most careful work we do, and some homes here have one. A coating or multi-stage correction needs controlled light, no wind and no sun on the panels. In a roomy garage, we can run a proper process: a full decontamination, test spots, systematic correction and a clean application with an overnight cure.',
        'If you have a three-car garage and a project car, a daily driver and a family SUV, tell us. A day on site can handle more than one vehicle, and the travel fee is spread across them.',
      ],
    },
    {
      id: 'value',
      h2: 'Higher-value cars call for a lighter touch',
      paras: [
        'When a car is worth a lot, restraint matters. We measure paint thickness before heavy polishing, because removing more clear coat than necessary is a loss you cannot reverse. We prefer paintless dent repair to anything that touches paint, and if a dent or a scratch calls for body-shop work, we say so, rather than overreach.',
        'Specialty finishes such as matte, satin and some wraps are not the same as gloss paint. Do not let anyone machine-polish a matte finish. Tell us if your car has one, and we will tell you what we can and cannot do.',
      ],
    },
    {
      id: 'travel',
      h2: 'Travel, honestly',
      paras: [
        'Granite Bay is near the edge of our area, and the drive adds time and a fee. We think that is a fair trade for a service that comes to your door, particularly for long jobs like coating, where you would otherwise leave the car at a shop for days. The fee is visible in the booking flow before you commit to anything.',
      ],
    },
  ],
  jobs: [
    { job: 'Multi-stage correction and coating', service: 'ceramic-coating', why: 'Large garages and long-kept, well-kept cars.' },
    { job: 'Light dent removal on a newer luxury car', service: 'paintless-dent-repair', why: 'Keeping the factory finish intact.' },
    { job: 'Seasonal paint refresh', service: 'paint-correction', why: 'Cars that sit outdoors through summer.' },
  ],
  faqs: [
    {
      q: 'Can you coat my car in my garage?',
      a: 'Yes, and it is the best place for it. Tell us about the garage size, lighting and power, and we will plan the day.',
    },
    {
      q: 'Is there a travel fee for Granite Bay?',
      a: 'Likely, because it is near the edge of our area. The booking flow shows the amount before you pay.',
    },
    {
      q: 'Can you work on matte or satin paint?',
      a: 'We can clean and care for it, but matte finishes cannot be polished like gloss paint. Tell us the finish, and we will advise.',
    },
    {
      q: 'Can you do two cars in one visit?',
      a: 'Often yes. It is more efficient for travel, and we can plan the sequence once we know the vehicles.',
    },
  ],
  neighbors: ['folsom', 'roseville', 'el-dorado-hills'],
  blogs: ['ceramic-coating-in-valley-heat', 'how-often-to-wax-or-coat-central-valley'],
  services: ['ceramic-coating', 'paint-correction', 'paintless-dent-repair'],
};
