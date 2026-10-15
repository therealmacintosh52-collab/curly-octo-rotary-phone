'use client';
import { useEffect } from 'react';
import { loadMotion, motionMode, onFirstIntent } from '@/lib/motion';

/*
  One restrained, orchestrated motion per section, keyed by data-motion on the <section>.
  Targets are [data-m] children. Content is fully visible without JS / with reduced motion:
  nothing here runs unless the page is in full-motion mode.
*/
export function SectionMotion() {
  useEffect(() => {
    if (motionMode() !== 'full') return;
    let revert: (() => void) | undefined;
    let cancelled = false;
    const off = onFirstIntent(() => loadMotion().then(({ gsap }) => {
      if (cancelled) return;
      const ctx = gsap.context(() => {
        document.querySelectorAll<HTMLElement>('[data-motion]').forEach((sec) => {
          const kind = sec.dataset.motion;
          const items = sec.querySelectorAll<HTMLElement>('[data-m]');
          const st = { trigger: sec, start: 'top 75%', once: true };
          switch (kind) {
            case 'steps': { // numbers rise in sequence while the connector line draws
              const tl = gsap.timeline({ scrollTrigger: st });
              tl.from(sec.querySelectorAll('[data-line]'), { scaleX: 0, transformOrigin: 'left center', duration: 1.1, ease: 'power3.inOut' })
                .from(items, { y: 28, opacity: 0, duration: 0.7, stagger: 0.18, ease: 'power3.out' }, 0.1);
              break;
            }
            case 'grid':
              gsap.from(items, { y: 24, opacity: 0, duration: 0.6, stagger: { each: 0.07, grid: 'auto', from: 'start' }, ease: 'power2.out', scrollTrigger: st });
              break;
            case 'reveal': // clip-path wipe, left → right
              gsap.from(items, { clipPath: 'inset(0 100% 0 0 round 20px)', duration: 1, stagger: 0.15, ease: 'power3.inOut', scrollTrigger: st });
              break;
            case 'parallax': { // the beading image settles from a slight zoom as you scroll through
              const img = sec.querySelector('[data-parallax]');
              if (img) gsap.fromTo(img, { scale: 1.14, yPercent: -4 }, { scale: 1, yPercent: 4, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
              gsap.from(items, { y: 20, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out', scrollTrigger: st });
              break;
            }
            case 'draw': { // reclaim loop path draws, then the three points follow
              const paths = sec.querySelectorAll<SVGPathElement>('[data-draw]');
              const tl = gsap.timeline({ scrollTrigger: st });
              paths.forEach((p) => { const L = p.getTotalLength(); gsap.set(p, { strokeDasharray: L, strokeDashoffset: L }); });
              tl.to(paths, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.2 })
                .from(items, { y: 16, opacity: 0, duration: 0.5, stagger: 0.12, ease: 'power2.out' }, 0.5);
              break;
            }
            case 'pins': { // city pins drop in from the centre outward
              const tl = gsap.timeline({ scrollTrigger: st });
              tl.from(sec.querySelectorAll('[data-halo]'), { scale: 0.6, opacity: 0, transformOrigin: '50% 50%', duration: 1, ease: 'power2.out' })
                .from(sec.querySelectorAll('[data-pin]'), { scale: 0, opacity: 0, transformOrigin: '50% 50%', duration: 0.4, stagger: 0.06, ease: 'back.out(2)' }, 0.2)
                .from(items, { opacity: 0, duration: 0.4, stagger: 0.03 }, 0.4);
              break;
            }
            case 'tiers': // cards rise; the featured tier lands last
              gsap.from(items, { y: 40, opacity: 0, duration: 0.8, stagger: 0.14, ease: 'power3.out', scrollTrigger: st });
              break;
            case 'slide':
              gsap.from(items, { x: -36, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out', scrollTrigger: st });
              break;
            case 'fade':
              gsap.from(items, { opacity: 0, y: 12, duration: 0.5, stagger: 0.06, ease: 'power1.out', scrollTrigger: st });
              break;
          }
        });
      });
      revert = () => ctx.revert();
    }));
    return () => { cancelled = true; off(); revert?.(); };
  }, []);
  return null;
}
