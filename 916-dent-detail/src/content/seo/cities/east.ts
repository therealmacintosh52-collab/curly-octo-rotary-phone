import type { CityDoc } from '../types';

export const folsom: CityDoc = {
  slug: 'folsom',
  name: 'Folsom',
  title: 'Ceramic Coating & Dent Repair Folsom CA | 916 Dent & Detail',
  description: 'Mobile ceramic coating, paint correction and dent repair in Folsom, CA. Care for commuter and higher-trim cars, done at your home or work.',
  h1: 'Paint care and dent repair for Folsom drivers.',
  lede: 'Tech-campus commuters, lakeside sun and a lot of well-kept cars. In Folsom, the emphasis tends to be on protecting a good finish as much as fixing a bad dent.',
  distance: 'mid',
  driveNote: 'Folsom is a mid-distance trip, so a travel fee may apply. The booking flow shows what it is for your ZIP.',
  places: [
    { name: 'the Intel campus', note: 'off Prairie City Road and Highway 50', sourced: true },
    { name: 'the Folsom auto mall off Highway 50', sourced: true },
    { name: 'Folsom Lake', sourced: false },
    { name: 'Historic Sutter Street', sourced: false },
  ],
  sections: [
    {
      id: 'protect',
      h2: 'Why Folsom skews toward protection work',
      paras: [
        'Drive through a Folsom office park or a neighborhood near the lake and you see a lot of cars that are owned with care: newer crossovers, higher-trim sedans and trucks that get washed on weekends. For owners like these, the question is not so much "how do I fix this" as "how do I keep this looking right". That is where a paint-correction-and-coating package makes sense, and where we see the most interest in it.',
        'If you are considering a Gloss Shield, our ceramic coating page explains the prep, the cure and what a coating cannot do, and the paint correction page covers the step that comes before it.',
      ],
    },
    {
      id: 'campus',
      h2: 'Campus and office-park commuting',
      paras: [
        'Folsom is home to a large tech campus off Prairie City Road and Highway 50, and the surrounding business parks fill every weekday. Intel has reported layoffs in recent years, and the city has said it intends to keep growing and diversifying, so the daily traffic picture is shifting. For our purposes, the result is the same: many cars parked in big shared lots, all day, with the ordinary hazards of the parking-lot life.',
        'A workplace visit is an option if your employer or property manager allows it. Book a window, tell us the lot and the row, and we handle the rest while you work.',
      ],
    },
    {
      id: 'sun',
      h2: 'Lake-area sun and long driveways',
      paras: [
        'Sun exposure matters more than most people realize. Cars parked outdoors all day in a hot, dry climate see more paint oxidation, more dust and faster fading of unprotected trim and headlights. If your headlights have started to yellow, our headlight page explains the fix. If your driveway has no shade, a coating and a quality cover can both help, and we will tell you honestly which matters more for your car.',
      ],
    },
    {
      id: 'automall',
      h2: 'Auto mall visits',
      paras: [
        'The Folsom auto mall off Highway 50 groups several dealers close together. If you manage used inventory there, a cluster visit is efficient for us, and our dealership recon page describes how it is organized.',
      ],
    },
  ],
  jobs: [
    { job: 'Correction and coating on a daily driver', service: 'ceramic-coating', why: 'Owners who want to protect a well-kept finish.' },
    { job: 'Headlight clean-up', service: 'headlight-restoration', why: 'Outdoor parking and strong sun.' },
    { job: 'Office-lot dent', service: 'paintless-dent-repair', why: 'Workday parking in large shared lots.' },
  ],
  faqs: [
    {
      q: 'Can you coat my car at my house in Folsom?',
      a: 'Usually yes. A garage or covered area makes the work easier and the result better. Tell us what you have, and we will plan around it.',
    },
    {
      q: 'Do you work at office parks?',
      a: 'Often, with permission from the property. Tell us the lot, the row and any access requirements.',
    },
    {
      q: 'Is Folsom inside your service area?',
      a: 'Yes. A travel fee may apply, and the booking flow shows it for your ZIP before you pay.',
    },
    {
      q: 'Should I coat a car I plan to keep a long time?',
      a: 'It can make sense, especially if the car is parked outdoors. Our ceramic coating page explains what it does and does not do.',
    },
  ],
  neighbors: ['el-dorado-hills', 'granite-bay', 'rancho-cordova'],
  blogs: ['ceramic-coating-in-valley-heat', 'how-often-to-wax-or-coat-central-valley'],
  services: ['ceramic-coating', 'paint-correction', 'headlight-restoration'],
};

