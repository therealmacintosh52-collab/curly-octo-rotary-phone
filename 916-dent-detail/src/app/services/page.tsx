import type { Metadata } from 'next';
import { PageIntro } from '@/components/PageIntro';
import { QuoteLink, TextLink } from '@/components/CtaLinks';
import { ServiceIcon } from '@/components/sections/ServiceIcon';
import { services } from '@/content/home';
import { ESTIMATE_LABEL, formatMoney, serviceFromPrice } from '@/config/pricing';
import { HowItWorks } from '@/components/sections/Sections';

export const metadata: Metadata = {
  title: 'Mobile Dent Repair & Detailing Services Sacramento',
  description: 'Paintless dent repair, hail repair, paint correction, ceramic coating, paint decontamination and interior detailing, done at your home, work or lot across Sacramento.',
  alternates: { canonical: '/services' },
};

export default function ServicesPage() {
  return (
    <>
      <PageIntro eyebrow="Services" title="Dent repair & detailing that comes to you" lede="Plain names up front, the real trade terms underneath. Every job starts with a photo.">
        <QuoteLink where="services_intro" className="btn btn-gold">Get a price from a photo</QuoteLink>
        <TextLink where="services_intro" className="btn btn-outline">Text us</TextLink>
      </PageIntro>
      <div className="wrap space-y-5 pb-10">
        {services.map((s) => {
          const from = formatMoney(serviceFromPrice[s.id] ?? null);
          return (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="card scroll-mt-28 grid gap-6 p-7 sm:p-10 md:grid-cols-[auto_1fr_auto] md:items-center">
              <ServiceIcon name={s.icon} />
              <div>
                <h2 id={`${s.id}-t`} className="text-xl">{s.plain} <span className="block pt-1 font-sans text-sm uppercase tracking-[0.14em] text-steel">{s.term}</span></h2>
                <p className="mt-4 max-w-2xl text-ivory/80">{s.summary}</p>
              </div>
              <div className="text-sm md:text-right">
                <p className="text-steel">From</p>
                <p className="mt-1">{from.placeholder ? <span className="owner-mark">{from.text}</span> : from.text}</p>
                <QuoteLink where={`service_${s.id}`} className="btn btn-outline mt-4 !min-h-11 text-sm">Get my price</QuoteLink>
              </div>
            </section>
          );
        })}
        <p className="pt-4 text-sm text-steel">{ESTIMATE_LABEL}</p>
      </div>
      <HowItWorks />
    </>
  );
}
