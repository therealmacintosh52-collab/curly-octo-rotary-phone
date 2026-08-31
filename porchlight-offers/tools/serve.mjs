/** Minimal static server for local preview: node tools/serve.mjs [port] */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'public');
const PORT = Number(process.argv[2] || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = join(ROOT, normalize(url).replace(/^(\.\.[/\\])+/, ''));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    const fallback = join(ROOT, '404.html');
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    if (existsSync(fallback)) return createReadStream(fallback).pipe(res);
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Serving public/ on http://localhost:${PORT}`));
