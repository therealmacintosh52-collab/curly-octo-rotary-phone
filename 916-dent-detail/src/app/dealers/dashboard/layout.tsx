import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import '../dealers.css';
import { DashNav } from '@/components/dealers/DashNav';
import { SignOutButton } from '@/components/dealers/SignOutButton';
import { authMode } from '@/lib/dealers/auth';
import { getDealerContext } from '@/lib/dealers/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { absolute: 'Dealer Portal | 916 Dent & Detail' }, robots: { index: false, follow: false, nocache: true }, alternates: { canonical: null } };

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const ctx = await getDealerContext();
  if (!ctx) redirect('/dealers/signin');
  const { dealer } = ctx;
  return (
    <div className="wrap pb-32 pt-24 lg:pt-32">
      {authMode() === 'demo' && <p className="dl-demo mb-5" role="note"><strong>DEMO mode.</strong> Demo data on this server. Nothing real is sent, scheduled or charged.</p>}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Dealer portal</p>
          <p className="mt-2 font-display text-lg text-ivory">{dealer.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`dl-badge ${dealer.status === 'active' ? 'dl-badge-green' : dealer.status === 'pending' ? 'dl-badge-gold' : 'dl-badge-red'}`}>{dealer.status === 'active' ? 'Approved' : dealer.status === 'pending' ? 'Waiting for approval' : 'Paused'}</span>
          <SignOutButton />
        </div>
      </header>
      <DashNav />
      <div id="dash-main" className="mt-8">{children}</div>
    </div>
  );
}
