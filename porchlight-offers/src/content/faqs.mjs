/**
 * Global FAQ set. Rendered on the home page and /faq, and emitted as FAQPage
 * JSON-LD. Google only wants FAQ markup where the answers are genuinely on the
 * page and visible to users — these are.
 *
 * Answer honestly. In this industry the sites that convert best are the ones
 * that say plainly what a cash offer is and is not.
 */
export const faqs = [
  {
    q: 'How do you calculate my cash offer?',
    a: 'We start with what your house will be worth after it is repaired and updated (the after-repair value), based on recent nearby sales. Then we subtract the cost of the repairs it needs, our holding and closing costs, and our profit margin. What is left is your offer. We will walk you through every line of that math on the phone — if a buyer will not show you their numbers, that is a reason to be careful.',
  },
  {
    q: 'Will I get less than listing with a real estate agent?',
    a: 'On the sale price, usually yes. A cash offer trades some price for speed, certainty and zero costs. What matters is your net: with an agent you pay roughly 5–6% in commissions, 1–3% in seller closing costs, the repairs a buyer demands after inspection, and several more months of mortgage, taxes, insurance and utilities — plus the risk the buyer’s financing falls through. For a house in good shape with time to wait, listing usually nets more, and we will tell you that. For a house that needs work or a seller who needs out, the gap is often much smaller than people expect.',
  },
  {
    q: 'Are there any fees or commissions?',
    a: 'None. No commissions, no listing fees, no inspection fees, no appraisal, and we cover the standard seller closing costs. The number we agree on is the number wired to you, less any mortgage payoff, liens or unpaid property taxes that title must clear.',
  },
  {
    q: 'How fast can you actually close?',
    a: 'As fast as seven days once title is clear, and the average is closer to two to three weeks because that is how long title work and payoff statements take. If you need longer — 30, 60, 90 days — you pick the date. We schedule around you, not the other way around.',
  },
  {
    q: 'Do I need to clean, repair or stage anything?',
    a: 'No. Sell it exactly as it sits. No repairs, no cleaning, no staging, no cleanout, no lawn service. Take what you want and leave the rest behind.',
  },
  {
    q: 'Is the offer really no-obligation?',
    a: 'Yes. You get a written offer, you take as long as you want to think about it, and you can say no with no cost and no pressure. We do not use expiring offers or same-day deadlines.',
  },
  {
    q: 'Do you do a home inspection?',
    a: 'We do one walkthrough, usually 20 to 30 minutes, before we put the offer in writing. It exists so we can price the house accurately once — not so we can come back later and ask for a discount. Our contract price does not change after inspection.',
  },
  {
    q: 'Who pays the closing costs?',
    a: 'We do. Standard seller-side closing costs are on us. Your mortgage payoff, any liens, HOA dues and unpaid property taxes still come out of your proceeds, because those are debts against the property.',
  },
  {
    q: 'What kinds of houses do you buy?',
    a: 'Single-family homes, townhouses, condos, duplexes and small multifamily. Occupied, vacant, rented, inherited, damaged, condemned, hoarder condition, mid-foreclosure, or perfectly nice and simply unwanted. Condition is not a disqualifier.',
  },
  {
    q: 'Are you actually the buyer, or will you assign my contract to someone else?',
    a: 'We buy with our own funds and close in our own name. If a deal ever needs a partner’s capital we will tell you in writing before you sign. Ask every cash buyer this question — plenty of them are wholesalers who will shop your contract around, and you deserve to know which one you are talking to.',
  },
  {
    q: 'What if I still owe money on the house?',
    a: 'That is normal. The title company requests your payoff, pays the lender at closing, and wires you the difference. As long as the offer covers the payoff, an existing mortgage changes nothing about the process.',
  },
  {
    q: 'What information do you need to make an offer?',
    a: 'The address, roughly what condition it is in, and how to reach you. That is enough for a preliminary number, and the walkthrough firms it up. We do not need your Social Security number, bank details, or a credit check to give you an offer — no legitimate buyer does.',
  },
];

export const homeFaqs = faqs.slice(0, 8);
