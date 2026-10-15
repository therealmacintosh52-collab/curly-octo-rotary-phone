import type { Metadata } from 'next';
import { ESTIMATE_LABEL } from '@/config/pricing';
import { site } from '@/config/site';
import { CallLink, TextLink } from '@/components/CtaLinks';
import { BookingFlow } from './BookingFlow';

export const metadata: Metadata = {
  title: 'Book Mobile Dent Repair & Detailing Sacramento',
  description: 'Get a photo estimate, pick a real open time and reserve with a small deposit. We come to you across Sacramento.',
  alternates: { canonical: '/book' },
};

export default function BookPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-8 pt-28 lg:pb-10 lg:pt-40">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(201,162,74,0.13),transparent_70%)]" />
        <div className="wrap relative">
          <p className="eyebrow">Book</p>
          <h1 className="mt-4 max-w-3xl text-[clamp(1.6rem,4.2vw,3rem)]">Book your visit</h1>
          <p className="lede mt-4">Choose your service, add photos for dents, pick a real open time. It takes about two minutes. {ESTIMATE_LABEL}</p>
          <noscript>
            <p className="mt-4 text-steel">Booking needs JavaScript. Prefer to talk? Call or text {site.phone.display}.</p>
          </noscript>
        </div>
      </section>
      <BookingFlow />
      <section aria-label="Prefer to talk" className="wrap pb-24">
        <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-steel">Rather talk it through? A real person replies fast.</p>
          <div className="flex flex-wrap gap-3">
            <TextLink where="book_footer" className="btn btn-outline">Text us</TextLink>
            <CallLink where="book_footer" className="btn btn-outline">Call {site.phone.display}</CallLink>
          </div>
        </div>
        {site.phone.placeholder && <p className="mt-4"><span className="owner-mark">[OWNER] real phone number in config/site.ts</span></p>}
      </section>
    </>
  );
}
