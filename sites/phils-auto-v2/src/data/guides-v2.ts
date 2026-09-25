/* Two advice posts added in v2 (see seo/keyword-map.md). Same shape as the
   v1 guides: sections are [heading, "p" | "ul", items[]] and items may hold
   inline HTML. */
export const extraGuides = [
  {
    slug: 'fleet-maintenance-schedule',
    nav: 'A fleet maintenance schedule that actually gets followed',
    title: 'Fleet Maintenance Schedule for Work Trucks, Lodi CA',
    meta: 'A preventive maintenance schedule for work trucks and vans that fits real routes, from a Lodi fleet shop. What to check, how often, what downtime costs.',
    blurb: 'What to check, how often, and how to keep the schedule from dying in a glovebox.',
    icon: 'truck',
    sections: [
      ['Why most fleet schedules fail', 'p', [
        'Most small fleets have a maintenance schedule. It is usually the one printed in the owner\'s manual, and it is usually ignored, because it was written for a commuter car that sees 12,000 easy miles a year, not a van that idles for an hour a day with a full load and a trailer.',
        'The schedule that gets followed is the one built around how the vehicle is actually used: mileage <em>and</em> hours <em>and</em> load. That is what we set up for fleet customers, and it is simpler than it sounds.',
      ]],
      ['The intervals that matter for work vehicles', 'ul', [
        '<strong>Every 5,000 miles or 250 engine hours:</strong> oil and filter, tire pressures and rotation, brake inspection, fluid levels, a walk-around for leaks and lights. On a diesel, drain the fuel-water separator.',
        '<strong>Every 15,000 miles:</strong> cabin and engine air filters, battery test and terminal clean, belt and hose inspection, brake measurement written down so wear can be tracked.',
        '<strong>Every 30,000 miles:</strong> transmission service on anything that tows, differential and transfer-case fluids on 4x4s, fuel filter on diesels, coolant test.',
        '<strong>Every 60,000 miles:</strong> spark plugs on gas engines, full brake fluid exchange, suspension and steering inspection with the wheels off the ground.',
        '<strong>Seasonally:</strong> AC performance before Central Valley summer, battery and glow plugs before winter.',
      ]],
      ['Hours versus miles', 'p', [
        'A truck that idles at job sites can put an engine hour on the clock every 25 miles or less. Oil does not care about the odometer; it cares about heat cycles and time under load. If your vehicles idle a lot, run PTO equipment or tow, service by hours. Most modern trucks show engine hours in the instrument cluster menu.',
      ]],
      ['What a breakdown really costs', 'p', [
        'The repair bill is the small part. A van that is down for two days costs the day\'s revenue, the crew standing around, the customer you rescheduled and, if it happens on the road, a tow. Preventive work on a schedule costs a fraction of that and can be booked for the day the vehicle would be idle anyway.',
      ]],
      ['How we run it for you', 'ul', [
        'One sheet per vehicle with the intervals above, adjusted for its real use.',
        'A standing appointment slot so the vehicle is never waiting behind walk-ins.',
        'Measurements, not opinions: brake thickness, tire depth and battery health recorded each visit so you can see wear coming.',
        'A direct line to the person who worked on the vehicle, not a service desk.',
      ]],
    ],
    takeaway: 'Service by hours as well as miles, put the intervals on one sheet per vehicle, and book the work for days the truck would sit anyway. Call us and we will build the sheet with you.',
  },
  {
    slug: 'brake-noise',
    nav: 'Brake squeal, grinding and what each one means',
    title: 'Brake Squeal vs Grinding: What the Noise Means, Lodi CA',
    meta: 'Squealing, grinding, clicking or a pulsing pedal: what each brake noise usually means, which ones can wait and which cannot, from a Lodi brake repair shop.',
    blurb: 'Squeal, grind, click or pulse: which brake noises can wait and which cannot.',
    icon: 'disc',
    sections: [
      ['Squealing', 'p', [
        'A high-pitched squeal when you brake is most often the wear indicator, a small metal tab designed to touch the rotor when the pad is nearly used up. It is a warning, not an emergency. You have some driving left, but the pads should be measured soon.',
        'A squeal only on the first stop of a cold morning, or after rain, is usually surface rust on the rotor and disappears within a few stops. That one is normal.',
      ]],
      ['Grinding', 'p', [
        'A low grinding or scraping that you can feel through the pedal means metal on metal: the pad material is gone and the steel backing plate is cutting into the rotor. Every mile now adds a rotor to the bill, and braking distance is longer than it should be. Do not wait on this one.',
      ]],
      ['Pulsing pedal or shaking wheel', 'p', [
        'If the pedal pulses under your foot or the steering wheel shakes when braking from speed, the rotor surface is no longer even. Sometimes it is thickness variation, sometimes deposits from overheated pads. It is not dangerous today, but it gets worse and it wears pads unevenly. We measure the rotor before deciding whether it can be resurfaced or needs replacing.',
      ]],
      ['Clicking, clunking or a pull to one side', 'ul', [
        '<strong>Click on the first press:</strong> often a pad shifting in its bracket. Cheap to fix, annoying to ignore.',
        '<strong>Clunk over bumps that changes when braking:</strong> usually suspension, not brakes. We check both.',
        '<strong>Pull to one side while braking:</strong> a sticking caliper or a collapsed hose. This one affects control and should be looked at promptly.',
      ]],
      ['What we do differently', 'p', [
        'We measure pad thickness and rotor condition on every corner and tell you the numbers. "Front pads at 3 mm, rears at 7 mm, rotors within spec" tells you exactly what needs doing now and what can wait. A parts list without measurements does not.',
      ]],
    ],
    takeaway: 'Squeal: book it soon. Grinding: stop driving on it. Pulsing: measure the rotors. Bring it in and we will give you the numbers, not a list.',
  },
];
