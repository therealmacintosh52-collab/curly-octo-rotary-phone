#!/usr/bin/env node
// SEO gate. Builds (if needed), starts the PRODUCTION server, crawls every internal link and asserts:
//   one <h1> · unique <title> and meta description · canonical present and self-referencing path ·
//   OG/Twitter tags · JSON-LD parses · no aggregateRating/review · no street address ·
//   no placeholder phone in schema while site.phone.placeholder is true · all internal links return 200 ·
//   sitemap lists every crawlable page and every sitemap URL is 200 · robots lists the sitemap ·
//   legacy redirects fire · 404 page is a real 404.
//
//   node scripts/check-seo.mjs [--no-build] [--port=3199] [--base=http://localhost:3000]
// --base skips starting a server and crawls an already-running one.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? '').split('=')[1] ?? d;
const port = Number(arg('port', '3199'));
const externalBase = arg('base', '');
const noBuild = process.argv.includes('--no-build');
const distDir = process.env.NEXT_DIST_DIR || '.next';
const base = externalBase || `http://127.0.0.1:${port}`;
const MAX_DESC = 155;

const { site } = await import(pathToFileURL(join(root, 'src/config/site.ts')).href);
const redirects = (await import(pathToFileURL(join(root, 'src/config/redirects.ts')).href)).redirectMap;

const failures = [];
const warnings = [];
const fail = (page, msg) => failures.push(`${page}  ${msg}`);

let server;
async function startServer() {
  if (!noBuild && !existsSync(join(root, distDir, 'BUILD_ID'))) {
    console.log(`[check:seo] no build in ${distDir}, running next build ...`);
    execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
  }
  server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`${base}/robots.txt`); if (r.status === 200) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(log);
  throw new Error('production server did not start');
}

const get = (path, init = {}) => fetch(base + path, { redirect: 'manual', ...init });
const attr = (tag, name) => (tag.match(new RegExp(`${name}=("([^"]*)"|'([^']*)')`, 'i')) ?? [])[2] ?? (tag.match(new RegExp(`${name}=("([^"]*)"|'([^']*)')`, 'i')) ?? [])[3];
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function metas(html) {
  const out = {};
  for (const m of html.matchAll(/<meta\s[^>]*>/gi)) {
    const key = attr(m[0], 'name') ?? attr(m[0], 'property');
    const content = attr(m[0], 'content');
    if (key && content !== undefined) out[key] = unescape(content);
  }
  return out;
}

function walk(node, visit, path = '') {
  if (Array.isArray(node)) node.forEach((n, i) => walk(n, visit, `${path}[${i}]`));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) { visit(k, v, `${path}.${k}`); walk(v, visit, `${path}.${k}`); }
}

const normalizePath = (href) => {
  if (!href) return null;
  if (/^(mailto:|tel:|sms:|javascript:|data:)/i.test(href)) return null;
  let u;
  try { u = new URL(href, base + '/'); } catch { return null; }
  const sameOrigin = u.origin === new URL(base).origin;
  let canonOrigin = false;
  try { canonOrigin = u.origin === new URL(site.url).origin; } catch { /* ignore */ }
  if (!sameOrigin && !canonOrigin) return null; // external
  let p = u.pathname.replace(/\/+$/, '') || '/';
  return p;
};

