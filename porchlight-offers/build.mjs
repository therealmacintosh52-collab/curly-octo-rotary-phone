/**
 * Zero-dependency static site generator.
 *
 *   node build.mjs           build into public/
 *   node build.mjs --check   build, then validate internal links + SEO fields
 *
 * Output is plain HTML/CSS/JS — deploy public/ to Netlify, Cloudflare Pages,
 * Vercel, S3, or any web server.
 */
import {
  cpSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { site } from './src/config.mjs';
import { renderPage } from './src/layout.mjs';
import { outputFileFor } from './src/lib/html.mjs';
import { corePages } from './src/pages/core.mjs';
import { localPages } from './src/pages/local.mjs';
import { guidePages } from './src/pages/guides.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const OUT = join(root, 'public');
const check = process.argv.includes('--check');

const pages = [...corePages(), ...localPages(), ...guidePages()];

/* ------------------------------------------------------------- render */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const written = [];
for (const page of pages) {
  const file = join(OUT, outputFileFor(page.path));
  mkdirSync(dirname(file), { recursive: true });
  const html = renderPage(page);
  writeFileSync(file, html);
  written.push({ ...page, file, bytes: Buffer.byteLength(html) });
}

/* -------------------------------------------------------- static assets */

cpSync(join(root, 'assets/styles.css'), join(OUT, 'styles.css'));
cpSync(join(root, 'assets/main.js'), join(OUT, 'main.js'));
cpSync(join(root, 'assets/img'), join(OUT, 'img'), { recursive: true });

/* -------------------------------------------------------------- sitemap */

const priorityFor = (p) => {
  if (p === '/') return '1.0';
  if (p.startsWith('/we-buy-houses/') || p.startsWith('/situations/')) return '0.9';
  if (['/how-it-works/', '/compare/', '/locations/', '/contact/'].includes(p)) return '0.8';
  if (p.startsWith('/blog/')) return '0.6';
  return '0.5';
};

const today = new Date().toISOString().slice(0, 10);
const indexable = written.filter((p) => !p.noindex && !p.path.endsWith('.html'));

writeFileSync(
  join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable
  .map(
    (p) => `  <url>
    <loc>${site.origin}${p.path}</loc>
    <lastmod>${today}</lastmod>
    <priority>${priorityFor(p.path)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`,
);

writeFileSync(
  join(OUT, 'robots.txt'),
  `# ${site.name}
User-agent: *
Allow: /
Disallow: /thank-you/

Sitemap: ${site.origin}/sitemap.xml
`,
);

writeFileSync(
  join(OUT, 'site.webmanifest'),
  JSON.stringify(
    {
      name: site.name,
      short_name: 'Porchlight',
      description: site.description,
      start_url: '/',
      display: 'browser',
      background_color: '#fdfaf5',
      theme_color: '#0f2440',
      icons: [
        { src: '/img/logo.png', sizes: '512x512', type: 'image/png' },
        { src: '/img/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    null,
    2,
  ),
);

// Netlify/Cloudflare headers: long-cache the fingerprint-free assets modestly,
// and set the security headers a marketing site should always send.
writeFileSync(
  join(OUT, '_headers'),
  `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

/img/*
  Cache-Control: public, max-age=604800

/styles.css
  Cache-Control: public, max-age=86400

/main.js
  Cache-Control: public, max-age=86400
`,
);

/* ------------------------------------------------------------- reporting */

const totalBytes = written.reduce((n, p) => n + p.bytes, 0);
console.log(`Built ${written.length} pages → public/  (${(totalBytes / 1024).toFixed(0)} KB HTML)`);

if (!check) {
  console.log('Run `node build.mjs --check` to validate links and SEO fields.');
  process.exit(0);
}

/* ----------------------------------------------------------------- checks */

const problems = [];
const routes = new Set(written.map((p) => p.path));
const assetFiles = new Set();
(function walk(dir, base = '') {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = `${base}/${entry}`;
    if (statSync(full).isDirectory()) walk(full, rel);
    else assetFiles.add(rel);
  }
})(OUT);

for (const page of written) {
  // Title / description discipline.
  if (page.title.length > 62) problems.push(`${page.path} — title is ${page.title.length} chars (>62)`);
  if (page.description.length > 165) problems.push(`${page.path} — meta description is ${page.description.length} chars (>165)`);
  if (page.description.length < 70 && !page.noindex) problems.push(`${page.path} — meta description is only ${page.description.length} chars`);

  const html = renderPage(page);
  const h1s = html.match(/<h1[\s>]/g) || [];
  if (h1s.length !== 1) problems.push(`${page.path} — ${h1s.length} <h1> tags (expected exactly 1)`);

  // Internal links must resolve to a generated route or a real file.
  const hrefs = [...html.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]);
  for (const href of new Set(hrefs)) {
    if (routes.has(href)) continue;
    if (assetFiles.has(href)) continue;
    if (assetFiles.has(`${href.replace(/\/$/, '')}/index.html`)) continue;
    problems.push(`${page.path} — broken internal link: ${href}`);
  }

  // JSON-LD must parse.
  for (const block of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    try {
      JSON.parse(block[1]);
    } catch (e) {
      problems.push(`${page.path} — invalid JSON-LD: ${e.message}`);
    }
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} issue(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('✓ links, headings, meta lengths and JSON-LD all check out');
