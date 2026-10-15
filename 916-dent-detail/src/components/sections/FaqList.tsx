'use client';
import { useId, useState } from 'react';

/* Accessible accordion: real <button>s with aria-expanded/aria-controls; panels are labelled regions. */
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((it, i) => {
        const isOpen = open === i;
        const btn = `${base}-b${i}`;
        const panel = `${base}-p${i}`;
        return (
          <div key={it.q} data-m>
            <h3 className="font-sans text-base font-semibold">
              <button
                id={btn}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panel}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-6 py-5 text-left text-ivory transition-colors hover:text-gold-light"
              >
                {it.q}
                <span aria-hidden="true" className={`relative h-4 w-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>
                  <span className="absolute left-0 top-1/2 h-px w-4 bg-gold" />
                  <span className="absolute left-1/2 top-0 h-4 w-px bg-gold" />
                </span>
              </button>
            </h3>
            <div id={panel} role="region" aria-labelledby={btn} hidden={!isOpen} className="pb-6 pr-10 text-steel">
              {it.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
