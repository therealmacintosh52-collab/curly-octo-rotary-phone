'use client';
// Wraps the marketing-site chrome (header, footer, CTA bar, analytics, consent banner, smooth scroll) so none of it
// renders inside /admin, which has its own phone-first shell and must not load trackers or marketing UI.
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function PublicOnly({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '';
  return path === '/admin' || path.startsWith('/admin/') ? null : <>{children}</>;
}
