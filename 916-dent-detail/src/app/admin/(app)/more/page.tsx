import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth/server';
import { isStaff } from '@/lib/auth/roles';
import { Card, PageHeader, Row, Section } from '../../_ui';
import { SignOut } from '../../_ui/SignOut';

export const metadata: Metadata = { title: 'More' };

const STAFF_LINKS: { href: string; title: string; sub: string }[] = [
  { href: '/admin/today', title: 'Today (tech view)', sub: 'Route, navigate, start and finish jobs' },
  { href: '/admin/inbox', title: 'Needs a person', sub: 'Chats and texts the assistant handed off' },
  { href: '/admin/invoices', title: 'Invoices & payments', sub: 'Open balances, record payments' },
  { href: '/admin/memberships', title: 'Memberships', sub: 'Members, visit credits' },
  { href: '/admin/referrals', title: 'Referrals', sub: 'Codes and credit ledger' },
  { href: '/admin/reports', title: 'Reports', sub: 'Revenue, close rate, ad CPA, CSV' },
  { href: '/admin/schedule/settings', title: 'Schedule settings', sub: 'Blocks, blackout dates, weather, durations' },
  { href: '/admin/customers/duplicates', title: 'Find duplicate customers', sub: 'Merge by phone or email' },
];

export default async function MorePage() {
  const s = await requireSession();
  return (
    <>
      <PageHeader title="More" eyebrow={s.role === "tech" ? "Technician" : "Owner"} />
      {isStaff(s.role) && (
        <Section>
          <Card>{STAFF_LINKS.map((l) => <Row key={l.href} href={l.href} title={l.title} sub={l.sub} />)}</Card>
        </Section>
      )}
      <Section title="Install on your phone">
        <p className="text-sm text-[#b9bcc3]">Open this page in Safari or Chrome and choose Add to Home Screen. It opens full screen on your Today view.</p>
      </Section>
      <Section><SignOut /></Section>
    </>
  );
}
