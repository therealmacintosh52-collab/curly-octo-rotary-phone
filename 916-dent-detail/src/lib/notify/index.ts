// Public notify API used by the booking service, the cron route and (Phase 3) the tech view.
import { travelMinutes } from '@/lib/geo';
import { log } from '@/lib/api/log';
import { transition } from '@/lib/booking/state';
import { repo, type QueueRow } from '@/lib/db';
import { dispatchDue } from './dispatch';
import { planBookingNotifications, planPostJob, type Planned } from './schedule';

export * from './schedule';
export { render } from './templates';
export { dispatchDue } from './dispatch';

export async function enqueuePlanned(bookingId: string, planned: Planned[], payload: QueueRow['payload'] = {}): Promise<number> {
  const db = repo();
  for (const p of planned) {
    await db.queue.enqueue({ booking_id: bookingId, kind: p.kind, run_at: new Date(p.runAt).toISOString(), status: 'pending', attempts: 0, dedupe_key: p.dedupeKey, payload });
  }
  return planned.length;
}

/** Schedule confirmation + 24h/2h reminders for a confirmed booking. Idempotent. */
export async function scheduleForBooking(bookingId: string, opts: { now?: number; rescheduled?: boolean } = {}): Promise<Planned[]> {
  const b = await repo().bookings.get(bookingId);
  if (!b) throw new Error('booking not found');
  const planned = planBookingNotifications({ id: b.id, startsAt: Date.parse(b.starts_at) }, opts.now ?? Date.now());
  await enqueuePlanned(b.id, planned, opts.rescheduled ? { rescheduled: true } : {});
  return planned;
}

/** Cancel not-yet-sent reminders (used on reschedule/cancel). */
export const cancelReminders = (bookingId: string) => repo().queue.cancelPending(bookingId, ['reminder_24h', 'reminder_2h', 'confirmation']);

/**
 * Called when a job is marked complete (Phase 3 tech view): schedules the invoice + Google review request
 * (2 h later) and the 6-month rebook nudge. Idempotent.
 */
export async function scheduleAfterCompletion(bookingId: string, completedAt = Date.now(), payload: QueueRow['payload'] = {}): Promise<Planned[]> {
  const planned = planPostJob({ id: bookingId, completedAt });
  await enqueuePlanned(bookingId, planned, payload);
  return planned;
}

/**
 * "On the way" with ETA. Callable from the tech view: marks the booking on_the_way and sends SMS+email now
 * (exempt from quiet hours). ETA comes from `etaMinutes` if given, else estimated from the tech's home ZIP.
 */
export async function sendOnTheWay(bookingId: string, opts: { etaMinutes?: number; fromZip?: string | null; now?: number } = {}): Promise<{ etaMinutes: number }> {
  const db = repo();
  const b = await db.bookings.get(bookingId);
  if (!b) throw new Error('booking not found');
  const tech = b.tech_id ? await db.techs.get(b.tech_id) : null;
  const etaMinutes = opts.etaMinutes ?? travelMinutes(opts.fromZip ?? tech?.home_zip, b.zip);
  if (b.status !== 'on_the_way') {
    await db.bookings.update(b.id, { status: transition(b.status, 'tech_en_route') }); // throws InvalidTransitionError if not allowed
  }
  const now = opts.now ?? Date.now();
  await enqueuePlanned(b.id, [{ kind: 'on_the_way', runAt: now, dedupeKey: `${b.id}:on_the_way:${new Date(b.starts_at).toISOString()}` }], { etaMinutes });
  await dispatchDue(now, 10);
  log('info', 'notify.on_the_way', { booking: b.id, etaMinutes });
  return { etaMinutes };
}
