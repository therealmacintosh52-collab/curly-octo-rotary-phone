import { describe, expect, it } from 'vitest';
import { addDays, addMonthsLocalDate, localToUtc, tzOffsetMs, utcToLocal, weekdayOf } from '@/lib/availability/tz';

const H = 3_600_000;
describe('tz (America/Los_Angeles)', () => {
  it('PDT is UTC-7, PST is UTC-8', () => {
    expect(tzOffsetMs(Date.parse('2026-07-01T12:00:00Z'))).toBe(-7 * H);
    expect(tzOffsetMs(Date.parse('2026-12-01T12:00:00Z'))).toBe(-8 * H);
  });
  it('round trips ordinary times', () => {
    const t = localToUtc('2026-10-20', 9 * 60)!;
    expect(new Date(t).toISOString()).toBe('2026-10-20T16:00:00.000Z');
    expect(utcToLocal(t)).toMatchObject({ date: '2026-10-20', minutes: 540, weekday: 2 });
  });
  it('spring forward: 2026-03-08 02:30 does not exist', () => {
    expect(localToUtc('2026-03-08', 2 * 60 + 30)).toBeNull();
    expect(new Date(localToUtc('2026-03-08', 3 * 60)!).toISOString()).toBe('2026-03-08T10:00:00.000Z');
    expect(new Date(localToUtc('2026-03-08', 1 * 60)!).toISOString()).toBe('2026-03-08T09:00:00.000Z');
  });
  it('fall back: 2026-11-01 01:30 happens twice, earlier (PDT) wins', () => {
    expect(new Date(localToUtc('2026-11-01', 90)!).toISOString()).toBe('2026-11-01T08:30:00.000Z');
    expect(new Date(localToUtc('2026-11-01', 8 * 60)!).toISOString()).toBe('2026-11-01T16:00:00.000Z'); // PST after change
  });
  it('a local day is 25h on fall-back and 23h on spring-forward', () => {
    const len = (d: string) => (localToUtc(addDays(d, 1), 0)! - localToUtc(d, 0)!) / H;
    expect(len('2026-11-01')).toBe(25);
    expect(len('2027-03-14')).toBe(23);
    expect(len('2026-10-20')).toBe(24);
  });
  it('9:00 local stays 9:00 across the DST boundary even though UTC shifts', () => {
    const before = localToUtc('2026-10-31', 540)!; const after = localToUtc('2026-11-02', 540)!;
    expect(utcToLocal(before).minutes).toBe(540); expect(utcToLocal(after).minutes).toBe(540);
    expect((after - before) / H).toBe(49);
  });
  it('date arithmetic does not use 24h steps', () => {
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekdayOf('2026-11-01')).toBe(0);
  });
  it('late-evening UTC maps to previous local date', () => {
    expect(utcToLocal(Date.parse('2026-10-20T03:00:00Z')).date).toBe('2026-10-19');
  });
  it('addMonthsLocalDate clamps end-of-month', () => {
    expect(addMonthsLocalDate('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonthsLocalDate('2027-08-31', 6)).toBe('2028-02-29');
    expect(addMonthsLocalDate('2026-10-15', 6)).toBe('2027-04-15');
    expect(addMonthsLocalDate('2026-10-15', 3)).toBe('2027-01-15');
  });
});
