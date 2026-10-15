import type { ReactNode } from 'react';

export function PageIntro({ eyebrow, title, lede, children }: { eyebrow: string; title: ReactNode; lede?: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden pb-14 pt-32 lg:pb-20 lg:pt-44">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(201,162,74,0.13),transparent_70%)]" />
      <div className="wrap relative">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-5 max-w-4xl text-[clamp(1.8rem,4.6vw,3.4rem)]">{title}</h1>
        {lede && <p className="lede mt-6">{lede}</p>}
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}
