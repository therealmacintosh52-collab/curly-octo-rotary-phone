/* Submits every URL in the built sitemap to IndexNow (Bing, Yandex, Naver,
   Seznam share the index; Bing is what ChatGPT search reads). Run after a
   deploy: node scripts/indexnow.mjs [--dry]
   The key file public/<key>.txt must be live at the site root first. */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const dry = process.argv.includes('--dry');
const keyFile = readdirSync(path.join(root, 'public')).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('No IndexNow key file in public/ (32 hex chars + .txt)');
const key = keyFile.replace(/\.txt$/, '');

const urls = new Set();
for (const f of readdirSync(dist).filter((f) => /^sitemap.*\.xml$/.test(f))) {
  const xml = readFileSync(path.join(dist, f), 'utf8');
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) if (!m[1].endsWith('.xml')) urls.add(m[1]);
}
const list = [...urls];
if (!list.length) throw new Error('No URLs found. Run npm run build first.');
const host = new URL(list[0]).host;
const body = { host, key, keyLocation: `https://${host}/${keyFile}`, urlList: list };
console.log(`${list.length} URLs for ${host}` + (dry ? ' (dry run)' : ''));
if (dry) { console.log(list.join('\n')); process.exit(0); }
const res = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body),
});
console.log(`IndexNow: HTTP ${res.status} ${res.status === 200 || res.status === 202 ? 'accepted' : await res.text()}`);
if (res.status >= 400) process.exit(1);
