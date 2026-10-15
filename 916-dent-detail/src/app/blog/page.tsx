import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { CtaBand, SeoHero } from '@/components/seo/PageParts';
import { allPosts, allTags, tagSlug } from '@/lib/seo/blog';
import { blogPath } from '@/lib/seo/content';
import { pageMetadata } from '@/lib/seo/metadata';
import { itemListSchema } from '@/lib/seo/schema';

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Dent Repair & Car Care Blog Sacramento | 916 Dent & Detail',
    description: 'Straight answers on dent repair cost, hail, ceramic coating, tree sap and mobile detailing for Sacramento and Central Valley drivers.',
    path: '/blog',
  }),
  alternates: { canonical: '/blog', types: { 'application/rss+xml': '/blog/rss.xml' } },
};

export default function BlogIndex() {
  const posts = allPosts();
  return (
    <>
      <JsonLdScript data={itemListSchema('Blog', posts.map((p) => ({ name: p.title, path: blogPath(p.slug) })))} />
      <Breadcrumbs items={[{ name: 'Blog', path: '/blog' }]} />
      <SeoHero eyebrow="Blog" title="Straight answers for Sacramento drivers" lede="Dent repair, detailing and paint care in Valley heat. Honest about what works, what does not and what it depends on." />
      <nav aria-label="Blog topics" className="wrap">
        <ul className="flex flex-wrap gap-2">
          {allTags().map((t) => (
            <li key={t}><Link href={`/blog/tag/${tagSlug(t)}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-steel hover:border-gold-deep hover:text-gold-light">{t}</Link></li>
          ))}
          <li><a href="/blog/rss.xml" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-steel hover:border-gold-deep hover:text-gold-light">RSS feed</a></li>
        </ul>
      </nav>
      <ul className="wrap mt-8 grid gap-4 pb-6 md:grid-cols-2">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link href={blogPath(p.slug)} className="card group flex h-full flex-col p-6 transition-colors hover:border-gold-deep">
              <span className="text-xs uppercase tracking-[0.14em] text-steel">{p.tags.slice(0, 2).join(' · ')} · {p.minutes} min read</span>
              <h2 className="mt-3 font-sans text-lg font-semibold text-ivory group-hover:text-gold-light">{p.title}</h2>
              <span className="mt-2 flex-1 text-[0.95rem] text-ivory/75">{p.description}</span>
              <span aria-hidden="true" className="mt-4 text-sm text-gold">Read →</span>
            </Link>
          </li>
        ))}
      </ul>
      <CtaBand where="blog_index" />
    </>
  );
}
