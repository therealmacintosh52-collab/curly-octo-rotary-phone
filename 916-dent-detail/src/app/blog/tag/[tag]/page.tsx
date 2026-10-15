import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { CtaBand, SeoHero } from '@/components/seo/PageParts';
import { allTags, postsByTag, tagSlug } from '@/lib/seo/blog';
import { blogPath } from '@/lib/seo/content';
import { pageMetadata } from '@/lib/seo/metadata';

export const dynamicParams = false;

export function generateStaticParams() {
  return allTags().map((t) => ({ tag: tagSlug(t) }));
}

const tagName = (slug: string) => allTags().find((t) => tagSlug(t) === slug);

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const slug = (await params).tag;
  const name = tagName(slug);
  if (!name) return {};
  // Tags with a single article are thin pages: keep them crawlable but out of the index (and the sitemap).
  const thin = postsByTag(slug).length < 2;
  return {
    ...pageMetadata({
      title: `${name[0]?.toUpperCase()}${name.slice(1)} Articles Sacramento | 916 Dent & Detail`,
      description: `Articles tagged ${name}: honest answers on dent repair and detailing for Sacramento and Central Valley drivers.`,
      path: `/blog/tag/${slug}`,
    }),
    ...(thin ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function TagRoute({ params }: { params: Promise<{ tag: string }> }) {
  const slug = (await params).tag;
  const name = tagName(slug);
  if (!name) notFound();
  const posts = postsByTag(slug);
  return (
    <>
      <Breadcrumbs items={[{ name: 'Blog', path: '/blog' }, { name, path: `/blog/tag/${slug}` }]} />
      <SeoHero eyebrow="Blog topic" title={`Articles about ${name}`} lede="Everything we have written on this topic." />
      <ul className="wrap grid gap-4 pb-6 md:grid-cols-2">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link href={blogPath(p.slug)} className="card group flex h-full flex-col p-6 transition-colors hover:border-gold-deep">
              <h2 className="font-sans text-lg font-semibold text-ivory group-hover:text-gold-light">{p.title}</h2>
              <span className="mt-2 text-[0.95rem] text-ivory/75">{p.description}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="wrap pb-4 text-sm"><Link href="/blog" className="text-gold underline underline-offset-4 hover:text-gold-light">All articles</Link></p>
      <CtaBand where={`blog_tag_${slug}`} />
    </>
  );
}
