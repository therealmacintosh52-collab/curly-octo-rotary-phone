// Lighthouse (mobile default preset, simulated slow 4G) on several pages, N runs each, medians printed.
//   CHROME_PATH=... node tools/lh.mjs <baseUrl> <outDir> [path,path] [--runs=3] [--desktop]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const base = pos[0], out = pos[1], paths = (pos[2] || '/').split(',');
const runs = Number((process.argv.find((a) => a.startsWith('--runs=')) || '--runs=3').split('=')[1]);
const desktop = process.argv.includes('--desktop');
const LH = process.env.LH_BIN || 'lighthouse';
mkdirSync(out, { recursive: true });
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
for (const p of paths) {
  const rows = [];
  for (let r = 1; r <= runs; r++) {
    const file = join(out, `lh-${p.replace(/\W+/g, '_') || 'root'}-${r}.json`);
    const args = [base + p, '--output=json', `--output-path=${file}`, '--quiet', '--only-categories=performance,accessibility,best-practices,seo',
      '--chrome-flags=--headless=new --no-sandbox --disable-gpu --host-resolver-rules="MAP lh.test 127.0.0.1" ' + (process.env.LH_FLAGS || '')];
    if (desktop) args.push('--preset=desktop');
    try { execFileSync(LH, args, { stdio: ['ignore', 'ignore', 'inherit'] }); } catch (e) { console.error('lighthouse failed', e.message); continue; }
    const j = JSON.parse(readFileSync(file, 'utf8')); const c = j.categories, a = j.audits;
    rows.push({ perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100), bp: Math.round(c['best-practices'].score * 100), seo: Math.round(c.seo.score * 100),
      lcp: a['largest-contentful-paint'].numericValue / 1000, cls: a['cumulative-layout-shift'].numericValue, tbt: a['total-blocking-time'].numericValue, fcp: a['first-contentful-paint'].numericValue / 1000,
      si: a['speed-index'].numericValue / 1000, bytes: a['total-byte-weight'].numericValue / 1024, lcpEl: a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.nodeLabel?.slice(0, 40) ?? '' });
    const bad = Object.values(a).filter((x) => x.score !== null && x.score < 1 && x.scoreDisplayMode === 'binary' && ['accessibility', 'best-practices', 'seo'].some((k) => c[k].auditRefs.find((ar) => ar.id === x.id)));
    if (bad.length && r === 1) console.log('  failing audits:', bad.map((x) => x.id).join(', '));
  }
  if (!rows.length) continue;
  console.log(`\n${p} (${desktop ? 'desktop' : 'mobile'}, ${rows.length} runs)`);
  console.table(rows.map((r) => ({ ...r, lcp: r.lcp.toFixed(2), cls: r.cls.toFixed(3), tbt: Math.round(r.tbt), fcp: r.fcp.toFixed(2), si: r.si.toFixed(2), bytes: Math.round(r.bytes) })));
  console.log('MEDIAN', JSON.stringify({ perf: med(rows.map((r) => r.perf)), a11y: med(rows.map((r) => r.a11y)), bp: med(rows.map((r) => r.bp)), seo: med(rows.map((r) => r.seo)), lcp_s: +med(rows.map((r) => r.lcp)).toFixed(2), cls: +med(rows.map((r) => r.cls)).toFixed(3), tbt_ms: Math.round(med(rows.map((r) => r.tbt))), kb: Math.round(med(rows.map((r) => r.bytes))) }));
}
