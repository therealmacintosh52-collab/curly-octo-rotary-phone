import type { Metadata } from 'next';
import Link from 'next/link';
import { serviceById } from '@/config/booking';
import { addDays, formatLocal } from '@/lib/availability/tz';
import { loadCalendar } from '@/lib/admin/schedule';
import { fmtTime, localToday, vehicleLabel } from '@/lib/admin/format';
import { requireStaff } from '@/lib/auth/server';
import { repo } from '@/lib/db';
import { Badge, Card, Empty, PageHeader, Row, Section } from '../../_ui';

export const metadata: Metadata = { title: 'Schedule' };
export const dynamic = 'force-dynamic';

const dayName = (date: string, long = false) => formatLocal(Date.parse(`${date}T12:00:00Z`), long ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' }, 'UTC');

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; tech?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const today = localToday();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : today;
  const week = sp.view === 'week';
  const from = week ? addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7)) : date; // Monday-start week
  const { days, techs } = await loadCalendar(from, week ? 7 : 1);
  const techFilter = techs.some((t) => t.id === sp.tech) ? sp.tech! : '';
  const db = repo();
  const customers = new Map((await db.customers.list({ whereIn: [{ col: 'id', values: [...new Set(days.flatMap((d) => d.bookings.map((b) => b.customer_id).filter((x): x is string => !!x)))] }] })).map((c) => [c.id, c]));
  const vehicles = new Map((await db.vehicles.list({ whereIn: [{ col: 'id', values: [...new Set(days.flatMap((d) => d.bookings.map((b) => b.vehicle_id).filter((x): x is string => !!x)))] }] })).map((v) => [v.id, v]));
  const href = (o: Record<string, string | undefined>) => { const p = new URLSearchParams(); const m = { view: sp.view, date: sp.date, tech: sp.tech, ...o }; for (const [k, v] of Object.entries(m)) if (v) p.set(k, v); return `/admin/schedule?${p}`; };
  const step = week ? 7 : 1;
  const techName = (id: string | null | undefined) => techs.find((t) => t.id === id)?.name ?? 'Unassigned';
  return (
    <>
      <PageHeader title="Schedule" actions={<Link href="/admin/schedule/new" className="adm-btn adm-btn-gold">Book</Link>} />
      <Section>
        <div className="flex items-center justify-between gap-2">
          <Link className="adm-btn adm-btn-line" href={href({ date: addDays(from, -step) })} aria-label={week ? 'Previous week' : 'Previous day'}>‹</Link>
          <div className="text-center"><p className="font-semibold">{week ? `Week of ${dayName(from)}` : dayName(from, true)}</p>{from === today && !week && <Badge tone="gold">Today</Badge>}</div>
          <Link className="adm-btn adm-btn-line" href={href({ date: addDays(from, step) })} aria-label={week ? 'Next week' : 'Next day'}>›</Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={href({ view: undefined })} aria-current={!week ? 'page' : undefined} className={`adm-badge min-h-9 px-3 ${!week ? 'adm-badge-gold' : ''}`}>Day</Link>
          <Link href={href({ view: 'week' })} aria-current={week ? 'page' : undefined} className={`adm-badge min-h-9 px-3 ${week ? 'adm-badge-gold' : ''}`}>Week</Link>
          <Link href={href({ date: today })} className="adm-badge min-h-9 px-3">Today</Link>
          <span className="mx-1 self-center text-[#4a4d55]" aria-hidden="true">|</span>
          <Link href={href({ tech: undefined })} aria-current={!techFilter ? 'page' : undefined} className={`adm-badge min-h-9 px-3 ${!techFilter ? 'adm-badge-gold' : ''}`}>All techs</Link>
          {techs.map((t) => <Link key={t.id} href={href({ tech: t.id })} aria-current={techFilter === t.id ? 'page' : undefined} className={`adm-badge min-h-9 px-3 ${techFilter === t.id ? 'adm-badge-gold' : ''}`}><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: t.color ?? '#8c8f96' }} />{t.name.replace('[OWNER] ', '')}</Link>)}
        </div>
      </Section>
      {days.map((d) => {
        const list = d.bookings.filter((b) => !techFilter || b.tech_id === techFilter);
        return (
          <Section key={d.date} title={week ? dayName(d.date) : undefined} id={`day-${d.date}`}>
            <div className="mb-2 flex flex-wrap gap-2">
              {d.weather && <Badge tone="blue">Weather hold: {d.weather}</Badge>}
              {d.blackout.map((b, i) => <Badge key={i} tone="red">Closed{b.techId ? ` (${techName(b.techId)})` : ''}{b.reason ? `: ${b.reason}` : ''}</Badge>)}
              {d.blocks.filter((b) => !techFilter || !b.techId || b.techId === techFilter).map((b) => <Badge key={b.id}>Blocked {fmtTime(b.startsAt)}–{fmtTime(b.endsAt)}{b.reason ? ` · ${b.reason}` : ''}</Badge>)}
            </div>
            {list.length === 0 ? <Empty>{week ? 'Nothing booked.' : 'Nothing booked this day.'}</Empty> : (
              <Card>
                {list.map((b) => (
                  <Row key={b.id} href={`/admin/bookings/${b.id}`}
                    leading={<span aria-hidden="true" className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: techs.find((t) => t.id === b.tech_id)?.color ?? '#8c8f96' }} />}
                    title={`${fmtTime(b.starts_at)} · ${customers.get(b.customer_id ?? '')?.name ?? 'Customer'}`}
                    sub={`${b.services.map((s) => serviceById(s)?.plain ?? s).join(' + ')} · ${vehicleLabel(vehicles.get(b.vehicle_id ?? '')) || b.city || ''} · ${techName(b.tech_id).replace('[OWNER] ', '')}`}
                    right={<Badge tone={b.status === 'completed' ? 'green' : ['cancelled', 'no_show', 'expired'].includes(b.status) ? 'red' : b.status === 'pending_deposit' ? 'neutral' : 'gold'}>{b.status.replace('_', ' ')}</Badge>} />
                ))}
              </Card>
            )}
          </Section>
        );
      })}
      <Section><Link className="text-sm text-gold-light underline underline-offset-4" href="/admin/schedule/settings">Blocks, blackout dates, weather and durations</Link></Section>
    </>
  );
}
