/**
 * Bundles the built site into ONE self-contained HTML file for sharing a live
 * preview (no server, no deploy). Every page body is embedded as data; the
 * shell renders the current route into an iframe via srcdoc, so each page gets
 * a fresh document and the site's own JS initialises exactly as it does live.
 *
 *   node tools/bundle-preview.mjs [outfile]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(root, 'public');
const out = process.argv[2] || join(root, 'preview.html');

const css = readFileSync(join(PUB, 'styles.css'), 'utf8');
const js = readFileSync(join(PUB, 'main.js'), 'utf8');

const files = [];
(function walk(dir, base = '') {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, `${base}/${entry}`);
    else if (entry.endsWith('.html')) files.push({ full, rel: `${base}/${entry}` });
  }
})(PUB);

const routeFor = (rel) =>
  rel === '/index.html' ? '/' : rel.endsWith('/index.html') ? `${rel.slice(0, -10)}` : rel;

const pages = {};
for (const { full, rel } of files) {
  const html = readFileSync(full, 'utf8');
  const body = html.slice(html.indexOf('>', html.indexOf('<body')) + 1, html.lastIndexOf('</body>'));
  const title = (html.match(/<title>([^<]*)<\/title>/) || [, ''])[1];
  pages[routeFor(rel)] = {
    t: title,
    b: body.replace(/<script src="\/main\.js" defer><\/script>/, ''),
  };
}

const order = ['/', '/how-it-works/', '/compare/', '/situations/', '/locations/', '/reviews/', '/faq/'];
const routes = Object.keys(pages).sort(
  (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b),
);

const data = JSON.stringify({ pages, css, js, routes }).replace(/<\/script/gi, '<\\/script');

writeFileSync(
  out,
  `<title>Porchlight Offers</title>
<meta name="description" content="Live preview of the Porchlight Offers cash home buyer site.">
<style>
  :root {
    --shell-ink: #0b1a30;
    --shell-line: rgba(255, 255, 255, .14);
    --shell-text: #b9c8db;
    --shell-amber: #f6a623;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; height: 100vh; display: flex; flex-direction: column;
    background: var(--shell-ink); color: var(--shell-text);
    font: 13px/1.4 "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .bar {
    display: flex; align-items: center; gap: .75rem; flex-wrap: wrap;
    padding: .55rem .85rem; border-bottom: 1px solid var(--shell-line);
    background: linear-gradient(180deg, #10233d, #0b1a30);
  }
  .brand { display: flex; align-items: center; gap: .5rem; font-weight: 700; color: #fff; letter-spacing: -.01em; }
  .brand svg { width: 20px; height: 20px; }
  .brand span { color: var(--shell-amber); }
  .tag {
    font-size: 10px; text-transform: uppercase; letter-spacing: .1em;
    color: var(--shell-amber); border: 1px solid rgba(246, 166, 35, .35);
    border-radius: 999px; padding: .18rem .5rem;
  }
  select, .seg button {
    font: inherit; color: #dfe7f1; background: rgba(255, 255, 255, .07);
    border: 1px solid var(--shell-line); border-radius: 8px;
    padding: .35rem .6rem; cursor: pointer;
  }
  select { max-width: 46vw; }
  .seg { display: flex; gap: .25rem; margin-left: auto; }
  .seg button[aria-pressed="true"] { background: var(--shell-amber); border-color: var(--shell-amber); color: #2a1a02; font-weight: 700; }
  .stage { flex: 1; min-height: 0; display: flex; justify-content: center; background: #071322; padding: 0; position: relative; }
  .fallback {
    position: absolute; inset: 0; z-index: 0; display: grid; place-content: center;
    text-align: center; padding: 2rem; max-width: 46ch; margin: 0 auto; line-height: 1.6;
  }
  .fallback strong { color: #fff; display: block; margin-bottom: .4rem; font-size: 15px; }
  .stage.is-phone { padding: 14px; }
  iframe { width: 100%; height: 100%; border: 0; background: transparent; position: relative; z-index: 1; }
  .stage.is-phone iframe { width: 390px; max-width: 100%; border-radius: 18px; box-shadow: 0 12px 40px rgba(0, 0, 0, .5); }
  :focus-visible { outline: 2px solid var(--shell-amber); outline-offset: 2px; }
</style>

<header class="bar">
  <span class="brand">
    <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="20" r="7" fill="#f6a623" opacity=".25"/><path d="M4 15 16 4l12 11M7 14v13h18V14" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="20" r="3.2" fill="#f6a623"/></svg>
    Porchlight<span>Offers</span>
  </span>
  <span class="tag">Live preview</span>
  <label for="route" class="sr">
    <select id="route" aria-label="Jump to page"></select>
  </label>
  <span class="seg" role="group" aria-label="Viewport">
    <button type="button" data-w="desktop" aria-pressed="true">Desktop</button>
    <button type="button" data-w="phone" aria-pressed="false">Phone</button>
  </span>
</header>
<div class="stage" id="stage">
  <p class="fallback">
    <strong>Preview didn't load here</strong>
    This page embeds the site in a frame. If your viewer blocks that, run it locally instead:
    <code>npm run dev</code> in <code>porchlight-offers/</code>.
  </p>
  <iframe id="frame" title="Porchlight Offers site preview"></iframe>
</div>

<script id="site-data" type="application/json">${data}</script>
<script>
(function () {
  var DATA = JSON.parse(document.getElementById('site-data').textContent);
  var frame = document.getElementById('frame');
  var stage = document.getElementById('stage');
  var picker = document.getElementById('route');
  var FONTS =
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap">';

  function isSectionPage(r) {
    var inSection =
      r.indexOf('/we-buy-houses/') === 0 ||
      r.indexOf('/situations/') === 0 ||
      r.indexOf('/blog/') === 0;
    return inSection && r.split('/').length > 3;
  }

  function label(r) {
    if (r === '/') return 'Home';
    var t = DATA.pages[r].t || r;
    var cut = t.indexOf(' | ');
    if (cut > 0) t = t.slice(0, cut);
    cut = t.indexOf(' \u2014 ');
    if (cut > 0) t = t.slice(0, cut);
    return t;
  }

  var GROUPS = [
    ['Pages', function (r) { return !isSectionPage(r); }],
    ['Cities', function (r) { return r.indexOf('/we-buy-houses/') === 0; }],
    ['Situations', function (r) { return r.indexOf('/situations/') === 0; }],
    ['Guides', function (r) { return r.indexOf('/blog/') === 0; }]
  ];
  var placed = {};
  GROUPS.forEach(function (g) {
    var group = document.createElement('optgroup');
    group.label = g[0];
    DATA.routes.forEach(function (r) {
      if (placed[r] || !g[1](r)) return;
      placed[r] = 1;
      var o = document.createElement('option');
      o.value = r;
      o.textContent = label(r);
      group.appendChild(o);
    });
    if (group.children.length) picker.appendChild(group);
  });

  var current = '';

  function normalise(href) {
    var path = href.split('#')[0].split('?')[0];
    if (!path) return current || '/';
    if (path !== '/' && !path.endsWith('/') && !path.endsWith('.html')) path += '/';
    return path;
  }

  function render(path, hash) {
    var page = DATA.pages[path] || DATA.pages['/404.html'] || DATA.pages['/'];
    current = DATA.pages[path] ? path : '/404.html';
    picker.value = current;
    frame.srcdoc =
      '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + page.t + '</title>' + FONTS +
      '<style>' + DATA.css + '</style></head><body>' + page.b +
      (hash ? '<script>addEventListener("load",function(){var t=document.getElementById(' + JSON.stringify(hash) + ');if(t)t.scrollIntoView();});<\\/script>' : '') +
      '<script>' + DATA.js + '<\\/script></body></html>';
  }

  // Links and form posts inside the preview route within the shell.
  frame.addEventListener('load', function () {
    var doc = frame.contentDocument;
    if (!doc) return;
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || /^(tel:|mailto:|https?:)/.test(href)) return;
      if (href.charAt(0) === '#') return; // in-page anchor: let it work
      e.preventDefault();
      go(normalise(href), (href.split('#')[1] || ''));
    });
    doc.addEventListener('submit', function (e) {
      e.preventDefault();
      go('/thank-you/', '');
    });
  });

  function go(path, hash) {
    location.hash = '#' + path + (hash ? '#' + hash : '');
  }

  function fromHash() {
    var raw = location.hash.slice(1) || '/';
    var parts = raw.split('#');
    render(normalise(parts[0]), parts[1] || '');
  }

  addEventListener('hashchange', fromHash);
  picker.addEventListener('change', function () {
    go(picker.value, '');
  });
  document.querySelectorAll('.seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.seg button').forEach(function (o) {
        o.setAttribute('aria-pressed', String(o === b));
      });
      stage.classList.toggle('is-phone', b.dataset.w === 'phone');
    });
  });

  fromHash();
})();
</script>
`,
);

console.log(
  `Preview bundle → ${out.replace(root + '/', '')} (${Math.round(
    Buffer.byteLength(readFileSync(out)) / 1024,
  )} KB, ${routes.length} routes)`,
);
