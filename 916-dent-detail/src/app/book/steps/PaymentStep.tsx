'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { depositPolicy } from '@/config/booking';
import { policyLines } from '@/lib/booking/policy';
import { formatRange } from '@/lib/pricing';
import { api } from '../api';
import { priceFor } from '../state';
import { NavButtons, Spinner, StepFrame } from '../ui';
import type { StepProps } from './types';

const LivePayment = dynamic(() => import('./LivePayment'), { ssr: false, loading: () => <p className="mt-6 text-steel">Loading secure payment form…</p> });

function useCountdown(iso: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    const tick = () => setLeft(Date.parse(iso) - Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [iso]);
  return left;
}

export function PaymentStep({ flow, dispatch, go, focusKey, onPaid }: StepProps & { onPaid: (token: string) => void }) {
  const b = flow.booking!;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const left = useCountdown(b.holdExpiresAt);
  const expired = left !== null && left <= 0;
  const price = priceFor(flow);
  const mm = left !== null && left > 0 ? `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}` : null;

  async function confirm(action: 'mock-pay' | 'confirm-payment') {
    setBusy(true); setErr(null);
    const r = await api(`/api/booking/${b.token}`, { body: { action } });
    setBusy(false);
    if (!r.ok) { setErr(r.error.message); return; }
    onPaid(b.token);
  }
  function newTime() { dispatch({ type: 'patch', patch: { booking: null, slot: null } }); go(5); }

  return (
    <StepFrame id="pay" title="Reserve your time" lede="A small deposit holds your slot. It is credited to your final bill." focusKey={focusKey}>
      <div className="card p-5">
        <p className="eyebrow mb-3">Deposit</p>
        <p className="font-display text-2xl text-ivory">{formatRange(b.amount, b.amount)}</p>
        <p className="mt-2 text-sm text-steel">{flow.slot?.date} at {flow.slot?.label}{flow.area?.city ? ` · ${flow.area.city}` : ''}</p>
        {price && price.ok && price.status === 'priced' && <p className="mt-2 text-sm text-steel">Estimated total {formatRange(price.totalLow!, price.totalHigh!)}. {price.label}</p>}
        {mm && <p role="timer" aria-live="off" className="mt-3 text-sm text-gold">Your time is held for {mm}</p>}
      </div>

      {expired ? (
        <div role="alert" className="card mt-6 p-5">
          <p className="font-semibold text-ivory">Your hold expired.</p>
          <p className="mt-2 text-sm text-steel">Slots are held for a few minutes while you pay. Pick a time again, it takes a moment.</p>
          <button type="button" className="btn btn-gold mt-4" onClick={newTime}>Pick a new time</button>
        </div>
      ) : b.mode === 'mock' ? (
        <div className="bk-demo mt-6">
          <p className="font-semibold text-ivory">DEMO MODE: no card is charged</p>
          <p className="mt-1 text-sm text-steel">Stripe keys are not configured, so this is a simulated payment. Add keys and a real secure card form appears here.</p>
          <button type="button" className="btn btn-gold mt-4 w-full sm:w-auto" onClick={() => void confirm('mock-pay')} disabled={busy}>{busy ? <Spinner label="Confirming…" /> : `Confirm demo deposit (${formatRange(b.amount, b.amount)})`}</button>
        </div>
      ) : (
        <LivePayment publishableKey={b.publishableKey ?? ''} clientSecret={b.clientSecret} returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/booking/${b.token}`} onPaid={() => confirm('confirm-payment')} label={`Pay ${formatRange(b.amount, b.amount)} deposit`} />
      )}
      {err && <p role="alert" className="bk-err mt-4">{err}</p>}

      <details className="mt-8 text-sm text-steel">
        <summary className="min-h-[44px] cursor-pointer py-2 font-semibold text-ivory">Cancellation and reschedule policy</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5">{policyLines(depositPolicy).map((l) => <li key={l}>{l}</li>)}</ul>
      </details>
      <NavButtons onBack={() => go(6)} />
    </StepFrame>
  );
}
