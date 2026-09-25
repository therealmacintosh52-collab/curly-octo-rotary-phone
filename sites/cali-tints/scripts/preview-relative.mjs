/**
 * Sub-path-safe copy of the built site.
 *
 *   npm run build && node scripts/preview-relative.mjs   -> dist-preview/
 *
 * Root-relative URLs (/services/…) only resolve at the root of a domain. This
 * rewrites every href/src/srcset/action to a relative path so the same folder
 * works from a subdirectory, a staging URL, or opened straight off disk — which
 * is how the owner gets to look at it before the domain is pointed anywhere.
 */
import { cpSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'dist-preview');

if (!existsSync(DIST)) { console.error('Run npm run build first.'); process.exit(1); }
rmSync(OUT, { recursive: true, force: true });
cpSync(DIST, OUT, { recursive: true });

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = path.join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (f.endsWith('.html')) out.push(f);
  }
  return out;
}

let n = 0;
for (const file of walk(OUT)) {
  const rel = path.relative(OUT, file);
  const depth = rel.split(path.sep).length - 1;
  const prefix = depth === 0 ? './' : '../'.repeat(depth);
  let html = readFileSync(file, 'utf8');
  // href/src/action="/…"  ->  relative. Protocol-relative (//) is left alone.
  html = html.replace(/(href|src|action)="\/(?!\/)/g, `$1="${prefix}`);
  html = html.replace(/srcset="\/(?!\/)/g, `srcset="${prefix}`);
  // url(/fonts/…) inside the inlined stylesheet (@font-face) — with or without quotes
  html = html.replace(/url\((['"]?)\/(?!\/)/g, `url($1${prefix}`);
  // canonical/og:url must keep pointing at the real domain, so put those back
  html = html.replace(new RegExp(`(rel="canonical" href=")${prefix.replace(/\./g,'\\.')}`, 'g'),
                      '$1https://calitintsca.com/');
  writeFileSync(file, html);
  n++;
}
console.log(`dist-preview/ ready — ${n} pages rewritten to relative paths`);
