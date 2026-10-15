// Blog loader: MDX files in /content/blog with a small frontmatter block (no YAML dependency).
//   ---
//   title: ...
//   description: ... (<=155 chars)
//   date: 2026-10-15
//   tags: cost, dent repair
//   services: paintless-dent-repair, pricing-note   (service slugs to link)
//   cities: sacramento
//   ---
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'content', 'blog');

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags: string[];
  services: string[];
  cities: string[];
  minutes: number;
};

const list = (v: string | undefined) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);

function parse(slug: string, raw: string): { meta: PostMeta; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`content/blog/${slug}.mdx is missing frontmatter`);
  const fm: Record<string, string> = {};
  for (const line of (m[1] ?? '').split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  const body = m[2] ?? '';
  for (const k of ['title', 'description', 'date']) if (!fm[k]) throw new Error(`content/blog/${slug}.mdx frontmatter missing "${k}"`);
  const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return {
    body,
    meta: {
      slug,
      title: fm.title!,
      description: fm.description!,
      date: fm.date!,
      updated: fm.updated || undefined,
      tags: list(fm.tags),
      services: list(fm.services),
      cities: list(fm.cities),
      minutes: Math.max(1, Math.round(words / 220)),
    },
  };
}

let cache: { meta: PostMeta; body: string }[] | null = null;
function load() {
  if (cache && process.env.NODE_ENV === 'production') return cache;
  cache = readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => parse(f.replace(/\.mdx$/, ''), readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => (a.meta.date < b.meta.date ? 1 : a.meta.date > b.meta.date ? -1 : a.meta.slug.localeCompare(b.meta.slug)));
  return cache;
}

export const allPosts = (): PostMeta[] => load().map((p) => p.meta);
export const getPost = (slug: string) => load().find((p) => p.meta.slug === slug) ?? null;
export const allTags = (): string[] => [...new Set(allPosts().flatMap((p) => p.tags))].sort();
export const tagSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const postsByTag = (slug: string) => allPosts().filter((p) => p.tags.some((t) => tagSlug(t) === slug));
