import type { Metadata } from 'next';
import Link from 'next/link';
import { formatLocal } from '@/lib/availability/tz';
import { fmtDate, localToday, money, sourceLabel } from '@/lib/admin/format';
import { LEAD_SOURCES } from '@/lib/admin/pipeline';
import { requireStaff } from '@/lib/auth/server';
import { summarize } from '@/lib/reports/compute';
import { loadReportData } from '@/lib/reports/load';
import { PRESETS, PRESET_LABEL, resolveRange } from '@/lib/reports/range';
import { addAdSpendAction, deleteAdSpendAction } from '../../_actions/reports';
import { ActionForm } from '../../_ui/forms';
import { ChartCard, ColumnChart, HBarChart } from '../../_ui/Charts';
import { Badge, Card, Empty, Field, PageHeader, Section, Stat } from '../../_ui';

export const metadata: Metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);
const weekLabel = (w: string) => formatLocal(Date.parse(`${w}T12:00:00Z`), { month: 'short', day: 'numeric' }, 'UTC');

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ preset?: string; from?: string; to?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const r = resolveRange(sp.preset, { from: sp.from, to: sp.to });
  const d = await loadReportData(r);
  const s = summarize(d, r);
  const qs = r.preset === 'custom' ? `preset=custom&from=${r.from}&to=${r.to}` : `preset=${r.preset}`;
  const csv = (type: string) => <a className="text-sm text-gold-light underline underline-offset-4" href={`/api/admin/reports/csv?type=${type}&${qs}`} download>Download CSV<span className="sr-only"> ({type})</span></a>;
  const today = localToday();
  const spendRows = [...d.adSpend].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  return (
    <>
      <PageHeader title="Reports" eyebrow={`${r.label} · ${fmtDate(`${r.from}T20:00:00Z`)} to ${fmtDate(`${r.to}T20:00:00Z`)}`} />
      <Section>
        <nav aria-label="Date range" className="flex flex-wrap gap-2">
          {PRESETS.filter((p) => p !== 'custom').map((p) => <Link key={p} href={`/admin/reports?preset=${p}`} aria-current={r.preset === p ? 'page' : undefined} className={`adm-badge min-h-9 px-3 ${r.preset === p ? 'adm-badge-gold' : ''}`}>{PRESET_LABEL[p]}</Link>)}
        </nav>
        <form action="/admin/reports" className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <input type="hidden" name="preset" value="custom" />
          <Field label="From" htmlFor="from"><input id="from" name="from" type="date" defaultValue={r.from} className="adm-input" /></Field>
          <Field label="To" htmlFor="to"><input id="to" name="to" type="date" defaultValue={r.to} className="adm-input" /></Field>
          <button className="adm-btn adm-btn-line" type="submit">Apply</button>
        </form>
      </Section>

      <Section>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Revenue" value={money(s.revenue)} sub={`${s.jobs} finished job${s.jobs === 1 ? '' : 's'}`} />
          <Stat label="Average ticket" value={s.avgTicket === null ? '—' : money(s.avgTicket)} />
          <Stat label="Close rate" value={pct(s.funnel.leadToDone)} sub={`${s.funnel.done} of ${s.funnel.leads} new leads finished`} />
          <Stat label="Reviews per week" value={s.reviewsPerWeek.toFixed(1)} sub={`${s.reviews} marked reviewed`} />
        </div>
        <p className="mt-2 text-xs text-[#8c8f96]">Revenue counts the value of finished jobs by finish date (not cash received). Reviews are jobs you marked Reviewed in the pipeline.</p>
      </Section>

      <Section title="Revenue by week"><ChartCard title="Weekly revenue" action={csv('weekly')}><ColumnChart title="Revenue per week" desc={`Revenue in dollars for each week from ${r.from} to ${r.to}.`} labels={s.weekly.map((w) => weekLabel(w.week))} series={[{ name: 'Revenue', color: 'gold', values: s.weekly.map((w) => w.revenue), format: (n) => money(n) }]} /></ChartCard></Section>
      <Section title="Revenue by service"><ChartCard title="By service" action={csv('service')}><HBarChart title="Revenue by service" desc="Revenue split by service, add-ons, travel and discounts." valueHeader="Revenue" rows={s.byService.map((x) => ({ label: x.label, value: x.revenue, display: money(x.revenue), note: `${x.jobs} jobs` }))} /></ChartCard></Section>
      <Section title="Revenue by source"><ChartCard title="By lead source" action={csv('source')}><HBarChart title="Revenue by lead source" desc="Revenue by where the customer first came from." valueHeader="Revenue" rows={s.bySource.map((x) => ({ label: x.label, value: x.revenue, display: money(x.revenue), note: `${x.jobs} jobs` }))} /></ChartCard></Section>
      <Section title="Revenue by tech"><ChartCard title="By technician" action={csv('tech')}><HBarChart title="Revenue by technician" desc="Revenue by the technician who did the job." valueHeader="Revenue" rows={s.byTech.map((x) => ({ label: x.label, value: x.revenue, display: money(x.revenue), note: `${x.jobs} jobs` }))} /></ChartCard></Section>

      <Section title="Close rate">
        <ChartCard title="Leads to finished jobs" action={csv('funnel')}>
          <HBarChart title="Lead funnel" desc="New leads, those quoted or booked, those booked, and those finished." valueHeader="Count" rows={[
            { label: 'New leads', value: s.funnel.leads, display: String(s.funnel.leads) }, { label: 'Quoted', value: s.funnel.quoted, display: String(s.funnel.quoted) },
            { label: 'Booked', value: s.funnel.booked, display: String(s.funnel.booked) }, { label: 'Finished', value: s.funnel.done, display: String(s.funnel.done) },
          ]} />
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div><dt className="text-xs text-[#a9acb3]">Quote to booked</dt><dd className="font-semibold tabular-nums">{pct(s.funnel.quoteToBook)}</dd></div>
            <div><dt className="text-xs text-[#a9acb3]">Booked to done</dt><dd className="font-semibold tabular-nums">{pct(s.funnel.bookToDone)}</dd></div>
            <div><dt className="text-xs text-[#a9acb3]">Lead to done</dt><dd className="font-semibold tabular-nums">{pct(s.funnel.leadToDone)}</dd></div>
          </dl>
        </ChartCard>
      </Section>

      <Section title="Reviews per week"><ChartCard title="Reviews and requests" action={csv('weekly')}><ColumnChart title="Reviews per week" desc="Jobs marked reviewed and review requests sent, by week." labels={s.weekly.map((w) => weekLabel(w.week))} series={[{ name: 'Reviews', color: 'gold', values: s.weekly.map((w) => w.reviews), format: (n) => String(n) }, { name: 'Requests sent', color: 'steel', values: s.weekly.map((w) => w.requests), format: (n) => String(n) }]} /></ChartCard></Section>

      <Section title="Ad cost per customer" action={csv('cpa')}>
        {s.cpa.length === 0 ? <Empty>No ad spend entered for this range. Add it below.</Empty> : (
          <Card><div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Ad cost per customer by channel"><table className="adm-table">
            <thead><tr><th>Channel</th><th className="num">Spend</th><th className="num">Leads</th><th className="num">Booked</th><th className="num">Done</th><th className="num">Per lead</th><th className="num">Per booked</th><th className="num">Per job</th><th className="num">ROAS</th></tr></thead>
            <tbody>{s.cpa.map((c) => <tr key={c.channel}><td>{c.label}</td><td className="num">{money(c.spend)}</td><td className="num">{c.leads}</td><td className="num">{c.booked}</td><td className="num">{c.done}</td><td className="num">{c.cpl === null ? '—' : money(c.cpl)}</td><td className="num">{c.cpaBooked === null ? '—' : money(c.cpaBooked)}</td><td className="num">{c.cpaDone === null ? '—' : money(c.cpaDone)}</td><td className="num">{c.roas === null ? '—' : `${c.roas.toFixed(1)}x`}</td></tr>)}</tbody>
          </table></div></Card>
        )}
        <p className="mt-2 text-xs text-[#8c8f96]">Leads, booked and done count leads created in this range from that channel. ROAS = revenue from that channel / spend. Spend is typed in by hand.</p>
      </Section>

      <Section title="Enter ad spend" action={csv('adspend')}>
        <Card><div className="p-4">
          <ActionForm action={addAdSpendAction} submit="Save spend" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" htmlFor="ad-date"><input id="ad-date" name="date" type="date" required defaultValue={today} className="adm-input" /></Field>
              <Field label="Spend ($)" htmlFor="ad-spend"><input id="ad-spend" name="spend" type="number" inputMode="decimal" step="0.01" min="0" required className="adm-input" /></Field>
            </div>
            <Field label="Channel" htmlFor="ad-channel"><select id="ad-channel" name="channel" defaultValue="google" className="adm-input">{LEAD_SOURCES.map((c) => <option key={c} value={c}>{sourceLabel(c)}</option>)}</select></Field>
            <Field label="Note (optional)" htmlFor="ad-notes"><input id="ad-notes" name="notes" maxLength={120} className="adm-input" placeholder="Campaign name, flyer run…" /></Field>
          </ActionForm>
        </div></Card>
        {spendRows.length > 0 && (
          <Card className="mt-3">{spendRows.map((a) => (
            <div key={a.id} className="adm-row">
              <span className="min-w-0 flex-1"><span className="block font-semibold">{money(a.spend)} · {sourceLabel(a.channel)}</span><span className="text-sm text-[#a9acb3]">{fmtDate(`${a.date}T20:00:00Z`)}{a.notes ? ` · ${a.notes}` : ''}</span></span>
              <Badge>manual</Badge>
              <ActionForm action={deleteAdSpendAction} className="contents" submit="Delete" submitClass="adm-btn adm-btn-line"><input type="hidden" name="id" value={a.id} /></ActionForm>
            </div>
          ))}</Card>
        )}
      </Section>
      <Section><p className="text-xs text-[#8c8f96]">Also: <a className="underline" href={`/api/admin/reports/csv?type=invoices&${qs}`} download>invoices CSV</a>. Export opens in Excel or Google Sheets; cells that start with = + - @ are neutralised.</p></Section>
    </>
  );
}
