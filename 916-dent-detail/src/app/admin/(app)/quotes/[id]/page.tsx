import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serviceById } from '@/config/booking';
import { fmtDateTime, moneyRange } from '@/lib/admin/format';
import { repo } from '@/lib/db';
import { requireStaff } from '@/lib/auth/server';
import { Badge, Card, KV, PageHeader, Section } from '../../../_ui';

export const metadata: Metadata = { title: 'Quote' };
export const dynamic = 'force-dynamic';

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const q = await repo().quotes.get(id);
  if (!q) notFound();
  const customer = q.customer_id ? await repo().customers.get(q.customer_id) : null;
  const book = `/admin/schedule/new?${q.lead_id ? `lead=${q.lead_id}&` : ''}${q.customer_id ? `customer=${q.customer_id}&` : ''}quote=${q.id}`;
  return (
    <>
      <PageHeader title={moneyRange(q.low, q.high)} eyebrow="Quote" back={{ href: q.lead_id ? `/admin/leads/${q.lead_id}` : '/admin/pipeline', label: 'Back' }} />
      <Section>
        <Card>
          <KV items={[['Services', q.services.map((s) => serviceById(s)?.plain ?? s).join(' + ')], ['Size', q.size_class ?? '—'], ['Customer', customer ? <Link key="c" className="underline underline-offset-4" href={`/admin/customers/${customer.id}`}>{customer.name}</Link> : '—'], ['Created', fmtDateTime(q.created_at)], ['Source', q.mock ? <Badge key="m">demo quote</Badge> : q.model ? 'AI photo quote' : 'Entered by hand']]} />
          <p className="border-t border-line px-4 py-3 text-xs text-[#a9acb3]">{q.label}</p>
          {q.notes && <p className="whitespace-pre-wrap border-t border-line px-4 py-3 text-sm">{q.notes}</p>}
        </Card>
      </Section>
      {q.photo_paths.length > 0 && (
        <Section title="Customer photos"><div className="grid grid-cols-3 gap-2">{q.photo_paths.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <a key={p} href={`/api/admin/photo?path=${encodeURIComponent(p)}`} target="_blank" rel="noreferrer"><img src={`/api/admin/photo?path=${encodeURIComponent(p)}`} alt="Customer-submitted damage photo" className="aspect-square w-full rounded-xl object-cover" loading="lazy" /></a>
        ))}</div></Section>
      )}
      <Section><Link className="adm-btn adm-btn-gold adm-btn-big w-full" href={book}>Book it</Link></Section>
    </>
  );
}
