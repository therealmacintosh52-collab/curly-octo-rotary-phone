import type { CityDoc } from '../types';

export const sacramento: CityDoc = {
  slug: 'sacramento',
  name: 'Sacramento',
  title: 'Dent Repair & Detailing Sacramento CA | 916 Dent & Detail',
  description: 'Mobile dent repair and car detailing in Sacramento, CA. We come to Midtown, downtown, East Sac and beyond. Photo quote first, no body shop.',
  h1: 'Mobile dent repair and detailing across the city of Sacramento.',
  lede: 'Street parking, office garages, apartment lots and a lot of sun. Sacramento is where most of our calls come from, and the work follows the way people here park.',
  distance: 'near',
  driveNote: 'Sacramento proper is a short drive from where we start the day, so travel fees are modest for most addresses in the city.',
  places: [
    { name: 'the State Capitol', sourced: true },
    { name: 'Old Sacramento', note: 'the riverfront historic district', sourced: true },
    { name: 'Tower Bridge', sourced: true },
    { name: "Sutter's Fort", sourced: true },
    { name: 'Golden 1 Center', note: 'downtown arena', sourced: true },
    { name: 'Midtown and East Sacramento street parking', sourced: false },
    { name: 'Arden Fair', note: 'shopping mall', sourced: false },
    { name: 'Auburn Boulevard', note: 'dealer strip', sourced: false },
  ],
  sections: [
    {
      id: 'street',
      h2: 'Street-parked cars collect dings',
      paras: [
        'In the older grid of the city, from Midtown out through East Sacramento, a great many people park on the street overnight. Tight spaces between neighbors, narrow curbside gaps and passing traffic make door dings, mirror knocks and shopping-cart marks a normal part of life. A mobile visit suits this well: we can usually work right at the curb, in front of your house or apartment, as long as there is room to open doors and a safe place for us to stand.',
        'If you live in a building with permit parking or a gated garage, tell us when you book. We will ask for the space, the level and any access code, so that the visit does not turn into a hunt for a parking spot.',
      ],
    },
    {
      id: 'downtown',
      h2: 'Downtown workdays and the capitol-area commute',
      paras: [
        'The state government and the county are major employers in Sacramento, and many of those jobs are downtown, around the Capitol. Cars that spend the workday in a garage or a surface lot are parked tightly and for long hours, and that is where dings multiply. Our office-lot visits are designed for exactly that: you book a window, we set up near where the car is parked, and the dent is gone by the time you finish your afternoon meetings.',
        'Check first with your building manager or the garage operator. Some garages restrict work on site, while many surface lots allow it. If there is any doubt, we can meet at your home instead.',
      ],
    },
    {
      id: 'trees',
      h2: 'Shade trees, sap and summer sun',
      paras: [
        'Sacramento is known for its tree-lined streets, and shade is a mercy in July. Trees drop sap, blossoms and berries on parked cars, though, and the heat bakes them in. A few weeks of sap on the hood can turn into a stubborn patch that wants more than a car wash. If that is your car, our detailing and paint-correction services handle it, and our blog has a practical guide to getting sap off safely.',
        'Summer here also means regular stretches over 100 degrees. We often schedule exterior work for early in the day and ask to move cars into shade, because polish, wax and coatings behave badly on a hot panel.',
      ],
    },
  ],
  jobs: [
    { job: 'Door dings and cart marks', service: 'door-ding-repair', why: 'Street parking and busy lots in every neighborhood.' },
    { job: 'Swirled paint on a dark commuter', service: 'paint-correction', why: 'Years of automatic washes and dusty summers.' },
    { job: 'Pre-trade-in clean-up', service: 'mobile-detailing', why: 'Sellers who want a clean, dent-free car before a dealer sees it.' },
  ],
  faqs: [
    {
      q: 'Can you work on my car if I only have street parking?',
      a: 'Usually yes. We need room to open the doors and a safe place to set up. Tell us where the car is, and if there are parking restrictions or street-sweeping days, tell us those too.',
    },
    {
      q: 'Will you come to my office downtown?',
      a: 'Often, with permission from the property. Some garages do not allow outside work. Give us the parking location, and we will tell you whether it will work.',
    },
    {
      q: 'Is Sacramento heat a problem for paintless dent repair?',
      a: 'It affects the setup more than the technique. We prefer shade or a covered spot, and early appointments in summer, because hot metal and harsh light make dents harder to read.',
    },
    {
      q: 'Do you serve all neighborhoods in the city?',
      a: 'We serve the city of Sacramento and the surrounding area. Enter your ZIP when you book, and the booking flow will confirm that we can reach you and show any travel fee.',
    },
  ],
  neighbors: ['west-sacramento', 'natomas', 'carmichael', 'elk-grove'],
  blogs: ['tree-sap-removal', 'dent-repair-cost-sacramento'],
  services: ['door-ding-repair', 'paint-correction', 'mobile-detailing'],
};

