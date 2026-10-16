// The dealer leave-behind: the QR/printed URL follows NEXT_PUBLIC_SITE_URL, the default build says so loudly, and the output is byte-stable.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(import.meta.dirname, '..', '..', 'scripts', 'leave-behind.mjs');
const dir = mkdtempSync(join(tmpdir(), 'lb-'));
const build = (name: string, site?: string) => {
  const out = join(dir, name);
  const env = { ...process.env, ...(site === undefined ? {} : { NEXT_PUBLIC_SITE_URL: site }) } as Record<string, string | undefined>;
  if (site === undefined) delete env.NEXT_PUBLIC_SITE_URL;
  const r = spawnSync(process.execPath, [script, `--out=${out}`], { encoding: 'utf8', env: env as NodeJS.ProcessEnv });
  return { r, bytes: readFileSync(out) };
};
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

// each case spawns node and renders a PDF (~2 s alone, much more when the whole suite runs in parallel): generous timeout, no retries
describe('npm run leave-behind', { timeout: 120_000 }, () => {
  it('with NEXT_PUBLIC_SITE_URL set (dummy value) the QR points at it and there is no warning', () => {
    const { r, bytes } = build('dummy.pdf', 'https://dummy-916.example/');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('-> QR https://dummy-916.example/dealers/signup?utm_source=leave_behind&utm_medium=print');
    expect(r.stderr).not.toMatch(/NEXT_PUBLIC_SITE_URL is not set/);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  });
  it('without it the QR points at localhost, a warning is printed and the sheet carries the [OWNER] marker (so the PDF differs from the real one)', () => {
    const dummy = build('a.pdf', 'https://dummy-916.example');
    const def = build('b.pdf');
    expect(def.r.stdout).toContain('-> QR http://localhost:3000/dealers/signup');
    expect(def.r.stderr).toMatch(/NEXT_PUBLIC_SITE_URL is not set/);
    expect(sha(def.bytes)).not.toBe(sha(dummy.bytes));
  });
  it('is deterministic: the same inputs give byte-identical PDFs (re-running never dirties git), and --out leaves the committed file alone', () => {
    const a = build('c1.pdf', 'https://dummy-916.example');
    const b = build('c2.pdf', 'https://dummy-916.example');
    expect(sha(a.bytes)).toBe(sha(b.bytes));
    expect(a.r.stdout).not.toContain('public/dealers/leave-behind.pdf');
    rmSync(dir, { recursive: true, force: true });
  });
});
