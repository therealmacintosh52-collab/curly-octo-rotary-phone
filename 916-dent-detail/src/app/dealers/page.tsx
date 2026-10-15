import Link from 'next/link';
import './dealers.css';
import { PageIntro } from '@/components/PageIntro';
import { SectionMotion } from '@/components/SectionMotion';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { FaqList } from '@/components/sections/FaqList';
import { PriceTable } from '@/components/dealers/PriceTable';
import { SheetForm } from '@/components/dealers/SheetForm';
import { CallLink } from '@/components/CtaLinks';
import { claimsConfirmed, dealerAudience, dealerFaqs, dealerSteps, dealerValue, portalFeatures } from '@/content/dealers';
import { breadcrumbSchema, faqSchema } from '@/lib/seo/schema';
import { pageMetadata } from '@/lib/seo/metadata';
import { site } from '@/config/site';

export const metadata = pageMetadata({
  title: 'Dealership Recon & Dent Repair Sacramento | 916 Dent & Detail',
  description: 'On-lot paintless dent repair and detailing for Sacramento dealerships, fleets, rental lots and body shops. Per-panel rates, one monthly statement.',
  path: '/dealers',
});

const crumbs = [{ name: 'Home', path: '/' }, { name: 'Dealers', path: '/dealers' }];

export default function DealersPage() {
  return (
    <>
      <JsonLdScript data={[breadcrumbSchema(crumbs), faqSchema(dealerFaqs)]} />
      <SectionMotion />
      <PageIntro
        eyebrow="Dealers · fleets · rental lots · body shops"
        title="Faster frontline-ready. On your lot."
        lede="Dealership recon and dent repair in Sacramento for used-car and recon managers: paintless dent removal and detailing done where the cars are parked, billed per panel."
      >
        <Link href="/dealers/signup" className="btn btn-gold">Open a dealer account</Link>
        <Link href="#wholesale-sheet" className="btn btn-outline">Request the wholesale sheet</Link>
        <p className="w-full text-sm text-steel">Already have an account? <Link href="/dealers/signin" className="text-gold-light underline underline-offset-4">Sign in</Link></p>
      </PageIntro>

      <section aria-labelledby="dl-why" className="wrap pb-16 lg:pb-24">
        <h2 id="dl-why" className="sr-only">Why dealers use us</h2>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {dealerValue.map((x) => (
            <li key={x.t} className="card p-7">
              <h3 className="text-base">{x.t}</h3>
              <p className="mt-3 text-steel">{x.b}</p>
              {'claim' in x && !claimsConfirmed[x.claim] && <p className="mt-3"><span className="owner-mark">[OWNER] {x.owner}</span></p>}
            </li>
          ))}
        </ul>
      </section>

      <section id="pricing" aria-labelledby="dl-price" className="section border-t border-line/60">
        <div className="wrap grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="eyebrow">Wholesale pricing</p>
            <h2 id="dl-price" className="h2 mt-4">Priced per panel, so you can estimate recon before you buy</h2>
            <p className="lede mt-5">One rate sheet for dealers, fleets and shops. We price by panel and by vehicle, never by surprise. Anything extra we find is proposed to you with a price first.</p>
          </div>
          <PriceTable />
        </div>
      </section>

      <section id="how" aria-labelledby="dl-how" className="section border-t border-line/60" data-motion="steps">
        <div className="wrap">
          <p className="eyebrow">How it works</p>
          <h2 id="dl-how" className="h2 mt-4">Dealer recon in four steps</h2>
          <div className="relative mt-14">
            <div data-line aria-hidden="true" className="hairline absolute left-0 right-0 top-[1.9rem] hidden lg:block" />
            <ol className="grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {dealerSteps.map((s) => (
                <li key={s.n} data-m className="relative">
                  <span className="text-metal font-display text-5xl leading-none" aria-hidden="true">{s.n}</span>
                  <h3 className="mt-6 text-lg">{s.t}</h3>
                  <p className="mt-3 max-w-xs text-steel">{s.b}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="dl-who" className="section border-t border-line/60">
        <div className="wrap">
          <p className="eyebrow">Who we serve</p>
          <h2 id="dl-who" className="h2 mt-4">Built for people who run a lot</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dealerAudience.map((x) => (
              <li key={x.t} className="card p-7">
                <h3 className="text-base">{x.t}</h3>
                <p className="mt-3 text-steel">{x.b}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="dl-portal" className="section border-t border-line/60">
        <div className="wrap grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="eyebrow">The dealer portal</p>
            <h2 id="dl-portal" className="h2 mt-4">Submit, track, approve, pay. In one place.</h2>
            <p className="lede mt-5">No spreadsheets by text. Everything we do to your cars is on a list you can search by stock number or VIN.</p>
            <p className="mt-8 flex flex-wrap gap-3">
              <Link href="/dealers/signup" className="btn btn-gold">Open a dealer account</Link>
              <a href="/dealers/leave-behind.pdf" className="btn btn-outline" download>Printable one-pager (PDF)</a>
            </p>
          </div>
          <ul className="grid gap-3">
            {portalFeatures.map((f) => (
              <li key={f} className="card flex gap-3 p-4 text-ivory/90">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-gold" aria-hidden="true"><path d="M5 12l4.5 4.5L19 7" /></svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="wholesale-sheet" aria-labelledby="dl-sheet" className="section border-t border-line/60">
        <div className="wrap grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="eyebrow">Wholesale sheet</p>
            <h2 id="dl-sheet" className="h2 mt-4">Get the wholesale rate sheet</h2>
            <p className="lede mt-5">Tell us who you are and we will email the per-panel sheet. Prefer to talk? <CallLink where="dealers_sheet" className="text-gold-light underline underline-offset-4">Call us</CallLink>{site.phone.placeholder && <> <span className="owner-mark">[OWNER] phone</span></>}.</p>
          </div>
          <div className="card p-6 sm:p-8"><SheetForm /></div>
        </div>
      </section>

      <section aria-labelledby="dl-faq" className="section border-t border-line/60">
        <div className="wrap grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="eyebrow">Dealer FAQ</p>
            <h2 id="dl-faq" className="h2 mt-4">Questions recon managers ask</h2>
          </div>
          <FaqList items={dealerFaqs} />
        </div>
      </section>

      <section aria-labelledby="dl-cta" className="section border-t border-line/60 text-center">
        <div className="wrap">
          <h2 id="dl-cta" className="h2 mx-auto max-w-2xl">Get the next car frontline-ready</h2>
          <p className="lede mx-auto mt-5">Open an account today. We approve dealers by hand and you can submit your first list as soon as you are in.</p>
          <p className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/dealers/signup" className="btn btn-gold">Open a dealer account</Link>
            <Link href="#wholesale-sheet" className="btn btn-outline">Request the wholesale sheet</Link>
          </p>
        </div>
      </section>
    </>
  );
}
