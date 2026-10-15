import Link from 'next/link';
import { redirect } from 'next/navigation';
import '../dealers.css';
import { PageIntro } from '@/components/PageIntro';
import { SigninForm } from '@/components/dealers/SigninForm';
import { authMode, DEMO_DEALER_EMAIL } from '@/lib/dealers/auth';
import { getDealerContext } from '@/lib/dealers/session';
import { pageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';
export const metadata = { ...pageMetadata({ title: 'Dealer Sign In | 916 Dent & Detail', description: 'Sign in to the 916 Dent & Detail dealer portal.', path: '/dealers/signin' }), robots: { index: false, follow: true } };

export default async function DealerSigninPage() {
  if (await getDealerContext()) redirect('/dealers/dashboard');
  return (
    <>
      <PageIntro eyebrow="Dealer portal" title="Dealer sign in" />
      <section className="wrap pb-24">
        <div className="card mx-auto max-w-md p-6 sm:p-9"><SigninForm demo={authMode() === 'demo'} demoEmail={DEMO_DEALER_EMAIL} /></div>
        <p className="mx-auto mt-6 max-w-md text-center text-sm text-steel">New here? <Link href="/dealers/signup" className="text-gold-light underline underline-offset-4">Open a dealer account</Link></p>
      </section>
    </>
  );
}
