// check:owner groups owner placeholders by category, counts them, and never counts ordinary code that merely matches a pattern.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const script = join(import.meta.dirname, '..', '..', 'scripts', 'check-owner.mjs');
const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 60_000 });

describe('check:owner', { timeout: 120_000 }, () => {
  const j = JSON.parse(run('--json').stdout) as { total: number; categories: Record<string, number>; filtered: Record<string, number> };

  it('reports categories whose counts add up to the total, and exits 1 while any remain', () => {
    expect(Object.values(j.categories).reduce((a, b) => a + b, 0)).toBe(j.total);
    expect(run().status).toBe(j.total > 0 ? 1 : 0);
    expect(Object.keys(j.categories)).toEqual(expect.arrayContaining(['Business facts', 'Prices & offers', 'Claims to confirm', 'Proof (photos, reviews, claims)', 'Legal & counsel']));
  });
  it('still counts the real owner items (fictional phone/email, null prices, PRICES_ARE_PLACEHOLDERS, unconfirmed dealer claims, placeholder photos and reviews, legal templates)', () => {
    const text = run().stdout;
    expect(text).toMatch(/site\.ts:\d+ +phone: \{[^\n]*placeholder: true/);
    expect(text).toMatch(/site\.ts:\d+ +email: \{[^\n]*placeholder: true/);
    expect(text).toMatch(/PRICES_ARE_PLACEHOLDERS is still true/);
    expect(text).toMatch(/claimsConfirmed\.sameDay \/ \.coi are false/);
    expect(text).toMatch(/REPLACE WITH REAL JOB PHOTOS/);
    expect(text).toMatch(/\[OWNER\] real review/);
    expect(text).toMatch(/Template, not legal advice/);
    expect(j.categories['Business facts']).toBeGreaterThanOrEqual(8);
    expect(j.categories['Prices & offers']).toBeGreaterThanOrEqual(20);
  });
  it('filters (and reports) application-logic nulls, marker renderers, prefix strippers and fixtures instead of counting them', () => {
    const text = run('--show-filtered').stdout;
    expect(j.filtered['`: null` in application logic (not config)']).toBeGreaterThan(30);
    expect(text).toMatch(/\[filtered\] src\/lib\/booking\/service\.ts:\d+ +\(`: null` in application logic/);
    expect(text).toMatch(/\[filtered\] src\/components\/Footer\.tsx:\d+ +\(marker renderer/);
    expect(text).toMatch(/\[filtered\] src\/lib\/reports\/compute\.ts:\d+ +\(code that strips the \[OWNER\] prefix/);
    // none of the filtered lines may appear in the counted section
    const counted = text.split('Summary')[0]!;
    expect(counted).not.toMatch(/booking\/service\.ts/);
    expect(counted).not.toMatch(/Footer\.tsx/);
    expect(counted).not.toMatch(/mock-model\.ts/);
  });
});
