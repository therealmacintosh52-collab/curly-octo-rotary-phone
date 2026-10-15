import Link from 'next/link';
import { JsonLdScript } from './JsonLdScript';
import { breadcrumbSchema, type Crumb } from '@/lib/seo/schema';

/** Visible breadcrumb trail + BreadcrumbList JSON-LD. Last item is the current page (not a link). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ name: 'Home', path: '/' }, ...items];
  return (
    <>
      <nav aria-label="Breadcrumb" className="wrap pt-28 lg:pt-36">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-steel">
          {all.map((c, i) => {
            const last = i === all.length - 1;
            return (
              <li key={c.path} className="flex items-center gap-2">
                {last ? (
                  <span aria-current="page" className="text-ivory/80">{c.name}</span>
                ) : (
                  <Link href={c.path} className="underline-offset-4 hover:text-gold-light hover:underline">{c.name}</Link>
                )}
                {!last && <span aria-hidden="true" className="text-line">/</span>}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLdScript data={breadcrumbSchema(all)} />
    </>
  );
}