try {
  if (!externalBase) await startServer();
  console.log(`[check:seo] crawling ${base}`);

  // ---- crawl ----
  const pages = new Map(); // path -> { status, html, location }
  const linkSources = new Map(); // path -> first page that links to it
  const queue = ['/'];
  const queued = new Set(queue);
  while (queue.length) {
    const path = queue.shift();
    const res = await get(path);
    const type = res.headers.get('content-type') ?? '';
    const rec = { status: res.status, location: res.headers.get('location'), type };
    if (res.status === 200 && type.includes('text/html')) {
      rec.html = await res.text();
      for (const m of rec.html.matchAll(/<a\s[^>]*href=("([^"]*)"|'([^']*)')[^>]*>/gi)) {
        const p = normalizePath(unescape(m[2] ?? m[3] ?? ''));
        if (p && !queued.has(p)) { queued.add(p); queue.push(p); linkSources.set(p, path); }
      }
    } else { await res.arrayBuffer(); }
    pages.set(path, rec);
  }

  // ---- internal links: every one must be 200 (no redirects, no 404s) ----
  for (const [p, r] of pages) if (r.status !== 200) fail(p, `internal link returns ${r.status}${r.location ? ` -> ${r.location}` : ''} (linked from ${linkSources.get(p)})`);

  // ---- sitemap ----
  const sm = await get('/sitemap.xml');
  const smXml = sm.status === 200 ? await sm.text() : '';
  if (sm.status !== 200) fail('/sitemap.xml', `status ${sm.status}`);
  const sitemapPaths = new Set([...smXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => normalizePath(unescape(m[1]))));
  const sitemapOrigins = new Set([...smXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(unescape(m[1])).origin));
  if (sitemapOrigins.size > 1) fail('/sitemap.xml', `mixed origins: ${[...sitemapOrigins].join(', ')}`);
  for (const p of sitemapPaths) {
    if (!pages.has(p)) { const r = await get(p); if (r.status !== 200) fail('/sitemap.xml', `lists ${p} which returns ${r.status}`); await r.arrayBuffer(); }
  }

  // ---- per-page assertions ----
  const titles = new Map();
  const descs = new Map();
  const counts = { html: 0, services: 0, cities: 0, posts: 0 };
  let jsonLdBlocks = 0;
  const phoneNeedles = [site.phone.e164, site.phone.display, '555-0100', '5550100'];
  for (const [path, r] of pages) {
    if (r.status !== 200 || !r.html) continue;
    counts.html++;
    if (path.startsWith('/services/')) counts.services++;
    if (path.startsWith('/areas/')) counts.cities++;
    if (/^\/blog\/[^/]+$/.test(path) && !path.startsWith('/blog/tag') && path !== '/blog/rss.xml') counts.posts++;
    const html = r.html;
    const m = metas(html);
    const noindex = /noindex/i.test(m.robots ?? '');
    const h1s = (html.match(/<h1[\s>]/gi) ?? []).length;
    if (h1s !== 1) fail(path, `has ${h1s} <h1> (want exactly 1)`);
    const title = unescape((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1] ?? '').trim();
    if (!title) fail(path, 'missing <title>');
    else if (titles.has(title)) fail(path, `duplicate title with ${titles.get(title)}: "${title}"`);
    else titles.set(title, path);
    const desc = m.description;
    if (!desc) fail(path, 'missing meta description');
    else {
      if (desc.length > MAX_DESC) fail(path, `meta description ${desc.length} chars (> ${MAX_DESC})`);
      if (descs.has(desc)) fail(path, `duplicate meta description with ${descs.get(desc)}`);
      else descs.set(desc, path);
    }
    const canon = [...html.matchAll(/<link\s[^>]*>/gi)].map((x) => x[0]).find((t) => /rel=("|')canonical\1/i.test(t));
    const canonHref = canon ? attr(canon, 'href') : undefined;
    if (!canonHref) fail(path, 'missing canonical');
    else {
      const cp = normalizePath(unescape(canonHref));
      if (cp !== path) fail(path, `canonical points to ${canonHref} (path ${cp}), expected ${path}`);
    }
    for (const k of ['og:title', 'og:description', 'og:image', 'twitter:card']) if (!m[k]) fail(path, `missing <meta ${k}>`);
    if (!noindex && !sitemapPaths.has(path) && path !== '/_not-found') fail(path, 'crawlable + indexable but missing from sitemap.xml');
    if (/streetAddress|PostalAddress/i.test(html)) fail(path, 'street address markup found (service-area business must not publish one)');

    // JSON-LD
    const blocks = [...html.matchAll(/<script[^>]*type=("|')application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)].map((x) => x[2]);
    if (!blocks.length) fail(path, 'no JSON-LD');
    for (const raw of blocks) {
      jsonLdBlocks++;
      let data;
      try { data = JSON.parse(unescape(raw)); } catch (e) { fail(path, `JSON-LD does not parse: ${e.message}`); continue; }
      walk(data, (k) => {
        if (/^(aggregateRating|review|reviews)$/i.test(k)) fail(path, `JSON-LD contains "${k}" (forbidden)`);
        if (/^(address|streetAddress|PostalAddress)$/i.test(k)) fail(path, `JSON-LD contains "${k}" (no address allowed)`);
        if (k === 'telephone' && site.phone.placeholder) fail(path, 'JSON-LD telephone present while site.phone.placeholder is true');
        if (k === 'email' && site.email.placeholder) fail(path, 'JSON-LD email present while site.email.placeholder is true');
      });
      if (site.phone.placeholder) for (const n of phoneNeedles) if (raw.includes(n)) fail(path, `placeholder phone "${n}" leaked into JSON-LD`);
    }
  }

  // ---- content-set expectations ----
  if (counts.services < 9) fail('/services', `only ${counts.services} service pages crawled (want 9 + hub)`);
  if (counts.cities < 14) fail('/areas', `only ${counts.cities} city pages crawled (want 14)`);
  if (counts.posts < 10) fail('/blog', `only ${counts.posts} blog posts crawled (want 10)`);

  // ---- robots ----
  const rb = await get('/robots.txt');
  const robotsTxt = await rb.text();
  if (!/Sitemap:\s*\S+\/sitemap\.xml/i.test(robotsTxt)) fail('/robots.txt', 'does not reference sitemap.xml');
  if (!/User-agent:\s*\*/i.test(robotsTxt)) fail('/robots.txt', 'missing User-agent: *');

  // ---- RSS ----
  const rss = await get('/blog/rss.xml');
  const rssXml = await rss.text();
  const rssItems = (rssXml.match(/<item>/g) ?? []).length;
  if (rss.status !== 200 || rssItems < 10) fail('/blog/rss.xml', `status ${rss.status}, ${rssItems} items (want >= 10)`);

  // ---- redirects ----
  const sample = [...new Map(redirects.map((r) => [r.source, r])).values()].filter((_, i) => i % 6 === 0).slice(0, 25);
  let redirectOk = 0;
  for (const r of sample) {
    const res = await get(r.source);
    const loc = res.headers.get('location') ?? '';
    await res.arrayBuffer();
    const lp = loc ? normalizePath(loc) : null;
    const want = r.destination.split('#')[0].replace(/\/+$/, '') || '/';
    if (![301, 302, 307, 308].includes(res.status) || lp !== want) fail(r.source, `redirect expected -> ${r.destination}, got ${res.status} ${loc}`);
    else redirectOk++;
  }

  // ---- 404 ----
  const nf = await get('/this-page-does-not-exist-xyz');
  const nfHtml = await nf.text();
  if (nf.status !== 404) fail('/404', `unknown URL returned ${nf.status}, want 404`);
  if ((nfHtml.match(/<h1[\s>]/gi) ?? []).length !== 1) fail('/404', '404 page should have exactly one h1');

  // ---- report ----
  console.log(`\n[check:seo] pages crawled: ${pages.size}  html 200: ${counts.html}  services: ${counts.services}  cities: ${counts.cities}  posts: ${counts.posts}`);
  console.log(`[check:seo] sitemap urls: ${sitemapPaths.size}  JSON-LD blocks parsed: ${jsonLdBlocks}  redirects verified: ${redirectOk}/${sample.length}  rss items: ${rssItems}`);
  for (const w of warnings) console.log('WARN', w);
  if (failures.length) {
    console.error(`\n[check:seo] FAILED (${failures.length})`);
    for (const f of failures) console.error('  FAIL', f);
    process.exitCode = 1;
  } else console.log('[check:seo] OK');
} catch (e) {
  console.error('[check:seo] error:', e);
  process.exitCode = 1;
} finally {
  if (server) server.kill('SIGTERM');
}
