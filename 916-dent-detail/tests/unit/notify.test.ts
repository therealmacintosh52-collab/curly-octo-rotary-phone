import { describe, expect, it } from 'vitest';
import { isQuietHour, nextSmsWindow, planBookingNotifications, planPostJob, QUIET_EXEMPT } from '@/lib/notify/schedule';
import { render, type TemplateCtx } from '@/lib/notify/templates';
import { localToUtc, utcToLocal } from '@/lib/availability/tz';
import { normalizePhone, isStopKeyword, isStartKeyword } from '@/lib/sms';

const H = 3_600_000;
const L = (date: string, h: number, m = 0) => localToUtc(date, h * 60 + m)!;

describe('planBookingNotifications', () => {
  it('books far ahead: confirmation now + 24h + 2h reminders at exact offsets', () => {
    const now = L('2026-10-15', 12); const start = L('2026-10-20', 9);
    const p = planBookingNotifications({ id: 'b1', startsAt: start }, now);
    expect(p.map((x) => x.kind)).toEqual(['confirmation', 'reminder_24h', 'reminder_2h']);
    expect(p[0]!.runAt).toBe(now);
    expect(p[1]!.runAt).toBe(start - 24 * H); expect(p[2]!.runAt).toBe(start - 2 * H);
  });
  it('skips reminders whose time has already passed', () => {
    const start = L('2026-10-20', 9);
    expect(planBookingNotifications({ id: 'b', startsAt: start }, start - 10 * H).map((x) => x.kind)).toEqual(['confirmation', 'reminder_2h']);
    expect(planBookingNotifications({ id: 'b', startsAt: start }, start - 1 * H).map((x) => x.kind)).toEqual(['confirmation']);
  });
  it('dedupe keys are stable (idempotent) and change when the time changes (reschedule)', () => {
    const now = L('2026-10-15', 12); const start = L('2026-10-20', 9);
    const a = planBookingNotifications({ id: 'b1', startsAt: start }, now); const b = planBookingNotifications({ id: 'b1', startsAt: start }, now + 1000);
    expect(a.map((x) => x.dedupeKey)).toEqual(b.map((x) => x.dedupeKey));
    const moved = planBookingNotifications({ id: 'b1', startsAt: start + 24 * H }, now);
    expect(moved.every((m) => !a.some((x) => x.dedupeKey === m.dedupeKey))).toBe(true);
    expect(new Set(a.map((x) => x.dedupeKey)).size).toBe(a.length);
  });
  it('24h reminder uses real elapsed time across the DST change', () => {
    const start = L('2026-11-01', 9); // 9:00 PST on the fall-back Sunday
    const p = planBookingNotifications({ id: 'b', startsAt: start }, L('2026-10-29', 12)).find((x) => x.kind === 'reminder_24h')!;
    expect(start - p.runAt).toBe(24 * H);
    // 24 real hours earlier is 10:00 PDT the day before (the local day is 25h long), not 9:00
    expect(utcToLocal(p.runAt)).toMatchObject({ date: '2026-10-31', minutes: 10 * 60 });
  });
});

describe('planPostJob', () => {
  it('review request 2h after completion; rebook 6 months later at 10:00 local', () => {
    const done = L('2026-10-15', 14);
    const [review, rebook] = planPostJob({ id: 'b1', completedAt: done });
    expect(review).toMatchObject({ kind: 'review_request', runAt: done + 2 * H });
    expect(rebook!.kind).toBe('rebook_6mo');
    expect(utcToLocal(rebook!.runAt)).toMatchObject({ date: '2027-04-15', minutes: 600 });
  });
  it('end-of-month completion clamps (Aug 31 -> Feb 28)', () => {
    expect(utcToLocal(planPostJob({ id: 'b', completedAt: L('2026-08-31', 12) })[1]!.runAt).date).toBe('2027-02-28');
  });
  it('is idempotent by key', () => {
    const a = planPostJob({ id: 'b', completedAt: 1 }); const b = planPostJob({ id: 'b', completedAt: 999 });
    expect(a.map((x) => x.dedupeKey)).toEqual(b.map((x) => x.dedupeKey));
  });
});

