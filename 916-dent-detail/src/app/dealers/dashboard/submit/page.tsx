import Link from 'next/link';
import { SubmitVehicles } from '@/components/dealers/SubmitVehicles';
import { getDealerContext } from '@/lib/dealers/session';

export default async function SubmitPage() {
  const { dealer } = (await getDealerContext())!;
  if (dealer.status !== 'active') {
    return <section className="dl-card p-6 sm:p-9"><h1 className="text-xl">Submitting opens when your account is approved</h1><p className="mt-3 text-steel">We will email you. <Link href="/dealers/dashboard" className="text-gold-light underline underline-offset-4">Back to overview</Link></p></section>;
  }
  return (
    <div>
      <h1 className="text-xl">Submit vehicles</h1>
      <p className="mt-2 max-w-prose text-steel">Add one car, or paste or upload a list. We check every VIN and show you which rows to fix before anything is submitted.</p>
      <div className="mt-6"><SubmitVehicles /></div>
    </div>
  );
}
