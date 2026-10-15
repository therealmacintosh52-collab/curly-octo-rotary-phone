import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { formatMoney, serviceFromPrice } from '@/config/pricing';

/** Markdown links: internal -> next/link, external -> new-tab-safe anchor. */
function A({ href = '', children, ...rest }: ComponentProps<'a'>) {
  const cls = 'text-gold underline underline-offset-4 hover:text-gold-light';
  if (href.startsWith('/') || href.startsWith('#')) return <Link href={href} className={cls}>{children}</Link>;
  return <a href={href} className={cls} target="_blank" rel="noopener noreferrer" {...rest}>{children}</a>;
}

/** <FromPrice service="pdr" /> renders the config price when set, otherwise points at the pricing page. Never a hardcoded number. */
function FromPrice({ service }: { service: string }) {
  const v = serviceFromPrice[service] ?? null;
  const p = formatMoney(v);
  if (p.placeholder) return <Link href="/pricing" className="text-gold underline underline-offset-4 hover:text-gold-light">see our pricing page</Link>;
  return <strong>from {p.text}</strong>;
}

function Callout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <aside className="card my-8 border-gold-deep/50 p-6">
      {title && <p className="font-semibold text-ivory">{title}</p>}
      <div className={title ? 'mt-2 text-ivory/80' : 'text-ivory/80'}>{children}</div>
    </aside>
  );
}

export const mdxComponents = {
  a: A,
  h2: (p: ComponentProps<'h2'>) => <h2 className="mb-1 mt-12 text-[clamp(1.25rem,2.4vw,1.7rem)]" {...p} />,
  h3: (p: ComponentProps<'h3'>) => <h3 className="mt-8 font-sans text-lg font-semibold text-ivory" {...p} />,
  p: (p: ComponentProps<'p'>) => <p className="mt-5 text-[1.02rem] leading-[1.75] text-ivory/80" {...p} />,
  ul: (p: ComponentProps<'ul'>) => <ul className="mt-5 list-disc space-y-2 pl-6 text-ivory/80 marker:text-gold" {...p} />,
  ol: (p: ComponentProps<'ol'>) => <ol className="mt-5 list-decimal space-y-2 pl-6 text-ivory/80 marker:text-gold" {...p} />,
  li: (p: ComponentProps<'li'>) => <li className="pl-1 leading-[1.7]" {...p} />,
  strong: (p: ComponentProps<'strong'>) => <strong className="font-semibold text-ivory" {...p} />,
  blockquote: (p: ComponentProps<'blockquote'>) => <blockquote className="my-8 border-l-2 border-gold pl-5 text-ivory/80" {...p} />,
  hr: () => <hr className="my-10 border-line" />,
  table: (p: ComponentProps<'table'>) => <div className="my-8 overflow-x-auto" role="region" aria-label="Table" tabIndex={0}><table className="w-full min-w-[28rem] text-left text-sm" {...p} /></div>,
  th: (p: ComponentProps<'th'>) => <th className="border-b border-line p-3 font-semibold text-ivory" {...p} />,
  td: (p: ComponentProps<'td'>) => <td className="border-b border-line/60 p-3 text-ivory/80" {...p} />,
  FromPrice,
  Callout,
};
