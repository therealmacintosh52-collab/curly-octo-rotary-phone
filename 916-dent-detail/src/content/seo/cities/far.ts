import type { CityDoc } from '../types';

export const elDoradoHills: CityDoc = {
  slug: 'el-dorado-hills',
  name: 'El Dorado Hills',
  title: 'Mobile Detailing & Dent Repair El Dorado Hills | 916 Dent & Detail',
  description: 'Mobile detailing, paint protection and dent repair in El Dorado Hills, CA. Highway 50 commuters and hillside driveways, serviced at your door.',
  h1: 'Mobile detailing and dent repair in El Dorado Hills.',
  lede: 'Hillside driveways, Highway 50 commutes and a lot of cars that go to Folsom and beyond every morning. We bring the work to you, uphill included.',
  distance: 'far',
  driveNote: 'El Dorado Hills is toward the far east edge of our service area, so a travel fee is likely. The booking flow shows the amount for your ZIP.',
  places: [
    { name: 'El Dorado Hills Town Center', sourced: false },
    { name: 'Highway 50', sourced: false },
    { name: 'Serrano', note: 'a residential community', sourced: false },
  ],
  sections: [
    {
      id: 'hills',
      h2: 'Slopes, driveways and where we set up',
      paras: [
        'Geography is the first practical question in El Dorado Hills. Some driveways are steep, some streets are narrow and curved and some homes are set back behind gates. None of that is a problem for us, but it changes where we can work safely. A steep driveway is a poor place to polish, since water and product run downhill, and a car on a slope is harder to inspect. If yours is steep, tell us, and we may suggest working in the garage, on a flat apron or at a nearby level spot.',
        'For gated communities, we need the code or a name on the guest list. A text with the details before we arrive saves time at the gate.',
      ],
    },
    {
      id: 'commute',
      h2: 'The commute to Folsom and the Highway 50 grind',
      paras: [
        'A good share of the working population here heads west on Highway 50 each morning, toward Folsom, Rancho Cordova and Sacramento. Daily highway miles produce chips on the nose and a film of road grime. Chips need paint repair, which we will not pretend a polish can handle. The film and the dullness, however, are things a decontamination and a good sealant fix well.',
        'Workplace visits are also possible if your employer permits them. A car parked at an office in Folsom is within our area as well, and we can meet you there.',
      ],
    },
    {
      id: 'town',
      h2: 'Town Center errands and the shopping-lot ding',
      paras: [
        'Like anywhere, shopping centers and school lots produce small dings. If you see a round dent on a door or a fender after errands, a photo is the quickest way to find out whether it can be removed without paint, which it often can.',
      ],
    },
  ],
  jobs: [
    { job: 'Sealant or coating for a commuter', service: 'ceramic-coating', why: 'Daily highway miles and sun exposure.' },
    { job: 'Door ding after errands', service: 'door-ding-repair', why: 'Shopping-center and school lots.' },
    { job: 'Interior reset', service: 'interior-detailing', why: 'Family cars and long daily drives.' },
  ],
  faqs: [
    {
      q: 'Can you work on a steep driveway?',
      a: 'Sometimes, but we may suggest the garage or a flat spot. Tell us about the slope when you book.',
    },
    {
      q: 'Do you serve gated communities?',
      a: 'Yes. Send us the gate code or guest-list details before the visit.',
    },
    {
      q: 'Is there a travel fee to El Dorado Hills?',
      a: 'Likely, because it is toward the edge of our area. The booking flow shows it before you pay.',
    },
    {
      q: 'Can you meet me at work in Folsom instead?',
      a: 'Often, with permission from the property. Tell us the lot and any access requirements.',
    },
  ],
  neighbors: ['folsom', 'granite-bay', 'rancho-cordova'],
  blogs: ['how-often-to-wax-or-coat-central-valley', 'how-long-does-mobile-detailing-take'],
  services: ['ceramic-coating', 'door-ding-repair', 'interior-detailing'],
};

