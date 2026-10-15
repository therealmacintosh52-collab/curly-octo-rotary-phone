// Server-safe presentational primitives for admin pages. No hooks, no client JS.
import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({ title, eyebrow, actions, back }: { title: string; eyebrow?: string; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="px-4 pt-5 pb-3">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-steel hover:text-gold-light">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          {back.label}
        </Link>
      )}
      {eyebrow && <p className="adm-eyebrow mb-1">{eyebrow}</p>}
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-[1.25rem] leading-tight text-ivory">{title}</h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Section({ title, action, children, id }: { title?: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="px-4 py-2" aria-labelledby={id ? `${id}-h` : undefined}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-3">
          {title && <h2 id={id ? `${id}-h` : undefined} className="font-sans text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-[#b9bcc3]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`adm-card ${className}`}>{children}</div>;

export function Row({ href, title, sub, right, leading, children }: { href?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; leading?: ReactNode; children?: ReactNode }) {
  const inner = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ivory">{title}</span>
        {sub && <span className="block truncate text-sm text-[#a9acb3]">{sub}</span>}
        {children}
      </span>
      {right && <span className="shrink-0 text-right text-sm">{right}</span>}
      {href && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c8f96" strokeWidth="2" aria-hidden="true" className="shrink-0"><path d="M9 6l6 6-6 6" /></svg>}
    </>
  );
  return href ? <Link href={href} className="adm-row">{inner}</Link> : <div className="adm-row">{inner}</div>;
}

type Tone = 'neutral' | 'gold' | 'green' | 'red' | 'blue';
export const Badge = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) => (
  <span className={`adm-badge ${tone === 'neutral' ? '' : `adm-badge-${tone}`}`}>{children}</span>
);

export const Empty = ({ children }: { children: ReactNode }) => (
  <div className="adm-card px-4 py-8 text-center text-sm text-[#a9acb3]">{children}</div>
);

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="adm-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#a9acb3]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ivory">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#a9acb3]">{sub}</p>}
    </div>
  );
}

export function Field({ label, htmlFor, help, children }: { label: string; htmlFor: string; help?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="adm-label">{label}</label>
      {children}
      {help && <p className="adm-help" id={`${htmlFor}-help`}>{help}</p>}
    </div>
  );
}

export const DemoBanner = () => (
  <p role="note" className="border-b border-[#6d5622] bg-[#1f1a0e] px-4 py-2 text-center text-xs font-semibold text-gold-light">
    DEMO MODE: seeded data, nothing is sent to real customers or processors.
  </p>
);

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[#a9acb3]">{k}</dt>
          <dd className="min-w-0 break-words text-right text-ivory">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
