/* v2 interactions, loaded on every page (no Three.js here):
   Lenis smooth scroll, GSAP reveals, split-text headline, magnetic
   buttons and the custom cursor. Everything is progressive: without JS
   the page is complete and static. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;

/* --- Smooth scroll ------------------------------------------------ */
if (!reduce) {
  const lenis = new Lenis({ autoRaf: false, lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  (window as any).__lenis = lenis;
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!a || a.getAttribute('href') === '#') return;
    const target = document.querySelector(a.getAttribute('href')!);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target as HTMLElement, { offset: -88 });
  });
}

/* --- Split-text headline reveal ------------------------------------ */
function splitWords(el: HTMLElement) {
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      const words = (node.textContent || '').split(/(\s+)/);
      words.forEach((w) => {
        if (!w) return;
        if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
        const outer = document.createElement('span'); outer.className = 'w';
        const inner = document.createElement('span'); inner.className = 'wi'; inner.textContent = w;
        outer.appendChild(inner); frag.appendChild(outer);
      });
      node.parentNode!.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      Array.from(node.childNodes).forEach(walk);
    }
  };
  Array.from(el.childNodes).forEach(walk);
}
document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
  if (reduce) return;
  splitWords(el);
  gsap.from(el.querySelectorAll('.wi'), {
    yPercent: 110, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.045,
    delay: Number(el.dataset.splitDelay || 0.15),
  });
});

/* --- Scroll reveals: clip-path + scale ------------------------------ */
if (!reduce) {
  gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.fromTo(el,
      { clipPath: 'inset(0 0 18% 0 round 16px)', scale: 0.96, opacity: 0 },
      { clipPath: 'inset(0 0 0% 0 round 16px)', scale: 1, opacity: 1, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
  });
  gsap.utils.toArray<HTMLElement>('[data-stagger]').forEach((group) => {
    gsap.from(group.children, {
      y: 28, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08,
      scrollTrigger: { trigger: group, start: 'top 85%', once: true },
    });
  });
}

/* --- Magnetic buttons ---------------------------------------------- */
if (fine && !reduce) {
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.28);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* --- Custom cursor -------------------------------------------------- */
if (fine && !reduce) {
  const cur = document.createElement('div');
  cur.className = 'cursor';
  const label = document.createElement('span');
  label.className = 'cursor-label';
  cur.appendChild(label);
  document.body.appendChild(cur);
  document.documentElement.classList.add('has-cursor');
  const xTo = gsap.quickTo(cur, 'x', { duration: 0.18, ease: 'power3.out' });
  const yTo = gsap.quickTo(cur, 'y', { duration: 0.18, ease: 'power3.out' });
  window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const t = e.target as Element;
    const labelled = t.closest?.('[data-cursor]') as HTMLElement | null;
    const link = t.closest?.('a, button, [role="button"]');
    cur.classList.toggle('is-link', !!link && !labelled);
    cur.classList.toggle('is-label', !!labelled);
    label.textContent = labelled?.dataset.cursor || '';
  });
  document.addEventListener('pointerleave', () => cur.classList.remove('is-link', 'is-label'));
}
