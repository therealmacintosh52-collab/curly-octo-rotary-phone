#!/usr/bin/env node
// Launch gate: lists every [OWNER] placeholder still in the app (prices, phone, hours, reviews,
// photos...). Exit 1 while any remain. Run before any launch: `npm run check:owner`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const patterns = [/\[OWNER[^\]]*\]/, /\[REPLACE WITH REAL JOB PHOTOS\]/, /placeholder: true/, /: null(,| as)/, /555-01\d\d/, /example\.com/];
const hits = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== 'generated') walk(p); continue; }
    if (!/\.(tsx?|mjs)$/.test(f)) continue;
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      if (patterns.some((re) => re.test(line))) hits.push(`${relative(ROOT, p)}:${i + 1}  ${line.trim().slice(0, 110)}`);
    });
  }
};
walk(join(ROOT, 'src'));
console.log(hits.join('\n'));
console.log(`\n${hits.length} owner placeholder line(s) remain.`);
process.exit(hits.length ? 1 : 0);
