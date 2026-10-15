'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { flushOutbox, outboxSize, subscribeOutbox } from './outbox';

const subOnline = (fn: () => void) => { window.addEventListener('online', fn); window.addEventListener('offline', fn); return () => { window.removeEventListener('online', fn); window.removeEventListener('offline', fn); }; };

type Tab = { href: string; label: string; icon: ReactNode; match: (p: string) => boolean };
const ic = (d: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

const TODAY: Tab = { href: '/admin/today', label: 'Today', icon: ic('M4 5h16v14H4zM4 10h16M9 3v4M15 3v4'), match: (p) => p.startsWith('/admin/today') || p.startsWith('/admin/jobs') };
const MORE: Tab = { href: '/admin/more', label: 'More', icon: ic('M5 12h.01M12 12h.01M19 12h.01'), match: (p) => p.startsWith('/admin/more') || /^\/admin\/(invoices|memberships|referrals|reports|settings|leads|quotes|vehicles)/.test(p) };
const STAFF_TABS: Tab[] = [
  { href: '/admin', label: 'Home', icon: ic('M4 11l8-7 8 7v9h-5v-6H9v6H4z'), match: (p) => p === '/admin' },
  { href: '/admin/pipeline', label: 'Pipeline', icon: ic('M4 6h16M4 12h10M4 18h6'), match: (p) => p.startsWith('/admin/pipeline') },
  { href: '/admin/schedule', label: 'Schedule', icon: ic('M4 5h16v14H4zM4 10h16M8 14h2M14 14h2'), match: (p) => p.startsWith('/admin/schedule') || p.startsWith('/admin/bookings') },
  { href: '/admin/customers', label: 'Customers', icon: ic('M16 19v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1M10 10a3 3 0 100-6 3 3 0 000 6zM20 19v-1a3 3 0 00-2-2.8M16 4.2a3 3 0 010 5.6'), match: (p) => p.startsWith('/admin/customers') },
  MORE,
];
const TECH_TABS: Tab[] = [TODAY, MORE];

export function AdminShell({ role, name, demo, children }: { role: 'owner' | 'admin' | 'tech'; name: string; demo: boolean; children: ReactNode }) {
  const path = usePathname() ?? '';
  const tabs = role === 'tech' ? TECH_TABS : STAFF_TABS;
  const online = useSyncExternalStore(subOnline, () => navigator.onLine, () => true);
  const queued = useSyncExternalStore(subscribeOutbox, outboxSize, () => 0);

  useEffect(() => {
    const up = () => { void flushOutbox(); };
    window.addEventListener('online', up);
    void flushOutbox();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin' }).catch(() => undefined);
    return () => window.removeEventListener('online', up);
  }, []);

  return (
    <>
      <a href="#admin-main" className="adm-skip">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-line bg-onyx/92 backdrop-blur-md" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between gap-3 px-4">
          <Link href={role === 'tech' ? '/admin/today' : '/admin'} className="flex min-h-11 items-center gap-2" aria-label="916 Admin home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/d-mark-80.webp" width={28} height={28} alt="" className="h-7 w-7" />
            <span className="font-display text-[0.7rem] tracking-[0.14em]">916 <span className="text-gold">ADMIN</span></span>
          </Link>
          <div className="flex items-center gap-2 text-xs">
            {role !== 'tech' && <Link href="/admin/today" className="adm-badge adm-badge-gold min-h-8 px-3">Today</Link>}
            <span className="hidden max-w-[10rem] truncate text-[#a9acb3] sm:inline">{name}</span>
          </div>
        </div>
        {(!online || queued > 0) && (
          <p role="status" className={`px-4 py-1.5 text-center text-xs font-semibold ${online ? 'bg-[#101a26] text-[#a9cbf2]' : 'bg-[#231212] text-[#f6b4b4]'}`}>
            {online ? `Syncing ${queued} saved change${queued === 1 ? '' : 's'}…` : `Offline: ${queued ? `${queued} change${queued === 1 ? '' : 's'} saved on this phone and will sync` : 'changes are saved on this phone and will sync'} when you are back online.`}
          </p>
        )}
        {demo && <p role="note" className="border-t border-[#6d5622] bg-[#1f1a0e] px-4 py-1.5 text-center text-xs font-semibold text-gold-light">DEMO MODE: seeded data, nothing real is sent or charged.</p>}
      </header>
      <div id="admin-main" tabIndex={-1} className="adm-main mx-auto max-w-3xl outline-none">{children}</div>
      <nav aria-label="Admin" className="adm-tabbar">
        <ul className="mx-auto flex max-w-xl items-stretch px-2">
          {tabs.map((t) => (
            <li key={t.href} className="flex flex-1">
              <Link href={t.href} className="adm-tab w-full" aria-current={t.match(path) ? 'page' : undefined}>
                {t.icon}{t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
