import type { Metadata } from 'next';
import Link from 'next/link';
import { searchCustomers } from '@/lib/admin/customers';
import { fmtPhone } from '@/lib/admin/format';
import { requireStaff } from '@/lib/auth/server';
import { Badge, Card, Empty, PageHeader, Row, Section } from '../../_ui';

export const metadata: Metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff();
  const { q = '' } = await searchParams;
  const list = await searchCustomers(q, 50);
  return (
    <>
      <PageHeader title="Customers" actions={<Link href="/admin/customers/new" className="adm-btn adm-btn-gold">Add</Link>} />
      <Section>
        <form role="search" className="flex gap-2" action="/admin/customers">
          <label htmlFor="q" className="sr-only">Search customers by name, phone or email</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Name, phone or email" className="adm-input" autoComplete="off" />
          <button className="adm-btn adm-btn-line" type="submit">Search</button>
        </form>
      </Section>
      <Section title={q ? `Results for “${q}”` : 'Recent'}>
        {list.length === 0 ? <Empty>No customers found.</Empty> : (
          <Card>{list.map((c) => <Row key={c.id} href={`/admin/customers/${c.id}`} title={c.name} sub={[fmtPhone(c.phone), c.email].filter(Boolean).join(' · ') || 'No contact info'} right={c.sms_opt_out_at ? <Badge tone="red">STOP</Badge> : undefined} />)}</Card>
        )}
        <p className="mt-3 text-sm"><Link className="text-gold-light underline underline-offset-4" href="/admin/customers/duplicates">Find duplicate customers</Link></p>
      </Section>
    </>
  );
}