export const elkGrove: CityDoc = {
  slug: 'elk-grove',
  name: 'Elk Grove',
  title: 'Mobile Dent Repair Elk Grove CA | 916 Dent & Detail',
  description: 'Mobile dent repair and detailing in Elk Grove, CA. Family SUVs, big-box lot dings and commuter wear fixed at your home or work. Photo quote first.',
  h1: 'Mobile dent repair and detailing in Elk Grove.',
  lede: 'Minivans, SUVs and Highway 99 commuters. Elk Grove is close to where we start the day, which keeps visits flexible and travel fees low.',
  distance: 'home-base',
  driveNote: 'Elk Grove is the closest part of our service area to our base, so travel is usually the smallest here.',
  places: [
    { name: 'Laguna Promenade', note: 'at Elk Grove Boulevard and Bruceville Road', sourced: true },
    { name: 'the Elk Grove Auto Mall', sourced: true },
    { name: 'Elk Grove Commons', sourced: true },
    { name: 'Old Town Elk Grove', sourced: false },
    { name: 'Highway 99', note: 'commuter route toward Sacramento', sourced: false },
  ],
  sections: [
    {
      id: 'family',
      h2: 'Family cars: the school-run reality',
      paras: [
        'Elk Grove is a suburb built around driveways, garages and school pickup lines, and its vehicles are weighted toward family SUVs, crossovers and minivans. That makes the typical job a little different from a city one. We see more interior work: crumbs in the seat rails, spills on the third row and sticky buttons. We also see low-speed damage from a lot of short trips, such as a bumper that met a garage wall or a sliding door that met a post.',
        'Because the cars are bigger and the households busy, a visit at home is the easiest route. We set up in your driveway, you stay inside, and the work is done by the time the school run begins.',
      ],
    },
    {
      id: 'lots',
      h2: 'Shopping-center lots and the big-box dent',
      paras: [
        'Retail centers near Elk Grove Boulevard and Bruceville Road, including Laguna Promenade and Elk Grove Commons, have large lots and heavy traffic, which is where careless carts and swinging doors cause most dings. If you notice a crease on a rear quarter panel after a weekend errand run, it is a very typical story.',
        'The good news is that this kind of damage, shallow, round and with intact paint, is the sweet spot for paintless repair.',
      ],
    },
    {
      id: 'commute',
      h2: 'Highway 99 commuters and highway wear',
      paras: [
        'Many Elk Grove residents drive north on Highway 99 each day. Highway miles bring stone chips on the hood and bumper, bugs on the front end in warmer months and a layer of grime on the paint. Chips are paint repair, not dent repair, and we will tell you which is which. For the grime and the dull paint underneath, a decontamination wash and a protective layer go a long way.',
        'Long commutes also wear interiors. A cabin that is used twice a day, five days a week, benefits from a periodic deep reset.',
      ],
    },
    {
      id: 'dealers',
      h2: 'Dealer row and trade-ins',
      paras: [
        'Elk Grove has its own auto mall, and trade-ins from nearby households flow through it. If you plan to trade in, a dent repair and a detail before you drive in can protect the value of the car. If you work in a dealership, see our recon page for on-lot service.',
      ],
    },
  ],
  jobs: [
    { job: 'Minivan interior reset', service: 'interior-detailing', why: 'Third-row crumbs, spills and pet hair from a busy household.' },
    { job: 'Retail-lot dent on a rear quarter', service: 'paintless-dent-repair', why: 'Wide lots, careless carts, car doors.' },
    { job: 'Trade-in tidy-up', service: 'dealership-recon', why: 'Nearby auto mall, so a clean, dent-free car makes a good first impression.' },
  ],
  faqs: [
    {
      q: 'Is Elk Grove close to your base?',
      a: 'Yes, it is the nearest part of our service area to where we start, so travel fees are lowest here. The booking flow shows any fee for your ZIP before you pay.',
    },
    {
      q: 'Can you work in my driveway or garage?',
      a: 'Yes. Most Elk Grove jobs are done at home. A garage is a bonus for polishing and coating, because it gives us shade and controlled light.',
    },
    {
      q: 'Can you fix a dent from a shopping-center lot?',
      a: 'Often, yes, as long as the paint is not cracked. Send a photo and we will tell you what we see.',
    },
    {
      q: 'I want to trade in my car. What should I fix first?',
      a: 'Dings and a deep clean usually give the biggest improvement for the cost. Our trade-in prep post explains the order.',
    },
    {
      q: 'Do you do interior work only?',
      a: 'Yes, interior detailing can be booked on its own, and many Elk Grove families choose it for that reason.',
    },
  ],
  neighbors: ['sacramento', 'rancho-cordova', 'west-sacramento'],
  blogs: ['dealership-trade-in-prep', 'how-long-does-mobile-detailing-take'],
  services: ['interior-detailing', 'paintless-dent-repair', 'dealership-recon'],
};

