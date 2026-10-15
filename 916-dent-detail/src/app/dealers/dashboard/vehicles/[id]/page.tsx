import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddonActions } from '@/components/dealers/AddonActions';
import { CancelVehicle } from '@/components/dealers/CancelVehicle';
import { PhotoDrop } from '@/components/dealers/PhotoDrop';
import { money } from '@/lib/dealers/billing';
import { asProposals, dealerVisible } from '@/lib/dealers/addons';
import { trail } from '@/lib/dealers/audit';
import { jobPhotosFor } from '@/lib/dealers/photos';
import { getDealerContext } from '@/lib/dealers/session';
import { STATUS_LABEL, STATUS_ORDER, type VehicleStatus } from '@/lib/dealers/status';
import { describeServices, getVehicle } from '@/lib/dealers/vehicles';

export const metadata = { title: 'Vehicle' };

const photoUrl = (p: string) => `/api/dealers/photo?path=${encodeURIComponent(p)}`;
const EVENT_TEXT: Record<string, (d: Record<string, unknown>) => string> = {
  'dealer.vehicle.submitted': () => 'Submitted',
  'dealer.vehicle.status': (d) => `Status: ${STATUS_LABEL[String(d.to) as VehicleStatus] ?? String(d.to)}`,
  'dealer.vehicle.priced': () => 'Price set',
  'dealer.addon.proposed': () => 'Add-on proposed',
  'dealer.addon.priced': () => 'Add-on priced and sent for your approval',
  'dealer.addon.approved': () => 'Add-on approved',
  'dealer.addon.declined': () => 'Add-on declined',
  'dealer.addon.withdrawn': () => 'Add-on withdrawn',
};
const who = (a?: string | null) => (a?.startsWith('dealer:') ? 'You' : a === 'tech' ? 'Technician' : a === 'owner' ? '916 Dent & Detail' : 'System');

