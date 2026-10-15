import type { Metadata } from 'next';
import Link from 'next/link';
import { fmtDate, money } from '@/lib/admin/format';
import { requireStaff } from '@/lib/auth/server';
import { repo } from '@/lib/db';
import { Badge, Card, Empty, PageHeader, Row, Section } from '../../_ui';

export const metadata: Metadata = { title: 'Invoices' };
export const dynamic = 'force-dynamic';

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireStaff();
  const { f = 'open' } = await searchParams;
  const db = repo();
  const all = await db.invoices.list({ orderBy: 'created_at', desc: true, limit: 200 });
  const filtered = all.filter((i) => (f === 'paid' ? i.status === 'paid' : f === 'all' ? true : ['sent', 'overdue', 'draft'].includes(i.status)));
  const cust = new Map((await db.customers.list({ whereIn: [{ col: 'id', values: [...new Set(filtered.map((i) => i.customer_id).filter((x): x is string => !!x))] }] })).map((c) => [c.id, c]));
  const owed = all.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0);
  const tab = (id: string, label: string) => <Link key={id} href={`/admin/invoices?f=${id}`} aria-current={f === id ? 'page' : undefined} className={`adm-badge min-h-9 px-3 ${f === id ? 'adm-badge-gold' : ''}`}>{label}</Link>;
  return (
    <>
      <PageHeader title="Invoices" eyebrow={`${money(owed)} awaiting payment`} />
      <Section><div className="flex gap-2">{tab('open', 'Open')}{tab('paid', 'Paid')}{tab('all', 'All')}</div></Section>
      <Section>
        {filtered.length === 0 ? <Empty>No invoices here.</Empty> : (
          <Card>{filtered.map((i) => (
            <Row key={i.id} href={`/admin/invoices/${i.id}`} title={`${i.number ?? 'Invoice'} · ${cust.get(i.customer_id ?? '')?.name ?? 'Customer'}`} sub={fmtDate(i.created_at)}
              right={<span className="flex flex-col items-end gap-1"><span className="font-semibold tabular-nums">{money(i.subtotal)}</span><Badge tone={i.status === 'paid' ? 'green' : i.status === 'void' ? 'neutral' : 'gold'}>{i.status}</Badge></span>} />
          ))}</Card>
        )}
      </Section>
    </>
  );
}
