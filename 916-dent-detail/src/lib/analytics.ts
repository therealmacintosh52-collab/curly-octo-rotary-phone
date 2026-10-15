// track(event, props): ONE call site fans out to GA4 (gtag), Meta Pixel, Google Ads conversions and Vercel Analytics.
//  - env-gated: a sink with no ID configured is a no-op
//  - consent-gated: GA4 + Vercel custom events need `analytics`; Meta + Google Ads need `marketing`
//  - safe before scripts load: events wait in a per-sink queue and flush when the sink reports ready
//  - returns the event_id used for the browser event, so a server call (lib/analytics/capi.ts) can reuse it and Meta dedupes
// Existing callers keep working unchanged: track('call_click', { where }).
import { track as vercelTrack } from '@vercel/analytics';
import { gadsId, gadsLabels, ga4Id, metaPixelId } from '@/lib/analytics/config';
import { metaEventName, newEventId, type AnalyticsEvent, type EventProps } from '@/lib/analytics/events';
import { getConsent } from '@/lib/analytics-consent';

export type { AnalyticsEvent, EventProps } from '@/lib/analytics/events';
export { newEventId } from '@/lib/analytics/events';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[] };
  }
}

type Sink = 'gtag' | 'fbq';
type Item = { event: AnalyticsEvent; props: EventProps; id: string };
const ready: Record<Sink, boolean> = { gtag: false, fbq: false };
const queue: Record<Sink, Item[]> = { gtag: [], fbq: [] };

const clean = (p: EventProps) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as Record<string, string | number | boolean>;

function sendGtag({ event, props, id }: Item) {
  const c = getConsent();
  const gtag = window.gtag;
  if (!gtag) return;
  const params = clean({ ...props, event_id: id, transport_type: 'beacon' });
  if (ga4Id && c.analytics) gtag('event', event, params);
  if (gadsId && c.marketing) {
    const label = event === 'quote_requested' ? gadsLabels.quote : event === 'booking_completed' ? gadsLabels.booking : event === 'call_click' ? gadsLabels.call : '';
    if (label) {
      const conv: Record<string, string | number> = { send_to: `${gadsId}/${label}`, transaction_id: id };
      if (typeof props.value === 'number') { conv.value = props.value; conv.currency = typeof props.currency === 'string' ? props.currency : 'USD'; }
      gtag('event', 'conversion', conv);
    }
  }
}

function sendFbq({ event, props, id }: Item) {
  const c = getConsent();
  const name = metaEventName[event];
  if (!window.fbq || !c.marketing || !name) return;
  const { value, currency, ...rest } = props;
  const custom = clean({ ...rest, ...(typeof value === 'number' ? { value, currency: typeof currency === 'string' ? currency : 'USD' } : {}) });
  window.fbq('track', name, custom, { eventID: id }); // same id goes to CAPI => deduplicated
}

function dispatch(sink: Sink, item: Item) {
  if (!ready[sink]) { queue[sink].push(item); if (queue[sink].length > 50) queue[sink].shift(); return; }
  (sink === 'gtag' ? sendGtag : sendFbq)(item);
}

/** Called by the script loader once gtag/fbq exist (after their init commands). Flushes queued events. */
export function markSinkReady(sink: Sink): void {
  ready[sink] = true;
  const items = queue[sink].splice(0);
  for (const it of items) (sink === 'gtag' ? sendGtag : sendFbq)(it);
}

export function track(event: AnalyticsEvent, props: EventProps = {}): string {
  const id = typeof props.event_id === 'string' ? props.event_id : newEventId();
  if (typeof window === 'undefined') return id;
  const rest: EventProps = { ...props };
  delete rest.event_id;
  const item: Item = { event, props: rest, id };
  const payload = { event, ...clean(rest), event_id: id, ts: Date.now() };
  (window.dataLayer ||= []).push(payload); // passive, no PII; GTM-compatible
  const c = getConsent();
  if ((ga4Id && c.analytics) || (gadsId && c.marketing)) dispatch('gtag', item);
  if (metaPixelId && c.marketing) dispatch('fbq', item);
  if (c.analytics) { try { vercelTrack(event, clean(rest)); } catch { /* not on Vercel: ignore */ } }
  if (process.env.NODE_ENV !== 'production') console.debug('[track]', payload);
  return id;
}
