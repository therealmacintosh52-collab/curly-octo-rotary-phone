import type { Metadata } from 'next';
import Link from 'next/link';
import { serviceById } from '@/config/booking';
import { LEAD_SOURCES, PIPELINE_STAGES, STAGE_LABEL, loadPipeline } from '@/lib/admin/pipeline';
import { fmtPhone, sourceLabel } from '@/lib/admin/format';
import { requireStaff } from '@/lib/auth/server';
import type { LeadSource, LeadStage } from '@/lib/db';
import { quickAddLeadAction } from '../../_actions/crm';
import { ActionForm } from '../../_ui/forms';
import { Badge, Card, Empty, Field, PageHeader, Row, Section } from '../../_ui';

export const metadata: Metadata = { title: 'Pipeline' };
export const dynamic = 'force-dynamic';

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ stage?: string; source?: string; lost?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const source = LEAD_SOURCES.includes(sp.source as LeadSource) ? (sp.source as LeadSource) : null;
  const board = await loadPipeline({ source, includeLost: sp.lost === '1' });
  const stages: LeadStage[] = [...PIPELINE_STAGES, ...(sp.lost === '1' ? (['lost'] as const) : [])];
  const active = stages.includes(sp.stage as LeadStage) ? (sp.stage as LeadStage) : null;
  const q = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(); const m = { stage: sp.stage, source: sp.source, lost: sp.lost, ...extra };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    const s = p.toString(); return `/admin/pipeline${s ? `?${s}` : ''}`;
  };
  return (
    <>
      <PageHeader title="Pipeline" eyebrow="Leads to reviews" />
      <Section>
        <details className="adm-card" open={false}>
          <summary className="flex min-h-14 cursor-pointer items-center justify-between px-4 text-sm font-semibold text-gold-light">Quick add lead (door-knock mode)<span aria-hidden="true">+</span></summary>
          <div className="px-4 pb-4">
            <ActionForm action={quickAddLeadAction} submit="Add lead">
              <Field label="Name" htmlFor="qa-name"><input id="qa-name" name="name" required maxLength={80} className="adm-input" autoComplete="off" /></Field>
              <Field label="Phone" htmlFor="qa-phone"><input id="qa-phone" name="phone" type="tel" inputMode="tel" required className="adm-input" autoComplete="off" /></Field>
              <Field label="Where / what" htmlFor="qa-notes" help="e.g. Hanlees lot, 3 dented trucks"><input id="qa-notes" name="notes" maxLength={300} className="adm-input" autoComplete="off" /></Field>
              <input type="hidden" name="source" value="door_knock" />
            </ActionForm>
          </div>
        </details>
      </Section>
      <Section>
        <nav aria-label="Pipeline stages" className="-mx-1 flex flex-wrap gap-2">
          <Link href={q({ stage: undefined })} aria-current={!active ? 'page' : undefined} className={`adm-badge min-h-9 px-3 ${!active ? 'adm-badge-gold' : ''}`}>All</Link>
          {stages.map((s) => <Link key={s} href={q({ stage: s })} aria-current={active === s ? 'page' : undefined} className={`adm-badge min-h-9 px-3 ${active === s ? 'adm-badge-gold' : ''}`}>{STAGE_LABEL[s]} {board[s].length}</Link>)}
        </nav>
        <form action="/admin/pipeline" className="mt-3 flex items-end gap-2">
          {sp.stage && <input type="hidden" name="stage" value={sp.stage} />}
          {sp.lost && <input type="hidden" name="lost" value={sp.lost} />}
          <div className="flex-1"><label htmlFor="source" className="adm-label">Source</label>
            <select id="source" name="source" defaultValue={source ?? ''} className="adm-input"><option value="">All sources</option>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}</select></div>
          <button className="adm-btn adm-btn-line" type="submit">Filter</button>
        </form>
        <p className="mt-2 text-sm"><Link className="text-gold-light underline underline-offset-4" href={q({ lost: sp.lost === '1' ? undefined : '1' })}>{sp.lost === '1' ? 'Hide lost' : 'Show lost'}</Link></p>
      </Section>
      {stages.filter((s) => !active || s === active).map((s) => (
        <Section key={s} title={`${STAGE_LABEL[s]} (${board[s].length})`} id={`stage-${s}`}>
          {board[s].length === 0 ? <Empty>Nothing here.</Empty> : (
            <Card>
              {board[s].map(({ lead, customer, ageDays }) => (
                <Row key={lead.id} href={`/admin/leads/${lead.id}`} title={lead.name ?? customer?.name ?? 'Unnamed lead'}
                  sub={[fmtPhone(lead.phone ?? customer?.phone), lead.zip, lead.notes?.split('\n')[0]?.replace(/^Services: /, '').split(', ').map((x) => serviceById(x)?.plain ?? x).join(', ')].filter(Boolean).join(' · ') || undefined}
                  right={<span className="flex flex-col items-end gap-1"><Badge tone="gold">{sourceLabel(lead.source)}</Badge><span className="text-xs text-[#8c8f96]">{ageDays === 0 ? 'today' : `${ageDays}d`}</span></span>} />
              ))}
            </Card>
          )}
        </Section>
      ))}
    </>
  );
}
