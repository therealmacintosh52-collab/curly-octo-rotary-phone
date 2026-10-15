import { jsonLdString } from '@/lib/seo/schema';

/** Renders one or more JSON-LD objects as <script type="application/ld+json">. Server component. */
export function JsonLdScript({ data }: { data: unknown | unknown[] }) {
  const list = Array.isArray(data) ? data : [data];
  return (
    <>
      {list.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(d) }} />
      ))}
    </>
  );
}
