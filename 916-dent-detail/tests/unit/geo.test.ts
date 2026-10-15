import { describe, expect, it } from 'vitest';
import { assessZip, feeForMiles, haversineMiles, travelMinutes, ZIP_TABLE } from '@/lib/geo';
import { travelFees } from '@/config/pricing';

describe('geo', () => {
  it('base ZIP is in area with zero fee', () => {
    const r = assessZip('95624');
    expect(r.status).toBe('in_area');
    expect(r.travelFee).toBe(0);
  });
  it('every one of the 14 target cities has at least one ZIP in the table', () => {
    const cities = ['Sacramento', 'Elk Grove', 'Roseville', 'Folsom', 'Rancho Cordova', 'Citrus Heights', 'Natomas', 'West Sacramento', 'Davis', 'Carmichael', 'Granite Bay', 'El Dorado Hills', 'Lincoln', 'Rocklin'];
    const have = new Set(Object.values(ZIP_TABLE).map((z) => z.city));
    for (const c of cities) expect(have.has(c), c).toBe(true);
  });
  it('all table coordinates sit in the Sacramento region', () => {
    for (const [zip, z] of Object.entries(ZIP_TABLE)) {
      expect(z.lat, zip).toBeGreaterThan(38.1); expect(z.lat, zip).toBeLessThan(39.0);
      expect(z.lng, zip).toBeGreaterThan(-122.0); expect(z.lng, zip).toBeLessThan(-120.9);
    }
  });
  it('unknown but well-formed ZIP is needs_review, never guessed', () => {
    const r = assessZip('90210');
    expect(r.status).toBe('needs_review');
    expect(r.travelFee).toBeNull();
    expect(r.miles).toBeUndefined();
  });
  it('malformed ZIPs are invalid', () => {
    for (const z of ['', '9562', '956245', 'abcde', '95 24', '95624-1234']) expect(assessZip(z).status).toBe('invalid');
  });
  it('trims whitespace', () => expect(assessZip(' 95624 ').status).toBe('in_area'));
  it('fee tiers follow config and are monotonic', () => {
    expect(feeForMiles(0)).toBe(0);
    expect(feeForMiles(travelFees.freeRadiusMiles)).toBe(0);
    const t0 = travelFees.tiers[0]!;
    expect(feeForMiles(travelFees.freeRadiusMiles + 0.1)).toBe(t0.fee);
    expect(feeForMiles(t0.upToMiles)).toBe(t0.fee);
    expect(feeForMiles(travelFees.maxServiceMiles + 0.1)).toBeNull();
    let prev = 0;
    for (let m = 0; m <= travelFees.maxServiceMiles; m += 0.5) { const f = feeForMiles(m)!; expect(f).toBeGreaterThanOrEqual(prev); prev = f; }
  });
  it('a far-but-known ZIP is out_of_area (Lincoln from Elk Grove) or fee-bearing, never silently free', () => {
    const r = assessZip('95648');
    expect(['out_of_area', 'in_area']).toContain(r.status);
    if (r.status === 'in_area') expect(r.travelFee).toBeGreaterThan(0);
  });
  it('base ZIP is configurable', () => {
    const r = assessZip('95648', '95648');
    expect(r.miles).toBe(0); expect(r.travelFee).toBe(0);
  });
  it('haversine sanity: Sacramento to Davis is roughly 13-17 miles', () => {
    const d = haversineMiles(ZIP_TABLE['95814']!, ZIP_TABLE['95616']!);
    expect(d).toBeGreaterThan(11); expect(d).toBeLessThan(18);
  });
  it('travel minutes: same ZIP short, unknown falls back, farther takes longer', () => {
    expect(travelMinutes('95624', '95624')).toBe(5);
    expect(travelMinutes('95624', '00000')).toBe(30);
    expect(travelMinutes(null, '95624')).toBe(30);
    expect(travelMinutes('95624', '95746')).toBeGreaterThan(travelMinutes('95624', '95823'));
  });
});
