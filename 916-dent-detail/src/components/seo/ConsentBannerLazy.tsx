'use client';
// The banner is only ever shown after a 1.5 s delay and only when a tracker is configured, so its code is not part of the first-load
// bundle: it is fetched in an idle slot (or immediately when the footer's "Cookie settings" button asks for it).
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { trackingConfigured } from '@/lib/analytics/config';
import { CONSENT_OPEN_EVENT } from '@/lib/analytics-consent';

const Banner = lazy(() => import('./ConsentBanner').then((m) => ({ default: m.ConsentBanner })));

export function ConsentBannerLazy() {
  const [on, setOn] = useState(false);
  const replay = useRef(false);
  useEffect(() => {
    if (!trackingConfigured) return;
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const arm = () => setOn(true);
    const id = w.requestIdleCallback ? w.requestIdleCallback(arm, { timeout: 2500 }) : window.setTimeout(arm, 1200);
    // "Cookie settings" clicked before the banner chunk is in: mount it now and replay the event once it is listening
    const open = () => { if (!on) { replay.current = true; setOn(true); } };
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => { window.removeEventListener(CONSENT_OPEN_EVENT, open); if (w.cancelIdleCallback && w.requestIdleCallback) w.cancelIdleCallback(id); else window.clearTimeout(id); };
  }, [on]);
  useEffect(() => {
    if (!on || !replay.current) return;
    replay.current = false;
    const t = window.setTimeout(() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT)), 0);
    return () => window.clearTimeout(t);
  }, [on]);
  if (!trackingConfigured || !on) return null;
  return <Suspense fallback={null}><Banner /></Suspense>;
}
