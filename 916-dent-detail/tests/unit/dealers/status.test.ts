import { describe, expect, it } from 'vitest';
import { assertTransition, BOARD_COLUMNS, canTransition, jobStageFor, nextStatuses, StatusError, STATUS_LABEL } from '@/lib/dealers/status';

describe('vehicle status transitions', () => {
  it('follows the spec chain: submitted -> scheduled -> in_progress -> done -> invoiced', () => {
    expect(canTransition('submitted', 'scheduled')).toBe(true);
    expect(canTransition('scheduled', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'done')).toBe(true);
    expect(canTransition('done', 'invoiced')).toBe(true);
  });
  it('blocks skipping steps and going backwards past the allowed edges', () => {
    expect(canTransition('submitted', 'in_progress')).toBe(false);
    expect(canTransition('submitted', 'done')).toBe(false);
    expect(canTransition('scheduled', 'done')).toBe(false);
    expect(canTransition('invoiced', 'done')).toBe(false);
    expect(nextStatuses('invoiced')).toEqual([]);
    expect(() => assertTransition('submitted', 'done')).toThrow(StatusError);
  });
  it('allows cancel before work starts, not after', () => {
    expect(canTransition('submitted', 'cancelled')).toBe(true);
    expect(canTransition('scheduled', 'cancelled')).toBe(true);
    expect(canTransition('in_progress', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'submitted')).toBe(true);
  });
  it('rework (done -> in_progress) is blocked once billed', () => {
    expect(() => assertTransition('done', 'in_progress')).not.toThrow();
    expect(() => assertTransition('done', 'in_progress', { billed: true })).toThrow(/statement/);
  });
  it('legacy 0001 statuses flow into the new chain', () => {
    expect(canTransition('quoted', 'scheduled')).toBe(true);
    expect(canTransition('approved', 'scheduled')).toBe(true);
  });
  it('maps to job stages and dealer-facing labels', () => {
    expect(jobStageFor('submitted')).toBe('new');
    expect(jobStageFor('scheduled')).toBe('booked');
    expect(jobStageFor('in_progress')).toBe('in_progress');
    expect(jobStageFor('done')).toBe('done');
    expect(jobStageFor('invoiced')).toBe('done');
    expect(STATUS_LABEL.done).toBe('Frontline-ready');
  });
  it('every status appears in exactly one board column (except cancelled)', () => {
    const all = BOARD_COLUMNS.flatMap((c) => c.statuses);
    expect(new Set(all).size).toBe(all.length);
    for (const s of Object.keys(STATUS_LABEL)) if (s !== 'cancelled') expect(all).toContain(s);
  });
});
