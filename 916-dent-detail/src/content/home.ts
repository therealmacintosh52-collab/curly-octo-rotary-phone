// Marketing copy. Plain-language names up front; the real trade term is kept for H2s,
// alt text, schema and FAQs (SPEC "PLAIN-LANGUAGE RULE"). No invented facts: no years in
// business, no ratings, no counts, no warranties, no prices (prices live in config/pricing.ts).

export type Service = {
  id: string;
  plain: string; // shown first
  term: string; // real trade term (H2/alt/schema/FAQ)
  summary: string;
  icon: 'dent' | 'hail' | 'swirl' | 'shield' | 'clay' | 'seat';
};

export const services: Service[] = [
  {
    id: 'pdr',
    plain: 'Dent Removal',
    term: 'Paintless dent repair (PDR)',
    summary: 'No paint, no body shop. We work the metal back from behind the panel so your factory finish stays original.',
    icon: 'dent',
  },
  {
    id: 'hail',
    plain: 'Hail Fix',
    term: 'Hail damage repair',
    summary: 'Hail dents worked out panel by panel with the same paint-free method. We can photograph the damage for your claim.',
    icon: 'hail',
  },
  {
    id: 'paint-correction',
    plain: 'Swirl & Scratch Erase',
    term: 'Paint correction',
    summary: 'Machine polishing that levels out swirls, haze and light scratches so reflections look sharp again.',
    icon: 'swirl',
  },
  {
    id: 'ceramic',
    plain: 'Gloss Shield',
    term: 'Ceramic coating',
    summary: 'A hard, slick layer bonded to your clear coat. Water beads and runs off, and washing gets easier.',
    icon: 'shield',
  },
  {
    id: 'decon',
    plain: 'Paint Deep-Clean',
    term: 'Clay bar & paint decontamination',
    summary: 'Pulls out the bonded grit a normal wash leaves behind. Paint feels glass-smooth before any polish or coating.',
    icon: 'clay',
  },
  {
    id: 'interior',
    plain: 'Interior Reset',
    term: 'Interior detailing',
    summary: 'Seats, carpets, vents and glass, cleaned top to bottom. Back to that just-picked-up feeling.',
    icon: 'seat',
  },
];

export const steps = [
  { n: '01', title: 'Send a photo', body: 'Snap the dent or the car and send it. We reply with an estimate range.' },
  { n: '02', title: 'We come to you', body: 'Home, office or lot. We bring the tools and set up where the car is parked.' },
  { n: '03', title: 'Drive away fixed', body: 'Dent gone, paint glowing. No body-shop drop-off, no rental car.' },
];

// Positions are SCHEMATIC (approximate relative layout from lat/long, not to scale) for the inline SVG.
export const cities: { name: string; x: number; y: number }[] = [
  { name: 'Sacramento', x: 214, y: 214 },
  { name: 'Natomas', x: 200, y: 165 },
  { name: 'West Sacramento', x: 158, y: 228 },
  { name: 'Davis', x: 40, y: 250 },
  { name: 'Carmichael', x: 300, y: 190 },
  { name: 'Rancho Cordova', x: 330, y: 228 },
  { name: 'Elk Grove', x: 262, y: 330 },
  { name: 'Citrus Heights', x: 340, y: 128 },
  { name: 'Roseville', x: 334, y: 92 },
  { name: 'Rocklin', x: 372, y: 64 },
  { name: 'Lincoln', x: 338, y: 22 },
  { name: 'Granite Bay', x: 414, y: 98 },
  { name: 'Folsom', x: 420, y: 150 },
  { name: 'El Dorado Hills', x: 486, y: 146 },
];

export const faqs: { q: string; a: string }[] = [
  {
    q: 'What is paintless dent repair (PDR)?',
    a: 'Paintless dent repair is a way of removing dents by working the metal back into shape from behind the panel, without sanding, filler or new paint. Your original factory finish stays on the car.',
  },
  {
    q: 'Can every dent be fixed without paint?',
    a: 'No. If the paint is cracked or the metal is stretched too far, paintless repair may not be the right fix. Send a photo and we will tell you straight.',
  },
  {
    q: 'How do I get a price?',
    a: 'Send a photo of the damage or tell us about the car. We reply with an estimate range. Estimate — final price confirmed on inspection.',
  },
  {
    q: 'Do you really come to me?',
    a: 'Yes. We are fully mobile across Greater Sacramento: your driveway, office parking lot or dealer lot. Tell us where the car is parked when you book.',
  },
  {
    q: 'What is a ceramic coating (Gloss Shield)?',
    a: 'A ceramic coating is a liquid layer that bonds to your clear coat and hardens. It makes the paint slicker and glossier, so water beads and dirt releases more easily. It is applied after the paint is cleaned and, if needed, corrected.',
  },
  {
    q: 'Is paint correction the same as a polish?',
    a: 'Paint correction (our Swirl & Scratch Erase) is a more thorough, multi-step machine polish that levels swirl marks and light scratches, rather than just filling them in for a few weeks.',
  },
  {
    q: 'Will my insurance cover hail repair?',
    a: 'Hail is often handled under comprehensive coverage, but every policy is different, so check with your insurer. We can photograph the damage and give you an estimate to support the claim.',
  },
  {
    q: 'Do you work with dealerships and fleets?',
    a: 'Yes. We do on-lot dent and detail work for dealerships, fleets, rental lots and body shops. See the dealer page for how it works.',
  },
];
