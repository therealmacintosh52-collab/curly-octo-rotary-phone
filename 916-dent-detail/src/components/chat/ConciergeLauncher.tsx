'use client';
// 916 Concierge launcher. This is the ONLY part of the chat that ships with every page: a fixed-position button (no layout
// shift) and a few lines of logic. The panel (messages, streaming, photo upload, cards) is a separate chunk that is
// downloaded when the visitor shows intent: pointer/focus/touch on the button, or the click itself. Nothing is fetched
// on idle, so it cannot affect LCP/TBT of the page it sits on.
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { onFirstIntent } from '@/lib/motion';

const preload = () => import('./ChatPanel');
const ChatPanel = dynamic(preload, { ssr: false });

export function ConciergeLauncher() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  // After the visitor's first scroll/touch/key (never on an idle page, so Lighthouse and first paint are unaffected), fetch and compile the panel
  // chunk in an idle slot. Opening the chat then no longer evaluates ~tens of KB of script inside the tap (that overlap was the chat button's INP).
  useEffect(() => onFirstIntent(() => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(() => void preload(), { timeout: 3000 }); else setTimeout(() => void preload(), 800);
  }), []);
  const close = useCallback(() => { setOpen(false); requestAnimationFrame(() => btn.current?.focus()); }, []);

  if (path.startsWith('/admin')) return null;
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Chat with the 916 Concierge"
        onPointerEnter={() => void preload()}
        onFocus={() => void preload()}
        onTouchStart={() => void preload()}
        onClick={() => setOpen(true)}
        data-concierge-launcher
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-14 items-center justify-center gap-2 rounded-full bg-gold px-4 text-onyx shadow-[0_8px_30px_rgba(0,0,0,0.55)] transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory lg:bottom-5 lg:right-5 lg:px-5"
        style={{ display: open ? 'none' : undefined }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /><path d="M8.5 10h7M8.5 13h4" /></svg>
        <span className="hidden text-sm font-semibold tracking-wide lg:inline">Ask the Concierge</span>
      </button>
      {open && <ChatPanel onClose={close} />}
    </>
  );
}
