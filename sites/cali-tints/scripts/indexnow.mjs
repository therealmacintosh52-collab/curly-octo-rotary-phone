/**
 * Push every URL in the sitemap to IndexNow (Bing, Yandex, Naver, Seznam).
 * Google does not use IndexNow; submit there through Search Console.
 *
 *   node scripts/indexnow.mjs            # dry run, prints the payload
 *   node scripts/indexnow.mjs --send     # actually submits
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const keyFile = readdirSync(path.join(ROOT, 'public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.error('No IndexNow key file in public/.'); process.exit(1); }
const key = keyFile.replace('.txt', '');

const idx = path.join(DIST, 'sitemap-index.xml');
if (!existsSync(idx)) { console.error('Run npm run build first.'); process.exit(1); }
let urls = [];
for (const m of readFileSync(idx, 'utf8').match(/<loc>(.*?)<\/loc>/g) || []) {
  const sub = m.replace(/<\/?loc>/g, '');
  const f = path.join(DIST, sub.replace(/^https?:\/\/[^/]+\//, ''));
  if (existsSync(f)) {
    urls = urls.concat((readFileSync(f, 'utf8').match(/<loc>(.*?)<\/loc>/g) || [])
      .map((l) => l.replace(/<\/?loc>/g, '')));
  }
}

const host = new URL(urls[0]).host;
const body = { host, key, keyLocation: `https://${host}/${keyFile}`, urlList: urls };
console.log(`${urls.length} URLs, key ${key}`);

if (!process.argv.includes('--send')) {
  console.log('Dry run. Re-run with --send once the domain actually serves this build.');
  process.exit(0);
}
const res = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
console.log(`IndexNow responded ${res.status} ${res.statusText}`);
