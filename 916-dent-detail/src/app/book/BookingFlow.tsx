'use client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { captureAttribution } from '@/lib/attribution';
import './book.css';
import { clearDraft, initialFlow, loadDraft, maxReachable, reducer, saveDraft, STEPS, type Flow } from './state';
import { AreaStep } from './steps/AreaStep';
import { ConfirmStep } from './steps/ConfirmStep';
import { ContactStep } from './steps/ContactStep';
import { PaymentStep } from './steps/PaymentStep';
import { PhotosStep } from './steps/PhotosStep';
import { ServiceStep } from './steps/ServiceStep';
import { SlotsStep } from './steps/SlotsStep';
import { VehicleStep } from './steps/VehicleStep';
import { Stepper, Summary } from './ui';

export function BookingFlow() {
  const [flow, dispatch] = useReducer(reducer, undefined, initialFlow);
  const [ready, setReady] = useState(false);
  const [focusKey, setFocusKey] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [doneToken, setDoneToken] = useState<string | null>(null);
  const started = useRef(false);
  const flowRef = useRef<Flow>(flow);
  useEffect(() => { flowRef.current = flow; }, [flow]);

  // restore the draft (client only) and capture attribution once
  useEffect(() => {
    const d = loadDraft();
    if (d) dispatch({ type: 'hydrate', flow: { ...d, step: Math.min(d.step, maxReachable(d)) } });
    captureAttribution();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage can only be read after mount; this gates first render of the restored step
    setReady(true);
    history.replaceState({ step: d ? Math.min(d.step, maxReachable(d)) : 1 }, '');
  }, []);

  // Persist the draft off the interaction path: saveDraft serialises the whole flow (photo thumbnails included) and writes localStorage,
  // which is noticeable on a throttled phone. Debounced, and flushed when the page is hidden or closed so nothing typed is lost.
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => saveDraft(flow), 350);
    return () => clearTimeout(t);
  }, [flow, ready]);
  useEffect(() => {
    if (!ready) return;
    const flush = () => { if (document.visibilityState === 'hidden') saveDraft(flowRef.current); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush); };
  }, [ready]);

  useEffect(() => {
    if (!started.current && flow.services.length > 0) {
      started.current = true;
      track('booking_started', { where: 'book_flow', step: 'services' });
    }
  }, [flow.services.length]);

  const go = useCallback((n: number) => {
    const f = flowRef.current;
    const target = Math.max(1, Math.min(n, f.confirmed ? 8 : 7));
    if (!f.confirmed && target > maxReachable(f) && target !== 7) return;
    dispatch({ type: 'patch', patch: { step: target } });
    setFocusKey((k) => k + 1);
    setAnnounce(`Step ${target} of ${STEPS.length}: ${STEPS[target - 1]!.heading}`);
    try { history.pushState({ step: target }, '', `#step-${target}`); } catch { /* ignore */ }
  }, []);

  // browser back / forward moves between steps without losing state
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const f = flowRef.current;
      // Only OUR history entries (pushState({ step })) are step changes. A fragment navigation (the skip link, any #anchor) also fires popstate
      // with state === null; treating that as "go to step 1" threw the visitor back to the first step and stole focus (found by the P8 keyboard test).
      const st = e.state as { step?: number } | null;
      if (typeof st?.step !== 'number') return;
      const n = st.step;
      if (f.confirmed) return;
      const target = Math.max(1, Math.min(n, maxReachable(f), 7));
      dispatch({ type: 'patch', patch: { step: target } });
      setFocusKey((k) => k + 1);
      setAnnounce(`Step ${target} of ${STEPS.length}: ${STEPS[target - 1]!.heading}`);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const onPaid = useCallback((token: string) => {
    setDoneToken(token);
    dispatch({ type: 'patch', patch: { confirmed: true, step: 8 } });
    setFocusKey((k) => k + 1);
    setAnnounce('Booking confirmed.');
    clearDraft();
    try { history.pushState({ step: 8 }, '', '#step-8'); } catch { /* ignore */ }
  }, []);

  const another = useCallback(() => {
    clearDraft();
    setDoneToken(null);
    dispatch({ type: 'reset' });
    started.current = false;
    setFocusKey((k) => k + 1);
    try { history.pushState({ step: 1 }, '', '#step-1'); } catch { /* ignore */ }
  }, []);

  const props = { flow, dispatch, go, focusKey };
  const step = flow.step;
  const max = maxReachable(flow);

  return (
    <div id="photo" className="bk-scope wrap scroll-mt-28 pb-40 lg:pb-28">
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      <Stepper step={step} max={max} onGo={go} confirmed={flow.confirmed} />
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 lg:order-1">
          {/* Step 1 is server-rendered (initialFlow is deterministic) instead of a "Loading…" line that was replaced after hydration: that swap pushed the
              content below the form down (CLS 0.097, right at the 0.1 limit). A returning visitor's saved draft is applied right after hydration. */}
          {(
            <>
              {step === 1 && <ServiceStep {...props} />}
              {step === 2 && <VehicleStep {...props} />}
              {step === 3 && <PhotosStep {...props} />}
              {step === 4 && <AreaStep {...props} />}
              {step === 5 && <SlotsStep {...props} />}
              {step === 6 && <ContactStep {...props} />}
              {step === 7 && flow.booking && <PaymentStep {...props} onPaid={onPaid} />}
              {step === 7 && !flow.booking && <p className="text-steel">Your reservation was not found. <button type="button" className="text-gold underline" onClick={() => go(6)}>Go back</button> to reserve your time.</p>}
              {step === 8 && doneToken && <ConfirmStep {...props} token={doneToken} onAnother={another} />}
              {step === 8 && !doneToken && <p className="text-steel">This booking is complete. Use the link in your confirmation to make changes.</p>}
            </>
          )}
        </div>
        <div className="order-first lg:order-2"><Summary flow={flow} /></div>
      </div>
    </div>
  );
}
