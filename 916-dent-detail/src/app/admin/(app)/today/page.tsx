import type { Metadata } from 'next';
import Link from 'next/link';
import { serviceById } from '@/config/booking';
import { addDays, formatLocal, utcToLocal } from '@/lib/availability/tz';
import { fmtTime, localToday, moneyRange, vehicleLabel } from '@/lib/admin/format';
import { addressOf, mapsUrl, smsUrl, telUrl } from '@/lib/admin/links';
import { isStaff } from '@/lib/auth/roles';
import { requireSession } from '@/lib/auth/server';
import { repo } from '@/lib/db';
import { travelMinutes } from '@/lib/geo';
import { Badge, Card, Empty, PageHeader, Section } from '../../_ui';

export const metadata: Metadata = { title: 'Today' };
export const dynamic = 'force-dynamic';

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string; tech?: string }> }) {
  const s = await requireSession();
  const sp = await searchParams;
  const db = repo();
  const today = localToday();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : today;
  const techs = await db.techs.list({ where: { active: true }, orderBy: 'name' });
  // A tech only ever sees their own route; staff can look at anyone's (default: first tech, or "all" via ?tech=all).
  const techId = isStaff(s.role) ? (sp.tech === 'all' ? '' : techs.some((t) => t.id === sp.tech) ? sp.tech! : s.techId ?? '') : s.techId ?? '__none__';
  const tech = techs.find((t) => t.id === techId) ?? null;
  const lo = new Date(Date.parse(`${addDays(date, -1)}T00:00:00Z`)).toISOString();
  const hi = new Date(Date.parse(`${addDays(date, 2)}T00:00:00Z`)).toISOString();
  const all = await db.bookings.list({ ranges: [{ col: 'starts_at', gte: lo, lt: hi }], orderBy: 'starts_at' });
  const stops = all.filter((b) => utcToLocal(Date.parse(b.starts_at)).date === date && ['confirmed', 'on_the_way', 'in_progress', 'completed', 'no_show'].includes(b.status) && (techId === '' || b.tech_id === techId));
  const [customers, vehicles, jobs, weather] = await Promise.all([
    db.customers.list({ whereIn: [{ col: 'id', values: [...new Set(stops.map((b) => b.customer_id).filter((x): x is string => !!x))] }] }),
    db.vehicles.list({ whereIn: [{ col: 'id', values: [...new Set(stops.map((b) => b.vehicle_id).filter((x): x is string => !!x))] }] }),
    db.jobs.list({ whereIn: [{ col: 'booking_id', values: stops.map((b) => b.id) }] }),
    db.weather_flags.first({ where: { date } }),
  ]);
  const cMap = new Map(customers.map((c) => [c.id, c])); const vMap = new Map(vehicles.map((v) => [v.id, v])); const jMap = new Map(jobs.map((j) => [j.booking_id, j]));
  const dayTitle = date === today ? 'Today' : formatLocal(Date.parse(`${date}T12:00:00Z`), { weekday: 'long', month: 'short', day: 'numeric' }, 'UTC');
  const q = (o: Record<string, string>) => `/admin/today?${new URLSearchParams({ ...(sp.tech ? { tech: sp.tech } : {}), ...o })}`;
  const remaining = stops.filter((b) => ['confirmed', 'on_the_way', 'in_progress'].includes(b.status)).length;
  let prevZip: string | null = tech?.home_zip ?? null;
  return (
    <>
      <PageHeader title={dayTitle} eyebrow={tech ? tech.name.replace('[OWNER] ', '') : isStaff(s.role) ? 'All technicians' : 'Your route'} />
      <Section>
        <div className="flex items-center justify-between gap-2">
          <Link className="adm-btn adm-btn-line" href={q({ date: addDays(date, -1) })} aria-label="Previous day">‹</Link>
          <p className="text-sm text-[#b9bcc3]">{stops.length} stop{stops.length === 1 ? '' : 's'} · {remaining} to go</p>
          <Link className="adm-btn adm-btn-line" href={q({ date: addDays(date, 1) })} aria-label="Next day">›</Link>
        </div>
        {isStaff(s.role) && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={q({ tech: 'all' })} className={`adm-badge min-h-9 px-3 ${techId === '' ? 'adm-badge-gold' : ''}`}>Everyone</Link>
            {techs.map((t) => <Link key={t.id} href={q({ tech: t.id })} className={`adm-badge min-h-9 px-3 ${techId === t.id ? 'adm-badge-gold' : ''}`}>{t.name.replace('[OWNER] ', '')}</Link>)}
          </div>
        )}
        {weather && <p role="note" className="mt-3 rounded-xl border border-[#35557a] bg-[#101a26] px-3 py-2 text-sm text-[#a9cbf2]">Weather hold today ({weather.reason}). Exterior work may need to move.</p>}
      </Section>
      <Section>
        {stops.length === 0 ? <Empty>No stops {date === today ? 'today' : 'that day'}. Enjoy it.</Empty> : (
          <ol className="space-y-3">
            {stops.map((b, i) => {
              const c = cMap.get(b.customer_id ?? ''); const j = jMap.get(b.id);
              const addr = addressOf(b);
              const drive = i === 0 && !prevZip ? null : travelMinutes(prevZip, b.zip);
              prevZip = b.zip ?? prevZip;
              const open = j ? `/admin/jobs/${j.id}` : `/admin/jobs/${b.id}`;
              return (
                <li key={b.id}>
                  {drive !== null && b.status !== 'completed' && <p className="mb-1 ml-2 text-xs text-[#8c8f96]">~{drive} min drive{i === 0 ? ' from home' : ' from previous stop'}</p>}
                  <Card>
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-gold-light">{i + 1}. {fmtTime(b.starts_at)}–{fmtTime(b.ends_at)}</p><h2 className="truncate text-lg font-semibold">{c?.name ?? 'Customer'}</h2></div>
                        <Badge tone={b.status === 'completed' ? 'green' : b.status === 'in_progress' ? 'gold' : b.status === 'on_the_way' ? 'blue' : b.status === 'no_show' ? 'red' : 'neutral'}>{b.status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="text-sm text-[#d6d8dd]">{b.services.map((x) => serviceById(x)?.plain ?? x).join(' + ')}{vMap.get(b.vehicle_id ?? '') ? ` · ${vehicleLabel(vMap.get(b.vehicle_id ?? ''))}` : ''}</p>
                      <p className="text-sm text-[#a9acb3]">{addr}{b.price_low != null ? ` · Est. ${moneyRange(b.price_low, b.price_high)}` : ' · price after photos'}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {addr ? <a className="adm-btn adm-btn-line" href={mapsUrl(addr)} aria-label={`Navigate to ${c?.name ?? 'customer'}`}>Navigate</a> : <span />}
                        {c?.phone ? <a className="adm-btn adm-btn-line" href={telUrl(c.phone)} aria-label={`Call ${c.name}`}>Call</a> : <span />}
                        {c?.phone ? <a className="adm-btn adm-btn-line" href={smsUrl(c.phone)} aria-label={`Text ${c.name}`}>Text</a> : <span />}
                      </div>
                      <Link href={open} className={`adm-btn adm-btn-big w-full ${b.status === 'completed' ? 'adm-btn-line' : 'adm-btn-gold'}`}>{b.status === 'completed' ? 'View job' : b.status === 'in_progress' ? 'Continue job' : 'Open job'}</Link>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </Section>
    </>
  );
}
