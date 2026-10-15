// Analytics shim. Phase 6 wires GA4 / Meta Pixel / Google Ads behind this one function.
// Until then events go to window.dataLayer (harmless if nothing reads it) and the dev console.

export type AnalyticsEvent =
  | 'call_click'
  | 'text_click'
  | 'quote_requested'
  | 'booking_started'
  | 'booking_completed'
  | 'cta_click';

type Props = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window { dataLayer?: unknown[] }
}

export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (typeof window === 'undefined') return;
  const payload = { event, ...props, ts: Date.now() };
  (window.dataLayer ||= []).push(payload);
  if (process.env.NODE_ENV !== 'production') console.debug('[track]', payload);
}