export default async function VehicleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dealer } = (await getDealerContext())!;
  const v = await getVehicle(dealer.id, id);
  if (!v) notFound();
  const addons = dealerVisible(asProposals(v.addon_approvals));
  const jobPhotos = await jobPhotosFor(v.job_id);
  const events = (await trail('dealer_vehicle', v.id)).filter((e) => EVENT_TEXT[e.type]);
  const idx = STATUS_ORDER.indexOf(v.status === 'invoiced' ? 'done' : (['quoted', 'approved'].includes(v.status) ? 'submitted' : v.status));
  const cancellable = v.status === 'submitted' || v.status === 'scheduled';
  const title = `${v.label}${v.stock_number ? ` · stock ${v.stock_number}` : ''}`;
  return (
    <div className="grid gap-8">
      <div>
        <Link href="/dealers/dashboard/vehicles" className="inline-flex min-h-11 items-center text-sm text-steel hover:text-gold-light">← All vehicles</Link>
        <h1 className="mt-1 text-xl">{title}</h1>
        <p className="mt-1 font-mono text-sm text-steel">{v.vin}</p>
      </div>

      <section aria-labelledby="st-h" className="dl-card p-5 sm:p-6">
        <h2 id="st-h" className="text-base">Status: <span className="text-gold-light">{v.statusLabel}</span></h2>
        {v.status === 'cancelled' ? <p className="mt-3 text-steel">This vehicle was cancelled.</p> : (
          <ol className="dl-stepper mt-4" aria-label="Progress">
            {STATUS_ORDER.slice(0, 4).map((s, i) => (
              <li key={s} className="dl-step" data-state={i < idx ? 'done' : i === idx ? 'now' : 'todo'} aria-current={i === idx ? 'step' : undefined}>{s === 'scheduled' ? 'Scheduled / on-lot' : s === 'done' ? 'Frontline-ready' : STATUS_LABEL[s]}</li>
            ))}
          </ol>
        )}
        {v.scheduled_at && v.status === 'scheduled' && <p className="mt-3 text-sm text-steel">Planned for {new Date(v.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })}.</p>}
        {cancellable && <div className="mt-5"><CancelVehicle vehicleId={v.id} /></div>}
      </section>

      {addons.length > 0 && (
        <section aria-labelledby="ad-h" className="grid gap-3">
          <h2 id="ad-h" className="text-base">Add-ons</h2>
          <ul className="grid gap-3">
            {addons.map((a) => (
              <li key={a.id} className={`dl-card p-5 ${a.status === 'proposed' ? '!border-[#6d5622]' : ''}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-ivory">{a.label}</p>
                  <p className="tabular-nums text-ivory">{money(a.price ?? 0)}</p>
                </div>
                {a.description && <p className="mt-1 text-sm text-steel">{a.description}</p>}
                <p className="mt-2"><span className={`dl-badge ${a.status === 'approved' ? 'dl-badge-green' : a.status === 'declined' ? 'dl-badge-red' : 'dl-badge-gold'}`}>{a.status === 'proposed' ? 'Waiting for your decision' : a.status === 'approved' ? 'Approved' : 'Declined'}</span></p>
                {a.status === 'proposed' && <><p className="mt-2 text-sm text-steel">We will not do this unless you approve it.</p><AddonActions vehicleId={v.id} addonId={a.id} label={a.label} /></>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="wk-h" className="dl-card p-5 sm:p-6">
        <h2 id="wk-h" className="text-base">Work requested</h2>
        <p className="mt-2 text-ivory/90">{describeServices(v.services, v.panels)}</p>
        {v.notes && <p className="mt-2 text-sm text-steel">Notes: {v.notes}</p>}
        {v.lot_address && <p className="mt-1 text-sm text-steel">Lot: {v.lot_address}</p>}
      </section>

      <section aria-labelledby="ph-h" className="grid gap-4">
        <h2 id="ph-h" className="text-base">Photos</h2>
        {jobPhotos.length > 0 && (
          <div>
            <h3 className="font-sans text-sm font-semibold text-steel">Before and after</h3>
            <ul className="dl-thumbs mt-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
              {jobPhotos.map((p) => (
                <li key={p.id} className="dl-thumb" style={{ aspectRatio: '4 / 3' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl(p.path)} alt={`${p.kind === 'before' ? 'Before' : 'After'} photo${p.caption ? `: ${p.caption}` : ''}`} loading="lazy" />
                  <span className="absolute left-1 top-1 rounded bg-onyx/80 px-1.5 py-0.5 text-[0.68rem] font-semibold uppercase text-gold-light">{p.kind}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {v.photo_paths.length > 0 && (
          <div>
            <h3 className="font-sans text-sm font-semibold text-steel">Submitted by you</h3>
            <ul className="dl-thumbs mt-2">
              {v.photo_paths.map((p, i) => (
                <li key={p} className="dl-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl(p)} alt={`Photo ${i + 1} you submitted for ${title}`} loading="lazy" />
                </li>
              ))}
            </ul>
          </div>
        )}
        {jobPhotos.length === 0 && v.photo_paths.length === 0 && <p className="text-sm text-steel">No photos yet. Before and after photos from our technicians appear here when the work is done.</p>}
        {v.status !== 'cancelled' && v.status !== 'invoiced' && <PhotoDrop vehicleId={v.id} existing={v.photo_paths.length} />}
      </section>

      <section aria-labelledby="au-h" className="dl-card p-5 sm:p-6">
        <h2 id="au-h" className="text-base">History</h2>
        <ol className="mt-3 grid gap-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="border-b border-[#202227] pb-2 last:border-0">
              <span className="block text-ivory/90">{EVENT_TEXT[e.type]!(e.data as Record<string, unknown>)}</span>
              <span className="block text-xs text-steel"><time dateTime={e.created_at}>{new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}</time> · {who(e.actor)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
