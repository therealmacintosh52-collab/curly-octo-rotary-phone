/**
 * State hub pages. Each state gets one, sitting above its metros and cities.
 *
 * The point of a state hub is the stuff that is genuinely state-level: the
 * foreclosure process, how probate works, what insurance is doing to sales.
 * That is also why expanding to a new state is not a copy-paste job — this
 * content has to be written (and lawyer-checked) per state.
 *
 * General information only. Nothing here is legal or tax advice, and every
 * page says so.
 */
export const states = [
  {
    slug: 'texas',
    name: 'Texas',
    abbr: 'TX',
    h1: 'We Buy Houses in Texas — Cash, As-Is, On Your Timeline',
    title: 'We Buy Houses in Texas | Cash Offer in 24 Hours',
    description:
      'Sell your Texas house fast for cash — Dallas–Fort Worth, Houston, San ' +
      'Antonio and Austin. Any condition, no repairs, no commissions, and you ' +
      'pick the closing date.',
    intro:
      'Texas has no state income tax and correspondingly high property taxes, ' +
      'which makes holding an empty or unwanted house genuinely expensive. It ' +
      'also has one of the fastest foreclosure processes in the country. Both ' +
      'facts push the same way: if you are going to sell, the cost of waiting is ' +
      'higher here than most places.',
    points: [
      {
        h: 'Foreclosure moves fast',
        p: 'Texas is a non-judicial state and sales are held on the first Tuesday of the month. Once a sale is posted the window is short — if you have equity, selling before the auction usually protects it.',
      },
      {
        h: 'Probate is unusually workable',
        p: 'Independent administration and muniment of title let many estates sell without a court supervising every step. We work with your attorney on whichever path your estate is on.',
      },
      {
        h: 'Foundations and hail',
        p: 'Clay soils move slabs and storms take roofs. Both are priced into our offer instead of being a repair list handed back to you.',
      },
      {
        h: 'Taxes make waiting costly',
        p: 'Between the tax bill, insurance and utilities, a vacant Texas house can quietly cost several hundred dollars a month while it sits on the market.',
      },
    ],
    faqs: [
      {
        q: 'How fast can you close in Texas?',
        a: 'As fast as seven days once title is clear, with most closings landing in two to three weeks. Texas closings run through a title company, and that timeline is set by title work and payoff statements rather than by us.',
      },
      {
        q: 'Can you close before a first-Tuesday foreclosure sale?',
        a: 'Often, yes — deals close days before auction regularly. It depends on your lender, your payoff and how clean the title is. Call as early as you can; options narrow quickly once a sale is posted.',
      },
      {
        q: 'Do I need a real estate attorney in Texas?',
        a: 'Texas closings are handled by title companies rather than attorneys, so one is not required for a straightforward sale. For probate, divorce or a contested title, get your own attorney — and we are glad to work with them.',
      },
    ],
  },
  {
    slug: 'california',
    name: 'California',
    abbr: 'CA',
    h1: 'We Buy Houses in California — Cash, As-Is, No Repairs',
    title: 'We Buy Houses in California | Fast Cash Offer',
    description:
      'Sell your California house fast for cash — Los Angeles, the Inland ' +
      'Empire, Sacramento and the Central Valley. Any condition, tenants ' +
      'welcome, no repairs, no fees.',
    intro:
      'California owners usually have the opposite problem from everyone else: ' +
      'a lot of equity locked inside a house that would cost a fortune to bring ' +
      'up to retail standard. Construction costs, permit timelines, tenant ' +
      'protections and an insurance market in retreat all make the traditional ' +
      'path slower and more expensive here than almost anywhere.',
    points: [
      {
        h: 'Tenants make a retail sale hard',
        p: 'Statewide just-cause and rent-cap rules mean removing a tenant to sell is slow, expensive and often not possible. We buy occupied and honor the lease, so you never have to try.',
      },
      {
        h: 'Repairs cost more than you think',
        p: 'Permits, prevailing labor rates and retrofit requirements — soft-story, seismic, sewer lateral — turn a modest repair list into six figures fast. Our offer already carries that cost.',
      },
      {
        h: 'Insurance is a live problem',
        p: 'Non-renewals in wildfire areas can leave a house effectively unfinanceable for a retail buyer. Paying cash removes the lender, and with it the insurance requirement.',
      },
      {
        h: 'Probate takes real time',
        p: 'California probate is court-supervised and often runs many months. We can agree a price now and close when the court allows, rather than pushing you to move faster than the law does.',
      },
    ],
    faqs: [
      {
        q: 'Can I sell my California house with tenants in it?',
        a: 'Yes. We buy occupied property, take the lease as it stands, and the security deposit transfers at closing. You do not have to serve notice, pay relocation, or attempt a just-cause termination.',
      },
      {
        q: 'What about my Proposition 13 tax basis?',
        a: 'Selling generally ends the low assessed value for the new owner, and rules on transferring a base year value to a replacement home are narrow — Proposition 19 tightened them considerably. Talk to a CPA before you decide; this affects your net more than most sellers expect.',
      },
      {
        q: 'Do you buy houses with unpermitted additions?',
        a: 'Routinely. Unpermitted square footage, converted garages and ADUs built without a permit are among the most common reasons a financed sale collapses here — and among the least of our concerns.',
      },
    ],
  },
  {
    slug: 'florida',
    name: 'Florida',
    abbr: 'FL',
    h1: 'We Buy Houses in Florida — Storm Damage and All',
    title: 'We Buy Houses in Florida | Cash Offer, Any Condition',
    description:
      'Sell your Florida house fast for cash — Jacksonville, Tampa Bay, ' +
      'Orlando and Southwest Florida. Old roof, flood zone or storm damage: we ' +
      'still buy.',
    intro:
      'In Florida the thing that stops a sale usually is not the house — it is ' +
      'the insurance. Carriers refuse older roofs, premiums have climbed past ' +
      'what some owners can carry, and a buyer who cannot get a policy cannot ' +
      'get a mortgage. Add flood zones, storm damage and rising association ' +
      'assessments and a perfectly solid house can sit for months.',
    points: [
      {
        h: 'Roof age kills financed deals',
        p: 'Insurers routinely decline to write on an older roof, and no policy means no loan. Replacing it first costs you five figures; selling to us does not.',
      },
      {
        h: 'Storm damage is normal here',
        p: 'Tarped, mid-claim, half-repaired or gutted — we buy in that condition. Talk to us before assigning your claim benefits to anyone.',
      },
      {
        h: 'Flood zones and elevation rules',
        p: 'Substantial repairs in a flood zone can trigger requirements to elevate the structure, which stops most buyers cold. A cash purchase absorbs it.',
      },
      {
        h: 'Owners who live somewhere else',
        p: 'A lot of Florida property is held from out of state. Everything can be signed remotely with a mobile or online notary, and funds are wired.',
      },
    ],
    faqs: [
      {
        q: 'Will you buy a house with an old roof or open insurance claim?',
        a: 'Yes to both. An aging roof is one of the most common reasons a Florida seller calls us, and we buy houses with claims open or already settled. You keep proceeds you have already been paid unless your contract says otherwise.',
      },
      {
        q: 'How long does foreclosure take in Florida?',
        a: 'Florida is a judicial foreclosure state, so the lender has to sue and the process usually takes considerably longer than in non-judicial states. That extra time is an opportunity: it is usually enough to sell and protect your equity rather than lose it at a courthouse sale.',
      },
      {
        q: 'I inherited a Florida house — is it complicated?',
        a: 'It can be. Florida homestead law restricts who property can be left to when there is a surviving spouse or minor child, and that shapes who must sign. It is very workable, but get a Florida probate attorney involved early; we will coordinate with them.',
      },
    ],
  },
];

export const stateBySlug = Object.fromEntries(states.map((s) => [s.slug, s]));
export const stateByName = Object.fromEntries(states.map((s) => [s.name, s]));