export const lincoln: CityDoc = {
  slug: 'lincoln',
  name: 'Lincoln',
  title: 'Mobile Car Detailing & Truck Care Lincoln CA | 916 Dent & Detail',
  description: 'Mobile car and truck detailing and dent repair in Lincoln, CA. Family SUVs, pickups and Highway 65 commuters, done at your driveway. Photo quote first.',
  h1: 'Mobile detailing, trucks and dent repair in Lincoln.',
  lede: 'Pickups, SUVs and Highway 65 commutes. Lincoln sits at the northern edge of our area, so we plan visits there with a little more care.',
  distance: 'far',
  driveNote: 'Lincoln is at the far northern edge of our service area, so a travel fee is likely. The booking flow shows it for your ZIP.',
  places: [
    { name: 'Highway 65', sourced: false },
    { name: 'Lincoln Crossing', sourced: false },
    { name: 'Twelve Bridges', sourced: false },
  ],
  sections: [
    {
      id: 'size',
      h2: 'Bigger vehicles take longer, and we plan for it',
      paras: [
        'Pickups and three-row SUVs are common on Lincoln streets, and size matters in detailing. A large truck has more paint to wash, correct and protect, more cabin to vacuum and a bed that may need its own attention. We quote by vehicle size, and we plan the day accordingly, so that a big job is not squeezed into a small window.',
        'If you drive a lifted truck or a dually, tell us at booking. Reaching the roof and the tops of the panels takes extra equipment and time, and we want to bring the right gear.',
      ],
    },
    {
      id: 'work',
      h2: 'Truck beds, tools and the work-vehicle interior',
      paras: [
        'Work trucks collect mud, concrete dust, sawdust and the occasional spilled load. Those are different from family-car messes. A truck cab with ground-in dirt in the carpet and dust in every vent needs a thorough dry clean before anything wet. We handle that, and we will tell you if a bed liner, a spray-in coating or a contaminated surface is outside what we can clean.',
      ],
    },
    {
      id: 'commute',
      h2: 'The Highway 65 commute',
      paras: [
        'Many Lincoln drivers run south on Highway 65 toward Rocklin, Roseville and beyond. A long daily commute is hard on front ends, with bugs, grit and stones. We cannot erase a stone chip with polish, because that is paint damage, but we can restore the look of the paint around it and protect it from further wear.',
        'If you work in Roseville or Rocklin, ask us about meeting you there. A visit in a nearby city is often the more convenient option and the travel fee depends on the location.',
      ],
    },
  ],
  jobs: [
    { job: 'Full truck detail and bed clean-up', service: 'mobile-detailing', why: 'Work vehicles and larger paint area.' },
    { job: 'Family SUV interior reset', service: 'interior-detailing', why: 'Third rows, car seats and daily use.' },
    { job: 'Hood and bumper dings', service: 'paintless-dent-repair', why: 'Daily highway and shopping-lot life.' },
  ],
  faqs: [
    {
      q: 'Do you detail large trucks?',
      a: 'Yes. Tell us the make and model, and whether it is lifted or a dually, so we can plan time and equipment.',
    },
    {
      q: 'Can you clean a work truck cab?',
      a: 'Usually yes. We start with a dry clean for dust and debris, then wet-clean surfaces. Contaminated or hazardous materials are outside what we do.',
    },
    {
      q: 'Is there a travel fee to Lincoln?',
      a: 'Likely, since it is at the northern edge of our area. The booking flow shows the amount before you pay.',
    },
    {
      q: 'Can you meet me in Roseville or Rocklin?',
      a: 'Often, with permission from the property where the car is parked.',
    },
  ],
  neighbors: ['rocklin', 'roseville', 'granite-bay'],
  blogs: ['how-long-does-mobile-detailing-take', 'is-a-mobile-detailer-legit'],
  services: ['mobile-detailing', 'interior-detailing', 'paintless-dent-repair'],
};

