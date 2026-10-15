import type { ServiceDoc } from '../types';

export const headlightRestoration: ServiceDoc = {
  slug: 'headlight-restoration',
  plain: 'Clear Headlights',
  term: 'Headlight restoration',
  title: 'Headlight Restoration Sacramento | 916 Dent & Detail',
  description: 'Mobile headlight restoration in Sacramento. Yellowed, cloudy headlight lenses sanded, polished and sealed so you see and are seen better at night.',
  h1: 'Cloudy headlights, clear again.',
  lede: 'Yellow, foggy headlight lenses cut the light you get at night and make a car look older than it is. We resurface the lens and seal it, at your location, in a short visit.',
  icon: 'swirl',
  priceKey: null,
  priceNote: 'Headlight work is priced per pair and depends on lens condition. Send a photo of each headlight for an estimate.',
  typicalTime: 'A pair of headlights is usually a short job relative to a full detail, and can be added to another service visit.',
  sections: [
    {
      id: 'what',
      h2: 'Headlight restoration: what is actually wrong with your lenses',
      paras: [
        'Most modern headlight lenses are made of polycarbonate, a tough clear plastic. Manufacturers apply a hard clear coating to protect it from UV light. Over the years, sun, heat, road grit and cleaning chemicals wear that coating away. Once it is gone, the plastic underneath oxidizes, and turns yellow, hazy or chalky. The cloudiness is on the outside of the lens, which is why it can be removed.',
        'Restoration takes off the failed outer layer and the oxidation beneath it, then smooths the lens and applies a new UV-protective layer. Done properly, the lens returns to clear and the light output on the road improves. Done badly, with a quick spray-on product and no sealing, the yellowing comes back within months.',
      ],
    },
    {
      id: 'sun',
      h2: 'Why Sacramento sun is hard on headlights',
      paras: [
        'Long hours of strong sunlight and high summer temperatures are the main causes of lens oxidation, and cars that live outdoors are at a disadvantage. Parking nose-in against a sunny wall, a long daily commute facing the sun, or a car left in an unshaded lot all expose the lenses to more UV. Garaged cars generally stay clearer for longer.',
        'We do not have local figures on how fast lenses cloud in the Valley, and it varies by car, plastic and how much the lenses are exposed. What matters is that the sealing step is not skipped, because the new UV layer is what slows the return of yellowing.',
      ],
    },
    {
      id: 'process',
      kind: 'steps',
      h2: 'How we restore a headlight lens',
      steps: [
        { title: 'Clean and mask', body: 'We wash the lens and the area around it, then mask the paint and trim so the sanding stage cannot touch them.' },
        { title: 'Wet sand through grits', body: 'Starting with the coarsest grit needed to remove the failed layer, we sand the lens evenly, then move through finer grits. This takes the lens from rough and uniformly matte to a smooth, hazy finish.' },
        { title: 'Machine polish', body: 'A polisher and compound bring clarity back to the plastic. The lens should look clear at this stage, but unprotected.' },
        { title: 'Wipe and seal', body: 'The lens is wiped clean of all oils and sealed with a UV-protective clear coating or a ceramic-style lens sealer. This is the step that decides how long the result lasts.' },
        { title: 'Cure and inspect', body: 'The sealer needs time to cure, and we tell you how long to keep the car dry. We check the lens in light and compare both sides for evenness.' },
      ],
    },
    {
      id: 'who',
      h2: 'Who should get their headlights restored',
      paras: ['Restoration makes sense in a few common situations:'],
      bullets: [
        'Your headlights look yellow or foggy, and night driving feels dimmer than it used to.',
        'You are selling or trading in a car, where dull headlights make it look tired.',
        'You are facing an inspection or want to improve visibility without replacing the headlight assemblies.',
        'The car is otherwise in good condition and a pair of new headlight assemblies would cost far more than a restoration.',
      ],
    },
    {
      id: 'expect',
      h2: 'What to expect from the visit',
      paras: [
        'We can restore headlights at your home or work. The job is not messy, but it does use water during the sanding stage, so we plan where the water goes and keep it off the street. We mask surrounding paint, work one lens at a time and compare the pair at the end.',
        'After the visit, keep the car out of the rain and avoid washing it for the period we specify while the sealer cures. Afterwards, regular care helps the result last: a quality wax or sealant on the lens, parking in shade when possible and avoiding harsh chemical cleaners.',
        'Restoration can be done alongside other services, such as a full detail or paint correction, which is often more convenient and can make sense on an older car.',
      ],
    },
    {
      id: 'limits',
      kind: 'limits',
      h2: 'When restoration will not work',
      paras: ['Restoration fixes outside oxidation, not every kind of headlight problem. These situations are outside what it can do:'],
      bullets: [
        'Moisture or condensation inside the lens. That means the seal has failed and the housing needs repair or replacement.',
        'Cracks and deep pitting. Heavy stone damage can be too deep to sand away safely.',
        'Yellowing that is on the inside of the lens, which can occur on some designs.',
        'Failed reflectors or bulbs. A restored lens will not fix a dim bulb or a dull reflector.',
        'Lenses already restored several times, where too little material is left to remove.',
      ],
      after: [
        'If your headlights fall into one of these categories, we will tell you before we start. Sometimes replacement is the sensible answer, and we would rather tell you that than take your money for a restoration that will not hold.',
      ],
    },
  ],
  faqs: [
    {
      q: 'Why are my headlights yellow and cloudy?',
      a: 'The factory UV coating on the lens wears away over time with sun and heat. Once it is gone, the plastic underneath oxidizes and turns yellow or hazy.',
    },
    {
      q: 'How long will a headlight restoration last?',
      a: 'It depends on the sealing step, the exposure to sun and how the car is cared for. A properly sealed lens lasts much longer than one that is only polished. We do not promise a specific duration.',
    },
    {
      q: 'Is it better to restore or replace headlights?',
      a: 'If the lens is oxidized on the outside, restoration is usually far cheaper than replacing the assembly. If there is moisture inside, a crack or deep pitting, replacement may be necessary.',
    },
    {
      q: 'Will restoring headlights improve night driving?',
      a: 'It often improves how much light reaches the road because the lens is clearer. The improvement depends on how bad the lens was and the condition of the bulbs and reflectors.',
    },
    {
      q: 'Are those DIY kits any good?',
      a: 'Some work for a while, but many skip proper UV sealing, so yellowing returns. The sealing step matters most.',
    },
    {
      q: 'Can I wash my car after a headlight restoration?',
      a: 'Keep the car dry for the curing time we tell you for the sealer. After that, normal gentle washing is fine.',
    },
    {
      q: 'Do you restore both headlights in one visit?',
      a: 'Yes. We always do the pair, so they match, and the work can be combined with other services.',
    },
  ],
  related: ['paint-correction', 'mobile-detailing', 'ceramic-coating'],
  blogs: ['how-often-to-wax-or-coat-central-valley', 'dealership-trade-in-prep', 'is-a-mobile-detailer-legit'],
  cities: ['sacramento', 'carmichael', 'citrus-heights', 'rancho-cordova'],
};