export const ranchoCordova: CityDoc = {
  slug: 'rancho-cordova',
  name: 'Rancho Cordova',
  title: 'Mobile Car Detailing Rancho Cordova CA | 916 Dent & Detail',
  description: 'Mobile car detailing and dent repair in Rancho Cordova, CA. Highway 50 commuters, auto-row recon and honest quotes from a photo. We come to you.',
  h1: 'Mobile detailing and dent repair in Rancho Cordova.',
  lede: 'A Highway 50 corridor town with an auto row of its own. Rancho Cordova jobs split between commuters who want a clean car and lots that need cars ready.',
  distance: 'near',
  driveNote: 'Rancho Cordova is a short run along Highway 50 from the middle of our area, so travel fees are modest.',
  places: [
    { name: 'Automall Parkway', note: 'auto dealers', sourced: true },
    { name: 'Sunrise Boulevard corridor', sourced: false },
    { name: 'Mather area', sourced: false },
    { name: 'Cordova Town Center', sourced: false },
    { name: 'Highway 50', sourced: false },
  ],
  sections: [
    {
      id: 'corridor',
      h2: 'Living on the Highway 50 corridor',
      paras: [
        'Rancho Cordova sits on Highway 50, between the city of Sacramento and the foothills. A lot of its residents drive that road every day in one direction or the other. Highway commuting means more miles in the sun, more grit on the nose of the car and more kicked-up stones. We see a lot of cars here that are mechanically fine and look tired: dull paint, a bug-spattered front end and a cabin that has held a thousand coffee cups.',
        'For these cars, a mobile detail is often the simplest answer. A Paint Deep-Clean removes the bonded grime that washing leaves, and a sealant restores slickness. If the cabin is the problem, an Interior Reset takes care of it.',
      ],
    },
    {
      id: 'autorow',
      h2: 'Auto row on Automall Parkway',
      paras: [
        'Rancho Cordova has dealerships along Automall Parkway, which makes it one of the places where recon work is a big part of the local economy. Used units come in from trade and auction with dings and tired interiors, and managers want them front-line ready. We offer on-lot repair and detailing, and our dealership recon page explains pricing and approvals.',
        'If you live here and are shopping for a used car, ask the dealer whether paintless repair or a detail is planned before delivery.',
      ],
    },
    {
      id: 'neighborhoods',
      h2: 'Neighborhood work: driveways and apartment lots',
      paras: [
        'Alongside single-family driveways, Rancho Cordova has apartment communities and workplace parking where space is shared. When you book, tell us if the car lives in a shared lot. We will ask about the stall, any gate and whether we can work in place or need to move the car a short way.',
      ],
    },
  ],
  jobs: [
    { job: 'Commuter detail', service: 'mobile-detailing', why: 'Highway miles, bugs and grime on the front end.' },
    { job: 'Dealer-row recon', service: 'dealership-recon', why: 'Dealerships along Automall Parkway.' },
    { job: 'Apartment-lot dings', service: 'door-ding-repair', why: 'Tight stalls and shared parking.' },
  ],
  faqs: [
    {
      q: 'How far is Rancho Cordova from where you start?',
      a: 'It is a short drive along Highway 50 from the middle of our service area, and travel fees are modest. The booking flow shows the exact amount.',
    },
    {
      q: 'Can you work at my apartment complex?',
      a: 'Often. Check the community rules about washing and outside contractors, and tell us the stall and any gate code.',
    },
    {
      q: 'Do you work with the dealerships here?',
      a: 'We offer on-lot recon for dealers across the region. Talk to us through the dealer page.',
    },
    {
      q: 'What helps a high-mileage commuter car most?',
      a: 'Usually a deep clean of the paint and cabin, then a protective layer. If there are dents, we repair them first.',
    },
  ],
  neighbors: ['folsom', 'elk-grove', 'carmichael', 'sacramento'],
  blogs: ['how-long-does-mobile-detailing-take', 'dealership-trade-in-prep'],
  services: ['mobile-detailing', 'dealership-recon', 'door-ding-repair'],
};

