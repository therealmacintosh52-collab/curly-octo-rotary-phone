import { describe, expect, it } from 'vitest';
import { BOOKING_STATUSES, InvalidTransitionError, canTransition, isTerminal, transition } from '@/lib/booking/state';
import { decisionMessage, evaluateCancel, evaluateReschedule, policyLines, type PolicyBooking } from '@/lib/booking/policy';
import { signBookingToken, verifyBookingToken } from '@/lib/booking/tokens';
import { depositPolicy } from '@/config/booking';

const H = 3_600_000;
const NOW = Date.parse('2026-10-20T16:00:00Z');
const pb = (hoursAhead: number, over: Partial<PolicyBooking> = {}): PolicyBooking => ({ status: 'confirmed', startsAt: NOW + hoursAhead * H, depositPaid: true, rescheduleCount: 0, ...over });

describe('state machine', () => {
  it('happy path', () => {
    let s = transition('pending_deposit', 'deposit_paid');
    s = transition(s, 'tech_en_route'); s = transition(s, 'start'); s = transition(s, 'finish');
    expect(s).toBe('completed');
  });
  it('confirmed can start without en-route', () => expect(transition('confirmed', 'start')).toBe('in_progress'));
  it('hold expiry only from pending_deposit', () => {
    expect(transition('pending_deposit', 'hold_expired')).toBe('expired');
    expect(() => transition('confirmed', 'hold_expired')).toThrow(InvalidTransitionError);
  });
  it('terminal states accept nothing', () => {
    for (const s of ['completed', 'cancelled', 'no_show', 'expired'] as const) {
      expect(isTerminal(s)).toBe(true);
      expect(canTransition(s, 'cancel')).toBe(false);
    }
  });
  it('cannot cancel once in progress; cannot pay a cancelled booking', () => {
    expect(() => transition('in_progress', 'cancel')).toThrow();
    expect(() => transition('cancelled', 'deposit_paid')).toThrow();
  });
  it('cannot finish before starting', () => expect(() => transition('confirmed', 'finish')).toThrow());
  it('every status is covered', () => expect(BOOKING_STATUSES).toHaveLength(8));
});

describe('cancel policy (config-driven)', () => {
  it('48h+ ahead: refund', () => expect(evaluateCancel(pb(72), NOW)).toMatchObject({ allowed: true, depositOutcome: 'refund' }));
  it('exactly at the boundary is the generous side', () => expect(evaluateCancel(pb(48), NOW)).toMatchObject({ depositOutcome: 'refund' }));
  it('24-48h: credit', () => expect(evaluateCancel(pb(30), NOW)).toMatchObject({ depositOutcome: 'credit' }));
  it('under 24h: forfeit', () => expect(evaluateCancel(pb(5), NOW)).toMatchObject({ depositOutcome: 'forfeit', late: true }));
  it('unpaid hold: no deposit affected', () => expect(evaluateCancel(pb(1, { status: 'pending_deposit', depositPaid: false }), NOW)).toMatchObject({ allowed: true, depositOutcome: 'none' }));
  it('after start is refused', () => expect(evaluateCancel(pb(-1), NOW)).toMatchObject({ allowed: false, reason: 'already_started' }));
  it('terminal bookings are not cancellable', () => expect(evaluateCancel(pb(72, { status: 'cancelled' }), NOW)).toMatchObject({ allowed: false, reason: 'not_changeable' }));
  it('respects custom windows', () => {
    const p = { ...depositPolicy, cancel: [{ minHoursBefore: 12, outcome: 'refund' as const }, { minHoursBefore: 0, outcome: 'forfeit' as const }] };
    expect(evaluateCancel(pb(13), NOW, p)).toMatchObject({ depositOutcome: 'refund' });
    expect(evaluateCancel(pb(11), NOW, p)).toMatchObject({ depositOutcome: 'forfeit' });
  });
});

describe('reschedule policy', () => {
  it('free when far ahead', () => expect(evaluateReschedule(pb(48), NOW)).toMatchObject({ allowed: true, late: false }));
  it('late inside the free window but before cutoff is flagged', () => expect(evaluateReschedule(pb(10), NOW)).toMatchObject({ allowed: true, late: true }));
  it('closed inside cutoff', () => expect(evaluateReschedule(pb(2), NOW)).toMatchObject({ allowed: false, reason: 'closed_window' }));
  it('limit on reschedules', () => expect(evaluateReschedule(pb(48, { rescheduleCount: depositPolicy.maxReschedules }), NOW)).toMatchObject({ allowed: false, reason: 'too_many_reschedules' }));
  it('only confirmed bookings can move', () => expect(evaluateReschedule(pb(48, { status: 'pending_deposit' }), NOW)).toMatchObject({ allowed: false }));
  it('messages exist for refusals', () => {
    const d = evaluateReschedule(pb(2), NOW);
    expect(decisionMessage(d)).toMatch(/call or text/i);
    expect(decisionMessage(evaluateReschedule(pb(48), NOW))).toBe('');
  });
});

describe('policy text', () => {
  it('is generated from config numbers', () => {
    const t = policyLines().join(' ');
    expect(t).toContain('48 hours'); expect(t).toContain('24'); expect(t).toContain(String(depositPolicy.creditValidDays));
    expect(t).toMatch(/refunded in full/);
  });
});

describe('booking tokens', () => {
  it('round trips', () => {
    const t = signBookingToken('abc', NOW + H);
    expect(verifyBookingToken(t, NOW)).toMatchObject({ ok: true, bookingId: 'abc' });
  });
  it('rejects tampering, expiry and junk', () => {
    const t = signBookingToken('abc', NOW + H);
    const [p, s] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ b: 'other', e: Math.floor((NOW + H) / 1000) })).toString('base64url');
    expect(verifyBookingToken(`${forged}.${s}`, NOW)).toMatchObject({ ok: false, reason: 'bad_signature' });
    expect(verifyBookingToken(`${p}.${s}x`, NOW)).toMatchObject({ ok: false });
    expect(verifyBookingToken(t, NOW + 2 * H)).toMatchObject({ ok: false, reason: 'expired' });
    for (const junk of ['', 'a', 'a.b.c', '.', undefined as unknown as string]) expect(verifyBookingToken(junk, NOW).ok).toBe(false);
  });
});
