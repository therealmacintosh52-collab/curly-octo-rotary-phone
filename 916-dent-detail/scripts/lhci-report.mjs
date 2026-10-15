#!/usr/bin/env node
// Per-URL table of the MEDIAN of the Lighthouse runs LHCI saved in .lighthouseci/ (so numbers are quoted honestly, not best-of).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '.lighthouseci');
if (!existsSync(dir)) { console.log('no .lighthouseci directory: run npm run lhci first'); process.exit(0); }
const runs = readdirSync(dir).filter((f) => /^lhr-.*\.json$/.test(f)).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const by = new Map();
for (const j of runs) { const u = new URL(j.finalUrl ?? j.requestedUrl).pathname; (by.get(u) ?? by.set(u, []).get(u)).push(j); }
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const rows = [];
for (const [u, js] of by) {
  const m = (f) => med(js.map(f));
  rows.push({
    url: u, runs: js.length,
    perf: Math.round(m((j) => j.categories.performance.score * 100)), a11y: Math.round(m((j) => j.categories.accessibility.score * 100)),
    bp: Math.round(m((j) => j.categories['best-practices'].score * 100)), seo: Math.round(m((j) => j.categories.seo.score * 100)),
    'LCP ms': Math.round(m((j) => j.audits['largest-contentful-paint'].numericValue)), CLS: Number(m((j) => j.audits['cumulative-layout-shift'].numericValue).toFixed(3)),
    'TBT ms': Math.round(m((j) => j.audits['total-blocking-time'].numericValue)), 'FCP ms': Math.round(m((j) => j.audits['first-contentful-paint'].numericValue)),
    perfRuns: js.map((j) => Math.round(j.categories.performance.score * 100)).join('/'),
  });
}
console.log('\nMedian of runs per URL (mobile preset, simulated slow 4G + 4x CPU):');
console.table(rows);