export const citrusHeights: CityDoc = {
  slug: 'citrus-heights',
  name: 'Citrus Heights',
  title: 'Dent & Hail Repair Citrus Heights CA | 916 Dent & Detail',
  description: 'Mobile paintless dent and hail repair in Citrus Heights, CA. Older cars, parking-lot dings and hail panels fixed without repaint. Photo quote first.',
  h1: 'Dent and hail repair for Citrus Heights.',
  lede: 'Many of the cars here have a few years behind them, and a few dents. The goal is a clean, honest fix that suits the age and value of the car.',
  distance: 'mid',
  driveNote: 'Citrus Heights is a mid-distance trip, so a travel fee may apply. The booking flow shows it for your ZIP.',
  places: [
    { name: 'Sunrise Mall area', sourced: false },
    { name: 'Greenback Lane', sourced: false },
    { name: 'Auburn Boulevard', sourced: false },
  ],
  sections: [
    {
      id: 'value',
      h2: 'Fixing dents sensibly on an older car',
      paras: [
        'Not every repair decision is about resale. On a car that is ten or fifteen years old, the question is whether a dent is worth fixing at all, and if so, what is the cheapest sensible way to do it. Paintless repair is often the economical answer, because it avoids the cost of paint and the days in a body shop. For a small ding, it can cost much less than repainting a panel.',
        'We will tell you straight if a dent is not worth fixing. A deep crease on a worn panel, with faded paint around it, is a case where improvement may be modest, and leaving it alone is a respectable choice.',
      ],
    },
    {
      id: 'hail',
      h2: 'When a storm has been through',
      paras: [
        'Local news has reported hail in Citrus Heights during past storms, without our being able to give you dates or counts. Hail on older cars is a particular concern, because the paint is often thinner and the owners are less likely to have comprehensive coverage with a low deductible. If your car has been hit, send photos and ask for an estimate, then compare it with your policy terms.',
        'We can document the damage by panel, which helps in a claim or in deciding to pay out of pocket for part of the car, such as the hood and roof, and ignore the rest.',
      ],
    },
    {
      id: 'lots',
      h2: 'Retail strips and busy boulevards',
      paras: [
        'Citrus Heights is crossed by busy retail boulevards with shopping centers on both sides, and parking there is tight and constant. Most dings on cars we see from this area come from precisely that: a lot, a door and a neighbor in a hurry.',
      ],
    },
  ],
  jobs: [
    { job: 'Hail dents on hood and roof', service: 'hail-damage-repair', why: 'Reported hail in past regional storms.' },
    { job: 'Single-dent repair on an older car', service: 'paintless-dent-repair', why: 'Economical alternative to a repaint.' },
    { job: 'Oxidized, yellowed headlights', service: 'headlight-restoration', why: 'Older lenses that have lost their UV coating.' },
  ],
  faqs: [
    {
      q: 'Is it worth fixing dents on an older car?',
      a: 'Sometimes. If the dent bothers you or you plan to sell, a paintless repair of a small dent is usually economical. We tell you honestly if we think it is not worth it.',
    },
    {
      q: 'Can you fix only the worst panels after hail?',
      a: 'Yes. We can price by panel, and you can choose to repair the hood and roof, for example, and leave the rest.',
    },
    {
      q: 'Do you come to Citrus Heights?',
      a: 'Yes. A travel fee may apply, and the booking flow shows the exact amount for your ZIP.',
    },
    {
      q: 'What if my paint is faded?',
      a: 'Dent repair still works if the paint is intact. Faded or peeling clear coat is a separate issue, and we will tell you what can be improved.',
    },
    {
      q: 'Can you restore my yellowed headlights too?',
      a: 'Yes. Headlight restoration is often combined with other work on older cars.',
    },
  ],
  neighbors: ['roseville', 'carmichael', 'sacramento', 'rocklin'],
  blogs: ['pdr-vs-body-shop', 'hail-season-prep-sacramento'],
  services: ['hail-damage-repair', 'paintless-dent-repair', 'headlight-restoration'],
};

