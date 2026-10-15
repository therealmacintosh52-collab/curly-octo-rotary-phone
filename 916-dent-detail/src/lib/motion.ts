'use client';
// Lazy-loaded motion stack: GSAP + ScrollTrigger + Lenis on ONE requestAnimationFrame loop
// (gsap.ticker drives lenis.raf; lenis 'scroll' → ScrollTrigger.update).
// Nothing here runs for prefers-reduced-motion or low-end devices (see motionMode()).

import type { gsap as GSAP } from 'gsap';
import type { ScrollTrigger as ST } from 'gsap/ScrollTrigger';
import type Lenis from 'lenis';

export type MotionStack = { gsap: typeof GSAP; ScrollTrigger: typeof ST; lenis: Lenis | null };

let stack: Promise<MotionStack> | null = null;

/** 'full' = scrub + smooth scroll + section motion; 'static' = no scroll-linked motion. */
export function motionMode(): 'full' | 'static' {
  if (typeof document === 'undefined') return 'static';
  return document.documentElement.classList.contains('scrub') ? 'full' : 'static';
}

export function loadMotion(): Promise<MotionStack> {
  if (stack) return stack;
  stack = (async () => {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    gsap.registerPlugin(ScrollTrigger);
    let lenis: Lenis | null = null;
    if (motionMode() === 'full') {
      const { default: LenisCtor } = await import('lenis');
      lenis = new LenisCtor({ autoRaf: false, anchors: true, lerp: 0.12, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis?.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    return { gsap, ScrollTrigger, lenis };
  })();
  return stack;
}

/**
 * Run `cb` once, on the first sign the user is engaging (scroll, wheel, touch, pointer, key).
 * Motion JS and the bulk of the hero frames are deferred to this moment so they never compete
 * with first paint / hydration (keeps TBT low). Returns a disposer.
 */
const INTENT_EVENTS = ['scroll', 'wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
export function onFirstIntent(cb: () => void): () => void {
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    off();
    cb();
  };
  const off = () => INTENT_EVENTS.forEach((e) => window.removeEventListener(e, fire));
  INTENT_EVENTS.forEach((e) => window.addEventListener(e, fire, { passive: true }));
  if (window.scrollY > 0) queueMicrotask(fire); // restored scroll position
  return off;
}
