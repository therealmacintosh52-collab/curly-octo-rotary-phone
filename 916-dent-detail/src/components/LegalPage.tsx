import type { ReactNode } from 'react';
import { PageIntro } from './PageIntro';

/** Shared frame for /privacy and /terms. Every legal page is a TEMPLATE until counsel signs off; the banner says so on the page itself. */
export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <PageIntro eyebrow={eyebrow} title={title} lede={`Last updated ${updated}.`} />
      <div className="wrap pb-24">
        <p role="note" className="owner-mark mb-10 block max-w-3xl rounded-xl border border-gold/40 bg-graphite p-4 text-sm !text-ivory">
          <strong className="text-gold-light">[OWNER] Template, not legal advice.</strong> This page describes how this website and our
          messaging work. It has not been reviewed by a lawyer and does not promise that we meet any specific law or carrier rule. Have
          counsel review and edit it before launch, then remove this notice.
        </p>
        <div className="max-w-3xl space-y-10 text-[0.98rem] leading-relaxed text-ivory/90 [&_a]:text-gold [&_a]:underline [&_a]:underline-offset-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:text-ivory [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </div>
    </>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-28 space-y-3">
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}
