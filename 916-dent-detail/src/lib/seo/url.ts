import { site } from '@/config/site';

/** Origin without trailing slash. Comes from NEXT_PUBLIC_SITE_URL ([OWNER] production domain). */
export const siteOrigin = site.url.replace(/\/+$/, '');

export function absoluteUrl(path = '/'): string {
  return `${siteOrigin}${path.startsWith('/') ? path : `/${path}`}`;
}
