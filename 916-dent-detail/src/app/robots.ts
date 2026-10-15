import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/booking/', '/invoice/', '/dealers/dashboard', '/dealers/signin'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
