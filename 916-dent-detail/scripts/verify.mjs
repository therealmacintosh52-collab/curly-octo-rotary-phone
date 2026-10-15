#!/usr/bin/env node
// One command for "is this releasable": tsc -> lint -> vitest (unit + bot) -> production build -> check:seo -> check:owner
// (report only unless --strict-owner) -> Playwright e2e (mock mode) -> axe on every route class (reduced motion too).
// Exits non-zero when any REAL check fails. check:owner lists placeholders the owner still has to replace; that is a launch
// checklist, not a code failure, so it only fails the run with --strict-owner (use that in the deploy preflight).
//
//   npm run verify                       everything
//   npm run verify -- --skip=e2e,axe     skip steps by name
//   npm run verify -- --only=unit,build  run just these
//   npm run verify -- --strict-owner     placeholders fail the run too
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? '').split('=')[1]?.split(',').filter(Boolean) ?? [];
const skip = new Set(arg('skip')); const only = new Set(arg('only'));
const strictOwner = process.argv.includes('--strict-owner');
const PORT = process.env.VERIFY_AXE_PORT || '3211';

const run = (cmd, args, env = {}) => new Promise((resolve) => {
  const t0 = Date.now();
  const p = spawn(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  p.on('exit', (code) => resolve({ code: code ?? 1, ms: Date.now() - t0 }));
});

async function axeStep() {
  const server = spawn('node', ['scripts/e2e-server.mjs', `--port=${PORT}`], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  try {
    const base = `http://localhost:${PORT}`;
    const deadline = Date.now() + 120_000;
    for (;;) {
      try { if ((await fetch(base + '/robots.txt')).ok) break; } catch { /* not up yet */ }
      if (Date.now() > deadline) return { code: 1, ms: 0 };
      await new Promise((r) => setTimeout(r, 500));
    }
    return await run('node', ['scripts/axe.mjs', base]);
  } finally { server.kill('SIGTERM'); }
}

const steps = [
  { name: 'typecheck', fatal: true, go: () => run('npx', ['tsc', '--noEmit']) },
  { name: 'lint', fatal: true, go: () => run('npx', ['eslint', '.']) },
  { name: 'unit', fatal: true, go: () => run('npx', ['vitest', 'run']) },
  { name: 'build', fatal: true, go: () => run('npm', ['run', 'build']) },
  { name: 'seo', fatal: true, go: () => run('node', ['scripts/check-seo.mjs', '--no-build']) },
  { name: 'owner', fatal: strictOwner, go: () => run('node', ['scripts/check-owner.mjs']), note: 'placeholders the owner must replace before launch (report only; --strict-owner makes it fail)' },
  { name: 'e2e', fatal: true, go: () => run('npx', ['playwright', 'test']) },
  { name: 'axe', fatal: true, go: axeStep },
];

const results = [];
for (const s of steps) {
  if ((only.size && !only.has(s.name)) || skip.has(s.name)) { results.push({ ...s, status: 'skipped', ms: 0 }); continue; }
  console.log(`\n======== verify: ${s.name} ========`);
  const r = await s.go();
  results.push({ ...s, ms: r.ms, status: r.code === 0 ? 'pass' : s.fatal ? 'FAIL' : 'report' });
}
console.log('\n======== verify summary ========');
for (const r of results) console.log(`${r.status.padEnd(8)} ${r.name.padEnd(10)} ${(r.ms / 1000).toFixed(1).padStart(7)}s${r.status === 'report' ? `   (${r.note})` : ''}`);
const failed = results.filter((r) => r.status === 'FAIL');
console.log(failed.length ? `\nverify FAILED: ${failed.map((f) => f.name).join(', ')}` : '\nverify OK');
process.exit(failed.length ? 1 : 0);
