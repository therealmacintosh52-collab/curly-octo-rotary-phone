#!/usr/bin/env node
// Content gate for Phase 6 (runs as `prebuild`, so `npm run build` fails on a bad page set).
//   node scripts/check-similarity.mjs [--quiet]
// For services, cities and blog posts it checks:
//   1. word count minimums (services 900, cities 600, posts 700)
//   2. 5-word shingle Jaccard similarity between EVERY pair inside a set; any pair > 35% fails
//   3. meta description <= 155 chars, titles unique
// Only page-specific copy is compared (templates/boilerplate are excluded on purpose).
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const quiet = process.argv.includes('--quiet');
const MAX = 0.35;
const K = 5;

const { serviceDocs } = await import(pathToFileURL(join(root, 'src/content/seo/services/index.ts')).href);
const { cityDocs } = await import(pathToFileURL(join(root, 'src/content/seo/cities/index.ts')).href);

// ---- blog posts (MDX with simple frontmatter) ----
export function parsePost(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: m[2] };
}
const blogDir = join(root, 'content/blog');
const posts = readdirSync(blogDir).filter((f) => f.endsWith('.mdx')).sort().map((f) => {
  const { meta, body } = parsePost(readFileSync(join(blogDir, f), 'utf8'));
  return { id: f.replace(/\.mdx$/, ''), title: meta.title, description: meta.description, text: body };
});

const sectionText = (s) => [s.h2, ...(s.paras ?? []), ...(s.bullets ?? []), ...(s.steps ?? []).flatMap((x) => [x.title, x.body]), ...(s.after ?? [])].join(' ');
const faqText = (f) => f.flatMap((x) => [x.q, x.a]).join(' ');

const sets = {
  services: serviceDocs.map((s) => ({ id: s.slug, title: s.title, description: s.description, text: [s.h1, s.lede, ...s.sections.map(sectionText), faqText(s.faqs)].join(' ') })),
  cities: cityDocs.map((c) => ({ id: c.slug, title: c.title, description: c.description, text: [c.h1, c.lede, c.driveNote, ...c.sections.map(sectionText), ...c.jobs.flatMap((j) => [j.job, j.why]), faqText(c.faqs)].join(' ') })),
  blog: posts,
};
const MIN = { services: 900, cities: 600, blog: 700 };

const clean = (t) => t
  .replace(/^import .*$/gm, ' ').replace(/<[^>]+>/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[#*_`>|]/g, ' ');
const tokens = (t) => clean(t).toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
const shingles = (w) => { const s = new Set(); for (let i = 0; i + K <= w.length; i++) s.add(w.slice(i, i + K).join(' ')); return s; };
const jaccard = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };

let failed = false;
const fail = (msg) => { failed = true; console.error('FAIL', msg); };

for (const [name, items] of Object.entries(sets)) {
  const prepared = items.map((it) => ({ ...it, words: tokens(it.text) }));
  prepared.forEach((it) => { it.sh = shingles(it.words); });
  const counts = prepared.map((p) => `${p.id}:${p.words.length}`);
  if (!quiet) console.log(`\n== ${name} (${prepared.length}) word counts, min ${MIN[name]}\n${counts.join('  ')}`);
  for (const p of prepared) if (p.words.length < MIN[name]) fail(`${name}/${p.id} has ${p.words.length} words (< ${MIN[name]})`);
  const pairs = [];
  for (let i = 0; i < prepared.length; i++) for (let j = i + 1; j < prepared.length; j++) {
    pairs.push({ a: prepared[i].id, b: prepared[j].id, j: jaccard(prepared[i].sh, prepared[j].sh) });
  }
  pairs.sort((x, y) => y.j - x.j);
  if (!quiet) {
    console.log(`${name}: ${pairs.length} pairs, top 5 Jaccard (${K}-word shingles):`);
    for (const p of pairs.slice(0, 5)) console.log(`  ${(p.j * 100).toFixed(2)}%  ${p.a}  <->  ${p.b}`);
  }
  for (const p of pairs) if (p.j > MAX) fail(`${name}: ${p.a} <-> ${p.b} overlap ${(p.j * 100).toFixed(1)}% > ${MAX * 100}%`);
  const mean = pairs.reduce((s, p) => s + p.j, 0) / (pairs.length || 1);
  if (pairs.length) console.log(`${name}: max ${(pairs[0].j * 100).toFixed(2)}%  mean ${(mean * 100).toFixed(2)}%  threshold ${MAX * 100}%`);
  const titles = new Map();
  for (const it of prepared) {
    if (it.description && it.description.length > 155) fail(`${name}/${it.id} description ${it.description.length} chars > 155`);
    if (!it.title || !it.description) fail(`${name}/${it.id} missing title/description`);
    if (titles.has(it.title)) fail(`${name}: duplicate title "${it.title}" (${titles.get(it.title)}, ${it.id})`);
    titles.set(it.title, it.id);
  }
}

if (failed) { console.error('\ncheck-similarity: FAILED'); process.exit(1); }
console.log('\ncheck-similarity: OK');
