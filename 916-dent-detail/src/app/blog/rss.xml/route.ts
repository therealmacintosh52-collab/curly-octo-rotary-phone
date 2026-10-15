import { allPosts } from '@/lib/seo/blog';
import { blogPath } from '@/lib/seo/content';
import { site } from '@/config/site';
import { absoluteUrl } from '@/lib/seo/url';

export const dynamic = 'force-static';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function GET() {
  const posts = allPosts();
  const items = posts
    .map((p) => {
      const url = absoluteUrl(blogPath(p.slug));
      return `<item><title>${esc(p.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(`${p.date}T12:00:00Z`).toUTCString()}</pubDate><description>${esc(p.description)}</description>${p.tags.map((t) => `<category>${esc(t)}</category>`).join('')}</item>`;
    })
    .join('');
  const last = posts[0] ? new Date(`${posts[0].date}T12:00:00Z`).toUTCString() : new Date(0).toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(site.name)} Blog</title><link>${absoluteUrl('/blog')}</link><atom:link href="${absoluteUrl('/blog/rss.xml')}" rel="self" type="application/rss+xml"/><description>${esc('Dent repair and detailing answers for Sacramento and Central Valley drivers.')}</description><language>en-us</language><lastBuildDate>${last}</lastBuildDate>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
