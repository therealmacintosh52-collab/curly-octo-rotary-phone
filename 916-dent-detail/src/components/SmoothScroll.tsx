'use client';
import { useEffect } from 'react';
import { loadMotion, motionMode } from '@/lib/motion';

/** Boots Lenis (+ GSAP ticker) after hydration, only in full-motion mode. */
export function SmoothScroll() {
  useEffect(() => {
    if (motionMode() !== 'full') return;
    const start = () => void loadMotion();
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1500 });
    else setTimeout(start, 200);
  }, []);
  return null;
}
