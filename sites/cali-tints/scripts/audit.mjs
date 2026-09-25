/**
 * Pre-deploy audit. Exits non-zero on any error so it can gate a deploy.
 *
 *   node scripts/audit.mjs
 *
 * Runs against the built dist/ in a real browser rather than regexing HTML, so
 * what is checked is what a crawler actually parses.
 *
 * Checks: exactly one H1, heading order, unique titles <= 60, unique meta
 * descriptions 70-160, canonical, OG/Twitter/geo tags, valid JSON-LD with no
 * self-published aggregateRating, every internal link and anchor resolving,
 * alt text on every image, one phone number everywhere, sitemap coverage, and
 * text contrast against the background each element actually renders on.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
// Chromium: this container's Playwright build, or the one `npx playwright install`
// puts in ~/.cache/ms-playwright (CI), or whatever PW_CHROME points at.
const _LOCAL_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.PW_CHROME || (existsSync(_LOCAL_CHROME) ? _LOCAL_CHROME : chromium.executablePath());
const PHONE = JSON.parse(readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'))
  .site.phone_display;

const errors = [];
const warnings = [];

/* ------------------------------------------------------------ tiny server */
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4',
};
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, url);
  if (url.endsWith('/')) file = path.join(file, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nope'); return;
  }
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

/* -------------------------------------------------------- collect the pages */
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = path.join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (e === 'index.html') out.push(f);
  }
  return out;
}
const pages = walk(DIST).map((f) => {
  const rel = path.relative(DIST, f).replace(/\\/g, '/').replace(/index\.html$/, '');
  return '/' + rel;
});

const titles = new Map();
const descs = new Map();
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/maps|favicon/i.test(m.text())) jsErrors.push(m.text()); });

for (const p of pages) {
  jsErrors.length = 0;
  // 'load', not 'networkidle': the hero video streams continuously, so the
  // network never goes idle and networkidle would hang or time out.
  await page.goto(BASE + p, { waitUntil: 'load' });
  await page.waitForTimeout(120);

  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const all = (s) => Array.from(document.querySelectorAll(s));
    return {
      h1: all('h1').length,
      h1text: q('h1')?.textContent?.trim() ?? '',
      title: document.title,
      desc: q('meta[name=description]')?.getAttribute('content') ?? '',
      canonical: q('link[rel=canonical]')?.getAttribute('href') ?? '',
      lang: document.documentElement.lang,
      robots: q('meta[name=robots]')?.getAttribute('content') ?? '',
      props: all('meta[property]').map((m) => m.getAttribute('property')),
      names: all('meta[name]').map((m) => m.getAttribute('name')),
      ld: all('script[type="application/ld+json"]').map((s) => s.textContent),
      links: all('a[href]').map((a) => a.getAttribute('href')),
      ids: all('[id]').map((e) => e.id),
      imgsNoAlt: all('img').filter((i) => i.getAttribute('alt') === null).length,
      headings: all('h1,h2,h3,h4,h5,h6').map((h) => Number(h.tagName[1])),
      tels: all('a[href^="tel:"]').map((a) => a.textContent.trim()),
      bodyText: document.body.innerText,
    };
  });

  if (jsErrors.length) errors.push(`${p}: JS error — ${jsErrors[0].slice(0, 120)}`);
  if (info.h1 !== 1) errors.push(`${p}: ${info.h1} <h1> (must be exactly 1)`);
  if (!info.lang) errors.push(`${p}: <html> has no lang`);
  if (info.imgsNoAlt) errors.push(`${p}: ${info.imgsNoAlt} <img> without alt`);
  if (!info.canonical) errors.push(`${p}: no canonical`);

  // heading order: never skip a level going down
  let prev = 0;
  for (const lvl of info.headings) {
    if (prev && lvl > prev + 1) { errors.push(`${p}: heading jumps h${prev} -> h${lvl}`); break; }
    prev = lvl;
  }

  const noindex = info.robots.includes('noindex');
  const t = info.title.trim();
  if (!t) errors.push(`${p}: no <title>`);
  else if (t.length > 60) errors.push(`${p}: title ${t.length} chars (max 60): "${t}"`);
  if (!noindex) {
    if (titles.has(t)) errors.push(`duplicate title "${t}" on ${p} and ${titles.get(t)}`);
    else titles.set(t, p);
  }

  const d = info.desc.trim();
  if (!d) errors.push(`${p}: no meta description`);
  else if (d.length < 70 || d.length > 160) errors.push(`${p}: description ${d.length} chars (need 70-160)`);
  if (!noindex) {
    if (descs.has(d)) errors.push(`duplicate description on ${p} and ${descs.get(d)}`);
    else descs.set(d, p);
  }

  for (const prop of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
    if (!info.props.includes(prop)) errors.push(`${p}: missing ${prop}`);
  }
  for (const n of ['twitter:card', 'geo.region', 'geo.position', 'ICBM', 'viewport']) {
    if (!info.names.includes(n)) errors.push(`${p}: missing meta ${n}`);
  }

  if (!info.ld.length && !noindex) warnings.push(`${p}: no JSON-LD`);
  for (const [i, blob] of info.ld.entries()) {
    let parsed;
    try { parsed = JSON.parse(blob); }
    catch (e) { errors.push(`${p}: JSON-LD block ${i + 1} invalid: ${e.message}`); continue; }
    if (!parsed['@context'] || !parsed['@type']) errors.push(`${p}: JSON-LD ${i + 1} missing @context/@type`);
    // The owner's explicit call, and Google's guidance on self-serving markup.
    if (JSON.stringify(parsed).includes('aggregateRating')) {
      errors.push(`${p}: JSON-LD self-publishes aggregateRating`);
    }
  }

  // one phone number everywhere
  for (const tel of info.tels) {
    if (tel && /\d/.test(tel) && !tel.includes(PHONE)) {
      errors.push(`${p}: tel link text "${tel}" does not match ${PHONE}`);
    }
  }

  // internal links + anchors
  for (const href of info.links) {
    if (/^(https?:|tel:|mailto:|data:|#$)/.test(href)) continue;
    const [pathPart, frag] = href.split('#');
    if (!pathPart) {
      if (frag && !info.ids.includes(frag)) errors.push(`${p}: anchor #${frag} has no target`);
      continue;
    }
    if (!pathPart.startsWith('/')) continue;
    const target = pathPart.endsWith('/') ? path.join(DIST, pathPart, 'index.html')
                                          : path.join(DIST, pathPart);
    if (!existsSync(target)) errors.push(`${p}: broken internal link -> ${href}`);
  }
}

/* ------------------------------------------------------------- contrast */
await page.goto(BASE + '/', { waitUntil: 'load' });
const contrast = await page.evaluate(() => {
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (s) => {
    const m = (s || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  };
  const out = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'IFRAME', 'VIDEO'].includes(el.tagName)) return;
    if (el.closest('.sr-only,.skip,.hp,[aria-hidden="true"]')) return;
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1).length;
    if (!own) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
    let n = el, grad = false, bg = [255, 255, 255];
    while (n) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') { grad = true; break; }
      const c = parse(s.backgroundColor);
      if (c && c[3] > 0.85) { bg = [c[0], c[1], c[2]]; break; }
      n = n.parentElement;
    }
    if (grad) return;                       // verified at the token level
    const fg = parse(cs.color); if (!fg) return;
    const L1 = lum(fg[0], fg[1], fg[2]), L2 = lum(bg[0], bg[1], bg[2]);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight) || 400;
    const need = px >= 24 || (px >= 18.66 && w >= 700) ? 3 : 4.5;
    if (ratio < need) out.push(`${el.tagName.toLowerCase()}.${el.className} ${ratio.toFixed(2)} < ${need}`);
  });
  return out;
});
contrast.forEach((c) => errors.push(`/: contrast ${c}`));

