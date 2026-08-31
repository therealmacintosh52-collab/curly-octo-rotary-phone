/**
 * "Situation" pages — the highest-intent non-geo keywords in this industry.
 * Someone searching "sell inherited house before probate closes" is far closer
 * to a signed contract than someone searching "home values".
 *
 * Nothing here is legal, tax or financial advice, and every page says so.
 */
export const situations = [
  {
    slug: 'inherited-house',
    nav: 'Inherited property',
    h1: 'Sell an Inherited House Without Fixing It Up',
    title: 'Sell an Inherited House Fast for Cash',
    description:
      'We buy inherited and probate properties as-is, work with your attorney ' +
      'and executor, and close on your timeline. No cleanout, no repairs, no fees.',
    keyword: 'sell inherited house',
    intro:
      'Inheriting a house usually means inheriting a to-do list: a mortgage or ' +
      'tax bill that keeps coming, decades of belongings, siblings in three ' +
      'states, and a probate process nobody explained. You do not have to ' +
      'renovate a house you never lived in to get value out of it.',
    pains: [
      'The house is full and nobody has time to empty it',
      'You are paying taxes, insurance and utilities on a vacant property',
      'Multiple heirs have to agree, and some live out of state',
      'Probate is not finished yet',
      'The house needs $40,000 of work before it would show well',
    ],
    help: [
      {
        h: 'Leave everything',
        p: 'Take what matters to you and walk away from the rest. We clear the house after closing — furniture, garage, attic, all of it.',
      },
      {
        h: 'We work with your attorney',
        p: 'We coordinate directly with the estate attorney, executor and title company. Heirs sign remotely; nobody has to fly in.',
      },
      {
        h: 'We can wait on the court',
        p: 'If probate is still open, we can lock the price now and close when the court allows. No pressure to close before you legally can.',
      },
      {
        h: 'One offer, split at closing',
        p: 'Title disburses each heir their share directly at closing, so no one is stuck fronting costs or chasing family for reimbursement.',
      },
    ],
    faqs: [
      {
        q: 'Can I sell an inherited house before probate is finished?',
        a: 'Sometimes — it depends on your state, the will, and whether an executor has been appointed with authority to sell. We can put the property under contract and close once the court signs off. Ask your probate attorney about your specific estate; we are buyers, not lawyers.',
      },
      {
        q: 'What if my siblings and I disagree?',
        a: 'All owners on title have to sign the contract. What we can do is give you one written number in hand, which is usually what turns an open-ended argument into a decision.',
      },
      {
        q: 'Will I owe taxes on the sale?',
        a: 'Inherited property generally receives a stepped-up cost basis as of the date of death, which often reduces or eliminates gain on a near-term sale. That is general information, not tax advice — confirm with a CPA before you sign anything.',
      },
    ],
  },
  {
    slug: 'foreclosure',
    nav: 'Behind on payments',
    h1: 'Behind on Payments or Facing Foreclosure',
    title: 'Stop Foreclosure by Selling Your House Fast',
    description:
      'Selling before the auction can protect your equity and your credit. We buy ' +
      'fast, pay cash, and can close before your sale date. Free, no-pressure offer.',
    keyword: 'stop foreclosure sell house',
    intro:
      'A foreclosure timeline is short and it does not pause because you are ' +
      'making calls. If you have equity, selling before the auction almost ' +
      'always beats losing the house at it — you keep what is left after the ' +
      'payoff instead of handing it to the lender.',
    pains: [
      'You have received a notice of default or a posted sale date',
      'Your lender will not take partial payments anymore',
      'A modification application has been pending for months',
      'You do not have cash for repairs or an agent commission',
      'You need to know today whether a sale can beat the auction date',
    ],
    help: [
      {
        h: 'We move on your deadline',
        p: 'Tell us the sale date. If a close is possible before it, we will tell you straight — and if it is not, we will tell you that too.',
      },
      {
        h: 'We talk to your lender',
        p: 'With your written authorization we request the payoff and coordinate with loss mitigation directly, so you are not repeating the story every week.',
      },
      {
        h: 'You keep the equity',
        p: 'At the auction the lender is made whole first and the rest is often gone. In a sale, the payoff and any liens come out of proceeds and the remainder is wired to you.',
      },
      {
        h: 'No cost to find out',
        p: 'We never charge for an offer or for reviewing your payoff. If keeping the house is realistic, we will point you at a HUD-approved housing counselor instead.',
      },
    ],
    faqs: [
      {
        q: 'Is it too late if a sale date is already posted?',
        a: 'Not necessarily. Deals close days before auction regularly, though it depends on your state, the lender, and how clean the title is. The sooner you call, the more options exist.',
      },
      {
        q: 'What if I owe more than the house is worth?',
        a: 'Then a cash sale at market value will not cover the payoff. In that case the paths are typically a short sale, a deed in lieu, or a modification. We will say so rather than waste your time.',
      },
      {
        q: 'Do you charge to help with this?',
        a: 'No. We make money by buying houses, not by charging homeowners fees. Anyone asking for money upfront to stop your foreclosure is a red flag — that is a common scam pattern.',
      },
    ],
  },
  {
    slug: 'house-needs-repairs',
    nav: 'House needs repairs',
    h1: 'Sell a House That Needs Major Repairs',
    title: 'We Buy Houses That Need Repairs — Sell As-Is for Cash',
    description:
      'Roof, foundation, mold, fire or water damage — we buy in any condition, ' +
      'as-is. No repairs, no cleaning, and no renegotiation after the inspection.',
    keyword: 'sell house as is needs repairs',
    intro:
      'A house that needs real work does not compete with the renovated one ' +
      'down the street. Financed buyers cannot get a loan on it, retail buyers ' +
      'discount it harder than the repairs actually cost, and every failed ' +
      'inspection puts the listing back on the market looking worse.',
    pains: [
      'Roof, foundation, HVAC or sewer line is at end of life',
      'Fire, smoke, storm or water damage',
      'Mold, asbestos, or an old oil tank',
      'Unpermitted additions or DIY work that will not pass',
      'A previous buyer already backed out after inspection',
    ],
    help: [
      {
        h: 'We do not ask you to fix anything',
        p: 'Not the roof, not the foundation, not the code violation. Our offer already accounts for the work because we are the ones doing it.',
      },
      {
        h: 'No inspection renegotiation',
        p: 'We inspect once, before we sign. The number on the contract is the number at closing — we do not come back for a discount at the end.',
      },
      {
        h: 'Nothing to clean out',
        p: 'Leave the debris, the appliances, the junk in the garage. Take what you want and hand us the keys.',
      },
      {
        h: 'Permits and violations are ours',
        p: 'Open permits, code letters, and unpermitted work become our problem at closing, not a condition you have to satisfy first.',
      },
    ],
    faqs: [
      {
        q: 'Do I have to disclose problems if you are buying as-is?',
        a: 'Yes — state disclosure law still applies, and you should disclose fully. It also helps you: surprises we find later are what cause other buyers to retrade the price. Tell us everything up front and the offer stands.',
      },
      {
        q: 'Will you still buy if the house is uninhabitable?',
        a: 'Usually, yes. Vacant, condemned, fire-damaged, and gutted houses are ordinary purchases for us.',
      },
    ],
  },
  {
    slug: 'tired-landlord',
    nav: 'Tired of being a landlord',
    h1: 'Sell a Rental Property — Tenants and All',
    title: 'Sell Your Rental Property Fast (Tenants Welcome)',
    description:
      'We buy rental properties with tenants in place, mid-lease, or after a bad ' +
      'turnover. No eviction required, no make-ready, no showings around tenants.',
    keyword: 'sell rental property with tenants',
    intro:
      'The math on a rental stops working long before you admit it: one bad ' +
      'turnover, a new roof, an insurance jump, and two years of cash flow is ' +
      'gone. Listing it on the retail market means either evicting a paying ' +
      'tenant or scheduling showings around them. Neither is fun.',
    pains: [
      'Tenants are mid-lease and you do not want to evict',
      'The unit needs a full make-ready you do not want to fund',
      'Rent no longer covers taxes, insurance and maintenance',
      'You inherited the property and never wanted to be a landlord',
      'You are managing it from another state',
    ],
    help: [
      {
        h: 'Sell it occupied',
        p: 'We buy with tenants in place and honor the existing lease. No eviction, no cash-for-keys, no vacancy.',
      },
      {
        h: 'No make-ready',
        p: 'Skip the paint, carpet and turn costs entirely. We price the property in its current condition.',
      },
      {
        h: 'One walkthrough, not thirty showings',
        p: 'Your tenants get one scheduled visit with proper notice instead of months of strangers in their home.',
      },
      {
        h: 'Portfolios welcome',
        p: 'Have several? We will price the whole package and close them together on one date.',
      },
    ],
    faqs: [
      {
        q: 'What happens to my tenants after you buy?',
        a: 'The lease transfers with the property and we honor it. Deposits transfer at closing and we notify the tenants in writing where to send rent.',
      },
      {
        q: 'What if my tenant is not paying?',
        a: 'We still buy. Ongoing evictions and non-paying tenants are situations we deal with regularly — you can hand the problem over at closing.',
      },
      {
        q: 'Will I owe capital gains tax?',
        a: 'Possibly, including depreciation recapture. If you want to defer it, tell us early — we can close into a 1031 exchange if your qualified intermediary is set up before closing. Talk to your CPA.',
      },
    ],
  },
  {
    slug: 'divorce',
    nav: 'Divorce',
    h1: 'Selling the House During a Divorce',
    title: 'Sell Your House Fast During a Divorce',
    description:
      'Divorce sales need speed, neutrality and a clean split. One written cash ' +
      'offer, a date you both choose, and proceeds disbursed per your agreement.',
    keyword: 'sell house during divorce',
    intro:
      'A house in a divorce is a shared bill that keeps arriving. Every month ' +
      'it stays unsold is another mortgage payment two people are arguing ' +
      'about, and a retail listing adds showings, repairs and negotiation to a ' +
      'situation with plenty of negotiation already.',
    pains: [
      'Neither party wants to fund repairs or staging',
      'Coordinating showings between two households is impossible',
      'You need a firm date to plan the rest of your lives around',
      'A court order or decree sets the terms of the sale',
      'One spouse has already moved out and both are still paying',
    ],
    help: [
      {
        h: 'One number, in writing',
        p: 'Both parties and both attorneys get the same written offer at the same time. No back-channel, no side deals.',
      },
      {
        h: 'A certain closing date',
        p: 'A firm date makes everything else in the settlement schedulable, instead of "whenever it sells".',
      },
      {
        h: 'Proceeds split at closing',
        p: 'Title disburses per your marital settlement agreement or court order. We follow the paperwork exactly.',
      },
      {
        h: 'Discreet, one visit',
        p: 'One walkthrough. No sign in the yard, no open house, no neighbors asking questions.',
      },
    ],
    faqs: [
      {
        q: 'Do both spouses have to sign?',
        a: 'Anyone on title must sign, and in community property and homestead states a non-title spouse often must sign too. Your attorney can confirm what your decree requires.',
      },
      {
        q: 'Can you close before the divorce is final?',
        a: 'Often yes, if both parties agree to the sale terms in writing. Many couples prefer to convert the house to cash first so there is a number to divide instead of an asset to fight over.',
      },
    ],
  },
  {
    slug: 'relocating',
    nav: 'Relocating',
    h1: 'Relocating and Need to Sell Fast',
    title: 'Sell Your House Fast When Relocating for Work',
    description:
      'Job transfer, military orders or a family move: close on the date you need, ' +
      'skip the repairs and showings, and stop carrying two housing payments.',
    keyword: 'sell house fast relocating job transfer',
    intro:
      'A relocation puts a hard date on something that normally has no date. ' +
      'Carrying a mortgage here and rent there eats a relocation package fast, ' +
      'and managing repairs and showings from another time zone is worse.',
    pains: [
      'A start date or PCS date you cannot move',
      'Two housing payments at once',
      'Managing a listing remotely',
      'You need certainty before you sign a lease in the new city',
      'You may need to stay a few extra weeks after closing',
    ],
    help: [
      {
        h: 'You pick the date',
        p: 'Close before you leave, or after — whatever fits the move. We work backward from your date.',
      },
      {
        h: 'Rent-back if you need it',
        p: 'Need to stay a couple weeks after closing? Ask. A short post-closing occupancy is usually workable.',
      },
      {
        h: 'Sign remotely',
        p: 'Remote online notarization and mobile notaries mean you can close from the new city. Funds are wired.',
      },
      {
        h: 'No holding costs',
        p: 'The mortgage, taxes, insurance, utilities and lawn care stop the day we close instead of six months into a listing.',
      },
    ],
    faqs: [
      {
        q: 'Can you close in under two weeks?',
        a: 'Frequently, yes. Cash purchases skip the appraisal and underwriting, so the schedule is set by title work rather than a lender.',
      },
      {
        q: 'What if my company offers a relocation buyout?',
        a: 'Compare both. A corporate buyout program may net you more — take the higher number. We will happily be the backup offer.',
      },
    ],
  },
  {
    slug: 'downsizing',
    nav: 'Downsizing',
    h1: 'Downsizing or Moving to Senior Living',
    title: 'Sell the Family Home When Downsizing',
    description:
      'Moving to a smaller home, assisted living or closer to family? Sell as-is ' +
      'with no repairs and no cleanout, and close when your new place is ready.',
    keyword: 'downsizing sell house as is',
    intro:
      'After thirty or forty years in one house, the hardest part of selling ' +
      'is rarely the price — it is the stairs, the stuff, and the timing. ' +
      'Nobody should have to renovate a home they are leaving, or empty it in ' +
      'a weekend.',
    pains: [
      'Decades of belongings to sort through',
      'The home is dated and would need real work to list',
      'Timing has to line up with a senior community waitlist',
      'Family lives out of state and cannot manage a listing',
      'A move-out deadline you cannot control',
    ],
    help: [
      {
        h: 'Take your time',
        p: 'We can hold a closing date for weeks while a community placement is finalized. No pressure and no expiring offer games.',
      },
      {
        h: 'Leave what you do not want',
        p: 'Take the photos and the heirlooms. Furniture and the rest can stay — we handle the cleanout.',
      },
      {
        h: 'Family can be involved',
        p: 'We are glad to walk through the numbers with adult children, a POA, or a trustee on the call.',
      },
      {
        h: 'No pressure, ever',
        p: 'Our offer is free and there is no obligation. If listing with an agent nets you more, we will say so.',
      },
    ],
    faqs: [
      {
        q: 'Can you work with a power of attorney or a trust?',
        a: 'Yes. POA and trust sales are routine — title will want to see the executed document and confirm the authority to sell.',
      },
      {
        q: 'What if the timing on my new place slips?',
        a: 'Tell us and we move the closing. A firm date is worth nothing if it strands you.',
      },
    ],
  },
  {
    slug: 'vacant-house',
    nav: 'Vacant or problem property',
    h1: 'Vacant, Hoarder, and Problem Properties',
    title: 'We Buy Vacant, Hoarder and Problem Houses for Cash',
    description:
      'Vacant houses, hoarder homes, code violations, liens, back taxes, squatters ' +
      '— if it is a problem property, it is an ordinary purchase for us.',
    keyword: 'we buy vacant hoarder houses',
    intro:
      'A vacant house is a liability that compounds: vandalism, burst pipes, ' +
      'code letters, an insurer that will not renew, and a city fine schedule ' +
      'that does not care why it sat empty. The longer it stays, the fewer ' +
      'buyers will touch it.',
    pains: [
      'The house has sat empty for months or years',
      'Hoarding conditions or heavy debris',
      'City code violations, fines, or a demolition notice',
      'Back taxes, judgments or a lien on title',
      'Squatters or an abandoned tenant belongings issue',
    ],
    help: [
      {
        h: 'We buy sight-clean',
        p: 'You do not have to clear a single room. We have cleaned out houses you could not walk through.',
      },
      {
        h: 'Liens paid at closing',
        p: 'Back taxes, judgments and most liens come out of the proceeds at closing. They rarely stop a sale — they just reduce the net.',
      },
      {
        h: 'Code cases handled',
        p: 'We take on open code violations and work with the city after closing. Bring us the letter.',
      },
      {
        h: 'Occupancy issues too',
        p: 'Squatters or holdover occupants are situations we have handled before and can take on at purchase.',
      },
    ],
    faqs: [
      {
        q: 'I owe back property taxes. Can I still sell?',
        a: 'Usually yes. The title company pays the taxing authority from your proceeds at closing and you receive the rest. If the taxes exceed the value, tell us and we will look at it honestly.',
      },
      {
        q: 'The house has been condemned. Is it worthless?',
        a: 'No — the lot has value, and often the structure does too. We buy condemned and demo-notice properties.',
      },
    ],
  },
];

export const situationBySlug = Object.fromEntries(
  situations.map((s) => [s.slug, s]),
);
