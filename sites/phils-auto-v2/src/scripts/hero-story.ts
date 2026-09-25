/* Home hero controller. Plain DOM + GSAP, no React: runs on every device.
   - drives the pinned four-beat scroll story (desktop only)
   - tracks the mouse for parallax
   - decides the GPU tier after load + idle, and only then dynamically
     imports the WebGL scene (React + Three.js), so phones and weak GPUs
     never download it. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { story } from '../lib/story';

gsap.registerPlugin(ScrollTrigger);

const hero = document.getElementById('hero');
const video = document.getElementById('hero-video') as HTMLVideoElement | null;

if (hero && video) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = matchMedia('(min-width: 881px)').matches;
  let inView = true;
  let scene: { setActive(on: boolean): void } | null = null;
  const updateActive = () => scene?.setActive(inView && !document.hidden);

  /* --- scroll story ------------------------------------------------- */
  if (!desktop || reduce) {
    hero.classList.add('no-story');
  } else {
    hero.classList.add('has-story');
    const beats = Array.from(hero.querySelectorAll<HTMLElement>('[data-beat]'));
    const dots = Array.from(hero.querySelectorAll<HTMLElement>('.v2-progress i'));
    let current = -1;
    const setBeat = (b: number) => {
      if (b === current) return;
      current = b;
      beats.forEach((el) => el.classList.toggle('is-active', Number(el.dataset.beat) === b));
      dots.forEach((d, i) => d.classList.toggle('is-on', i <= b));
    };
    setBeat(0);
    ScrollTrigger.create({
      trigger: hero, start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: (self) => { story.p = self.progress; setBeat(Math.min(3, Math.floor(self.progress * 4 + 0.0001))); },
    });
    window.addEventListener('pointermove', (e) => {
      story.mx = (e.clientX / innerWidth) * 2 - 1;
      story.my = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  new IntersectionObserver(([en]) => { inView = en.isIntersecting; updateActive(); }).observe(hero);
  document.addEventListener('visibilitychange', updateActive);

  /* --- tier decision, after the page has painted ---------------------- */
  const decide = async () => {
    if (!desktop) { console.info('[hero] phone layout: WebGL skipped by design'); return; }
    let tier: number;
    const forced = new URLSearchParams(location.search).get('gpu');
    if (forced !== null) {
      tier = Number(forced);
      console.info(`[hero] GPU tier forced to ${tier} via ?gpu=`);
    } else {
      try {
        const { getGPUTier } = await import('detect-gpu');
        const g = await getGPUTier();
        tier = g.tier;
        console.info(`[hero] GPU tier ${g.tier}${g.gpu ? ` (${g.gpu})` : ''} → ${tier >= 2 ? 'WebGL scene' : 'poster + video only'}`);
      } catch (err) {
        console.info('[hero] GPU detection failed, using poster + video only', err);
        return;
      }
    }
    if (tier < 2) return;
    const { mountScene } = await import('../components/home/Scene3D');
    scene = mountScene(hero.querySelector('.v2-stage') as HTMLElement, {
      video, tier, reduce,
      onReady: () => hero.classList.add('has-webgl'),
    });
    updateActive();
  };
  const idle = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 250));
  if (document.readyState === 'complete') idle(decide);
  else window.addEventListener('load', () => idle(decide), { once: true });
}
