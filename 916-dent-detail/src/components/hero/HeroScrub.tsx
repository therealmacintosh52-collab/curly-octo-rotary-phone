'use client';
import { useEffect, useRef } from 'react';
import { frameSrc, heroMedia } from '@/generated/media';
import { loadMotion, motionMode } from '@/lib/motion';

const N = heroMedia.frameCount;
const PRELOAD = 10;
const CONCURRENCY = 4;

type Ric = (cb: () => void, opts?: { timeout: number }) => number;
const idle = (cb: () => void, timeout = 1200) => {
  const ric = (window as unknown as { requestIdleCallback?: Ric }).requestIdleCallback;
  if (ric) ric(cb, { timeout });
  else setTimeout(cb, 60);
};

/** Coarse-to-fine order (every 8th, then 4th, 2nd, rest) so a fast scroll always has a near frame. */
function coarseOrder(n: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const step of [8, 4, 2, 1]) for (let i = 0; i < n; i += step) if (!seen.has(i)) { seen.add(i); out.push(i); }
  if (!seen.has(n - 1)) out.push(n - 1);
  return out;
}

export function HeroScrub() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const track = ref.current?.closest<HTMLElement>('[data-hero-track]');
    if (!track) return;
    const media = track.querySelector<HTMLElement>('[data-hero-media]');
    const canvas = track.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
    if (!media || !canvas) return;

    // ---------- static mode (reduced motion handled by <picture>; low-end / save-data here) ----------
    if (motionMode() !== 'full') {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) return; // <picture> already shows the static (final) frame
      const desk = window.matchMedia('(min-width: 1024px)').matches;
      const s = desk ? heroMedia.static.d : heroMedia.static.m;
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.className = 'absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700';
      img.src = s.webp;
      img.onload = () => {
        media.insertBefore(img, canvas);
        requestAnimationFrame(() => (img.style.opacity = '1'));
      };
      return () => img.remove();
    }

    // ---------- scrub mode ----------
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const mq = window.matchMedia('(min-width: 1024px)');
    let set: { dir: string } = mq.matches ? heroMedia.desktop : heroMedia.mobile;
    let frames: (HTMLImageElement | undefined)[] = new Array(N);
    let requested = new Set<number>();
    let inflight = 0;
    let current = 0;
    let drawn = -1;
    let restUnlocked = false;
    const order = coarseOrder(N);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; drawn = -1; draw(); }
    };

    const nearestLoaded = (i: number) => {
      for (let d = 0; d < N; d++) {
        if (frames[i - d]) return i - d;
        if (frames[i + d]) return i + d;
      }
      return -1;
    };

    const draw = () => {
      const j = nearestLoaded(current);
      if (j < 0 || j === drawn || !ctx) return;
      const img = frames[j]!;
      const cw = canvas.width, ch = canvas.height;
      const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight); // object-fit: cover
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      if (drawn < 0) canvas.style.opacity = '1';
      drawn = j;
    };

    const nextToLoad = (): number | undefined => {
      // 1) first PRELOAD frames  2) frames around the current position  3) coarse-to-fine sweep
      for (let i = 0; i < PRELOAD; i++) if (!requested.has(i)) return i;
      if (!restUnlocked) return undefined;
      for (let d = 1; d <= 12; d++) {
        for (const i of [current + d, current - d]) if (i >= 0 && i < N && !requested.has(i)) return i;
      }
      return order.find((i) => !requested.has(i));
    };

    const pump = () => {
      while (!disposed && inflight < CONCURRENCY) {
        const i = nextToLoad();
        if (i === undefined) return;
        requested.add(i);
        inflight++;
        const img = new Image();
        img.decoding = 'async';
        (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = i < PRELOAD ? 'auto' : 'low';
        const mySet = set;
        img.src = frameSrc(mySet.dir, i);
        img
          .decode()
          .then(() => {
            if (disposed || mySet !== set) return;
            frames[i] = img;
            if (Math.abs(i - current) <= Math.abs(nearestLoaded(current) - current)) { drawn = -1; draw(); }
          })
          .catch(() => requested.delete(i))
          .finally(() => { inflight--; if (!disposed) idle(pump, 400); });
      }
    };

    const unlockRest = () => {
      if (restUnlocked) return;
      restUnlocked = true;
      pump();
    };
    // Rest of the frames: on first scroll intent, or a few seconds after load (LCP stays untouched).
    const intent = () => unlockRest();
    for (const ev of ['wheel', 'touchstart', 'keydown', 'scroll', 'pointerdown'] as const) {
      window.addEventListener(ev, intent, { passive: true, once: true });
      cleanups.push(() => window.removeEventListener(ev, intent));
    }
    const afterLoad = () => {
      idle(pump);
      const t = window.setTimeout(unlockRest, 3500);
      cleanups.push(() => clearTimeout(t));
    };
    if (document.readyState === 'complete') afterLoad();
    else { window.addEventListener('load', afterLoad, { once: true }); cleanups.push(() => window.removeEventListener('load', afterLoad)); }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    cleanups.push(() => ro.disconnect());

    const onBreakpoint = () => {
      set = mq.matches ? heroMedia.desktop : heroMedia.mobile;
      frames = new Array(N);
      requested = new Set();
      drawn = -1;
      canvas.style.opacity = '0';
      pump();
    };
    mq.addEventListener('change', onBreakpoint);
    cleanups.push(() => mq.removeEventListener('change', onBreakpoint));

    // ScrollTrigger: progress over the whole track → frame index + copy beats.
    loadMotion().then(({ gsap }) => {
      if (disposed) return;
      const q = (s: string) => track.querySelectorAll<HTMLElement>(s);
      const state = { f: 0 };
      const ctxG = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: 0.35, invalidateOnRefresh: true },
        });
        tl.to(state, {
          f: N - 1,
          duration: 1,
          onUpdate: () => {
            const i = Math.round(state.f);
            if (i !== current) { current = i; draw(); if (restUnlocked) pump(); }
          },
        }, 0);
        // beats: 0–30% "Dents gone." · 30–60% "Paint glowing." · 60–100% "We come to you." + subhead + CTAs
        tl.to(q('.beat-1'), { opacity: 0.45, duration: 0.05 }, 0.28)
          .to(q('.beat-2'), { opacity: 1, y: 0, duration: 0.06, ease: 'power2.out' }, 0.28)
          .to(q('.beat-2'), { opacity: 0.45, duration: 0.05 }, 0.58)
          .to(q('.beat-3'), { opacity: 1, y: 0, duration: 0.06, ease: 'power2.out' }, 0.58)
          .to(q('.hero-after'), { opacity: 1, y: 0, duration: 0.06, ease: 'power2.out' }, 0.62)
          .to(q('[data-hero-cue]'), { opacity: 0, duration: 0.04 }, 0.02);
      }, track);
      cleanups.push(() => ctxG.revert());
    });

    return () => {
      disposed = true;
      cleanups.forEach((f) => f());
    };
  }, []);

  return <span ref={ref} hidden />;
}
