import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fmtDateTime } from '@/lib/admin/format';
import { requireStaff } from '@/lib/auth/server';
import { inboxPhone, STAFF_REPLY_MAX } from '@/lib/concierge/inbox';
import { isOptedOut } from '@/lib/concierge/optout';
import { conversationTranscript, loadConversationById, reasonLabel } from '@/lib/concierge/state';
import type { EscalationReason } from '@/lib/concierge/types';
import { repo } from '@/lib/db';
import { replyInboxAction, resolveInboxAction } from '../../../_actions/inbox';
import { ActionButton, ActionForm } from '../../../_ui/forms';
import { Badge, Card, Field, KV, PageHeader, Section } from '../../../_ui';
import { ContactButtons } from '../../../_ui/parts';

export const metadata: Metadata = { title: 'Conversation' };
export const dynamic = 'force-dynamic';

export default async function InboxItem({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const rec = await loadConversationById(id);
  if (!rec) notFound();
  const [transcript, phone] = await Promise.all([conversationTranscript(id), inboxPhone(id)]);
  const optedOut = phone ? await isOptedOut(phone) : false;
  const lead = rec.conv.lead_id ? await repo().leads.get(rec.conv.lead_id) : null;
  const open = rec.conv.needs_human;
  return (
    <>
      <PageHeader title={lead?.name ?? 'Conversation'} eyebrow={`${rec.conv.channel === 'sms' ? 'Text' : 'Website chat'} · ${open ? 'needs a person' : 'resolved'}`} back={{ href: '/admin/inbox', label: 'Inbox' }}
        actions={lead ? <Link className="adm-btn adm-btn-line" href={`/admin/leads/${lead.id}`}>Lead</Link> : undefined} />
      <Section>
        <Card>
          <KV items={[
            ['Why', <Badge key="r" tone="gold">{reasonLabel[(rec.conv.escalation_reason ?? 'other') as EscalationReason] ?? rec.conv.escalation_reason ?? '—'}</Badge>],
            ['Handed off', fmtDateTime(rec.conv.escalated_at)],
            ['Phone', phone ?? 'No verified phone'],
          ]} />
          {phone && <ContactButtons phone={phone} email={null} />}
        </Card>
      </Section>
      <Section title="Transcript">
        <Card><ol className="space-y-3 p-4" aria-label="Conversation transcript">
          {transcript.length === 0 && <li className="text-sm text-[#a9acb3]">No messages recorded.</li>}
          {transcript.map((m, n) => (
            <li key={n} className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-[#1c1d21] text-[#e8e9ec]' : 'ml-auto bg-[#2a2415] text-[#f3e6bd]'}`}>
              <span className="block text-[0.7rem] uppercase tracking-wide text-[#a9acb3]">{m.role === 'user' ? 'Customer' : 'Assistant / team'} · {fmtDateTime(m.at)}</span>
              <span className="whitespace-pre-wrap break-words">{m.content}</span>
            </li>
          ))}
        </ol></Card>
      </Section>
      <Section title="Reply by text">
        {!phone ? <p className="text-sm text-[#b9bcc3]">This chat never verified a phone number, so there is no number to text. Use the lead&apos;s email, or wait for the customer to verify.</p>
          : optedOut ? <p role="alert" className="rounded-xl border border-[#8a3b3b] bg-[#231212] px-3 py-2 text-sm text-[#f6b4b4]">This customer replied STOP. Do not text them. Call or email instead.</p>
          : (
            <ActionForm action={replyInboxAction} submit="Send text" className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <Field label="Message" htmlFor="body" help="Sent from the business number. The assistant stays paused until you mark this resolved.">
                <textarea id="body" name="body" required maxLength={STAFF_REPLY_MAX} rows={4} className="adm-input" />
              </Field>
            </ActionForm>
          )}
      </Section>
      {open && (
        <Section title="Done?">
          <div className="flex flex-wrap gap-2"><ActionButton action={resolveInboxAction} hidden={{ id }} className="adm-btn adm-btn-gold" confirm="Mark resolved? The assistant can answer this customer again.">Mark resolved</ActionButton></div>
        </Section>
      )}
    </>
  );
}
