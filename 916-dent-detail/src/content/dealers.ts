// Copy for /dealers. Plain-spoken, for used-car and recon managers. No invented numbers: the research (marketing/research/
// dealer-targets.md) found no sourced dealer rate or turnaround figure, so nothing here states one. Soft claims (same-day,
// COI) are flagged [OWNER] confirm on the page until the owner confirms them (TODO.md).
import type { Faq } from '@/content/seo/types';

export const dealerSteps = [
  { n: '01', t: 'Open an account', b: 'Sign up in two minutes. We review every dealer account by hand and email you when it is approved.' },
  { n: '02', t: 'Send the cars', b: 'Add one car or paste a whole list: VIN, stock number, what you want done. We check every VIN and flag typos before anything is submitted.' },
  { n: '03', t: 'We work on your lot', b: 'We come to the cars. You see each one move from submitted to scheduled to in progress, with before and after photos.' },
  { n: '04', t: 'Frontline-ready, one bill', b: 'Anything extra we find comes to you with a price first. You approve it or decline it. Work is billed on one monthly statement.' },
] as const;

export const dealerValue = [
  { t: 'Faster to frontline-ready', b: 'Dents and detailing happen where the car is parked. No transport run, no waiting for a body-shop slot, no repaint on paint-intact panels.' },
  { t: 'Same-day, on your lot', b: 'We work the cars where they sit and plan visit days around your lot.', owner: 'confirm same-day availability' },
  { t: 'Per-panel wholesale pricing', b: 'One rate sheet for recon volume, priced per panel so you can estimate recon before you buy a car.' },
  { t: 'Certificate of insurance on request', b: 'Ask and we send a COI for your vendor file.', owner: 'confirm coverage and COI' },
] as const;

export const dealerAudience = [
  { t: 'Dealers', b: 'Independent lots and franchise used-car departments. Trade-ins arrive in mixed condition and need to be photo-ready.' },
  { t: 'Fleets', b: 'Service vans, company cars and pool vehicles that pick up dings and need to stay on the road.' },
  { t: 'Rental lots', b: 'Cars come back with door dings and need to go out again. We work the lot between returns.' },
  { t: 'Body shops', b: 'Send us the small paintless jobs so your paint department can stay on the bigger repairs.' },
] as const;

export const portalFeatures = [
  'Submit one car or a whole list from a CSV (template included)',
  'VIN check before submit: length, letters, and the check digit',
  'Photos per vehicle, picked several at a time from your phone',
  'A status board: submitted, scheduled, in progress, frontline-ready',
  'Before and after photos on every finished car',
  'Add-on proposals with a price. You approve or decline, and nothing extra is done until you do',
  'A monthly statement as a PDF, and net-terms invoices once we approve your terms',
] as const;

export const dealerFaqs: Faq[] = [
  { q: 'What do you charge dealers?', a: 'Dealer work is priced per panel on a wholesale rate sheet, not per dent, so it is easy to estimate from a photo. We do not publish the rates on the website. Use the form on this page and we will send you the sheet.' },
  { q: 'Do you come to our lot?', a: 'Yes. We are a mobile crew and work on the lot or in your service area. A shaded spot or an open bay is best, and we plan visit days around your lot traffic. We work around customers and stay out of the way.' },
  { q: 'What do I need to submit a car?', a: 'A VIN is the only required field. A stock number, photos and a note about where the damage is help us plan the visit. You can add one car at a time or paste or upload a list. We check each VIN (17 characters, no I, O or Q, valid check digit) and tell you which rows to fix.' },
  { q: 'What if you find more damage than we listed?', a: 'We send you an add-on proposal with a price, for example a second dented panel or an interior reset. You approve or decline it in the portal. We do not do the extra work until you approve it.' },
  { q: 'How does billing work?', a: 'You get one statement per month listing each car we finished, with a PDF you can download. Dealers we approve for net terms are invoiced on net 15 or net 30. Other accounts are invoiced due on receipt. Invoices come with a Stripe-hosted payment link.' },
  { q: 'Can you send a certificate of insurance?', a: 'Yes, on request. Ask when you sign up or at any time and we send a COI for your vendor file.' },
  { q: 'Can paintless dent repair fix every dent?', a: 'No. If the paint is cracked or chipped, the panel was repainted or repaired before, or the dent is a sharp crease on a hard edge, paintless repair may not be the right fix. We say so before we start, so you can send that car to a body shop instead of paying twice.' },
  { q: 'Do you work with body shops and rental lots?', a: 'Yes. Body shops send us small paintless jobs. Rental and fleet lots use us for door dings between returns. The portal works the same way for all of them.' },
  { q: 'Which areas do you serve?', a: 'Greater Sacramento, including Roseville, Folsom, Elk Grove, Rancho Cordova, Citrus Heights, Natomas, West Sacramento, Davis and the surrounding cities. Tell us where the lot is when you sign up.' },
];
