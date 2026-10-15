// Queue worker: claims due rows, decides channel(s) per customer consent, respects quiet hours, retries, logs.
import { notifyConfig, serviceById } from '@/config/booking';
import { site } from '@/config/site';
import { depositAmount } from '@/config/pricing';
import { formatLocal } from '@/lib/availability/tz';
import { log } from '@/lib/api/log';
import { signBookingToken } from '@/lib/booking/tokens';
import { repo, type BookingRow, type Customer, type QueueRow } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { sendSms } from '@/lib/sms';
import { QUIET_EXEMPT, isQuietHour, nextSmsWindow } from './schedule';
import { render, type TemplateCtx } from './templates';

const HOUR = 3_600_000;

export function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
}

export function buildCtx(b: BookingRow, c: Customer, payload: QueueRow['payload'] = {}): TemplateCtx {
  const start = Date.parse(b.starts_at);
  const token = signBookingToken(b.id, Math.max(start, Date.now()) + 7 * 24 * HOUR);
  return {
    firstName: c.name.split(' ')[0] || 'there',
    services: b.services.map((s) => serviceById(s)?.plain ?? s).join(' + '),
    when: `${formatLocal(start, { weekday: 'short', month: 'short', day: 'numeric' })} at ${formatLocal(start, { hour: 'numeric', minute: '2-digit' })}`,
    city: b.city,
    manageUrl: `${baseUrl()}/booking/${token}`,
    bookUrl: `${baseUrl()}/book`,
    reviewUrl: site.googleReviewUrl || null,
    invoiceUrl: (payload.invoiceUrl as string | undefined) ?? null,
    etaMinutes: (payload.etaMinutes as number | undefined) ?? null,
    rescheduled: Boolean(payload.rescheduled),
    deposit: `$${depositAmount}`,
    depositOutcome: payload.depositOutcome as TemplateCtx['depositOutcome'],
  };
}

type Outcome = 'sent' | 'skipped' | 'deferred' | 'retry' | 'failed';

/** Should this booking still receive this kind? Stale queue rows (cancelled, rescheduled) are skipped. */
export function stillRelevant(kind: QueueRow['kind'], b: BookingRow, now: number): boolean {
  switch (kind) {
    case 'confirmation': return b.status === 'confirmed' || b.status === 'on_the_way';
    case 'reminder_24h':
    case 'reminder_2h': return b.status === 'confirmed' && Date.parse(b.starts_at) > now;
    case 'on_the_way': return b.status === 'on_the_way';
    case 'review_request':
    case 'rebook_6mo': return b.status === 'completed';
    case 'cancellation': return b.status === 'cancelled';
  }
}

async function processOne(row: QueueRow, now: number): Promise<Outcome> {
  const db = repo();
  const booking = row.booking_id ? await db.bookings.get(row.booking_id) : null;
  const customer = booking?.customer_id ? await db.customers.get(booking.customer_id) : null;
  if (!booking || !customer || !stillRelevant(row.kind, booking, now)) {
    await db.notification_queue.update(row.id, { status: 'skipped', last_error: 'not_relevant' });
    return 'skipped';
  }

  const ctx = buildCtx(booking, customer, row.payload);
  const msg = render(row.kind, ctx);
  const payload = { ...row.payload } as Record<string, unknown>;
  let failed = false;
  let deferredTo: number | null = null;

  // Email: transactional, always allowed when we have an address. Sent at most once per row.
  if (customer.email && !payload.emailSent) {
    const r = await sendEmail({ to: customer.email, subject: msg.subject, text: msg.text });
    if (r.ok) payload.emailSent = true; else failed = true;
  }

  // SMS: needs explicit opt-in, no STOP on file, and quiet hours unless the message is time-critical.
  const canText = Boolean(customer.phone && customer.sms_opt_in && !customer.sms_opt_out_at);
  if (canText && !payload.smsSent) {
    if (!QUIET_EXEMPT.includes(row.kind) && isQuietHour(now)) {
      const at = nextSmsWindow(now);
      const isReminder = row.kind === 'reminder_24h' || row.kind === 'reminder_2h';
      // A reminder that would only be allowed at/after the appointment is pointless: email already went.
      if (isReminder && at > Date.parse(booking.starts_at) - 30 * 60_000) payload.smsSent = 'skipped_quiet';
      else deferredTo = at;
    } else {
      const r = await sendSms(customer.phone!, msg.sms);
      if (r.ok) payload.smsSent = true; else failed = true;
    }
  }

  if (deferredTo !== null) {
    await db.notification_queue.update(row.id, { status: 'pending', run_at: new Date(deferredTo).toISOString(), attempts: Math.max(0, row.attempts - 1), payload });
    return 'deferred';
  }
  if (failed) {
    const give = row.attempts >= notifyConfig.maxAttempts;
    await db.notification_queue.update(row.id, give
      ? { status: 'failed', last_error: 'send_failed', payload }
      : { status: 'pending', run_at: new Date(now + notifyConfig.retryDelayMin * 60_000 * row.attempts).toISOString(), last_error: 'send_failed', payload });
    return give ? 'failed' : 'retry';
  }
  await db.notification_queue.update(row.id, { status: 'sent', sent_at: new Date(now).toISOString(), payload });
  await db.events.insert({ type: 'notify.sent', entity_type: 'booking', entity_id: booking.id, actor: 'system', data: { kind: row.kind, email: Boolean(payload.emailSent), sms: payload.smsSent === true } });
  return 'sent';
}

export type DispatchSummary = { claimed: number; sent: number; skipped: number; deferred: number; retry: number; failed: number; expiredHolds: number };

/** Run the queue once. Safe to call concurrently and repeatedly (rows are claimed atomically). */
export async function dispatchDue(now = Date.now(), limit = 50): Promise<DispatchSummary> {
  const db = repo();
  const sum: DispatchSummary = { claimed: 0, sent: 0, skipped: 0, deferred: 0, retry: 0, failed: 0, expiredHolds: 0 };
  // 1) lapse unpaid slot holds so the calendar frees up
  const holds = await db.bookings.list({ where: { status: 'pending_deposit' }, ranges: [{ col: 'hold_expires_at', lte: new Date(now).toISOString() }] });
  for (const h of holds) { await db.bookings.update(h.id, { status: 'expired' }); sum.expiredHolds++; }
  // 2) send what is due
  const rows = await db.queue.claimDue(new Date(now).toISOString(), limit);
  sum.claimed = rows.length;
  for (const r of rows) {
    try { sum[await processOne(r, now)]++; }
    catch (e) {
      log('error', 'notify.process_failed', { kind: r.kind, id: r.id, error: (e as Error).name });
      await db.notification_queue.update(r.id, { status: r.attempts >= notifyConfig.maxAttempts ? 'failed' : 'pending', last_error: 'exception' });
      sum.failed++;
    }
  }
  log('info', 'notify.dispatch', { ...sum });
  return sum;
}

