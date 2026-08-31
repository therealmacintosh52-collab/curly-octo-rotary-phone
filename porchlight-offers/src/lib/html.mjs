/** Tiny HTML helpers. No dependencies, no template engine. */

/** Escape text destined for HTML body/attribute context. */
export const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Escape a string for embedding inside a <script type="application/ld+json">. */
export const jsonLd = (obj) =>
  JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

/** Join truthy parts with newlines — lets templates use `cond && html` inline. */
export const join = (...parts) => parts.flat(Infinity).filter(Boolean).join('\n');

/** Absolute URL from a site-root path. */
export const abs = (origin, path) =>
  `${origin}${path.startsWith('/') ? path : `/${path}`}`;

/** '/how-it-works/' -> 'how-it-works/index.html' */
export const outputFileFor = (path) => {
  const clean = path.replace(/^\/+/, '');
  if (clean === '') return 'index.html';
  if (clean.endsWith('.html')) return clean;
  return `${clean.replace(/\/+$/, '')}/index.html`;
};

/** Format an ISO date as a human string. */
export const humanDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
