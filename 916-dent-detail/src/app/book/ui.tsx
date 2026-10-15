'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { ESTIMATE_LABEL, PRICES_ARE_PLACEHOLDERS } from '@/config/pricing';
import { serviceById, sizeClasses } from '@/config/booking';
import { formatRange } from '@/lib/pricing';
import { priceFor, STEPS, type Flow } from './state';

export function Check() {
  return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7.5l3 3 6-7" /></svg>;
}

export function Spinner({ label }: { label: string }) {
  return <span role="status" className="inline-flex items-center gap-2"><span className="bk-spin" aria-hidden="true" /><span>{label}</span></span>;
}

/** Heading that receives focus when its step opens so screen-reader and keyboard users land at the top of the new step. */
export function StepFrame({ id, title, lede, children, focusKey }: { id: string; title: string; lede?: string; children: ReactNode; focusKey: number }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; } // do not steal focus on first paint
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [focusKey]);
  return (
    <section aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <h2 id={`${id}-h`} ref={ref} tabIndex={-1} className="h2 outline-none">{title}</h2>
      {lede && <p className="lede mt-3">{lede}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="bk-label">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="bk-hint">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="bk-err">{error}</p>}
    </div>
  );
}

export function Stepper({ step, max, onGo, confirmed }: { step: number; max: number; onGo: (n: number) => void; confirmed: boolean }) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const ol = listRef.current;
    const cur = ol?.querySelector<HTMLElement>('[aria-current="step"]');
    if (ol && cur) ol.scrollLeft = cur.offsetLeft - (ol.clientWidth - cur.offsetWidth) / 2; // horizontal only: never scrolls the page
  }, [step]);
  const pct = ((step - 1) / (STEPS.length - 1)) * 100;
  return (
    <nav aria-label="Booking progress">
      <p className="mb-3 flex items-baseline justify-between text-sm text-steel">
        <span><span className="text-ivory">Step {step}</span> of {STEPS.length}</span>
        <span className="font-display text-[0.7rem] uppercase tracking-[0.2em] text-gold">{STEPS[step - 1]!.title}</span>
      </p>
      <div className="bk-progress" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      <ol ref={listRef} className="bk-steps mt-4" tabIndex={0} aria-label="Steps">
        {STEPS.map((s) => {
          const isCur = s.id === step;
          const reachable = !confirmed && s.id <= max && s.id < 8 && s.id !== step;
          return (
            <li key={s.id} className="bk-step">
              {reachable ? (
                <button type="button" className={s.id < step ? 'done' : ''} onClick={() => onGo(s.id)} aria-label={`Go to step ${s.id}: ${s.title}`}>
                  <span aria-hidden="true">{s.id}</span><span className="hidden sm:inline">{s.title}</span>
                </button>
              ) : (
                <span className="bk-pill" aria-current={isCur ? 'step' : undefined}>
                  <span aria-hidden="true">{s.id}</span><span className={isCur ? '' : 'hidden sm:inline'}>{s.title}</span>
                  <span className="sr-only">{isCur ? ' (current step)' : ' (not available yet)'}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Live summary: services, vehicle, estimate with the mandatory label. Desktop = sticky card, mobile = disclosure. */
export function Summary({ flow }: { flow: Flow }) {
  const price = priceFor(flow);
  const veh = [flow.year, flow.make, flow.model].filter(Boolean).join(' ');
  const size = sizeClasses.find((s) => s.id === flow.sizeClass)?.label;
  const body = (
    <div className="space-y-4 text-sm">
      {flow.services.length === 0 ? <p className="text-steel">Nothing selected yet.</p> : (
        <ul className="space-y-1">
          {flow.services.map((id) => <li key={id} className="flex justify-between gap-3"><span>{serviceById(id)?.plain}</span></li>)}
        </ul>
      )}
      {veh && <p className="text-steel">{veh}{size ? ` · ${size}` : ''}</p>}
      {flow.slot && <p className="text-ivory">{flow.slot.date} · {flow.slot.label}</p>}
      {price && price.ok && (
        <div className="border-t border-line pt-4">
          {price.status === 'priced' && price.low !== null && price.high !== null ? (
            <>
              <p className="text-steel">Estimated total{price.travelFee ? ' (with travel)' : ''}</p>
              <p className="mt-1 font-display text-xl text-ivory">{formatRange(price.totalLow!, price.totalHigh!)}</p>
            </>
          ) : <p className="text-steel">Dent price comes from your photos. We never quote a fixed dent price without them.</p>}
          <p className="mt-2 text-steel">{ESTIMATE_LABEL}</p>
          <p className="mt-2 text-steel">Deposit to reserve: <span className="text-ivory">{formatRange(price.deposit, price.deposit)}</span>, credited to your final bill.</p>
        </div>
      )}
      {PRICES_ARE_PLACEHOLDERS && <p><span className="owner-mark">[OWNER] demo pricing, real prices not set yet</span></p>}
    </div>
  );
  return (
    <>
      <details className="card p-4 lg:hidden">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between font-semibold">
          <span>Your booking</span>
          <span className="text-sm text-gold">{price && price.ok && price.status === 'priced' && price.totalLow !== null ? formatRange(price.totalLow, price.totalHigh!) : 'Details'}</span>
        </summary>
        <div className="mt-4">{body}</div>
      </details>
      <aside aria-label="Your booking summary" className="card sticky top-28 hidden p-6 lg:block">
        <p className="eyebrow mb-4">Your booking</p>
        {body}
      </aside>
    </>
  );
}

export function NavButtons({ onBack, onNext, nextLabel = 'Continue', nextDisabled, busy, hideBack, hint }: {
  onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; busy?: boolean; hideBack?: boolean; hint?: string;
}) {
  return (
    <div className="mt-10">
      {hint && <p role="status" className="mb-3 text-sm text-steel">{hint}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {!hideBack && onBack && <button type="button" className="btn btn-outline" onClick={onBack}>Back</button>}
        {onNext && (
          <button type="button" className="btn btn-gold disabled:cursor-not-allowed disabled:opacity-45" onClick={onNext} disabled={nextDisabled || busy} aria-disabled={nextDisabled || busy}>
            {busy ? <span className="bk-spin" aria-hidden="true" /> : null}{nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
