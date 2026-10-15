import type { Metadata } from 'next';
import { PageIntro } from '@/components/PageIntro';
import { CallLink, TextLink } from '@/components/CtaLinks';
import { site } from '@/config/site';

export const metadata: Metadata = {
  title: 'Dealership Recon & On-Lot Dent Repair Sacramento',
  description: 'On-lot paintless dent repair and detailing for Sacramento dealerships, fleets, rental lots and body shops. Per-panel wholesale pricing, COI on request.',
  alternates: { canonical: '/dealers' },
};

const steps = [
  { n: '01', t: 'Send the list', b: 'Stock numbers, VINs and a few photos per car, by text or email.' },
  { n: '02', t: 'We work on your lot', b: 'We schedule around your lot and work the cars where they sit.' },
  { n: '03', t: 'Frontline-ready', b: 'Dents out, paint and interior detailed, ready for photos and the front line.' },
];

export default function DealersPage() {
  return (
    <>
      <PageIntro
        eyebrow="Dealers · fleets · rental lots · body shops"
        title="Faster frontline-ready. On your lot."
        lede="Paintless dent repair and detailing for used-car managers who need cars photo-ready without a trip to the body shop."
      >
        <CallLink where="dealers_intro" className="btn btn-gold">Call about dealer pricing</CallLink>
        <TextLink where="dealers_intro" className="btn btn-outline">Text us</TextLink>
      </PageIntro>
      <section aria-labelledby="dl-why" className="wrap pb-16">
        <h2 id="dl-why" className="sr-only">Why dealers use us</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {[
            { t: 'Same-day on-lot', b: 'Dent and detail work done where the inventory is parked.' },
            { t: 'Per-panel wholesale pricing', b: 'Clear per-panel rates for recon volume.' },
            { t: 'COI on request', b: 'Certificate of insurance available for your files.' },
          ].map((x) => (
            <li key={x.t} className="card p-7">
              <h3 className="text-base">{x.t}</h3>
              <p className="mt-3 text-steel">{x.b}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6"><span className="owner-mark">[OWNER] wholesale per-panel price sheet</span></p>
      </section>
      <section aria-labelledby="dl-how" className="section border-t border-line/60">
        <div className="wrap">
          <p className="eyebrow">How it works</p>
          <h2 id="dl-how" className="h2 mt-4">Dealer recon in three steps</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n}>
                <span className="text-metal font-display text-5xl leading-none" aria-hidden="true">{s.n}</span>
                <h3 className="mt-6 text-lg">{s.t}</h3>
                <p className="mt-3 text-steel">{s.b}</p>
              </li>
            ))}
          </ol>
          <p className="mt-12 text-steel">
            Email the list to <a className="text-ivory underline underline-offset-4 hover:text-gold-light" href={`mailto:${site.email.address}?subject=Dealer%20recon`}>{site.email.address}</a>
            {site.email.placeholder && <> <span className="owner-mark">[OWNER] email</span></>}
          </p>
        </div>
      </section>
    </>
  );
}