describe('quiet hours (9pm-8am local)', () => {
  it('boundaries', () => {
    expect(isQuietHour(L('2026-10-20', 20, 59))).toBe(false);
    expect(isQuietHour(L('2026-10-20', 21))).toBe(true);
    expect(isQuietHour(L('2026-10-20', 2))).toBe(true);
    expect(isQuietHour(L('2026-10-20', 7, 59))).toBe(true);
    expect(isQuietHour(L('2026-10-20', 8))).toBe(false);
  });
  it('defers to the next 8:00 local', () => {
    expect(utcToLocal(nextSmsWindow(L('2026-10-20', 22)))).toMatchObject({ date: '2026-10-21', minutes: 480 });
    expect(utcToLocal(nextSmsWindow(L('2026-10-20', 3)))).toMatchObject({ date: '2026-10-20', minutes: 480 });
    const noon = L('2026-10-20', 12); expect(nextSmsWindow(noon)).toBe(noon);
  });
  it('is DST-safe: evening before fall-back still lands on 8:00 local', () => {
    expect(utcToLocal(nextSmsWindow(L('2026-10-31', 23)))).toMatchObject({ date: '2026-11-01', minutes: 480 });
  });
  it('only confirmation, on-the-way and cancellation may text at night', () => {
    expect(QUIET_EXEMPT.sort()).toEqual(['cancellation', 'confirmation', 'on_the_way']);
  });
});

describe('templates', () => {
  const ctx: TemplateCtx = { firstName: 'Sam', services: 'Dent Removal', when: 'Tue, Oct 20 at 9:00 AM', city: 'Elk Grove', manageUrl: 'https://x.test/booking/t', bookUrl: 'https://x.test/book', reviewUrl: 'https://g.page/r/abc', invoiceUrl: 'https://x.test/inv/1', etaMinutes: 22 };
  it('SMS stay short, name the business, no stray prices', () => {
    for (const k of ['confirmation', 'reminder_24h', 'reminder_2h', 'on_the_way', 'review_request', 'rebook_6mo', 'cancellation'] as const) {
      const r = render(k, ctx);
      expect(r.sms.length, k).toBeLessThanOrEqual(320);
      expect(r.sms).toContain('916 Dent & Detail');
      expect(r.sms).not.toMatch(/\$\d/);
      expect(r.subject.length).toBeGreaterThan(3);
    }
  });
  it('confirmation carries STOP/HELP; ETA rounds to 5 minutes', () => {
    expect(render('confirmation', ctx).sms).toMatch(/STOP/);
    expect(render('on_the_way', ctx).sms).toContain('about 20 minutes');
    expect(render('on_the_way', { ...ctx, etaMinutes: null }).sms).toContain('shortly');
  });
  it('review request includes both invoice and review links; omits review when no link', () => {
    expect(render('review_request', ctx).sms).toMatch(/inv\/1.*g\.page/);
    expect(render('review_request', { ...ctx, reviewUrl: null }).sms).not.toMatch(/review/i);
  });
  it('reschedule variant', () => expect(render('confirmation', { ...ctx, rescheduled: true }).sms).toMatch(/rebooked/));
});

describe('phone + STOP handling', () => {
  it('normalizes US numbers, rejects bad ones', () => {
    expect(normalizePhone('(916) 555-0100')).toBe('+19165550100');
    expect(normalizePhone('1-916-555-0100')).toBe('+19165550100');
    expect(normalizePhone('+1 916 555 0100')).toBe('+19165550100');
    for (const bad of ['', '123', '(016) 555-0100', '916-155-0100', '99999999999', 'abc', null as unknown as string]) expect(normalizePhone(bad), String(bad)).toBeNull();
  });
  it('STOP / START keywords', () => {
    for (const w of ['STOP', 'stop', ' Stop. ', 'unsubscribe', 'CANCEL', 'end', 'quit', 'STOPALL']) expect(isStopKeyword(w), w).toBe(true);
    for (const w of ['please stop by tomorrow', 'stopping', 'go']) expect(isStopKeyword(w), w).toBe(false);
    expect(isStartKeyword('START')).toBe(true);
  });
});
