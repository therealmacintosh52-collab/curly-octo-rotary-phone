import Link from 'next/link';
import { QuoteLink } from '@/components/CtaLinks';

export default function NotFound() {
  return (
    <section className="wrap flex min-h-[80svh] flex-col items-start justify-center pb-20 pt-32">
      <p className="text-metal font-display text-[clamp(4rem,14vw,9rem)] leading-none" aria-hidden="true">404</p>
      <h1 className="mt-6 text-[clamp(1.5rem,3.5vw,2.4rem)]">This page has a dent we can&apos;t fix.</h1>
      <p className="lede mt-4">The link may be old or mistyped. Here is where you probably wanted to go.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-outline">Home</Link>
        <Link href="/services" className="btn btn-outline">Services</Link>
        <QuoteLink where="404" className="btn btn-gold">Get a price from a photo</QuoteLink>
      </div>
    </section>
  );
}
