// One owner guard: defined once (src/lib/auth/server.ts), re-exported for dealers, and every /admin/dealers + owner-only API uses it.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : []; });
const files = walk('src');
const read = (f: string) => readFileSync(f, 'utf8');

describe('requireOwner', () => {
  it('is defined exactly once, in the Phase 3 auth module', () => {
    const defs = files.filter((f) => /export\s+(async\s+function|const|function)\s+requireOwner\b/.test(read(f)));
    expect(defs).toEqual([path.join('src', 'lib', 'auth', 'server.ts')]);
  });
  it('the dealer owner-guard only re-exports it (no second implementation)', () => {
    const g = read('src/lib/dealers/owner-guard.ts');
    expect(g).toMatch(/export \{ requireOwner, ownerAllowed \} from '@\/lib\/auth\/server'/);
    expect(g).not.toMatch(/getSession|requireStaff\(/);
  });
  it('requireStaff is the same function, so the two names can never drift', () => {
    expect(read('src/lib/auth/server.ts')).toMatch(/export const requireStaff = requireOwner;/);
  });
  it('every owner dealer screen calls it', () => {
    for (const f of ['src/app/admin/dealers/page.tsx', 'src/app/admin/dealers/[id]/page.tsx']) expect(read(f), f).toMatch(/await requireOwner\(\)/);
    expect(read('src/app/admin/dealers/_actions.ts')).toMatch(/await requireOwner\(\)/);
    expect(read('src/app/admin/dealers/layout.tsx')).toMatch(/requireOwner|requireStaff|requireSession/);
  });
});
