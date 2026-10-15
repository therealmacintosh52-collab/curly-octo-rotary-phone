import { describe, expect, it } from 'vitest';
import { ESTIMATE_LABEL } from '@/config/pricing';
import { CANARY, buildSystemPrompt } from '@/lib/concierge/prompt';
import { toolDefs } from '@/lib/concierge/tools';

describe('system prompt', () => {
  const p = buildSystemPrompt();
  it('is byte-identical on every call (a stable cached prefix: no dates, ids or per-customer text)', () => {
    expect(buildSystemPrompt()).toBe(p);
    expect(p).not.toMatch(/\b20\d{2}-\d{2}-\d{2}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(JSON.stringify(toolDefs())).toBe(JSON.stringify(toolDefs()));
  });
  it('carries the persona, the hard rules and the exact estimate label', () => {
    expect(p).toContain(CANARY);
    expect(p).toContain(ESTIMATE_LABEL);
    for (const must of ['1 to 3 sentences', 'NEVER priced without photos', 'at least 2 photos', 'never say "you\'re booked" until', 'only HOLDS', 'AI assistant', 'untrusted', 'DATA from outside', 'two steps', 'Dent Removal', 'Hail Fix', 'Swirl & Scratch Erase', 'Gloss Shield', 'Paint Deep-Clean', 'Interior Reset']) expect(p, must).toContain(must);
    expect(p).toMatch(/body shop/i);
    expect(p).toMatch(/water or power/i);
  });
  it('lists every hand-off topic', () => {
    for (const t of ['Complaints', 'insurance claims', 'legal threats', 'safety', 'abusive']) expect(p).toContain(t);
  });
  it('contains no invented business claims or numbers beyond config', () => {
    expect(p).not.toMatch(/guarantee[sd]? (that|your)|lifetime|licensed and insured|best in/i);
    const money = p.match(/\$\d+/g) ?? [];
    expect(new Set(money)).toEqual(new Set(['$50']));
  });
  it('is long enough to be cacheable (>1k tokens with the tool definitions) but not bloated', () => {
    const chars = p.length + JSON.stringify(toolDefs()).length;
    expect(chars / 4).toBeGreaterThan(1500);
    expect(chars / 4).toBeLessThan(9000);
  });
});