/* -------------------------------------------------------------- sitemap */
const smIndex = path.join(DIST, 'sitemap-index.xml');
if (!existsSync(smIndex)) errors.push('no sitemap-index.xml');
else {
  const sub = readFileSync(smIndex, 'utf8').match(/<loc>(.*?)<\/loc>/g) || [];
  let locs = [];
  for (const s of sub) {
    const f = path.join(DIST, s.replace(/<\/?loc>/g, '').replace(/^https?:\/\/[^/]+\//, ''));
    if (existsSync(f)) locs = locs.concat(readFileSync(f, 'utf8').match(/<loc>(.*?)<\/loc>/g) || []);
  }
  const listed = locs.map((l) => l.replace(/<\/?loc>/g, '').replace(/^https?:\/\/[^/]+/, ''));
  for (const l of listed) {
    if (!existsSync(path.join(DIST, l, 'index.html'))) errors.push(`sitemap lists a missing page: ${l}`);
  }
  for (const p of pages) {
    if (['/thank-you/', '/privacy/', '/404.html', '/404/'].includes(p)) continue;
    if (!listed.includes(p)) warnings.push(`built but not in sitemap: ${p}`);
  }
}

/* --------------------------------------------------------- deploy files */
for (const f of ['robots.txt', 'llms.txt', '_headers', '_redirects', 'site.webmanifest',
                 'assets/img/hero-poster.avif', 'assets/img/hero-poster.jpg',
                 'fonts/inter-latin-400-normal.woff2']) {
  if (!existsSync(path.join(DIST, f))) errors.push(`missing from dist: ${f}`);
}

await browser.close();
server.close();

console.log(`Audited ${pages.length} pages`);
warnings.forEach((w) => console.log(`  WARN  ${w}`));
errors.forEach((e) => console.log(`  ERROR ${e}`));
if (errors.length) {
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`\nAll checks passed (${warnings.length} warnings)`);
