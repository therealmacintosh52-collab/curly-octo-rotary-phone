// Reschedule / cancel rules and deposit outcome. Pure, config-driven (config/booking.ts depositPolicy).
import { depositPolicy } from '@/config/booking';
import type { BookingStatus } from './state';

export type DepositOutcome = 'refund' | 'credit' | 'forfeit' | 'none';
export type ChangeDecision =
  | { allowed: true; depositOutcome: DepositOutcome; late: boolean; hoursBefore: number }
  | { allowed: false; reason: 'closed_window' | 'too_many_reschedules' | 'not_changeable' | 'already_started'; hoursBefore: number };

const HOUR = 3_600_000;

export interface PolicyBooking { status: BookingStatus; startsAt: number; depositPaid: boolean; rescheduleCount: number }

export function evaluateCancel(b: PolicyBooking, now: number, policy = depositPolicy): ChangeDecision {
  const hoursBefore = (b.startsAt - now) / HOUR;
  if (b.status !== 'confirmed' && b.status !== 'pending_deposit') return { allowed: false, reason: 'not_changeable', hoursBefore };
  if (hoursBefore <= 0) return { allowed: false, reason: 'already_started', hoursBefore };
  if (b.status === 'pending_deposit' || !b.depositPaid) return { allowed: true, depositOutcome: 'none', late: false, hoursBefore };
  const rule = [...policy.cancel].sort((a, c) => c.minHoursBefore - a.minHoursBefore).find((r) => hoursBefore >= r.minHoursBefore);
  return { allowed: true, depositOutcome: rule?.outcome ?? 'forfeit', late: rule?.outcome === 'forfeit', hoursBefore };
}

export function evaluateReschedule(b: PolicyBooking, now: number, policy = depositPolicy): ChangeDecision {
  const hoursBefore = (b.startsAt - now) / HOUR;
  if (b.status !== 'confirmed') return { allowed: false, reason: 'not_changeable', hoursBefore };
  if (hoursBefore <= 0) return { allowed: false, reason: 'already_started', hoursBefore };
  if (hoursBefore < policy.changeCutoffHours) return { allowed: false, reason: 'closed_window', hoursBefore };
  if (b.rescheduleCount >= policy.maxReschedules) return { allowed: false, reason: 'too_many_reschedules', hoursBefore };
  // The deposit always transfers to the new time; "late" only flags a change inside the free window.
  return { allowed: true, depositOutcome: 'none', late: hoursBefore < policy.rescheduleFreeHours, hoursBefore };
}

const OUTCOME_TEXT: Record<DepositOutcome, string> = {
  refund: 'your deposit is refunded in full',
  credit: `your deposit becomes a credit toward a future visit`,
  forfeit: 'the deposit is kept to cover the reserved time',
  none: 'no deposit is affected',
};

/** Human-readable policy shown on /book (step 7) and /booking/[token]. Generated from config so it cannot drift. */
export function policyLines(policy = depositPolicy): string[] {
  const rules = [...policy.cancel].sort((a, c) => c.minHoursBefore - a.minHoursBefore);
  const lines: string[] = [];
  rules.forEach((r, i) => {
    const prev = rules[i - 1];
    const when = i === 0 ? `Cancel ${r.minHoursBefore} hours or more before your appointment`
      : r.minHoursBefore > 0 ? `Cancel between ${r.minHoursBefore} and ${prev!.minHoursBefore} hours before` : `Cancel less than ${prev!.minHoursBefore} hours before`;
    lines.push(`${when}: ${OUTCOME_TEXT[r.outcome]}${r.outcome === 'credit' ? ` (valid ${policy.creditValidDays} days)` : ''}.`);
  });
  lines.push(`Reschedule free up to ${policy.rescheduleFreeHours} hours ahead (up to ${policy.maxReschedules} times). Your deposit moves with you.`);
  lines.push(`Within ${policy.changeCutoffHours} hours of your appointment, call or text us to change anything.`);
  return lines;
}

export function decisionMessage(d: ChangeDecision): string {
  if (d.allowed) return '';
  switch (d.reason) {
    case 'closed_window': return `This appointment is too close to change online. Please call or text us.`;
    case 'too_many_reschedules': return `This booking has reached the reschedule limit. Please call or text us.`;
    case 'already_started': return 'This appointment has already started.';
    default: return 'This booking can no longer be changed online.';
  }
}
