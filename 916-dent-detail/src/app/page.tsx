import { Hero } from '@/components/hero/Hero';
import { SectionMotion } from '@/components/SectionMotion';
import { FaqJsonLd } from '@/components/JsonLd';
import { faqs } from '@/content/home';
import {
  BeforeAfterSection, ClosingCta, DealerBand, Eco, Faq, GlossShield, HowItWorks, Memberships, Reviews, ServiceArea, ServicesGrid,
} from '@/components/sections/Sections';

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <ServicesGrid />
      <BeforeAfterSection />
      <GlossShield />
      <Eco />
      <Reviews />
      <ServiceArea />
      <Memberships />
      <DealerBand />
      <Faq />
      <ClosingCta />
      <SectionMotion />
      <FaqJsonLd items={faqs} />
    </>
  );
}
