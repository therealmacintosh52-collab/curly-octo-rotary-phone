import type { Metadata } from 'next';
import { fmtDateTime } from '@/lib/admin/format';
import { requireStaff } from '@/lib/auth/server';
import { listNeedsHuman, reasonLabel } from '@/lib/concierge/state';
import type { EscalationReason } from '@/lib/concierge/types';
import { Badge, Card, Empty, PageHeader, Row, Section } from '../../_ui';

export const metadata: Metadata = { title: 'Needs a person' };
export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  await requireStaff();
  const items = await listNeedsHuman(100);
  return (
    <>
      <PageHeader title="Needs a person" eyebrow="916 Concierge inbox" back={{ href: '/admin/more', label: 'More' }} />
      <Section>
        {items.length === 0 ? <Empty>Nothing waiting. Chats the assistant hands off land here.</Empty> : (
          <Card>{items.map((i) => (
            <Row key={i.conversationId} href={`/admin/inbox/${i.conversationId}`}
              title={i.summary ? `“${i.summary.slice(0, 90)}”` : 'Conversation'}
              sub={`${fmtDateTime(i.escalatedAt)} · ${i.channel === 'sms' ? 'Text' : 'Website chat'}`}
              right={<Badge tone="gold">{reasonLabel[(i.reason ?? 'other') as EscalationReason] ?? i.reason}</Badge>} />
          ))}</Card>
        )}
      </Section>
    </>
  );
}
