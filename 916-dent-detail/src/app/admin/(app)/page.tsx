import type { Metadata } from 'next';
import Link from 'next/link';
import { serviceById } from '@/config/booking';
import { fmtDateTime, fmtTime, money, sourceLabel } from '@/lib/admin/format';
import { loadHome } from '@/lib/admin/home';
import { requireStaff } from '@/lib/auth/server';
import { Badge, Card, Empty, PageHeader, Row, Section, Stat } from '../_ui';

export const metadata: Metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const s = await requireStaff();
  const h = await loadHome();
  const sum = h.month;
  const alerts: { text: string; href: string }[] = [];
  if (h.needsPrice) alerts.push({ text: `${h.needsPrice} booking${h.needsPrice === 1 ? '' : 's'} need a dent price after photo review`, href: '/admin/schedule' });
  if (h.weatherAffected) alerts.push({ text: `${h.weatherAffected} booking${h.weatherAffected === 1 ? '' : 's'} fall on a weather-hold day`, href: '/admin/schedule/settings' });
  if (h.pastDue.length) alerts.push({ text: `${h.pastDue.length} membership${h.pastDue.length === 1 ? '' : 's'} past due`, href: '/admin/memberships' });
  if (h.openInvoices.length) alerts.push({ text: `${money(h.owed)} awaiting payment on ${h.openInvoices.length} invoice${h.openInvoices.length === 1 ? '' : 's'}`, href: '/admin/invoices' });
  return (
    <>
      <PageHeader title={`Hi ${s.name.replace(/^\[.*?\]\s*/, '').split(' ')[0] ?? ''}`} eyebrow="916 Admin" />
      <Section>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/admin/pipeline" className="adm-btn adm-btn-gold adm-btn-big">Quick add lead</Link>
          <Link href="/admin/schedule/new" className="adm-btn adm-btn-line adm-btn-big">Book a job</Link>
        </div>
      </Section>
      {alerts.length > 0 && <Section title="Needs attention"><Card>{alerts.map((a) => <Row key={a.text} href={a.href} title={a.text} />)}</Card></Section>}
      <Section title="Today" action={<Link className="text-sm text-gold-light underline underline-offset-4" href="/admin/today">Tech view</Link>}>
        {h.todays.length === 0 ? <Empty>Nothing booked today.</Empty> : (
          <Card>{h.todays.map((b) => <Row key={b.id} href={`/admin/bookings/${b.id}`} title={`${fmtTime(b.starts_at)} · ${h.customers.get(b.customer_id ?? '')?.name ?? 'Customer'}`} sub={b.services.map((x) => serviceById(x)?.plain ?? x).join(' + ')} right={<Badge tone={b.status === 'completed' ? 'green' : 'gold'}>{b.status.replace(/_/g, ' ')}</Badge>} />)}</Card>
        )}
      </Section>
      <Section title="New leads" action={<Link className="text-sm text-gold-light underline underline-offset-4" href="/admin/pipeline">All</Link>}>
        {h.newLeads.length === 0 ? <Empty>No new leads waiting.</Empty> : <Card>{h.newLeads.map((l) => <Row key={l.id} href={`/admin/leads/${l.id}`} title={l.name ?? 'Unnamed lead'} sub={fmtDateTime(l.created_at)} right={<Badge tone="gold">{sourceLabel(l.source)}</Badge>} />)}</Card>}
      </Section>
      <Section title="This month">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Revenue" value={money(sum.revenue)} sub={`${sum.jobs} jobs`} />
          <Stat label="Avg ticket" value={sum.avgTicket === null ? '—' : money(sum.avgTicket)} />
        </div>
        <p className="mt-2 text-sm"><Link className="text-gold-light underline underline-offset-4" href="/admin/reports">Open reports</Link></p>
      </Section>
    </>
  );
}