export const roseville: CityDoc = {
  slug: 'roseville',
  name: 'Roseville',
  title: 'Dent Repair & Hail Fix Roseville CA | 916 Dent & Detail',
  description: 'Mobile dent repair, hail repair and detailing in Roseville, CA. Mall-lot dings, automall recon and paintless hail work at your home or office.',
  h1: 'Mobile dent repair and hail fixes in Roseville.',
  lede: 'A big regional mall, a dense automall and a history of hail in the region. Roseville cars take a particular kind of beating, and most of it can be fixed without paint.',
  distance: 'mid',
  driveNote: 'Roseville is a mid-distance trip from our base, so a travel fee may apply. The booking flow shows the exact amount for your ZIP.',
  places: [
    { name: 'Westfield Galleria at Roseville', note: 'about 6,400 parking spaces, off Galleria Boulevard and Highway 65', sourced: true },
    { name: 'the Roseville Automall on Automall Drive', sourced: true },
    { name: 'Blue Oaks Boulevard retail', sourced: false },
    { name: 'Kaiser and Sutter hospitals', note: 'large employers', sourced: false },
  ],
  sections: [
    {
      id: 'galleria',
      h2: 'The Galleria effect: a lot of cars in a lot of lots',
      paras: [
        'The Westfield Galleria at Roseville sits at Galleria Boulevard and Highway 65 and publishes roughly 6,400 parking spaces. Add the retail around it and Blue Oaks Boulevard, and Roseville has some of the densest shopping parking in the region. Dense parking means close neighbors, and close neighbors mean door dings. Weekends and the holiday season are the usual culprits.',
        'If you notice a new dent after a mall trip, photograph it before you leave the lot if you can. A shot with the surrounding cars in frame can help if you ever need to raise it with a property manager.',
      ],
    },
    {
      id: 'hail',
      h2: 'Hail in Roseville: what we know and what we do not',
      paras: [
        'Local news has reported hail in Roseville during past regional storms, though the dates and severity vary from one event to the next. We are not going to claim a statistic about how often it happens, because we do not have a reliable one. What we do know is that when hail does arrive, a lot of cars are damaged at once, and the roof, hood and trunk are the usual casualties.',
        'Our hail page explains how repair works panel by panel, and how a documented estimate can support an insurance claim. If you are in Roseville and a storm has just rolled through, send photos first. Do not wait to see whether the dents settle, because they do not.',
      ],
    },
    {
      id: 'automall',
      h2: 'Automall recon and a shared-visit idea',
      paras: [
        'The Roseville Automall on Automall Drive is a cluster of franchise stores in one drive. For a mobile service, clusters are efficient: one visit day can serve several lots. If you manage a used department there, see our dealership recon page, or ask about joining a regular visit schedule.',
      ],
    },
  ],
  jobs: [
    { job: 'Hail panels: roof, hood and trunk', service: 'hail-damage-repair', why: 'Past regional storms have affected Roseville and neighbors.' },
    { job: 'Mall-lot door ding', service: 'door-ding-repair', why: 'Dense, busy parking close to Highway 65.' },
    { job: 'Used-lot front-line prep', service: 'dealership-recon', why: 'Automall Drive stores need units photo-ready.' },
  ],
  faqs: [
    {
      q: 'Does hail really hit Roseville?',
      a: 'Local news has reported hail in Roseville in past storms. It is not an annual event, so many owners are caught without a plan. Send photos if you think you have damage.',
    },
    {
      q: 'Can you come to my office in Roseville?',
      a: 'Often yes, with permission from the property. Tell us where the car will be parked and whether we need a pass.',
    },
    {
      q: 'Do you charge extra to come to Roseville?',
      a: 'A travel fee may apply, based on distance. It is shown in the booking flow for your ZIP before you pay anything.',
    },
    {
      q: 'Can you repair hail damage if I do not want to file a claim?',
      a: 'Yes. You can pay for the repair yourself. We will give you an estimate by panel, and you decide how to proceed.',
    },
  ],
  neighbors: ['rocklin', 'lincoln', 'citrus-heights', 'granite-bay'],
  blogs: ['hail-season-prep-sacramento', 'pdr-vs-body-shop'],
  services: ['hail-damage-repair', 'door-ding-repair', 'dealership-recon'],
};
