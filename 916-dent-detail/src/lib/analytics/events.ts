// Pure event vocabulary shared by the browser fan-out (lib/analytics.ts) and the server CAPI helper.
export type AnalyticsEvent =
  | 'call_click'
  | 'text_click'
  | 'quote_requested'
  | 'booking_started'
  | 'booking_completed'
  | 'cta_click';

export type EventProps = Record<string, string | number | boolean | undefined>;

/** Meta standard event for each of our events (null = not sent to Meta). Same mapping browser and server so event_id dedupes. */
export const metaEventName: Record<AnalyticsEvent, string | null> = {
  quote_requested: 'Lead',
  booking_started: 'InitiateCheckout',
  booking_completed: 'Schedule',
  call_click: 'Contact',
  text_click: 'Contact',
  cta_click: null,
};

export const newEventId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
