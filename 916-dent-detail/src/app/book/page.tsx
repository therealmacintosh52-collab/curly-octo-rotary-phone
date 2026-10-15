import type { Metadata } from 'next';
import { PageIntro } from '@/components/PageIntro';
import { CallLink, TextLink } from '@/components/CtaLinks';
import { ESTIMATE_LABEL } from '@/config/pricing';
import { site } from '@/config/site';

export const metadata: Metadata = {
  title: 'Book Mobile Dent Repair & Detailing Sacramento',
  description: 'Send a photo of the dent or the car and get an estimate range. We come to you across Sacramento.',
  alternates: { canonical: '/book' },
};

const how = [
  { n: '01', t: 'Text a photo', b: 'One wide shot and one close-up of each dent. For detailing, a photo of the car is enough.' },
  { n: '02', t: 'Tell us where', b: 'Your ZIP and where the car will be parked: driveway, office lot or dealer lot.' },
  { n: '03', t: 'Pick a time', b: 'We reply with an estimate range and open times that fit your day.' },
];

export default function BookPage() {
  return (
    <>
      <PageIntro eyebrow="Book" title="Send a photo. Get a price." lede="The fastest way to book: text us a photo. A real person replies with an estimate range and open times.">
        <TextLink where="book_intro" className="btn btn-gold">Text a photo</TextLink>
        <CallLink where="book_intro" className="btn btn-outline">Call {site.phone.display}</CallLink>
      </PageIntro>
      <section id="photo" aria-labelledby="photo-t" className="wrap scroll-mt-28 pb-24">
        <h2 id="photo-t" className="h2">Get a price from a photo</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {how.map((s) => (
            <li key={s.n} className="card p-7">
              <span className="text-metal font-display text-3xl" aria-hidden="true">{s.n}</span>
              <h3 className="mt-4 text-base">{s.t}</h3>
              <p className="mt-3 text-steel">{s.b}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-steel">{ESTIMATE_LABEL}</p>
        {site.phone.placeholder && <p className="mt-4"><span className="owner-mark">[OWNER] real phone number in config/site.ts</span></p>}
      </section>
    </>
  );
}
