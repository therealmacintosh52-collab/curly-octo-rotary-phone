import Link from 'next/link';
import { BOARD_COLUMNS } from '@/lib/dealers/status';
import { getDealerContext } from '@/lib/dealers/session';
import { listVehicles, countsByColumn, type VehicleRow } from '@/lib/dealers/vehicles';

const STATUS_TONE: Record<string, string> = { done: 'dl-badge-green', invoiced: 'dl-badge-green', in_progress: 'dl-badge-gold', scheduled: 'dl-badge-blue', cancelled: 'dl-badge-red' };

function VehicleCard({ v }: { v: VehicleRow }) {
  return (
    <Link href={`/dealers/dashboard/vehicles/${v.id}`} className="dl-card block p-4 transition-colors hover:border-gold-deep">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ivory">{v.label}</span>
        <span className={`dl-badge ${STATUS_TONE[v.status] ?? ''}`}>{v.statusLabel}</span>
      </span>
      <span className="mt-1 block text-sm text-steel">{v.stock_number ? `Stock ${v.stock_number}` : 'No stock number'}{v.vin ? ` · VIN …${v.vin.slice(-6)}` : ''}</span>
      {v.pendingAddons > 0 && <span className="dl-badge dl-badge-gold mt-2">Add-on needs your approval</span>}
    </Link>
  );
}

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; view?: string }> }) {
  const sp = await searchParams;
  const { dealer } = (await getDealerContext())!;
  const q = (sp.q ?? '').slice(0, 60);
  const status = sp.status ?? 'all';
  const view = sp.view === 'board' ? 'board' : 'list';
  const [rows, counts] = await Promise.all([listVehicles(dealer.id, { q, status }), countsByColumn(dealer.id)]);
  const href = (o: { status?: string; view?: string }) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    const s = o.status ?? status; if (s !== 'all') p.set('status', s);
    const v = o.view ?? view; if (v === 'board') p.set('view', 'board');
    const str = p.toString();
    return `/dealers/dashboard/vehicles${str ? `?${str}` : ''}`;
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">Vehicles</h1>
        <Link href="/dealers/dashboard/submit" className="dl-btn dl-btn-gold dl-btn-sm">Submit vehicles</Link>
      </div>
      <form method="get" role="search" className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="dl-label">Search by stock number, VIN, make or model</label>
          <input id="q" name="q" type="search" defaultValue={q} className="dl-input" autoComplete="off" />
        </div>
        {status !== 'all' && <input type="hidden" name="status" value={status} />}
        {view === 'board' && <input type="hidden" name="view" value="board" />}
        <button type="submit" className="dl-btn dl-btn-line">Search</button>
        {(q || status !== 'all') && <Link href={href({ status: 'all' }).split('?')[0] + (view === 'board' ? '?view=board' : '')} className="dl-btn dl-btn-line">Clear</Link>}
      </form>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by status"><ul className="dl-chip-row">
          <li><Link href={href({ status: 'all' })} className="dl-tab" aria-current={status === 'all' ? 'page' : undefined}>All ({counts.all})</Link></li>
          {BOARD_COLUMNS.map((c) => <li key={c.key}><Link href={href({ status: c.key })} className="dl-tab" aria-current={status === c.key ? 'page' : undefined}>{c.label} ({counts[c.key] ?? 0})</Link></li>)}
        </ul></nav>
        <nav aria-label="View"><ul className="dl-chip-row">
          <li><Link href={href({ view: 'list' })} className="dl-tab" aria-current={view === 'list' ? 'page' : undefined}>List</Link></li>
          <li><Link href={href({ view: 'board' })} className="dl-tab" aria-current={view === 'board' ? 'page' : undefined}>Board</Link></li>
        </ul></nav>
      </div>
      <p className="mt-4 text-sm text-steel" role="status">{rows.length} vehicle{rows.length === 1 ? '' : 's'}{q ? ` matching “${q}”` : ''}</p>
      {rows.length === 0 ? (
        <p className="dl-card mt-4 p-6 text-steel">Nothing here yet. {q ? 'Try a shorter search.' : <>Start with <Link href="/dealers/dashboard/submit" className="text-gold-light underline underline-offset-4">Submit vehicles</Link>.</>}</p>
      ) : view === 'list' ? (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">{rows.map((v) => <li key={v.id}><VehicleCard v={v} /></li>)}</ul>
      ) : (
        <div className="dl-board mt-4">
          {BOARD_COLUMNS.map((c) => {
            const col = rows.filter((v) => c.statuses.includes(v.status));
            return (
              <section key={c.key} className="dl-col" aria-labelledby={`col-${c.key}`}>
                <h2 id={`col-${c.key}`} className="mb-3 font-sans text-sm font-semibold text-ivory">{c.label} <span className="text-steel">({col.length})</span></h2>
                <ul className="grid gap-2">{col.map((v) => <li key={v.id}><VehicleCard v={v} /></li>)}</ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
