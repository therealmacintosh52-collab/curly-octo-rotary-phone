/** Lighthouse mobile on the four pages the blueprint names. Writes perf/lighthouse.md. */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
const _LOCAL_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
// .mp4 and .webm belong here: without them the clip is served as
// application/octet-stream, Chrome falls back to sniffing it, and the hero's
// first frame — which is the LCP element on the home page — lands seconds late.
// That read as a site regression for one round; it was this table.
const MIME = { '.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif',
  '.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain','.webmanifest':'application/manifest+json',
  '.mp4':'video/mp4','.webm':'video/webm' };

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, url);
  if (url.endsWith('/')) file = path.join(file, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  // Range support: <video> asks for byte ranges and treats a plain 200 for a
  // large file as a reason to abort, which looks exactly like a broken clip.
  const buf = readFileSync(file);
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = Number(m[1] || 0);
    const end = Math.min(Number(m[2] || buf.length - 1), buf.length - 1);
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${buf.length}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
    });
    res.end(buf.subarray(start, end + 1));
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': buf.length });
  res.end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const chrome = await launch({
  chromePath: process.env.PW_CHROME || (existsSync(_LOCAL_CHROME) ? _LOCAL_CHROME : undefined),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

const PAGES = [['Home','/'],['Service','/services/window-tinting/'],
               ['Guide','/advice/california-window-tint-law/'],['Contact','/contact/']];
const rows = [];
for (const [label, p] of PAGES) {
  const r = await lighthouse(BASE + p, {
    port: chrome.port, output: 'json', logLevel: 'error',
    screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
    formFactor: 'mobile',
    onlyCategories: ['performance','accessibility','best-practices','seo'],
  });
  const c = r.lhr.categories, a = r.lhr.audits;
  rows.push({
    label, p,
    perf: Math.round(c.performance.score*100), a11y: Math.round(c.accessibility.score*100),
    bp: Math.round(c['best-practices'].score*100), seo: Math.round(c.seo.score*100),
    lcp: a['largest-contentful-paint'].displayValue,
    cls: a['cumulative-layout-shift'].displayValue,
    tbt: a['total-blocking-time'].displayValue,
  });
  console.log(`${label.padEnd(8)} perf ${rows.at(-1).perf}  a11y ${rows.at(-1).a11y}  bp ${rows.at(-1).bp}  seo ${rows.at(-1).seo}  LCP ${rows.at(-1).lcp}  CLS ${rows.at(-1).cls}`);
}
await chrome.kill(); server.close();

const md = `# Lighthouse — mobile

Run with \`node scripts/lh.mjs\` against the built \`dist/\`, throttled mobile
(390×844, 4× CPU slowdown, simulated slow 4G — Lighthouse defaults).

Target from the blueprint: performance ≥ 90, accessibility / best-practices /
SEO = 100, CLS = 0.

| Page | URL | Perf | A11y | Best prac. | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
${rows.map(r => `| ${r.label} | \`${r.p}\` | **${r.perf}** | **${r.a11y}** | **${r.bp}** | **${r.seo}** | ${r.lcp} | ${r.cls} | ${r.tbt} |`).join('\n')}

Last run: ${new Date().toISOString().slice(0,10)}

## Notes

- The LCP element on the home page is the hero \`<video>\`'s first frame, not the
  poster: a video is an LCP candidate in its own right and the clip is the
  largest thing above the fold. The poster (AVIF, ~52 KB) is preloaded with
  \`fetchpriority="high"\` so the frame is painted early; the video source is
  attached after \`load\` + idle so it never competes for bandwidth with it.
- The web app manifest points at the 256 px logo, not the 800 px master: Chrome
  fetches manifest icons at high priority, and a 250 KB icon cost the home page
  about 1 s of simulated LCP before it was changed.
- Fonts are self-hosted woff2 with \`font-display: optional\` and metric-matched
  fallbacks, which is what holds CLS at 0.
- GSAP and Lenis are dynamically imported after \`load\` and skipped entirely for
  \`prefers-reduced-motion\`.
`;
writeFileSync(path.join(ROOT, 'perf/lighthouse.md'), md);
console.log('\nwrote perf/lighthouse.md');
