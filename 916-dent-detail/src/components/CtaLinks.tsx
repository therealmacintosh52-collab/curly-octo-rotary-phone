'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { smsHref, telHref } from '@/config/site';
import { track } from '@/lib/analytics';

type Common = { where: string; className?: string; children: ReactNode };

export function CallLink({ where, className, children }: Common) {
  // call/text clicks are tracked by the delegated listener in components/seo/AnalyticsRoot (reads data-track-where)
  return <a href={telHref} className={className} data-track-where={where}>{children}</a>;
}
export function TextLink({ where, className, children }: Common) {
  return <a href={smsHref} className={className} data-track-where={where}>{children}</a>;
}
export function QuoteLink({ where, className, children }: Common) {
  return (
    <Link href="/book#photo" className={className} onClick={() => track('quote_requested', { where, step: 'cta' })}>
      {children}
    </Link>
  );
}
export function BookLink({ where, className, children }: Common) {
  return (
    <Link href="/book" className={className} onClick={() => track('booking_started', { where, step: 'cta' })}>
      {children}
    </Link>
  );
}
