// Pure scheduling: given a booking's times, compute what to send and when. Idempotent: every item has a stable
// dedupe key, so re-running (retries, webhook replays) never creates duplicates.
import { notifyConfig, TIMEZONE } from '@/config/booking';
import { addDays as addDaysStr, addMonthsLocalDate, localToUtc, utcToLocal } from '@/lib/availability/tz';
import type { NotificationKind } from '@/lib/db/types';

export type Planned = { kind: NotificationKind; runAt: number; dedupeKey: string };
const HOUR = 3_600_000;

/** Kinds that may be texted during quiet hours (the customer is waiting for them). */
export const QUIET_EXEMPT: NotificationKind[] = ['confirmation', 'on_the_way', 'cancellation'];

/** When to send a reminder for a booking starting at `startsAt`; null if that moment has already passed. */
export function planBookingNotifications(b: { id: string; startsAt: number }, now: number): Planned[] {
  const startKey = new Date(b.startsAt).toISOString();
  const out: Planned[] = [{ kind: 'confirmation', runAt: now, dedupeKey: `${b.id}:confirmation:${startKey}` }];
  for (const h of notifyConfig.reminderHours) {
    const runAt = b.startsAt - h * HOUR;
    if (runAt > now) out.push({ kind: `reminder_${h}h` as NotificationKind, runAt, dedupeKey: `${b.id}:reminder_${h}h:${startKey}` });
  }
  return out;
}

/** After the job is marked complete: invoice + review request after the configured delay, rebook nudge in 6 months. */
export function planPostJob(b: { id: string; completedAt: number }): Planned[] {
  const local = utcToLocal(b.completedAt, TIMEZONE).date;
  const rebookDate = addMonthsLocalDate(local, notifyConfig.rebookMonths);
  const rebookAt = localToUtc(rebookDate, notifyConfig.rebookSendHourLocal * 60, TIMEZONE) ?? localToUtc(rebookDate, notifyConfig.rebookSendHourLocal * 60 + 60, TIMEZONE)!;
  return [
    { kind: 'review_request', runAt: b.completedAt + notifyConfig.reviewDelayHours * HOUR, dedupeKey: `${b.id}:review_request` },
    { kind: 'rebook_6mo', runAt: rebookAt, dedupeKey: `${b.id}:rebook_6mo` },
  ];
}

export function isQuietHour(ms: number, quiet = notifyConfig.quiet, tz = TIMEZONE): boolean {
  const h = utcToLocal(ms, tz).hour;
  return quiet.startHour > quiet.endHour ? h >= quiet.startHour || h < quiet.endHour : h >= quiet.startHour && h < quiet.endHour;
}

/** Earliest instant >= ms at which an SMS may go out (the next quiet-hours end, local time). */
export function nextSmsWindow(ms: number, quiet = notifyConfig.quiet, tz = TIMEZONE): number {
  if (!isQuietHour(ms, quiet, tz)) return ms;
  const l = utcToLocal(ms, tz);
  const date = l.hour >= quiet.startHour ? addDaysStr(l.date, 1) : l.date;
  return localToUtc(date, quiet.endHour * 60, tz) ?? localToUtc(date, quiet.endHour * 60 + 60, tz)!;
}
