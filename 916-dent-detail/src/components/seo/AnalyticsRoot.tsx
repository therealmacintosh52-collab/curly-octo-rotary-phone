'use client';
// Mounted once in the root layout. Loads GA4 / Google Ads / Meta Pixel ONLY for categories the visitor allowed
// (opt-in), captures first/last-touch attribution on every landing, tracks SPA page views and wires call/text
// links globally through one delegated click listener.
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { gadsId, ga4Id, metaPixelId } from '@/lib/analytics/config';
import { markSinkReady, track } from '@/lib/analytics';
import { SERVER_CONSENT, getConsent, subscribeConsent } from '@/lib/analytics-consent';
import { captureAttribution } from '@/lib/attribution';

const useConsent = () => useSyncExternalStore(subscribeConsent, getConsent, () => SERVER_CONSENT);

const gtagLoaderId = (analytics: boolean, marketing: boolean) => (analytics && ga4Id ? ga4Id : marketing && gadsId ? gadsId : '');

export function AnalyticsRoot() {
  const consent = useConsent();
  const pathname = usePathname();
  const first = useRef(true);

  // 1) attribution: every landing, regardless of consent (first-party CRM data, not an ad pixel)
  useEffect(() => { captureAttribution(); }, []);

  // 2) delegated tel:/sms: click tracking: any link, anywhere, including ones added later
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="tel:"], a[href^="sms:"]') as HTMLAnchorElement | null;
      if (!a) return;
      const where = a.dataset.trackWhere || a.closest('[data-track-where]')?.getAttribute('data-track-where') || 'link';
      track(a.getAttribute('href')!.startsWith('tel:') ? 'call_click' : 'text_click', { where });
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  // 3) SPA page views (the initial one is sent by the init scripts below)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (consent.analytics && ga4Id) window.gtag?.('event', 'page_view', { page_path: pathname, page_location: window.location.href });
    if (consent.marketing && metaPixelId) window.fbq?.('track', 'PageView');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // 4) consent changes after load: update Consent Mode / revoke Meta; config newly allowed IDs
  useEffect(() => {
    if (!window.gtag) return;
    window.gtag('consent', 'update', {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      ad_storage: consent.marketing ? 'granted' : 'denied',
      ad_user_data: consent.marketing ? 'granted' : 'denied',
      ad_personalization: consent.marketing ? 'granted' : 'denied',
    });
    if (consent.analytics && ga4Id) window.gtag('config', ga4Id, { send_page_view: false });
    if (consent.marketing && gadsId) window.gtag('config', gadsId);
    if (window.fbq) window.fbq('consent', consent.marketing ? 'grant' : 'revoke');
  }, [consent.analytics, consent.marketing]);

  const loaderId = gtagLoaderId(consent.analytics, consent.marketing);
  const wantMeta = Boolean(metaPixelId && consent.marketing);

  return (
    <>
      {loaderId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${loaderId}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive" onReady={() => markSinkReady('gtag')}>{`
            window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;
            gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
            gtag('consent','update',{analytics_storage:${consent.analytics ? "'granted'" : "'denied'"},ad_storage:${consent.marketing ? "'granted'" : "'denied'"},ad_user_data:${consent.marketing ? "'granted'" : "'denied'"},ad_personalization:${consent.marketing ? "'granted'" : "'denied'"}});
            gtag('js',new Date());
            ${consent.analytics && ga4Id ? `gtag('config','${ga4Id}',{send_page_view:true});` : ''}
            ${consent.marketing && gadsId ? `gtag('config','${gadsId}');` : ''}
          `}</Script>
        </>
      )}
      {wantMeta && (
        <Script id="meta-pixel" strategy="lazyOnload" onReady={() => markSinkReady('fbq')}>{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${metaPixelId}');fbq('track','PageView');
        `}</Script>
      )}
    </>
  );
}
