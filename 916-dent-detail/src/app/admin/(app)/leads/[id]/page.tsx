import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serviceById } from '@/config/booking';
import { LEAD_SOURCES, STAGE_LABEL, evaluateMove, moveContext, nextStages } from '@/lib/admin/pipeline';
import { fmtDateTime, moneyRange, sourceLabel } from '@/lib/admin/format';
import { requireStaff } from '@/lib/auth/server';
import { repo } from '@/lib/db';
import { moveStageAction, overrideSourceAction } from '../../../_actions/crm';
import { ActionForm } from '../../../_ui/forms';
import { Badge, Card, Empty, Field, KV, PageHeader, Row, Section } from '../../../_ui';
import { ContactButtons, NoteForm, NoteList, Timeline } from '../../../_ui/parts';
import { buildTimeline } from '@/lib/admin/customers';

export const metadata: Metadata = { title: 'Lead' };
export const dynamic = 'force-dynamic';

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const db = repo();
  const lead = await db.leads.get(id);
  if (!lead) notFound();
  const [ctx, quotes, notes, events] = await Promise.all([
    moveContext(lead), db.quotes.list({ where: { lead_id: id }, orderBy: 'created_at', desc: true }),
    db.notes.list({ where: { entity_type: 'lead', entity_id: id }, orderBy: 'created_at', desc: true }),
    db.events.list({ where: { entity_id: id }, orderBy: 'created_at', desc: true, limit: 50 }),
  ]);
  const job = ctx.booking ? await db.jobs.first({ where: { booking_id: ctx.booking.id } }) : null;
  const svc = (ids: string[]) => ids.map((s) => serviceById(s)?.plain ?? s).join(' + ');
  const utm = ([['utm_source', lead.utm_source], ['utm_medium', lead.utm_medium], ['utm_campaign', lead.utm_campaign], ['utm_term', lead.utm_term], ['utm_content', lead.utm_content], ['gclid', lead.gclid], ['fbclid', lead.fbclid], ['Referrer', lead.referrer], ['Landing page', lead.landing_page]] as [string, string | null | undefined][]).filter(([, v]) => v) as [string, string][];
  const next = nextStages(lead.stage);
  return (
    <>
      <PageHeader title={lead.name ?? 'Lead'} eyebrow={`Lead · ${STAGE_LABEL[lead.stage]}`} back={{ href: '/admin/pipeline', label: 'Pipeline' }} actions={lead.customer_id ? <Link className="adm-btn adm-btn-line" href={`/admin/customers/${lead.customer_id}`}>Customer</Link> : undefined} />
      {sp.added && <Section><p role="status" className="rounded-xl border border-[#2f6b49] bg-[#0f2017] px-3 py-2 text-sm text-[#a6e8c0]">Lead added to the pipeline.</p></Section>}
      <Section><Card><ContactButtons phone={lead.phone} email={lead.email} />{lead.notes && <p className="whitespace-pre-wrap border-t border-line px-4 py-3 text-sm text-[#d6d8dd]">{lead.notes}</p>}</Card></Section>

      <Section title="Next step">
        <Card><div className="space-y-3 p-4">
          {next.length === 0 && <p className="text-sm text-[#b9bcc3]">This lead is complete.</p>}
          {next.map((to) => {
            const d = evaluateMove(lead.stage, to, ctx, to === 'lost' ? 'x' : undefined);
            if (to === 'quoted' && !ctx.hasQuote) return <Link key={to} className="adm-btn adm-btn-gold w-full" href={`/admin/quotes/new?lead=${lead.id}`}>Create a quote</Link>;
            if (to === 'booked' && !d.ok) return <Link key={to} className="adm-btn adm-btn-gold w-full" href={`/admin/schedule/new?lead=${lead.id}`}>Book it</Link>;
            if (to === 'done' && !d.ok) return job ? <Link key={to} className="adm-btn adm-btn-gold w-full" href={`/admin/jobs/${job.id}`}>Open job to finish it</Link> : null;
            return (
              <ActionForm key={to} action={moveStageAction} className="space-y-2" submit={`Move to ${STAGE_LABEL[to]}`} submitClass={to === 'lost' ? 'adm-btn adm-btn-danger w-full' : 'adm-btn adm-btn-line w-full'}>
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="to" value={to} />
                {to === 'lost' && <Field label="Why was it lost?" htmlFor="reason"><input id="reason" name="reason" required maxLength={200} className="adm-input" placeholder="Too expensive, no reply, out of area…" /></Field>}
                {!d.ok && to !== 'lost' && <p className="text-xs text-[#a9acb3]">{d.reason}</p>}
              </ActionForm>
            );
          })}
          {ctx.booking && <Link className="adm-btn adm-btn-line w-full" href={`/admin/bookings/${ctx.booking.id}`}>Open booking</Link>}
        </div></Card>
      </Section>

      <Section title="Where it came from">
        <Card>
          <KV items={[['Source', <span key="s"><Badge tone="gold">{sourceLabel(lead.source)}</Badge>{lead.source_overridden && <span className="ml-2 text-xs text-[#a9acb3]">set by hand (auto: {sourceLabel(lead.source_auto)})</span>}</span>], ['Created', fmtDateTime(lead.created_at)], ...(lead.area_status ? [['Area', lead.area_status.replace('_', ' ')] as [string, string]] : [])]} />
          {utm.length > 0 && <KV items={utm} />}
          <div className="border-t border-line px-4 py-3">
            <ActionForm action={overrideSourceAction} submit="Update source" className="flex items-end gap-2" submitClass="adm-btn adm-btn-line">
              <input type="hidden" name="leadId" value={lead.id} />
              <div className="flex-1"><label htmlFor="source" className="adm-label">Override source</label>
                <select id="source" name="source" defaultValue={lead.source} className="adm-input">{LEAD_SOURCES.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}</select></div>
            </ActionForm>
          </div>
        </Card>
      </Section>

      <Section title="Quotes" action={<Link href={`/admin/quotes/new?lead=${lead.id}`} className="text-sm text-gold-light underline underline-offset-4">New quote</Link>}>
        {quotes.length === 0 ? <Empty>No quote yet.</Empty> : <Card>{quotes.map((q) => <Row key={q.id} href={`/admin/quotes/${q.id}`} title={moneyRange(q.low, q.high)} sub={`${svc(q.services)} · ${fmtDateTime(q.created_at)}`} right={q.mock ? <Badge>demo</Badge> : undefined} />)}</Card>}
      </Section>
      <Section title="Notes"><NoteList notes={notes} /><div className="mt-3"><NoteForm entityType="lead" entityId={lead.id} path={`/admin/leads/${lead.id}`} /></div></Section>
      <Section title="History"><Timeline entries={buildTimeline({ leads: [], quotes: [], bookings: [], jobs: [], invoices: [], payments: [], notes: [], messages: [], conversations: [], events })} /></Section>
    </>
  );
}
