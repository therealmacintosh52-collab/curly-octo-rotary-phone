#!/usr/bin/env node
// Lighthouse CI against the PRODUCTION build in mock mode (lighthouserc.json: 6 URLs x 3 runs, Lighthouse default mobile emulation, assertions on the
// MEDIAN run). Uses the sandbox Chromium via CHROME_PATH (auto-detected under PLAYWRIGHT_BROWSERS_PATH / /opt/pw-browsers).
// Run on an idle machine: other load makes every number worse and noisy. Build first (`npm run build`) or this builds for you.
//   npm run lhci            collect + assert + median table
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (existsSync(base)) for (const d of readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
    const p = join(base, d, 'chrome-linux', 'chrome');
    if (existsSync(p)) return p;
  }
  return null;
}
const chrome = findChrome();
if (!chrome) console.warn('lhci: no Chromium found; set CHROME_PATH or install Chrome. Falling back to the system default.');
const env = { ...process.env, ...(chrome ? { CHROME_PATH: chrome } : {}), PUPPETEER_SKIP_DOWNLOAD: '1' };
const r = spawnSync('npx', ['lhci', 'autorun', '--config=lighthouserc.json'], { cwd: root, stdio: 'inherit', env });
spawnSync('node', ['scripts/lhci-report.mjs'], { cwd: root, stdio: 'inherit', env });
process.exit(r.status ?? 1);
