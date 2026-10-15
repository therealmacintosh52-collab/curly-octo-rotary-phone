import type { Metadata } from 'next';
import { PageIntro } from '@/components/PageIntro';
import { QuoteLink } from '@/components/CtaLinks';
import { Memberships } from '@/components/sections/Sections';
import { services } from '@/content/home';
import { ESTIMATE_LABEL, formatMoney, serviceFromPrice } from '@/config/pricing';

export const metadata: Metadata = {
  title: 'Dent Repair & Detailing Prices Sacramento',
  description: 'How pricing works for mobile paintless dent repair and detailing in Sacramento: send a photo, get an estimate range, confirmed on inspection.',
  alternates: { canonical: '/pricing' },
};

export default function PricingPage() {
  return (
    <>
      <PageIntro eyebrow="Pricing" title="Priced from a photo. Confirmed on inspection." lede="Every dent and every car is different, so we price from your photos and confirm before we start.">
        <QuoteLink where="pricing_intro" className="btn btn-gold">Get a price from a photo</QuoteLink>
      </PageIntro>
      <section aria-labelledby="pr-from" className="wrap pb-6">
        <h2 id="pr-from" className="h2">Starting points</h2>
        <div className="card mt-8 overflow-x-auto" role="region" aria-label="Starting prices by service, scrollable table" tabIndex={0}>
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Starting prices by service</caption>
            <thead><tr className="border-b border-line text-steel"><th scope="col" className="p-5 font-normal">Service</th><th scope="col" className="p-5 font-normal">Also called</th><th scope="col" className="p-5 text-right font-normal">From</th></tr></thead>
            <tbody>
              {services.map((s) => {
                const p = formatMoney(serviceFromPrice[s.id] ?? null);
                return (
                  <tr key={s.id} className="border-b border-line/60 last:border-0">
                    <th scope="row" className="p-5 font-semibold text-ivory">{s.plain}</th>
                    <td className="p-5 text-steel">{s.term}</td>
                    <td className="p-5 text-right">{p.placeholder ? <span className="owner-mark">{p.text}</span> : p.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-steel">{ESTIMATE_LABEL}</p>
      </section>
      <Memberships />
    </>
  );
}
