'use client';
import { useEffect } from 'react';
import { loadMotion, motionMode, onFirstIntent } from '@/lib/motion';

/** Boots Lenis (+ GSAP ticker) on first user intent, only in full-motion mode. */
export function SmoothScroll() {
  useEffect(() => {
    if (motionMode() !== 'full') return;
    return onFirstIntent(() => void loadMotion());
  }, []);
  return null;
}
