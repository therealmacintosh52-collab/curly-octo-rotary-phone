'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { nav } from '@/config/site';
import { Logo } from './Logo';
import { track } from '@/lib/analytics';

export function Header() {
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const [solid, setSolid] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Escape closes the menu and puts focus back on the button that opened it (focus would otherwise be lost on a hidden link)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); menuBtn.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid || open ? 'bg-onyx/85 backdrop-blur-md' : 'bg-gradient-to-b from-onyx/80 to-transparent'
      }`}
    >
      <div className="wrap flex h-16 items-center justify-between lg:h-20">
        <Logo />
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                {item.href === '/book' ? (
                  <Link href={item.href} className="btn btn-gold ml-3 !min-h-10 !px-5 !py-2 text-sm" onClick={() => track('cta_click', { where: 'header', label: 'Book' })}>
                    {item.label}
                  </Link>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={pathname === item.href ? 'page' : undefined}
                    className="rounded-full px-4 py-2 text-sm text-ivory/85 transition-colors hover:text-gold-light aria-[current=page]:text-gold"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <button
          ref={menuBtn}
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ivory/20 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
            {open ? <path d="M4 4l12 12M16 4L4 16" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
          </svg>
        </button>
      </div>
      <nav id="mobile-nav" aria-label="Main mobile" hidden={!open} className="border-t border-line bg-onyx/95 lg:hidden">
        <ul className="wrap flex flex-col py-3">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === item.href ? 'page' : undefined}
                className="block rounded-lg px-2 py-3 font-display text-sm tracking-[0.14em] text-ivory aria-[current=page]:text-gold"
              >
                {item.label.toUpperCase()}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
