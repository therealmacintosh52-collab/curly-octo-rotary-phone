'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { loadMotion, motionMode, onFirstIntent } from '@/lib/motion';

/** Form and account pages: smooth-scroll hijacking adds nothing there, keeps a per-frame ticker + root class toggles running, and fights focus handling. */
const FORM_PAGES = /^\/(book|booking|invoice|dealers\/(dashboard|signup|signin))(\/|$)/;

/** Boots Lenis (+ GSAP ticker) on first user intent, only in full-motion mode and only on marketing pages. */
export function SmoothScroll() {
  const path = usePathname() ?? '';
  useEffect(() => {
    if (motionMode() !== 'full' || FORM_PAGES.test(path)) return;
    return onFirstIntent(() => void loadMotion());
  }, [path]);
  return null;
}
