import type { Metadata } from 'next';
import { PageIntro } from '@/components/PageIntro';
import { QuoteLink } from '@/components/CtaLinks';
import { Reviews } from '@/components/sections/Sections';

export const metadata: Metadata = {
  title: 'Reviews | Mobile Dent Repair Sacramento',
  description: 'Reviews from 916 Dent & Detail customers across Sacramento.',
  alternates: { canonical: '/reviews' },
};

export default function ReviewsPage() {
  return (
    <>
      <PageIntro eyebrow="Reviews" title="Real customers. Real cars." lede="We only publish reviews from real customers, with their permission.">
        <QuoteLink where="reviews_intro" className="btn btn-gold">Get a price from a photo</QuoteLink>
      </PageIntro>
      <Reviews />
    </>
  );
}
