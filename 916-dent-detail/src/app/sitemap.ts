import type { MetadataRoute } from 'next';
import { allCities, allServices, blogPath, cityPath, servicePath } from '@/lib/seo/content';
import { allPosts, allTags, postsByTag, tagSlug } from '@/lib/seo/blog';
import { absoluteUrl } from '@/lib/seo/url';

// Every indexable page. lastModified only where we have a real date (blog posts); inventing
// "today" for static pages would teach crawlers to ignore the field.
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths: { path: string; priority: number }[] = [
    { path: '/', priority: 1 },
    { path: '/services', priority: 0.9 },
    { path: '/areas', priority: 0.8 },
    { path: '/pricing', priority: 0.8 },
    { path: '/dealers', priority: 0.7 },
    { path: '/dealers/signup', priority: 0.5 },
    { path: '/reviews', priority: 0.5 },
    { path: '/book', priority: 0.9 },
    { path: '/blog', priority: 0.6 },
  ];
  const posts = allPosts();
  return [
    ...staticPaths.map((p) => ({ url: absoluteUrl(p.path), priority: p.priority })),
    ...allServices.map((s) => ({ url: absoluteUrl(servicePath(s.slug)), priority: 0.9 })),
    ...allCities.map((c) => ({ url: absoluteUrl(cityPath(c.slug)), priority: 0.7 })),
    ...posts.map((p) => ({ url: absoluteUrl(blogPath(p.slug)), lastModified: new Date(p.updated ?? p.date), priority: 0.5 })),
    ...allTags().filter((t) => postsByTag(tagSlug(t)).length >= 2).map((t) => ({ url: absoluteUrl(`/blog/tag/${tagSlug(t)}`), priority: 0.3 })),
  ];
}
