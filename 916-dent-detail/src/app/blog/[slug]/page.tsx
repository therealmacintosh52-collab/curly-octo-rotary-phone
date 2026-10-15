import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { CtaBand, LinkCards, SeoHero } from '@/components/seo/PageParts';
import { mdxComponents } from '@/components/seo/mdx';
import { allPosts, getPost, tagSlug } from '@/lib/seo/blog';
import { blogPath, cityPath, getCity, getService, servicePath } from '@/lib/seo/content';
import { pageMetadata } from '@/lib/seo/metadata';
import { articleSchema } from '@/lib/seo/schema';

export const dynamicParams = false;

export function generateStaticParams() {
  return allPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  const m = post.meta;
  return pageMetadata({
    title: `${m.title} | 916 Dent & Detail`,
    description: m.description,
    path: blogPath(m.slug),
    type: 'article',
    publishedTime: m.date,
    modifiedTime: m.updated ?? m.date,
    tags: m.tags,
    defaultImage: false,
  });
}

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export default async function PostRoute({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const m = post.meta;
  const services = m.services.map((s) => getService(s)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const cities = m.cities.map((c) => getCity(c)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const more = allPosts().filter((p) => p.slug !== m.slug).sort((a, b) => b.tags.filter((t) => m.tags.includes(t)).length - a.tags.filter((t) => m.tags.includes(t)).length).slice(0, 3);

  return (
    <>
      <JsonLdScript data={articleSchema({ slug: m.slug, title: m.title, description: m.description, date: m.date, updated: m.updated })} />
      <Breadcrumbs items={[{ name: 'Blog', path: '/blog' }, { name: m.title, path: blogPath(m.slug) }]} />
      <SeoHero eyebrow="Blog" title={m.title} lede={m.description} />
      <div className="wrap">
        <p className="-mt-4 mb-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-steel">
          <span>By 916 Dent &amp; Detail</span>
          <span aria-hidden="true">·</span>
          <time dateTime={m.date}>{fmt(m.date)}</time>
          <span aria-hidden="true">·</span>
          <span>{m.minutes} min read</span>
          {m.tags.map((t) => (
            <Link key={t} href={`/blog/tag/${tagSlug(t)}`} className="rounded-full border border-line px-3 py-0.5 text-xs hover:border-gold-deep hover:text-gold-light">{t}</Link>
          ))}
        </p>
        <article className="max-w-3xl pb-6">
          <MDXRemote source={post.body} components={mdxComponents} />
        </article>
      </div>
      {services.length > 0 && <LinkCards id="svc-t" heading="Related services" cols={3} items={services.map((s) => ({ href: servicePath(s.slug), title: s.plain, text: s.term }))} />}
      {cities.length > 0 && <LinkCards id="city-t" heading="Where we work" cols={4} items={cities.map((c) => ({ href: cityPath(c.slug), title: c.name }))} />}
      <LinkCards id="more-t" heading="More from the blog" cols={3} items={more.map((p) => ({ href: blogPath(p.slug), title: p.title, text: p.description }))} />
      <CtaBand where={`blog_${m.slug}`} />
    </>
  );
}
