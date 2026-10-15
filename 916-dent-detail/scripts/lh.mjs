#!/usr/bin/env node
// Lighthouse (mobile preset = Lighthouse default: Moto G-class emulation + simulated slow 4G).
//   CHROME_PATH=/path/to/chrome node scripts/lh.mjs [url=http://localhost:3000/] [outDir=.lighthouse] [--desktop] [--runs=3]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const url = pos[0] || 'http://localhost:3000/';
const out = pos[1] || '.lighthouse';
const desktop = args.includes('--desktop');
const runs = Number((args.find((a) => a.startsWith('--runs=')) || '--runs=1').split('=')[1]);
mkdirSync(out, { recursive: true });

const rows = [];
for (let r = 1; r <= runs; r++) {
  const file = join(out, `lh-${desktop ? 'desktop' : 'mobile'}-${new URL(url).pathname.replace(/\W+/g, '_') || 'root'}-${r}.json`);
  const flags = [url, '--output=json', `--output-path=${file}`, '--quiet', '--only-categories=performance,accessibility,best-practices,seo',
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu'];
  if (desktop) flags.push('--preset=desktop');
  execFileSync('npx', ['lighthouse', ...flags], { stdio: 'inherit' });
  const j = JSON.parse(readFileSync(file, 'utf8'));
  const c = j.categories, a = j.audits;
  rows.push({
    run: r,
    perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100),
    bp: Math.round(c['best-practices'].score * 100), seo: Math.round(c.seo.score * 100),
    FCP: a['first-contentful-paint'].displayValue, LCP: a['largest-contentful-paint'].displayValue,
    TBT: a['total-blocking-time'].displayValue, CLS: a['cumulative-layout-shift'].displayValue, SI: a['speed-index'].displayValue,
    lcpEl: a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.nodeLabel?.slice(0, 50) ?? '',
  });
}
console.table(rows);
