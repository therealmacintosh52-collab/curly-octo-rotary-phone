/**
 * Blog posts. These exist to rank for research-stage queries and to earn links
 * — the transparency posts ("here is our actual formula", "here is how to spot
 * a scam") are what get cited by local news and forums.
 *
 * Body is trusted HTML authored here, not user input.
 */
export const posts = [
  {
    slug: 'how-cash-home-buyers-calculate-offers',
    title: 'How Cash Home Buyers Calculate Offers (The Actual Formula)',
    description:
      'The 70% rule, after-repair value, holding costs and margin — the real ' +
      'math behind a cash offer on your house, with a worked example.',
    date: '2026-01-14',
    updated: '2026-06-02',
    tags: ['Cash offers', 'How it works'],
    minutes: 7,
    body: `
<p>Most "we buy houses" companies will not show you their math. There is no good reason for that, so here is ours in full. Every legitimate cash buyer in the country uses some version of this formula.</p>

<h2>The formula</h2>
<p class="callout"><strong>Offer = After-Repair Value − Repair Costs − Holding &amp; Selling Costs − Profit Margin</strong></p>
<p>Four inputs. Change any one of them and the offer changes. Understanding them is how you tell a fair offer from a lowball one.</p>

<h3>1. After-Repair Value (ARV)</h3>
<p>This is what your house would sell for on the open market <em>after</em> it has been renovated to current buyer standards — not what it is worth today. It comes from recent sales of comparable renovated homes nearby: similar square footage, similar bed and bath count, ideally within a mile and sold in the last 90 days.</p>
<p>Ask any buyer which three comps they used. If they will not name the addresses, the ARV is not real.</p>

<h3>2. Repair costs</h3>
<p>What it will actually take to get the house to that standard. Roof, foundation, HVAC, plumbing, electrical, windows, kitchen, baths, flooring, paint, landscaping. On a mid-size older home this commonly lands between $30,000 and $80,000, and a full gut can run well past that.</p>
<p>This is the line where sellers and buyers disagree most, and often for a fair reason: you are pricing repairs at "what it would cost me to live here", and the buyer is pricing them at "what it costs to make this sell against renovated competition".</p>

<h3>3. Holding and selling costs</h3>
<p>The buyer owns the house through the renovation and resale — typically four to eight months. During that time they pay property taxes, insurance (vacant-property policies cost more), utilities, loan interest if the money is borrowed, and then the agent commissions and closing costs when it resells. Budget roughly 10–15% of ARV.</p>

<h3>4. Profit margin</h3>
<p>This is a business, and the business carries the risk that the roof is worse than it looked or the market softens mid-renovation. Margins usually run 10–20% of ARV depending on the deal size and how much uncertainty is in it.</p>

<h2>A worked example</h2>
<table class="data-table">
  <tbody>
    <tr><th scope="row">After-repair value</th><td>$300,000</td></tr>
    <tr><th scope="row">Repairs needed</th><td>−$55,000</td></tr>
    <tr><th scope="row">Holding &amp; selling costs (12%)</th><td>−$36,000</td></tr>
    <tr><th scope="row">Profit margin (12%)</th><td>−$36,000</td></tr>
    <tr class="total"><th scope="row">Cash offer</th><td>$173,000</td></tr>
  </tbody>
</table>
<p>Seeing $173,000 on a $300,000 house feels bad until you run the alternative honestly. To get that $300,000 you would first spend the $55,000 on repairs, then pay about $18,000 in commissions and $6,000 in seller closing costs, then carry the house for four to six months. Net: roughly $210,000 — <em>if</em> the renovation stays on budget, <em>if</em> nothing fails inspection, and <em>if</em> your buyer's financing holds.</p>
<p>The real gap in this example is about $37,000, and what you are buying with it is certainty, no out-of-pocket cost, and a closing date you choose. For some sellers that is a bad trade. For others it is obviously worth it. Both answers are legitimate — the point is that you should be able to see the numbers before deciding.</p>

<h2>The "70% rule" you will see online</h2>
<p>A common shorthand is that investors pay about 70% of ARV minus repairs. It is a rough screening heuristic, not a law. In hot markets with reliable comps, offers run higher — 75–85% is common on houses that need light work. On unusual properties, rural lots, or houses with major structural unknowns, they run lower because the risk is higher.</p>

<h2>Four questions that separate real buyers from tire-kickers</h2>
<ol>
  <li><strong>What ARV did you use, and which comps?</strong> A real buyer names addresses.</li>
  <li><strong>What repair number is in your offer?</strong> Vagueness here usually means the price will drop later.</li>
  <li><strong>Are you buying with your own funds, or assigning this contract?</strong> Wholesalers shop your contract to other investors. That is legal in most states, but you should know which one you are dealing with.</li>
  <li><strong>Can you show proof of funds?</strong> A bank letter or statement, dated recently. Anyone who cannot produce one cannot close.</li>
</ol>

<h2>The bottom line</h2>
<p>A cash offer is a trade: some price for speed, certainty, and zero cost or effort. A fair buyer shows you exactly what they subtracted and why, then lets you decide without a countdown clock. If the number does not work for you, listing is the right call — and any buyer worth talking to will tell you so.</p>
`,
  },
  {
    slug: 'cash-offer-vs-realtor-net-proceeds',
    title: 'Cash Offer vs. Realtor: How to Compare Your Net',
    description:
      'A side-by-side net-proceeds comparison of a cash sale and a traditional ' +
      'listing, including the costs most sellers forget to count.',
    date: '2026-02-20',
    updated: '2026-05-18',
    tags: ['Cash offers', 'Selling costs'],
    minutes: 6,
    body: `
<p>Sellers compare the wrong two numbers. They compare the cash offer to the list price. The number that actually lands in your bank account is <em>net proceeds</em>, and the two paths look much closer once everything is counted.</p>

<h2>What comes out of a traditional sale</h2>
<ul>
  <li><strong>Agent commissions — 5–6% of the sale price.</strong> Post-2024 rule changes made buyer-agent compensation negotiable, but in practice most sellers still contribute something.</li>
  <li><strong>Seller closing costs — 1–3%.</strong> Title policy, escrow fees, transfer taxes, prorated property taxes, HOA transfer fees, recording fees.</li>
  <li><strong>Pre-listing repairs and cleanup.</strong> Paint, flooring, landscaping, the "make it show well" list.</li>
  <li><strong>Post-inspection concessions.</strong> The buyer's inspector finds items and asks for credits. On an older house this is routinely $5,000–$15,000.</li>
  <li><strong>Holding costs while it sits.</strong> Mortgage, taxes, insurance, utilities, lawn care — for every month on market plus the 30–45 days of escrow.</li>
  <li><strong>The risk of falling out of contract.</strong> A meaningful share of financed deals collapse, most often on financing or appraisal, and the listing goes back to market looking stale.</li>
</ul>

<h2>What comes out of a cash sale</h2>
<ul>
  <li>No commissions.</li>
  <li>No seller closing costs (we cover them).</li>
  <li>No repairs, no cleaning, no staging.</li>
  <li>No inspection renegotiation.</li>
  <li>Days to weeks of holding costs instead of months.</li>
  <li>No financing contingency, so no appraisal gap and no lender surprise.</li>
</ul>
<p>What comes out instead is a lower gross price. That is the whole trade.</p>

<h2>Side by side: a $300,000 house needing $55,000 of work</h2>
<table class="data-table">
  <thead><tr><th scope="col">Line</th><th scope="col">Listing with an agent</th><th scope="col">Cash sale</th></tr></thead>
  <tbody>
    <tr><th scope="row">Sale price</th><td>$300,000</td><td>$173,000</td></tr>
    <tr><th scope="row">Repairs to be sale-ready</th><td>−$55,000</td><td>$0</td></tr>
    <tr><th scope="row">Commissions (6%)</th><td>−$18,000</td><td>$0</td></tr>
    <tr><th scope="row">Seller closing costs (2%)</th><td>−$6,000</td><td>$0</td></tr>
    <tr><th scope="row">Inspection concessions</th><td>−$5,000</td><td>$0</td></tr>
    <tr><th scope="row">Holding costs (5 months)</th><td>−$9,000</td><td>−$400</td></tr>
    <tr class="total"><th scope="row">Estimated net</th><td>$207,000</td><td>$172,600</td></tr>
    <tr><th scope="row">Time to cash</th><td>4–7 months</td><td>7–21 days</td></tr>
    <tr><th scope="row">Out of pocket before closing</th><td>$55,000+</td><td>$0</td></tr>
    <tr><th scope="row">Risk of the deal collapsing</th><td>Real</td><td>Minimal</td></tr>
  </tbody>
</table>
<p>Illustrative numbers, not a quote. Run yours with your own repair estimate and holding costs.</p>

<h2>When listing wins</h2>
<p>List it if the house is in good condition, you can afford to wait, you have cash for repairs and the patience for showings, and there is no deadline pressing on you. In that scenario an agent will almost always net you more, and we will tell you so on the phone rather than pretend otherwise.</p>

<h2>When a cash offer wins</h2>
<p>Take the cash offer if the house needs work you cannot or will not fund; if you are carrying two housing payments; if a foreclosure, divorce, probate, or relocation date is driving the calendar; if the property is vacant and costing you money every month; if you are done being a landlord; or if certainty is simply worth more to you than the last $30,000.</p>

<h2>The honest test</h2>
<p>Get both numbers. Ask an agent for a realistic net sheet at a realistic list price for the house's actual condition — not a flattering one — and ask a cash buyer for a written offer with the math shown. Then compare net to net, and time to time. That is the only comparison that means anything.</p>
`,
  },
  {
    slug: 'we-buy-houses-scam-red-flags',
    title: '9 Red Flags of a "We Buy Houses" Scam',
    description:
      'How to tell a legitimate cash home buyer from a predatory one: upfront ' +
      'fees, price retrading, contract assignment, deed tricks and pressure ' +
      'tactics.',
    date: '2026-03-11',
    updated: '2026-07-08',
    tags: ['Consumer protection'],
    minutes: 8,
    body: `
<p>Most cash buyers are ordinary local businesses. A minority are predatory, and they concentrate exactly where people are most vulnerable — foreclosure lists, probate filings, code-violation records. Here is how to tell them apart, including when you are evaluating us.</p>

<h2>1. They ask you for money upfront</h2>
<p>An application fee, a "processing" fee, an inspection fee, an earnest-money deposit paid <em>by you</em>. A buyer pays a seller, never the reverse. Any upfront request is a hard stop.</p>

<h2>2. They will not show proof of funds</h2>
<p>Ask for a recent bank statement or a bank letter. A real cash buyer has one ready. "Our funding partner will provide it later" means they do not have the money and intend to find someone who does.</p>

<h2>3. They lower the price after you are under contract</h2>
<p>The classic bait-and-switch: an attractive number to get your signature, then a "discovery" during due diligence and a reduced price right before closing, when you are out of time and out of options. Ask directly: <em>is this price final, or subject to change after inspection?</em> Get the answer in writing.</p>

<h2>4. They are actually a wholesaler and did not say so</h2>
<p>A wholesaler puts your house under contract and then sells that contract to an investor for a fee. It is legal in most states and not inherently wrong — but it means the person in your living room is not the one closing, your timeline depends on them finding a buyer, and if they cannot, the deal dies. Ask: <em>are you buying this yourself, or assigning the contract?</em> Look at the contract for the words "and/or assigns" next to the buyer's name.</p>

<h2>5. Pressure and expiring offers</h2>
<p>"This offer is only good today." "I need a decision before I leave." Manufactured urgency exists to stop you from getting a second opinion. A real offer survives you sleeping on it.</p>

<h2>6. They want a deed instead of a purchase contract</h2>
<p>This is the most dangerous one. If someone asks you to sign a quitclaim or warranty deed, a "transfer for a dollar", or hands you papers that turn out to include a deed, stop and call a real estate attorney. You can sign away your house and its equity in one signature. Distressed and elderly homeowners are targeted with this specifically.</p>

<h2>7. They want to close outside a title company</h2>
<p>Legitimate closings run through a licensed title company or a real estate attorney, with a title search, escrow, recorded documents and wired funds. Cash at a kitchen table, a "notary friend", or a handshake at a restaurant means no title search, no escrow, and no recourse.</p>

<h2>8. No verifiable local footprint</h2>
<p>Check the state business registry for the entity. Look for a real address that is not just a mailbox, a phone number that a person answers, reviews that describe specific transactions, and county records showing deeds actually recorded in their name. A company that closes deals leaves a public paper trail.</p>

<h2>9. Equity-stripping "rescue" offers</h2>
<p>Deed the house over now and rent it back with an option to repurchase later. In practice the repurchase terms are unaffordable by design, and you become a tenant in the home you owned, evictable after one late payment. Several states regulate these arrangements specifically because of how often they are abused. Involve an attorney before signing anything shaped like this.</p>

<h2>Your checklist before signing anything</h2>
<ul>
  <li>Proof of funds, dated within the last 30 days</li>
  <li>The buying entity's name, verified in the state business registry</li>
  <li>A written offer that states the price is not subject to post-inspection reduction</li>
  <li>Clear language on whether the contract can be assigned</li>
  <li>The name of the title company or closing attorney — then call them directly</li>
  <li>Time to have an attorney read the contract, and no pushback when you ask for it</li>
  <li>Recent reviews you can trace to real, specific transactions</li>
</ul>

<h2>Where to report a problem</h2>
<p>Your state attorney general's consumer protection division, the Consumer Financial Protection Bureau at consumerfinance.gov, and the FTC at reportfraud.ftc.gov. If a foreclosure is involved, a HUD-approved housing counselor is free and works for you, not for a buyer.</p>
<p class="callout">Hold us to this list too. Ask us for proof of funds, ask whether we assign contracts, and take the contract to an attorney. If a buyer flinches at any of that, you have your answer.</p>
`,
  },
  {
    slug: 'sell-inherited-house-texas-probate',
    title: 'Selling an Inherited House in Texas: Probate & Taxes',
    description:
      'What Texas heirs need to know before selling: independent administration, ' +
      'muniment of title, heirship affidavits, stepped-up basis and timelines.',
    date: '2026-04-08',
    updated: '2026-08-12',
    tags: ['Inherited property', 'Texas'],
    minutes: 9,
    body: `
<p class="callout">General information, not legal or tax advice. Texas probate has several distinct paths and the right one depends on your specific facts — talk to a probate attorney and a CPA before you sign anything.</p>

<p>Most people who inherit a house in Texas want the same three things: to understand whether they can legally sell it, to stop paying for it in the meantime, and to not spend $40,000 renovating a house nobody in the family plans to live in. Here is the shape of the process.</p>

<h2>First: can you actually sell it yet?</h2>
<p>You can sell once you have legal authority to convey title. In Texas that authority typically comes from one of these:</p>

<h3>Independent administration (the common path with a will)</h3>
<p>Texas is unusually friendly here. If the will names an independent executor — or all heirs agree to one — the court appoints them, issues letters testamentary, and then largely steps back. An independent executor can sell the house without asking the court for permission on each step. Getting appointed usually takes a few weeks to a couple of months depending on the county's docket.</p>

<h3>Muniment of title (a will, no debts)</h3>
<p>A Texas-specific shortcut. If there is a valid will and no unpaid debts other than a mortgage, the court can admit the will as a "muniment of title" — the order itself transfers ownership, with no administration at all. It is faster and cheaper, and title companies accept it routinely.</p>

<h3>No will (intestate)</h3>
<p>Then Texas intestacy statutes decide who inherits, and the split depends on marriage, whether property is community or separate, and whether children are from the current marriage. The usual instruments are a determination of heirship or an affidavit of heirship. Note that title companies vary on how long they want an affidavit of heirship on record before they will insure a sale — ask early, because this is often the item that sets your timeline.</p>

<h3>Transfer on death deed or a living trust</h3>
<p>If the deceased recorded a transfer-on-death deed, or the house was titled in a living trust, the property passes outside probate entirely. This is the fastest scenario: the beneficiary or successor trustee can generally sell right away.</p>

<h2>What the house costs you while you wait</h2>
<p>The bills do not pause for probate:</p>
<ul>
  <li><strong>Property taxes.</strong> Texas has no state income tax and correspondingly high property taxes. Note that the homestead exemption and any over-65 or disability exemption the deceased carried may not survive for the estate — the bill can jump sharply.</li>
  <li><strong>Insurance.</strong> A vacant house needs a vacancy policy. Standard homeowner policies commonly exclude losses after 30 or 60 days of vacancy, and vacant coverage costs more.</li>
  <li><strong>The mortgage.</strong> It keeps accruing. Federal rules protect an inheriting relative's ability to assume or continue paying a loan, but nobody is excused from paying it.</li>
  <li><strong>Utilities and upkeep.</strong> Keep power on — an unconditioned Texas house in August is a mold claim waiting to happen — and keep the lawn mowed to avoid code citations.</li>
</ul>

<h2>Taxes: the stepped-up basis usually saves you</h2>
<p>Inherited property generally receives a stepped-up cost basis equal to its fair market value on the date of death. If your parent bought the house for $60,000 and it was worth $260,000 when they died, your basis is $260,000. Sell soon after for $255,000 and there is typically no taxable gain — there may even be a small loss.</p>
<p>Two practical consequences: get a date-of-death valuation (an appraisal or a documented broker opinion) and keep it, and understand that selling sooner generally means less accumulated gain, not more. Confirm your situation with a CPA — federal estate tax thresholds are high enough that most families never touch them, but the details matter.</p>

<h2>The renovation trap</h2>
<p>Heirs routinely spend $30,000–$60,000 renovating a house they have no emotional stake in, on the theory that it will sell for more. Sometimes it does. But the money is usually fronted by one sibling, the work runs long, and the eventual net is not obviously better than selling as-is — after commissions, holding costs and the months of shared decision-making that renovation requires.</p>
<p>Before committing to a renovation, get a written as-is cash number and a realistic agent net sheet for the house's current condition. Compare the two nets and the two timelines. Sometimes listing wins; frequently, on an estate property, it does not.</p>

<h2>A realistic timeline</h2>
<table class="data-table">
  <thead><tr><th scope="col">Path</th><th scope="col">Typical time to being able to close</th></tr></thead>
  <tbody>
    <tr><th scope="row">Trust or transfer-on-death deed</th><td>Days</td></tr>
    <tr><th scope="row">Muniment of title</th><td>Roughly 1–2 months</td></tr>
    <tr><th scope="row">Independent administration</th><td>Roughly 1–3 months to letters, then sell</td></tr>
    <tr><th scope="row">Heirship determination</th><td>Several months, varies by county and title company</td></tr>
  </tbody>
</table>

<h2>How we work with estates</h2>
<p>We buy inherited houses as-is, with the contents still in them, and we can put a price in writing while probate is still open and close when the court allows. We coordinate with your attorney and the title company, heirs sign remotely, and title disburses each heir their share at closing. If your estate is better served by listing, we will say so.</p>
`,
  },
];

export const postBySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
