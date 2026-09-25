/* Copies dist/ to dist-preview/ with root-absolute URLs rewritten to
   relative ones, so the built site can be hosted under a sub-path (a
   preview host, a staging folder). Production stays root-absolute.
   Usage: node scripts/preview-relative.mjs */
import { cpSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'dist'), out = path.join(root, 'dist-preview');
rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });

function walk(dir, files = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, files); else if (p.endsWith('.html')) files.push(p);
  }
  return files;
}
let n = 0;
for (const file of walk(out)) {
  const rel = path.relative(out, file).split(path.sep);
  const depth = rel.length - 1;                       // index.html at root → 0
  const prefix = depth === 0 ? './' : '../'.repeat(depth);
  let html = readFileSync(file, 'utf8');
  html = html
    .replace(/((?:href|src|data-src|data-poster|srcset|action)=")\/(?!\/)/g, `$1${prefix}`)
    .replace(/url\(\/(?!\/)/g, `url(${prefix}`);
  writeFileSync(file, html);
  n++;
}
console.log(`${n} pages rewritten into dist-preview/`);