export const rocklin: CityDoc = {
  slug: 'rocklin',
  name: 'Rocklin',
  title: 'Mobile Dent Repair & Detailing Rocklin CA | 916 Dent & Detail',
  description: 'Mobile dent repair and detailing in Rocklin, CA. School-lot dings, Highway 65 commuter wear and driveway detailing. Photo quote first, no body shop.',
  h1: 'Mobile dent repair and detailing in Rocklin.',
  lede: 'School lots, campus parking and the stop-start of Highway 65 traffic. Rocklin jobs are usually small, frequent and well suited to a driveway visit.',
  distance: 'far',
  driveNote: 'Rocklin is toward the northern edge of our service area, so a travel fee is likely. The booking flow shows it for your ZIP.',
  places: [
    { name: 'Sierra College', sourced: true },
    { name: 'Rocklin Unified School District campuses', sourced: true },
    { name: 'Quarry Park', sourced: false },
    { name: 'Blue Oaks Boulevard and Highway 65', sourced: false },
    { name: 'Sunset Boulevard', sourced: false },
  ],
  sections: [
    {
      id: 'schools',
      h2: 'School pickup lines and campus lots',
      paras: [
        'Sierra College and the Rocklin school district are among the city\'s larger employers according to the city\'s own list, which dates from 2017, so treat that as dated. What matters for cars is simpler: schools and campuses create congested lots twice a day. Pickup lines, tight turns and distracted drivers mean low-speed contact, and that is mostly bumper scuffs, door dings and the odd crease from a swung-open door.',
        'A bumper scuff is usually a paint issue rather than a dent, and we can often improve it with polishing. A door ding is a dent, and paintless repair usually handles it. We can tell which you have from a photo.',
      ],
    },
    {
      id: 'routine',
      h2: 'Small, frequent jobs and a regular rhythm',
      paras: [
        'Rocklin customers tend to book smaller, more regular services: a dent here, an interior reset before a road trip, a seasonal wash and sealant. If that is you, a repeating schedule can be more convenient than one-off bookings. Ask about our memberships, which are described on the pricing page, to see whether a regular visit fits your routine.',
      ],
    },
    {
      id: 'commute',
      h2: 'Highway 65, Blue Oaks and Sunset: the commuting loop',
      paras: [
        'Highway 65 links Rocklin to Roseville and Lincoln, and the cross streets feed the freeway at rush hour. Slow traffic means rear-end taps and kicked-up debris, and long hours in the sun mean faded trim and cloudy headlights. These are the quiet signs of a car that has been used hard, and they are usually fixable on a driveway.',
        'If you commute to Roseville, a workplace visit may be possible. Ask us, and tell us about the lot.',
      ],
    },
  ],
  jobs: [
    { job: 'Bumper scuff polish and door ding', service: 'paintless-dent-repair', why: 'School-lot and campus contact.' },
    { job: 'Seasonal detail before a road trip', service: 'mobile-detailing', why: 'Small, regular jobs.' },
    { job: 'Faded or cloudy headlights', service: 'headlight-restoration', why: 'Commuting in strong sun.' },
  ],
  faqs: [
    {
      q: 'Can you fix a scuffed bumper?',
      a: 'Often a scuff is transferred paint or light surface damage that polishing improves. Deep gouges or cracks need other repairs. A photo helps us tell you.',
    },
    {
      q: 'Do you offer regular maintenance visits?',
      a: 'Yes, memberships are on the pricing page. Ask us whether a regular schedule suits you.',
    },
    {
      q: 'Is there a travel fee to Rocklin?',
      a: 'Likely, because it is toward the northern edge of our area. The booking flow shows the amount before you pay.',
    },
    {
      q: 'Can you work in a school or campus lot?',
      a: 'Campuses usually restrict outside contractors, so check the rules. We can generally work at your home instead.',
    },
  ],
  neighbors: ['roseville', 'lincoln', 'granite-bay'],
  blogs: ['dent-repair-cost-sacramento', 'can-every-dent-be-fixed-without-paint'],
  services: ['paintless-dent-repair', 'mobile-detailing', 'headlight-restoration'],
};