export const natomas: CityDoc = {
  slug: 'natomas',
  name: 'Natomas',
  title: 'Mobile Detailing & Dent Repair Natomas CA | 916 Dent & Detail',
  description: 'Mobile detailing and dent repair in Natomas, Sacramento. Airport commuters, newer subdivisions and carport hail damage. Photo quote, we come to you.',
  h1: 'Mobile detailing and dent repair in Natomas.',
  lede: 'Newer subdivisions, a nearby airport and two freeways. Natomas cars tend to be newer, busy and parked in driveways and carports.',
  distance: 'near',
  driveNote: 'Natomas is on the north side of Sacramento, a short trip from the middle of our area, so travel fees are modest.',
  places: [
    { name: 'the former Arco Arena site', note: 'demolished in 2022, with redevelopment planned', sourced: true },
    { name: 'Natomas Marketplace', sourced: false },
    { name: 'Sacramento International Airport', sourced: false },
    { name: 'Interstate 5 and Interstate 80', sourced: false },
  ],
  sections: [
    {
      id: 'newer',
      h2: 'Newer neighborhoods, newer paint',
      paras: [
        'Much of Natomas was built relatively recently, and many of the cars parked in its driveways are newer too. Newer cars tend to have intact, glossy factory paint and often a lease or a loan attached, which makes preserving the finish a priority. That points to paintless repair for dents and to cautious, measured polishing for paint, since we want to leave clear coat in place on cars that are still young.',
        'Lease returns are a good example. A set of door dings can turn into a charge at turn-in. Fixing them beforehand with a paintless method often costs less than the bill, and we can show you photographs of the result.',
      ],
    },
    {
      id: 'carports',
      h2: 'Carports and open parking in a hailstorm',
      paras: [
        'A report on a regional hailstorm described a carport in Natomas collapsing under hail. The lesson is not that Natomas gets hail all the time, because it does not, but that carports and open parking offer less protection than people assume. A carport stops rain and sun. It does not always stop large hail, and a failing structure can add damage of its own.',
        'If you are asking whether your car has hail damage, our hail repair page explains how we assess it, and our blog has tips on what to do before a storm.',
      ],
    },
    {
      id: 'airport',
      h2: 'Airport trips and long-term parking',
      paras: [
        'Natomas is next to the airport, and many residents park for trips or commute to jobs nearby. Cars left in long-term lots collect dust, pollen and the odd shopping-cart ding from the parking-shuttle rush. After a long trip, a detail is a pleasant way to come home to a clean car, and we can arrange to be at your house when you land.',
      ],
    },
    {
      id: 'fleet',
      h2: 'Rental and fleet cars near the airport',
      paras: [
        'Rental operations and shuttle services cluster around airports, and their cars take a constant stream of small dings. If you manage a fleet near Natomas, our recon page describes how we work on lots.',
      ],
    },
  ],
  jobs: [
    { job: 'Lease-return dings', service: 'door-ding-repair', why: 'Newer cars with a turn-in date.' },
    { job: 'Post-travel detail', service: 'mobile-detailing', why: 'Cars that sat in a long-term lot or a hot driveway.' },
    { job: 'Hail check after a storm', service: 'hail-damage-repair', why: 'Reported carport damage in a regional hailstorm.' },
  ],
  faqs: [
    {
      q: 'Can you fix door dings before I return a lease?',
      a: 'Often. Send photos of each dent, and we will tell you which can be repaired paintless. We cannot predict what the leasing company will charge.',
    },
    {
      q: 'Will a carport protect my car from hail?',
      a: 'It helps with sun and rain, but a carport is not a guarantee against large hail. Garage parking is better, and our blog explains what to do before a storm.',
    },
    {
      q: 'Can you be at my home when I get back from a trip?',
      a: 'Book a window and tell us the car will be there. We do not need you present for most work, but we like a quick walk-around.',
    },
    {
      q: 'Do you serve fleets near the airport?',
      a: 'We work on fleet lots across the region. Contact us through the dealer page to talk about volume.',
    },
  ],
  neighbors: ['sacramento', 'west-sacramento', 'roseville'],
  blogs: ['hail-season-prep-sacramento', 'dealership-trade-in-prep'],
  services: ['door-ding-repair', 'mobile-detailing', 'hail-damage-repair'],
};
