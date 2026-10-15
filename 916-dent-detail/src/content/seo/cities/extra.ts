// Additional city-specific sections, merged in index.ts. Kept separate so each city's core copy stays readable.
export type CityExtra = { id: string; h2: string; paras: string[] };

export const cityExtras: Record<string, CityExtra[]> = {
  roseville: [
    {
      id: 'garages',
      h2: 'Parking structures and low ceilings',
      paras: [
        'Large retail centers often mix surface lots with multi-level parking structures. Structures help with sun and, in a rare storm, with hail, but they bring their own quirks: tight ramps, pillars at awkward angles and low clearances. If your car is parked in one at work, send us the level and any height limit. Our setup is compact, and for paintless work we mostly need light and a few feet of clearance around the damaged panel. Polishing and coating are better done in an open, well-lit space, so we may propose a different spot for those jobs.',
      ],
    },
  ],
  folsom: [
    {
      id: 'lakeside',
      h2: 'Picking a service by how the car lives',
      paras: [
        'A car that spends the day in a shaded garage at home and a covered structure at work needs a different plan from one that sits outdoors from dawn until dusk. Tell us where yours lives. For an outdoor car we lean toward a sealant or coating, regular decontamination and headlight care. For a garaged car, a light maintenance wash and periodic interior work may be all that is needed. Matching the service to the actual exposure saves you money, and we would rather sell you less than sell you something the car does not need.',
      ],
    },
  ],
  'rancho-cordova': [
    {
      id: 'combo',
      h2: 'Bundling work into one visit',
      paras: [
        'Because Rancho Cordova sits in the middle of the Highway 50 corridor, a visit here can often be combined with another job nearby. If you and a neighbor both want work done, or if you want to pair a dent repair with a detail, bundling saves a trip and usually saves you money on travel. When you contact us, mention anything else you would like done on the same visit, and any other cars at the same address.',
        'Apartment managers and small business owners can also ask about a standing visit day for several vehicles. That is a conversation, not a package, so describe the numbers and we will propose something realistic. We do not publish fixed fleet prices because they depend on the vehicles and the lot.',
      ],
    },
  ],
  'citrus-heights': [
    {
      id: 'estimate',
      h2: 'How we estimate on an older car',
      paras: [
        'An honest estimate on an older vehicle takes three things into account: the paint, the dents and the value of the car. We look at the condition of the clear coat first, because worn or faded paint limits what is worth doing. Then we count and size the dents, and we weigh the cost against what the repair adds. When the numbers do not add up, we say so. Sometimes the best advice is to fix the one dent that shows and ignore three that do not, or to polish out a scuff rather than chase a perfect panel.',
      ],
    },
  ],
  natomas: [
    {
      id: 'schedule',
      h2: 'Booking around a work schedule',
      paras: [
        'Many Natomas households have two commuters and one driveway, so the easy window is usually during the day while the cars are at home or at work. For driveway jobs, a window while you are at the office works well because we do not need you present for most work. Tell us where to park, leave the car unlocked or share a key arrangement that you are comfortable with, and we send a text when we start and when we finish.',
      ],
    },
  ],
  'west-sacramento': [
    {
      id: 'property',
      h2: 'For property managers and business owners',
      paras: [
        'If you manage a yard, a warehouse or an office park, a short conversation up front avoids problems later. Tell us who to check in with, where vehicles are parked, whether there are drainage points to avoid and whether you need proof of insurance. A certificate of insurance can be provided on request. We keep the work area tidy, remove our waste and leave the site as we found it. Scheduling several vehicles on one day makes the visit efficient, and we can propose a rotation if you have a regular need.',
      ],
    },
  ],
  davis: [
    {
      id: 'students',
      h2: 'Honest advice for a student budget',
      paras: [
        'Not every car in a college town needs much. If a car is worth little and the dent does not bother anyone, the right answer may be to do nothing, or to do one inexpensive thing, such as a deep clean that makes the car pleasant again. We will not talk anyone into a larger job than the car deserves. If you want to compare options, send photos and your budget, and we will tell you where the money does the most good.',
      ],
    },
  ],
  carmichael: [
    {
      id: 'steps',
      h2: 'What a sap-and-grime visit looks like',
      paras: [
        'A typical visit starts with a gentle wash to lift loose debris, followed by targeted treatment of sap spots with a solvent that softens them without harming the clear coat. Next, a clay treatment lifts what is still bonded to the paint, and we inspect the surface under light for any etching that remains. Light etching can be polished out. Deep etching may be reduced but not erased. We finish by protecting the paint, which makes the next cleaning easier. We will show you each affected spot before and after, so you can see what changed.',
      ],
    },
  ],
  'granite-bay': [
    {
      id: 'aftercare',
      h2: 'Aftercare you can do in your own driveway',
      paras: [
        'A finished car stays finished longer with a few habits. Wash with clean mitts and a two-bucket method, or choose a touchless wash. Dry with a soft, clean towel rather than a coarse one. Avoid automatic brush washes, which are where most swirls start. Rinse bird droppings and bug residue early, because they are acidic and etch faster in heat. If you ever have questions, text us a photo and we will tell you what we think.',
      ],
    },
    {
      id: 'plan',
      h2: 'How we plan a day for a larger project',
      paras: [
        'A coating project is planned backwards from the cure. We decide the time of day for application, the lighting we will use, how the car will be kept clean and dry afterward and what you need to do over the following days. We send these details ahead of the visit, along with a short checklist: clear the garage, plan where the car will sit overnight and keep pets and children away from the work area. If you want us to coordinate dent repair with polishing, we handle the dents first so the polish takes care of any residue.',
      ],
    },
  ],
  'el-dorado-hills': [
    {
      id: 'gate',
      h2: 'Arrival details that save time',
      paras: [
        'A short message before we arrive makes a visit smoother: the gate code or guest name, which side of the house to park on, where the outdoor tap and outlet are, and whether any dogs are loose. If you will not be home, tell us where the car keys will be, or whether the work can be done without them. We would rather ask five questions in advance than lose an hour at the gate.',
      ],
    },
    {
      id: 'heat',
      h2: 'Sun on a hillside and what it does to a car',
      paras: [
        'Cars parked on open driveways in a hot, dry area take more heat and UV than garaged ones. Trim fades, headlights cloud and unprotected paint loses depth faster. If your car sits outdoors, we suggest looking at trim, headlights and paint protection together rather than one at a time, since the same exposure affects all three. A sunshade for the windshield, a garage when possible and regular washing do more than people expect, and we are happy to say which of those is worth your attention before you spend money on a service.',
      ],
    },
  ],
  lincoln: [
    {
      id: 'prep',
      h2: 'Getting a truck ready for the visit',
      paras: [
        'A little preparation makes a big difference on a work truck. Empty the cab and bed of tools and loose items, tell us what is in the back and let us know if anything is sensitive. If the bed has a liner, say whether it is a drop-in, a spray-in or none, because each is cleaned differently. A truck that is parked on a flat, firm surface with some room around it is much easier to work on than one squeezed against a fence.',
      ],
    },
    {
      id: 'distance',
      h2: 'Making a long drive worth it',
      paras: [
        'Lincoln is far enough from the middle of our area that we plan visits there deliberately. We try to combine appointments in the same day and tell you the window in advance. If you have several things that need doing, such as a detail, a dent and a headlight job, it makes sense to book them together so the travel is spent once. If a neighbor wants work done too, let us know. Booking in a group is often the simplest way to keep the fee reasonable for everyone, and it gives you a firmer time slot.',
      ],
    },
  ],
  rocklin: [
    {
      id: 'photos',
      h2: 'Taking photos that give us a useful quote',
      paras: [
        'Good photos make a quote faster and more accurate. Shoot the damage in shade or on an overcast day, because direct sun washes out the shape of a dent. Take one picture straight on and one from a low angle, with a window or a building reflecting across the panel. Include a wide shot of the whole panel for context. If you have several dents, photograph each one on its own. Send them along with the make, model and year of the car.',
      ],
    },
    {
      id: 'sequence',
      h2: 'Fixing things in the right order',
      paras: [
        'When a car has several kinds of damage, the order matters. Dents come first, because repairing them can disturb the surrounding surface. Paint correction comes second, so that polishing removes any marks left by the dent work. Coating or sealant comes last, because it should lock in a finished surface, not a half-finished one. Interior work is independent and can happen at any point. If you are planning more than one service, tell us, and we will sequence them to avoid redoing anything, and to avoid paying twice for the same prep.',
      ],
    },
  ],
};
