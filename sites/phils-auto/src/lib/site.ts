/**
 * Every fact about the business, in one place.
 *
 * Nothing in here is invented. The phone number, the tires-at-cost claim and
 * the brands carried are read off photographs of the building; the rating and
 * hours come from the Google Business Profile; the reviews are quoted
 * verbatim from Yelp and MapQuest with only punctuation touched.
 */

export const SITE = {
  name: "Phil's Auto and Fleet Repair",
  short: "Phil's Auto & Fleet",
  url: "https://philsautofleet.com",
  phone: "(209) 647-4953",
  phoneLink: "+12096474953",
  email: "phil@philsautofleet.com",
  street: "103 E Elm St",
  city: "Lodi",
  region: "CA",
  regionLong: "California",
  zip: "95240",
  country: "US",
  lat: 38.1341,
  lng: -121.2724,
  hoursHuman: "Monday – Saturday, 8:00 AM – 5:00 PM",
  hoursRows: [
    ["Monday", "8:00 AM – 5:00 PM"],
    ["Tuesday", "8:00 AM – 5:00 PM"],
    ["Wednesday", "8:00 AM – 5:00 PM"],
    ["Thursday", "8:00 AM – 5:00 PM"],
    ["Friday", "8:00 AM – 5:00 PM"],
    ["Saturday", "8:00 AM – 5:00 PM"],
    ["Sunday", "Closed"],
  ] as const,
  rating: "4.4",
  reviewCount: "83",
  areas: [
    "Lodi", "Stockton", "Galt", "Acampo", "Woodbridge",
    "Lockeford", "Victor", "Thornton", "Clements", "Elk Grove",
  ],
  /** Read off the banners in the bay door, so safe to state. */
  carries: ["Interstate Batteries", "Mastercraft Tires", "ASC member shop", "AC Delco", "Valvoline"],
  mapsDirections:
    "https://www.google.com/maps/dir/?api=1&destination=103+E+Elm+St+Lodi+CA+95240",
} as const;

export const FULL_ADDRESS = `${SITE.street}, ${SITE.city}, ${SITE.region} ${SITE.zip}`;

/** Quoted exactly as written. Punctuation only. */
export const REVIEWS = [
  {
    quote:
      "I highly recommend Phil's Auto and Fleet Repair. I called on a Saturday morning for an appointment for an alignment on my BMW X3. They took me in right away, completed the work in the said time, gave me a report and my suv drives smoothly.",
    name: "Tracey P.",
    source: "Yelp",
  },
  {
    quote:
      "Phil and his shop do the best work! My ford fusion kept having the service advance track light come on randomly. I was leaving for a trip in 4 days and needed it fixed desperately. I called Phil and he worked me into his schedule that day and put more effort in than any other shop I have been to. I was back on the road that same day!",
    name: "Hannah K.",
    source: "Yelp",
  },
  {
    quote:
      "Replies back pretty quick and in a reasonable time. Their prices are fair and not too overly expensive like going to some dealership that cost you an arm and a leg. Thank you Phil's Auto and Fleet Repair for your time, quote and services.",
    name: "Michael D.",
    source: "Yelp",
  },
  {
    quote:
      "GREAT SERVICE! Above and beyond expectations!! Completed service on schedule!! I will be bringing my cars here from now on!",
    name: "Verified customer",
    source: "MapQuest",
  },
] as const;

export type Service = {
  slug: string;
  nav: string;
  title: string;
  h1: string;
  meta: string;
  blurb: string;
};

