'use client';
import { useEffect, useState } from 'react';
import { ESTIMATE_LABEL } from '@/config/pricing';
import { site, smsHref, telHref } from '@/config/site';
import { formatRange } from '@/lib/pricing';
import type { BookingView } from '@/lib/booking/service';
import { api } from '@/app/book/api';
import '@/app/book/book.css';

type Slot = { startsAt: string; date: string; label: string };
type Day = { date: string; slotCount: number };
type Avail = { days: Day[]; slots: Slot[] };

const parts = (iso: string) => { const [y, m, d] = iso.split('-').map(Number) as [number, number, number]; return new Date(y, m - 1, d); };
const longDay = (iso: string) => parts(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const STATUS: Record<string, string> = {
  pending_deposit: 'Waiting for deposit', confirmed: 'Confirmed', on_the_way: 'Technician on the way', in_progress: 'In progress',
  completed: 'Completed', cancelled: 'Cancelled', no_show: 'Missed', expired: 'Reservation expired',
};

export function ManageBooking({ token, initial }: { token: string; initial: BookingView }) {
  const [v, setV] = useState(initial);
  const [mode, setMode] = useState<'view' | 'reschedule' | 'cancel'>('view');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [avail, setAvail] = useState<Avail | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [pick, setPick] = useState<Slot | null>(null);

  // returning from a redirect-based payment method: verify with the server
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (v.status === 'pending_deposit' && q.get('payment_intent')) {
      void api<BookingView>(`/api/booking/${token}`, { body: { action: 'confirm-payment' } }).then((r) => { if (r.ok) setV(r.data); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openReschedule() {
    setMode('reschedule'); setMsg(null); setPick(null);
    const r = await api<Avail>('/api/availability', { body: { ...v.slotQuery, excludeBookingId: v.id } });
    if (!r.ok) { setMsg({ kind: 'err', text: r.error.message }); return; }
    setAvail(r.data);
    setDay(r.data.days.find((d) => d.slotCount > 0)?.date ?? null);
  }
  async function doReschedule() {
    if (!pick) return;
    setBusy(true); setMsg(null);
    const r = await api<BookingView>(`/api/booking/${token}`, { body: { action: 'reschedule', startsAt: pick.startsAt } });
    setBusy(false);
    if (!r.ok) { setMsg({ kind: 'err', text: r.error.message }); return; }
    setV(r.data); setMode('view'); setMsg({ kind: 'ok', text: `Rescheduled to ${r.data.dayLabel} at ${r.data.timeLabel}. A new confirmation is on its way.` });
  }
  async function doCancel() {
    setBusy(true); setMsg(null);
    const r = await api<BookingView & { depositOutcome: string }>(`/api/booking/${token}`, { body: { action: 'cancel' } });
    setBusy(false);
    if (!r.ok) { setMsg({ kind: 'err', text: r.error.message }); return; }
    setV(r.data); setMode('view');
    const o = r.data.depositOutcome;
    setMsg({ kind: 'ok', text: o === 'refund' ? 'Cancelled. Your deposit is being refunded.' : o === 'credit' ? 'Cancelled. Your deposit is held as credit toward a future visit.' : o === 'forfeit' ? 'Cancelled. Per our policy the deposit is kept.' : 'Cancelled.' });
  }

  const active = v.status === 'confirmed' || v.status === 'pending_deposit';
  const outcomeText: Record<string, string> = { refund: 'Your deposit will be refunded in full.', credit: 'Your deposit will be held as credit toward a future visit.', forfeit: 'Cancelling now means the deposit is kept, per the policy below.', none: '' };

  return (
    <div className="bk-scope grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <div role="status" aria-live="polite">{msg && <p className={`card mb-6 p-4 ${msg.kind === 'ok' ? 'text-gold' : 'text-[#f0907f]'}`}>{msg.text}</p>}</div>
        <div className="card p-6">
          <p className="eyebrow mb-3">{STATUS[v.status] ?? v.status}</p>
          <p className="font-display text-xl text-ivory">{v.dayLabel}</p>
          <p className="text-ivory">{v.timeLabel} <span className="text-sm text-steel">Pacific</span></p>
          <p className="mt-3 text-steel">{v.services.map((s) => s.plain).join(' + ')}{v.vehicle ? ` · ${v.vehicle}` : ''}</p>
          {v.city && <p className="text-steel">{v.city} {v.zip}</p>}
          {v.priceLow !== null && v.priceHigh !== null && <p className="mt-3 text-sm text-steel">Estimated total {formatRange(v.priceLow, v.priceHigh)}. {ESTIMATE_LABEL}</p>}
          <p className="mt-1 text-sm text-steel">Deposit {formatRange(v.depositAmount, v.depositAmount)}: {v.depositStatus === 'paid' ? 'paid' : v.depositStatus === 'refunded' ? 'refunded' : v.depositStatus === 'credited' ? 'held as credit' : v.depositStatus === 'forfeited' ? 'kept' : 'not paid'}.</p>
          {v.mock && <p className="bk-demo mt-4 text-sm"><strong>DEMO booking.</strong> No card was charged.</p>}
        </div>

        {mode === 'view' && active && (
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn btn-gold" onClick={() => void openReschedule()} disabled={!v.canReschedule}>Reschedule</button>
            <button type="button" className="btn btn-outline" onClick={() => { setMode('cancel'); setMsg(null); }} disabled={!v.canCancel}>Cancel booking</button>
          </div>
        )}
        {mode === 'view' && active && (!v.canReschedule || !v.canCancel) && <p className="bk-hint mt-3">{v.rescheduleMessage || v.cancelMessage} <a className="text-gold underline" href={telHref}>Call {site.phone.display}</a> or <a className="text-gold underline" href={smsHref}>text</a>.</p>}
        {mode === 'view' && v.status === 'pending_deposit' && <p className="bk-hint mt-3">This reservation is not confirmed until the deposit is paid. <a className="text-gold underline" href="/book">Start again</a> if it has expired.</p>}

        {mode === 'reschedule' && avail && (
          <section aria-labelledby="rs-h" className="card mt-6 p-6">
            <h2 id="rs-h" className="text-lg">Choose a new time</h2>
            {v.rescheduleMessage === '' && <p className="bk-hint">Your deposit moves with you.</p>}
            {avail.days.every((d) => d.slotCount === 0) ? <p className="mt-4 text-steel">No open times right now. Please call or text us.</p> : (
              <>
                <div role="group" aria-label="Choose a day" className="bk-dayrail mt-4">
                  {avail.days.map((d) => (
                    <button key={d.date} type="button" className="bk-day" aria-pressed={day === d.date} disabled={d.slotCount === 0} onClick={() => { setDay(d.date); setPick(null); }} aria-label={`${longDay(d.date)}${d.slotCount === 0 ? ', no times' : ''}`}>
                      <small>{parts(d.date).toLocaleDateString('en-US', { weekday: 'short' })}</small><b>{parts(d.date).getDate()}</b>
                    </button>
                  ))}
                </div>
                {day && (
                  <div role="group" aria-label={`Times on ${longDay(day)}`} className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {avail.slots.filter((s) => s.date === day).map((s) => <button key={s.startsAt} type="button" className="bk-chip" aria-pressed={pick?.startsAt === s.startsAt} onClick={() => setPick(s)}>{s.label}</button>)}
                  </div>
                )}
              </>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="btn btn-gold disabled:opacity-45" onClick={() => void doReschedule()} disabled={!pick || busy}>{busy ? <span className="bk-spin" aria-hidden="true" /> : null}Confirm new time</button>
              <button type="button" className="btn btn-outline" onClick={() => setMode('view')}>Keep my time</button>
            </div>
          </section>
        )}

        {mode === 'cancel' && (
          <section aria-labelledby="cn-h" className="card mt-6 p-6">
            <h2 id="cn-h" className="text-lg">Cancel this booking?</h2>
            {outcomeText[v.cancelOutcome] && <p className="mt-3 text-steel">{outcomeText[v.cancelOutcome]}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="btn btn-gold" onClick={() => void doCancel()} disabled={busy}>{busy ? <span className="bk-spin" aria-hidden="true" /> : null}Yes, cancel</button>
              <button type="button" className="btn btn-outline" onClick={() => setMode('view')}>Keep my booking</button>
            </div>
          </section>
        )}
      </div>

      <aside aria-labelledby="pol-h" className="card h-fit p-6">
        <h2 id="pol-h" className="eyebrow mb-4">Deposit and change policy</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-steel">{v.policy.map((l) => <li key={l}>{l}</li>)}</ul>
      </aside>
    </div>
  );
}
