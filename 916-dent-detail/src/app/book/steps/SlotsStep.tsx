'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { NavButtons, Spinner, StepFrame } from '../ui';
import { stepValid } from '../state';
import type { StepProps } from './types';

type Day = { date: string; status: 'open' | 'full' | 'closed' | 'blackout' | 'weather_hold' | 'past'; slotCount: number; weatherReason?: string };
type ApiSlot = { startsAt: string; endsAt: string; date: string; label: string; techId: string };
type Resp = { timezone: string; durationMin: number; days: Day[]; slots: ApiSlot[] };

const parts = (iso: string) => { const [y, m, d] = iso.split('-').map(Number) as [number, number, number]; return new Date(y, m - 1, d); };
const dow = (iso: string) => parts(iso).toLocaleDateString('en-US', { weekday: 'short' });
const dayNum = (iso: string) => String(parts(iso).getDate());
const longDay = (iso: string) => parts(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const shortDay = (iso: string) => parts(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export function SlotsStep({ flow, dispatch, go, focusKey }: StepProps) {
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(flow.slot?.isoDate ?? null);
  const [nonce, setNonce] = useState(0);
  const panels = flow.quote && flow.quote.result.status === 'ok' ? flow.quote.result.panelCount : undefined;

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts a network request that reports its state
    setLoading(true); setErr(null);
    void api<Resp>('/api/availability', { body: { services: flow.services, addons: flow.addons, sizeClass: flow.sizeClass, zip: flow.zip, panels } }).then((r) => {
      if (!live) return;
      setLoading(false);
      if (!r.ok) return setErr(r.error.message);
      setData(r.data);
      const firstOpen = r.data.days.find((d) => d.slotCount > 0)?.date ?? null;
      setSel((cur) => (cur && r.data.days.some((d) => d.date === cur && d.slotCount > 0) ? cur : firstOpen));
    });
    return () => { live = false; };
  }, [flow.services, flow.addons, flow.sizeClass, flow.zip, panels, nonce]);

  const day = sel;
  const times = useMemo(() => (data?.slots ?? []).filter((s) => s.date === day), [data, day]);
  const weatherDays = (data?.days ?? []).filter((d) => d.status === 'weather_hold');
  const hours = data ? Math.round((data.durationMin / 60) * 10) / 10 : null;

  function pick(s: ApiSlot) {
    dispatch({ type: 'patch', patch: { slot: { startsAt: s.startsAt, endsAt: s.endsAt, date: shortDay(s.date), isoDate: s.date, label: s.label, techId: s.techId } } });
  }

  return (
    <StepFrame id="slot" title="Pick a time" lede={hours ? `Your visit takes about ${hours} hours. Times are Pacific and come from our live calendar.` : 'Times are Pacific and come from our live calendar.'} focusKey={focusKey}>
      {loading && <p className="text-steel"><Spinner label="Loading open times…" /></p>}
      {err && <div role="alert" className="card p-5"><p className="bk-err mt-0">{err}</p><button type="button" className="btn btn-outline mt-4" onClick={() => setNonce((n) => n + 1)}>Try again</button></div>}
      {data && !loading && (
        <>
          {data.days.every((d) => d.slotCount === 0) ? (
            <div className="card p-5"><p className="font-semibold text-ivory">No open times in the next few weeks for this job.</p><p className="mt-2 text-sm text-steel">Text or call us and we will find room.</p></div>
          ) : (
            <>
              <div role="group" aria-label="Choose a day" className="bk-dayrail">
                {data.days.filter((d) => d.status !== 'past').map((d) => (
                  <button key={d.date} type="button" className="bk-day" aria-pressed={sel === d.date} disabled={d.slotCount === 0} onClick={() => setSel(d.date)} aria-label={`${longDay(d.date)}${d.slotCount === 0 ? (d.status === 'weather_hold' ? ', weather hold' : ', no times') : `, ${d.slotCount} times`}`}>
                    <small>{dow(d.date)}</small><b>{dayNum(d.date)}</b>
                  </button>
                ))}
              </div>
              {weatherDays.length > 0 && <p className="bk-hint mt-2">Outdoor work is on weather hold {weatherDays.slice(0, 3).map((d) => shortDay(d.date)).join(', ')}{weatherDays.length > 3 ? '…' : ''}.</p>}
              {sel && (
                <div className="mt-6">
                  <h3 className="text-base text-ivory" id="times-h">{longDay(sel)}</h3>
                  <div role="group" aria-labelledby="times-h" className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {times.map((s) => (
                      <button key={s.startsAt} type="button" className="bk-chip" aria-pressed={flow.slot?.startsAt === s.startsAt} onClick={() => pick(s)} aria-label={`${s.label}, ${longDay(s.date)}`}>{s.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
      {flow.slot && <p role="status" className="mt-6 text-sm text-gold">Selected: {flow.slot.date} at {flow.slot.label}. We hold it for you at checkout.</p>}
      <NavButtons onBack={() => go(4)} onNext={() => go(6)} nextDisabled={!stepValid(flow, 5)} hint={!flow.slot && !loading ? 'Choose a time to continue.' : undefined} />
    </StepFrame>
  );
}