/** Titles and descriptions are the ones checked in seo/keyword-map.md. */
export const SERVICES: Service[] = [
  {
    slug: "auto-repair",
    nav: "Auto Repair",
    title: "Auto Repair Shop in Lodi, CA | Phil's Auto",
    h1: "Auto Repair in Lodi, CA",
    meta: "Full-service auto repair in Lodi, CA for domestic and import vehicles. Honest diagnostics, clear pricing, no upsells. Call (209) 647-4953.",
    blurb: "Domestic and import cars, trucks, SUVs and vans — diagnosed properly, repaired once.",
  },
  {
    slug: "car-diagnostics",
    nav: "Check Engine & Diagnostics",
    title: "Check Engine Light Diagnostics, Lodi CA",
    h1: "Check Engine Light & Diagnostics",
    meta: "Check engine light on? We find the actual fault in Lodi, CA before replacing parts, and show you what we found. Call (209) 647-4953.",
    blurb: "A code names a circuit. We find the part — before anything gets replaced.",
  },
  {
    slug: "brake-repair",
    nav: "Brakes",
    title: "Brake Repair & Pad Replacement, Lodi CA",
    h1: "Brake Repair in Lodi, CA",
    meta: "Brake pads, rotors, calipers and ABS faults in Lodi, CA. You see what we found and the price before work starts. Call (209) 647-4953.",
    blurb: "Pads, rotors, calipers, hydraulics and ABS faults.",
  },
  {
    slug: "engine-repair",
    nav: "Engine Repair",
    title: "Engine Repair & Diagnostics in Lodi, CA",
    h1: "Engine Repair in Lodi, CA",
    meta: "Engine diagnosis and repair in Lodi, CA - timing, cooling, overheating and rebuilds, quoted before we start. Call (209) 647-4953.",
    blurb: "Timing components, cooling systems, overheating and rebuilds.",
  },
  {
    slug: "transmission-repair",
    nav: "Transmission",
    title: "Transmission Repair & Service, Lodi CA",
    h1: "Transmission Repair in Lodi, CA",
    meta: "Transmission service and repair in Lodi, CA. Slipping, harsh shifts or a leak, diagnosed first and quoted up front. Call (209) 647-4953.",
    blurb: "Slipping, harsh shifts, leaks and scheduled service.",
  },
  {
    slug: "diesel-repair",
    nav: "Diesel Repair",
    title: "Diesel Repair & Diesel Mechanic, Lodi CA",
    h1: "Diesel Repair in Lodi, CA",
    meta: "Diesel repair in Lodi, CA for Duramax, Power Stroke and Cummins - engine, fuel system, emissions and driveline. Call (209) 647-4953.",
    blurb: "Duramax, Power Stroke and Cummins — engine, fuel, emissions, driveline.",
  },
  {
    slug: "fleet-services",
    nav: "Fleet Services",
    title: "Fleet Maintenance & Repair in Lodi, CA",
    h1: "Fleet Services in Lodi, CA",
    meta: "Fleet maintenance in Lodi, CA on a schedule, so a breakdown lands on your calendar instead of a job site. Call (209) 647-4953.",
    blurb: "Scheduled maintenance so failures land on your calendar, not a job site.",
  },
  {
    slug: "oil-change-maintenance",
    nav: "Oil Change & Maintenance",
    title: "Oil Change & Scheduled Service, Lodi CA",
    h1: "Oil Change & Maintenance",
    meta: "Oil changes and scheduled maintenance in Lodi, CA. Factory intervals kept, no invented add-ons at the counter. Call (209) 647-4953.",
    blurb: "Factory intervals kept. No invented add-ons at the counter.",
  },
  {
    slug: "tire-repair",
    nav: "Tires",
    title: "Tires, Mounting & Balancing in Lodi, CA",
    h1: "Tires in Lodi, CA",
    meta: "Tires sold at our cost in Lodi, CA - you pay what we pay, plus mount and balancing. Flat repair too. Call (209) 647-4953.",
    blurb: "Sold at our cost — you pay what we pay, plus mount and balancing.",
  },
  {
    slug: "electrical-repair",
    nav: "Electrical & Batteries",
    title: "Car Electrical Repair & Batteries, Lodi",
    h1: "Electrical & Batteries",
    meta: "Car electrical repair in Lodi, CA - batteries, alternators, starters and wiring faults traced properly. Call (209) 647-4953.",
    blurb: "Batteries, alternators, starters and wiring faults traced properly.",
  },
];
