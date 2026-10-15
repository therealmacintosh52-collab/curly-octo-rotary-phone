import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth/server';
import { PageHeader, Section } from '../../../_ui';

export const metadata: Metadata = { title: 'Demo pay link' };

export default async function DemoPay({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  return (
    <>
      <PageHeader title="Demo pay link" eyebrow="Mock mode" back={{ href: '/admin/today', label: 'Today' }} />
      <Section>
        <p className="text-sm text-[#d6d8dd]">This is where Stripe&apos;s hosted payment page would open in live mode. No card is charged in demo mode ({id.slice(0, 14)}…). On the job screen use <strong>DEMO: mark link as paid</strong> to simulate the customer paying.</p>
        <Link href="/admin/today" className="adm-btn adm-btn-gold mt-4">Back to Today</Link>
      </Section>
    </>
  );
}
