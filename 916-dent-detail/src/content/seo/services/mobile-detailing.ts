import type { ServiceDoc } from '../types';

export const mobileDetailing: ServiceDoc = {
  slug: 'mobile-detailing',
  plain: 'Mobile Detail',
  term: 'Mobile car detailing',
  title: 'Mobile Car Detailing Sacramento | 916 Dent & Detail',
  description: 'Mobile car detailing in Sacramento. Interior and exterior detail at your home or office with low-water methods. See what is included and how to book.',
  h1: 'A full detail, in your driveway.',
  lede: 'Skip the drop-off and the waiting room. We bring the detail to the car, clean it inside and out, and leave the place we worked cleaner than we found it.',
  icon: 'clay',
  priceKey: null,
  priceNote: 'Detail pricing depends on vehicle size and condition. See the pricing page, or send a photo for an estimate.',
  typicalTime: 'A full interior and exterior detail takes real hours, more for large vehicles or neglected paint. We give a realistic window when you book.',
  sections: [
    {
      id: 'what',
      h2: 'What mobile car detailing includes',
      paras: [
        'A detail is not a wash. A wash removes loose dirt from the surface. A detail is a deep, methodical clean of every surface, done slowly with the right tools, and the aim is to bring the car as close as possible to how it looked when it was new. Mobile means that the work is performed at your location, in the space where the car is parked, instead of at a shop.',
        'We structure a mobile detail around two halves. The exterior is a careful hand wash, wheel and tire cleaning, decontamination of the paint so that it feels smooth rather than gritty, and a protective layer of wax or sealant. The interior is a thorough vacuum, a wipe-down and cleaning of hard surfaces, cleaning of glass, and care of seats and carpets according to material. Specific services are described on their own pages, and you can mix and match.',
      ],
    },
    {
      id: 'water',
      h2: 'Water, power and the mess question',
      paras: [
        'The first thing most people ask is where the water goes. A responsible mobile detailer uses low-water methods and does not let wash water run into the street, because discharging wash water, soap or cleaning agents into a storm drain is not permitted. Storm drains in the Sacramento area lead to local waterways without treatment, and the rule is that only rain should go down them. We keep our rinse to the area being worked, and use low-water products where they do the job.',
        'On power, most of the equipment we use for a detail runs on a modest supply. If you have an outdoor outlet and a tap we can use, it helps, but tell us when you book if you do not, and we will plan around it. We would rather know in advance than discover on arrival that there is nothing to plug in.',
      ],
    },
    {
      id: 'process',
      kind: 'steps',
      h2: 'How a mobile detail visit works',
      steps: [
        { title: 'Tell us about the car', body: 'Make, model, condition, and what bothers you most: pet hair, spills, swirl marks, dull paint, a smell. Photos of the worst areas help us plan the visit.' },
        { title: 'We confirm the scope and the window', body: 'You get a realistic time window and a clear description of what is included. If the car needs more than a standard detail, such as heavy pet hair or a spill that has set, we say so before we begin.' },
        { title: 'Set-up and walk-around', body: 'We walk the car with you if you are there, noting existing scratches and problem areas. That protects both of us.' },
        { title: 'Interior first, then exterior', body: 'We do the inside before the outside so that dust and debris from the cabin do not end up on clean paint. Wheels and tires come first on the exterior, then the wash, decontamination and protection.' },
        { title: 'Final check', body: 'We check panels under light, glass from both sides, and the cabin in daylight. You see the finished car before we pack up.' },
      ],
    },
    {
      id: 'who',
      h2: 'Who mobile detailing suits best',
      paras: ['Mobile service is a good fit if any of these sound like your week:'],
      bullets: [
        'Busy households and commuters who cannot spare a half-day at a shop.',
        'Offices that want to offer a car-care perk, with several cars done in one visit.',
        'Car owners selling or trading in a vehicle, where a deep clean tends to help a first impression.',
        'People with cars that are already coated or corrected who want maintenance rather than a full redo.',
        'Anyone with a car that is hard to drive, such as one waiting on a dent repair or a recent paint job.',
      ],
    },
    {
      id: 'expect',
      h2: 'What to expect, and how to get the most from a visit',
      paras: [
        'Clear out personal items before we arrive. We do not move or sort belongings and prefer not to be responsible for them. Remove loose items from the cabin, the glovebox and the trunk, and tell us about any child seats that need to be taken out or stay in.',
        'Shade is helpful, because chemicals and water spots behave badly on a hot panel. The Sacramento summer is demanding on paint, so we often work in the morning, or in the lee of a building or tree, and may ask to move the car a short distance. If your car lives in a garage, we can often work there with the door open.',
        'A detail is not a repair. A deep scratch, a chip or a dent will still be there after a detail, though a good clean can make them less noticeable. If you want those fixed, we do paint correction and paintless dent repair, and we can combine the work in one visit.',
      ],
    },
    {
      id: 'limits',
      kind: 'limits',
      h2: 'What a detail will not do',
      paras: ['So that the result is never a surprise, here is what detailing cannot achieve:'],
      bullets: [
        'Remove deep scratches that have gone through the clear coat. Those need paint repair.',
        'Reverse sun-faded or failing clear coat. A detail can improve the look, but peeling clear coat needs refinishing.',
        'Eliminate every stain. Some dyes, mold damage and old spills can be improved but not always removed.',
        'Remove every odor. Smoke, spills and mold can be reduced, and some smells need deeper treatment.',
        'Fix mechanical or electrical faults, or clean an engine bay unless you ask us about it first.',
      ],
    },
  ],
  faqs: [
    {
      q: 'Do you need access to my water and power?',
      a: 'It helps to have an outdoor tap and outlet, but tell us at booking if you do not. We use low-water methods and plan the visit around what is available.',
    },
    {
      q: 'Where does the wash water go?',
      a: 'We keep rinse water to the area being worked and use low-water methods. Discharging wash water into storm drains is not permitted in the Sacramento area, and we do not let it run into the street.',
    },
    {
      q: 'How long does a mobile detail take?',
      a: 'It depends on the vehicle size, its condition and the scope you choose. We give a time window when you book and tell you early if the car needs more than expected.',
    },
    {
      q: 'Can you detail my car at my office?',
      a: 'Usually yes, with permission from the property. Tell us the parking location and whether we need a gate code or visitor pass. Some buildings restrict water use, so ask first.',
    },
    {
      q: 'Do I need to be there?',
      a: 'Not for the whole visit. We like to do a walk-around at the start and show you the result at the end, but many customers are away in between.',
    },
    {
      q: 'What is the difference between a wash and a detail?',
      a: 'A wash removes surface dirt. A detail is a deep clean of every surface, including decontamination of the paint and protection, and a careful interior clean.',
    },
    {
      q: 'What if it rains?',
      a: 'Exterior work depends on the weather. If rain is forecast we will reschedule or move the work into a garage if one is available. Interior work can usually go ahead.',
    },
  ],
  related: ['interior-detailing', 'paint-correction', 'ceramic-coating'],
  blogs: ['how-long-does-mobile-detailing-take', 'is-a-mobile-detailer-legit', 'how-often-to-wax-or-coat-central-valley'],
  cities: ['sacramento', 'elk-grove', 'folsom', 'el-dorado-hills'],
};
