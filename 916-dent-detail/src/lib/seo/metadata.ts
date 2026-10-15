import type { Metadata } from 'next';
import { absoluteUrl } from './url';
import { site } from '@/config/site';

type Opts = {
  /** Full <title> string (already leads with service + place, includes the brand). */
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
  /** false = a route-level opengraph-image file supplies the image. */
  defaultImage?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
};

/** Canonical + Open Graph + Twitter for one page. `title.absolute` bypasses the layout's "%s | brand" template. */
export function pageMetadata(o: Opts): Metadata {
  const url = absoluteUrl(o.path);
  const images = o.defaultImage === false ? undefined : [{ url: '/og-image.jpg', width: 1200, height: 630, alt: `${site.name} gold logo on black` }];
  return {
    title: { absolute: o.title },
    description: o.description,
    alternates: { canonical: o.path },
    openGraph: {
      type: o.type ?? 'website',
      url,
      siteName: site.name,
      title: o.title,
      description: o.description,
      locale: 'en_US',
      ...(images ? { images } : {}),
      ...(o.type === 'article' ? { publishedTime: o.publishedTime, modifiedTime: o.modifiedTime ?? o.publishedTime, tags: o.tags, authors: [site.name] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: o.title,
      description: o.description,
      ...(images ? { images: ['/og-image.jpg'] } : {}),
    },
  };
}
