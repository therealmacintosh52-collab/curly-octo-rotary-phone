import type { ServiceDoc } from '../types';

export const dealershipRecon: ServiceDoc = {
  slug: 'dealership-recon',
  plain: 'On-Lot Recon',
  term: 'Dealership reconditioning (recon)',
  title: 'Dealership Recon Sacramento | 916 Dent & Detail',
  description: 'On-lot dent repair and detailing for Sacramento dealerships, fleets and rental lots. Frontline-ready vehicles without sending cars off the lot.',
  h1: 'Frontline-ready cars, without leaving the lot.',
  lede: 'Used-car managers want cars photographed and listed quickly. We bring paintless dent repair and detailing to the lot, so a vehicle does not wait for a body-shop slot or a transport run.',
  icon: 'dent',
  priceKey: null,
  priceNote: 'Dealer pricing is quoted per panel or per vehicle on a wholesale sheet. See the dealer page, or ask us for one.',
  typicalTime: 'Recon timing depends on the batch. We plan visit days around your lot schedule and tell you how many units we can finish in a visit.',
  sections: [
    {
      id: 'what',
      h2: 'Dealership reconditioning, and where PDR and detailing fit',
      paras: [
        'Reconditioning, or recon, is everything a used vehicle goes through between the moment it is acquired and the moment it is ready to sell: inspection, mechanical work, cosmetic repair, cleaning and photography. The cosmetic part is where most time is lost. A car with a door ding or two and tired interior can sit waiting for a body shop, a detailer and a photo slot, while it costs money for every day it is not on the front line.',
        'Paintless dent repair and detailing are two of the cheaper, quicker steps in that chain, and both can be done on a lot. We handle dings, creases and light hail damage without paint, and follow with detailing as needed, so a vehicle can move from bay to frontline without leaving the property.',
      ],
    },
    {
      id: 'who',
      h2: 'Who our recon service is for',
      paras: ['We work with several kinds of operators across the Sacramento region. In practice, the needs vary:'],
      bullets: [
        'Independent used-car lots who want cosmetic work done without finding and paying for a body shop on every car.',
        'Franchise dealers with a used department, where trade-ins arrive in mixed condition and need to be front-line ready.',
        'Rental and fleet lots, where cars come back with dings and need to go out again quickly.',
        'Body shops who want a reliable PDR partner for smaller jobs, so their paint department focuses on the bigger repairs.',
        'Auto malls and multi-store groups, where several dealers on one drive may share a visit day.',
      ],
    },
    {
      id: 'process',
      kind: 'steps',
      h2: 'How on-lot recon works',
      steps: [
        { title: 'Walk the lot and agree a list', body: 'We review the vehicles that need work, and mark panels and dent types. A written list per vehicle makes quoting and approvals simple.' },
        { title: 'Per-panel pricing', body: 'Dealer work is priced per panel, per dent size band or per vehicle on a wholesale sheet, so you can estimate the cost of recon before you buy a car at auction or on trade.' },
        { title: 'Visit day plan', body: 'We schedule visits around your lot traffic. Cars should be accessible, reasonably clean around the damage and, where possible, in shade or a service bay.' },
        { title: 'Repair and detail on site', body: 'PDR first, then detailing, so that finishing work is not covered in dust. We work in the open, in a bay or in a covered area as available.' },
        { title: 'Handover and records', body: 'You get a list of what was done, per vehicle by stock number or VIN, which makes statements and approvals easier to reconcile.' },
      ],
    },
    {
      id: 'expect',
      h2: 'What dealers can expect from us',
      paras: [
        'We communicate in the way a lot manager needs: short, clear and specific. A vehicle is identified by stock number or VIN. Approvals for add-on work, such as a second panel that turns out to need attention, go through you before we do it. Photos before and after are available on request to support condition reports.',
        'We understand that a lot is a working environment. We stay out of customer traffic, respect your lot rules and ask in advance about anything that needs a pass or an escort. Many dealers and property managers ask for proof of insurance, and we are glad to discuss that on request. A certificate of insurance can be provided on request.',
        'Results are judged on whether the car photographs and shows well, so we pay attention to the lighting conditions your photographers use. A dent that is invisible in shade but shows under a showroom light is a dent we care about.',
      ],
    },
    {
      id: 'auto-malls',
      h2: 'Auto malls and multi-store clusters across the region',
      paras: [
        'Sacramento\'s region has several clusters of dealerships on one street: the Roseville Automall on Automall Drive, the Folsom auto mall off Highway 50 and the Elk Grove Auto Mall are three that are public and easy to find. Clusters like these suit a mobile service, since a technician can handle several stores in one trip. If you manage a store in one, ask us whether neighboring stores have a regular visit day, and we can try to align yours with it.',
        'We make no claims about any specific dealership being a customer, and we do not approach stores without a conversation first. If you want to talk, use the dealer page.',
      ],
    },
    {
      id: 'limits',
      kind: 'limits',
      h2: 'Limits and honest expectations',
      paras: ['So that your recon budget is realistic, here are the boundaries:'],
      bullets: [
        'PDR does not repair cracked paint, deep creases or damage on panel edges. Those cars still need a body shop.',
        'We do not do mechanical reconditioning, glass, upholstery replacement or wheel refinishing.',
        'Heavily neglected interiors, such as smoke damage, mold or biohazards, are outside a standard detail.',
        'Cars must be reachable. A vehicle blocked in, locked without keys or parked in a space too tight to open doors will be skipped.',
        'Weather matters. Exterior detailing is not done in the rain, and very hot afternoons affect polishing and coating work.',
      ],
    },
  ],
  faqs: [
    {
      q: 'Can you work on our lot?',
      a: 'Yes. We are fully mobile and work on dealership, fleet and rental lots across Greater Sacramento. Tell us about lot rules, access and where vehicles will be parked.',
    },
    {
      q: 'How is dealer pricing set up?',
      a: 'Dealer work is priced per panel or per vehicle on a wholesale sheet. Ask us for one, and see the dealer page for how it works.',
    },
    {
      q: 'Do you offer same-day service?',
      a: 'It depends on our schedule and the batch size. Ask when you book, and we will tell you what is realistic for your volume.',
    },
    {
      q: 'Can you provide proof of insurance?',
      a: 'A certificate of insurance can be provided on request. Many lots and property managers ask for one before work starts.',
    },
    {
      q: 'How do you handle approvals and invoices?',
      a: 'Vehicles are tracked by stock number or VIN. Add-on work is approved by you before it is done, and invoices list work by vehicle.',
    },
    {
      q: 'Can you handle a batch of vehicles in one visit?',
      a: 'Often yes, depending on the repair types and the number. We plan visits around your lot schedule and tell you in advance how many units we can finish.',
    },
    {
      q: 'What about hail-damaged inventory?',
      a: 'Hail damage can be repaired paintless in many cases, panel by panel. Large batches need a plan and a time estimate, so talk to us before a storm if you can.',
    },
    {
      q: 'Do you work with body shops?',
      a: 'Yes. Body shops can send us the smaller PDR jobs so their paint teams focus on larger repairs.',
    },
  ],
  related: ['paintless-dent-repair', 'mobile-detailing', 'hail-damage-repair'],
  blogs: ['dealership-trade-in-prep', 'hail-season-prep-sacramento', 'pdr-vs-body-shop'],
  cities: ['roseville', 'folsom', 'elk-grove', 'davis'],
};
