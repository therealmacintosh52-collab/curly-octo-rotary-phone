'use client';
// Simple, honest consent banner. Shown only when a tracker is configured, nothing is stored yet, and after the
// page is idle (so it can never be the LCP element). "Essential only" is as prominent as "Accept all".
import { useEffect, useState, useSyncExternalStore } from 'react';
import { privacyUrl, trackingConfigured } from '@/lib/analytics/config';
import { CONSENT_OPEN_EVENT, SERVER_CONSENT, getConsent, isGpc, setConsent, subscribeConsent } from '@/lib/analytics-consent';

export function ConsentBanner() {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, () => SERVER_CONSENT);
  const [armed, setArmed] = useState(false);
  const [forced, setForced] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setArmed(true), 1500);
    const open = () => { setForced(true); setCustom(true); const c = getConsent(); setAnalytics(c.analytics); setMarketing(c.marketing); };
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => { window.clearTimeout(t); window.removeEventListener(CONSENT_OPEN_EVENT, open); };
  }, []);

  if (!trackingConfigured) return null;
  if (!forced && (consent.decided || !armed)) return null;

  const close = () => { setForced(false); setCustom(false); };
  const save = (a: boolean, m: boolean) => { setConsent({ analytics: a, marketing: m }); close(); };
  const gpc = isGpc();

  return (
    <section
      role="region"
      aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-[5.25rem] z-[60] mx-auto max-w-xl rounded-2xl border border-line bg-graphite p-5 shadow-2xl lg:bottom-5 lg:left-5 lg:right-auto lg:mx-0"
    >
      <p className="text-sm text-ivory">
        We use cookies to see which pages help people and which ads work. Nothing optional runs until you choose.
        {privacyUrl && <> <a href={privacyUrl} className="text-gold underline underline-offset-4">Privacy policy</a>.</>}
      </p>
      {custom && (
        <div className="mt-4 space-y-3 text-sm">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="mt-1 h-4 w-4 accent-[#C9A24A]" />
            <span><span className="font-semibold text-ivory">Analytics</span><span className="block text-steel">Anonymous page and click stats (Google Analytics).</span></span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={marketing && !gpc} disabled={gpc} onChange={(e) => setMarketing(e.target.checked)} className="mt-1 h-4 w-4 accent-[#C9A24A]" />
            <span><span className="font-semibold text-ivory">Advertising</span><span className="block text-steel">Measures our Google and Meta ads.{gpc && ' Off because your browser sends a Global Privacy Control signal.'}</span></span>
          </label>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {custom ? (
          <button type="button" className="btn btn-gold !min-h-11 !px-5 text-sm" onClick={() => save(analytics, marketing)}>Save choices</button>
        ) : (
          <>
            <button type="button" className="btn btn-gold !min-h-11 !px-5 text-sm" onClick={() => save(true, true)}>Accept all</button>
            <button type="button" className="btn btn-outline !min-h-11 !px-5 text-sm" onClick={() => save(false, false)}>Essential only</button>
            <button type="button" className="btn !min-h-11 !px-3 text-sm text-steel underline underline-offset-4 hover:text-gold-light" onClick={() => setCustom(true)}>Choose</button>
          </>
        )}
        {forced && <button type="button" className="btn !min-h-11 !px-3 text-sm text-steel hover:text-gold-light" onClick={close}>Close</button>}
      </div>
    </section>
  );
}

/** Footer link to reopen the banner. Renders nothing when no tracker is configured. */
export function CookieSettingsButton({ className }: { className?: string }) {
  if (!trackingConfigured) return null;
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}>
      Cookie settings
    </button>
  );
}
