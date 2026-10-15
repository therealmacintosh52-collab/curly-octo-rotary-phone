import Link from 'next/link';
import '../dealers.css';
import { PageIntro } from '@/components/PageIntro';
import { SignupForm } from '@/components/dealers/SignupForm';
import { authMode } from '@/lib/dealers/auth';
import { pageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata({
  title: 'Open a Dealer Account | Recon & Dent Repair | 916 Dent & Detail',
  description: 'Open a dealer account for on-lot dent repair and detailing in Sacramento. Submit vehicles by VIN, track every car, approve add-ons, one monthly statement.',
  path: '/dealers/signup',
});

export default function DealerSignupPage() {
  return (
    <>
      <PageIntro eyebrow="Dealer account" title="Open a dealer account" lede="Two minutes. We review every account by hand, then you can submit cars one at a time or from a list." />
      <section className="wrap pb-24">
        <div className="card mx-auto max-w-2xl p-6 sm:p-9">{authMode() === 'none' ? <p role="status" className="text-steel">Dealer accounts are not switched on yet. Text or call us and we will set you up.</p> : <SignupForm demo={authMode() === 'demo'} />}</div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-steel">Already have an account? <Link href="/dealers/signin" className="text-gold-light underline underline-offset-4">Sign in</Link></p>
      </section>
    </>
  );
}
