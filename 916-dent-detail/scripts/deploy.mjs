#!/usr/bin/env node
// One-command production deploy with a preflight. DRY RUN BY DEFAULT: it only prints what it would do.
//   npm run deploy                      print the plan (runs nothing)
//   npm run deploy -- --preflight-only --yes   run leave-behind (if domain set) + doctor + verify, do not deploy
//   npm run deploy -- --yes             run the preflight, then `vercel deploy --prod`; any failed step aborts before the deploy
// Needs the Vercel CLI logged in and the project linked (`vercel login && vercel link`) and the env vars set in Vercel (see README).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterDeploy, buildPlan } from './lib/deploy-plan.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const yes = process.argv.includes('--yes');
const preflightOnly = process.argv.includes('--preflight-only');
function envFile(f) {
  const o = {};
  if (!existsSync(f)) return o;
  for (const l of readFileSync(f, 'utf8').split('\n')) { const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
  return o;
}
const env = { ...envFile(join(root, '.env')), ...envFile(join(root, '.env.local')), ...process.env };
const hasVercelCli = spawnSync('vercel', ['--version'], { stdio: 'ignore' }).status === 0;
const plan = buildPlan({ env, yes, preflightOnly, hasVercelCli });

const git = spawnSync('git', ['status', '--porcelain', '--', '.'], { cwd: root, encoding: 'utf8' });
const dirty = (git.stdout ?? '').trim().length > 0;
console.log(`916 Dent & Detail deploy: ${plan.mode.toUpperCase()}${preflightOnly ? ' (preflight only)' : ''}`);
if (dirty) console.log('warning: uncommitted changes in this folder; Vercel deploys the working directory, not a commit.');
console.log('');
plan.steps.forEach((s, i) => {
  const line = s.skipped ? '(skipped)' : `${s.cmd} ${s.args.join(' ')}`;
  console.log(`${i + 1}. ${s.id.padEnd(13)} ${line}\n   ${s.why}`);
});
if (!yes) {
  console.log('\nDry run: nothing was executed. Add --yes to run these steps in order (a failing step stops everything before the deploy).');
  process.exit(0);
}
const run = (cmd, args) => new Promise((res) => { const p = spawn(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } }); p.on('exit', (c) => res(c ?? 1)); });
for (const s of plan.steps) {
  if (s.skipped) continue;
  console.log(`\n==== ${s.id} ====`);
  const code = await run(s.cmd, s.args);
  if (code !== 0) { console.error(`\n${s.id} failed (exit ${code}). Stopped: nothing was deployed after this point.`); process.exit(code); }
}
console.log(preflightOnly ? '\nPreflight passed. Nothing was deployed (--preflight-only).' : '\nDeployed. Next:');
if (!preflightOnly) for (const l of afterDeploy) console.log(`  - ${l}`);
