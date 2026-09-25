/**
 * Automotive Solutions by Single — client behaviour.
 *
 * Everything here is an enhancement. With JS disabled the nav links work, the
 * form posts normally, the hero shows its poster, and every reveal is visible.
 */
import data from '../data/site.json';

const PHONE = data.site.phone_display;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------- mobile nav */
const toggle = document.querySelector<HTMLButtonElement>('.nav-toggle');
const nav = document.getElementById('primary-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  nav.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).tagName === 'A') {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
}

/* ----------------------------------------------------------- footer year */
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

/* ------------------------------------------------------------- tracking
   Pushes to dataLayer (and gtag if a tag is ever installed). Nothing is
   loaded from a third party here; with no analytics tag the events simply
   queue on window.dataLayer. */
type Params = Record<string, unknown>;
function track(name: string, params: Params = {}) {
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event: name, ...params });
  if (typeof w.gtag === 'function') w.gtag('event', name, params);
}

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest?.('a');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  const where = a.getAttribute('data-loc') || 'page';
  if (href.startsWith('tel:')) track('click_to_call', { link_location: where });
  else if (href.includes('google.com/maps') || href.includes('maps.google')) {
    track('get_directions', { link_location: where });
  }
});

/* ---------------------------------------------------------------- forms */
document.querySelectorAll<HTMLFormElement>('form[data-quote-form]').forEach((form) => {
  const status = form.querySelector<HTMLElement>('.form-status');
  const es = document.documentElement.lang === 'es';

  const say = (msg: string, kind: 'ok' | 'err') => {
    if (!status) { window.alert(msg); return; }
    status.textContent = msg;
    status.className = `form-status show ${kind}`;
  };

  form.addEventListener('submit', (e) => {
    const hp1 = form.querySelector<HTMLInputElement>('input[name="_gotcha"]');
    const hp2 = form.querySelector<HTMLInputElement>('input[name="_honey"]');
    if (hp1?.value || hp2?.value) { e.preventDefault(); return; }

    const action = form.getAttribute('action') || '';
    // Shipped with a placeholder inbox until the shop supplies a real address.
    // It must not pretend to have sent anything.
    if (action.includes('REPLACE-ME') || action.includes('example.com')) {
      e.preventDefault();
      say(es
        ? `Este formulario aún no está conectado. Por favor llame al ${PHONE}.`
        : `This form isn't connected to an inbox yet. Please call ${PHONE} — we'll take care of you.`,
        'err');
      return;
    }

    e.preventDefault();
    const btn = form.querySelector<HTMLButtonElement>('button[type=submit]');
    const label = btn?.textContent ?? 'Send';
    if (btn) { btn.disabled = true; btn.textContent = es ? 'Enviando…' : 'Sending…'; }

    fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error('bad status');
        form.reset();
        say(es
          ? `Gracias — ya lo recibimos. Le llamamos con los siguientes pasos.`
          : `Thanks — we got it. We'll call you back with next steps. Need us sooner? Call ${PHONE}.`,
          'ok');
        track('generate_lead', { form_id: form.id || 'quote' });
      })
      .catch(() => {
        say(es
          ? `No se pudo enviar. Por favor llame al ${PHONE}.`
          : `That didn't go through. Please call ${PHONE} and we'll take care of you.`, 'err');
      })
      .finally(() => { if (btn) { btn.disabled = false; btn.textContent = label; } });
  });
});

/* ------------------------------------------------------------- video hero
   The poster is the LCP, so the video source is not attached until after
   `load`. Then autoplay is attempted and retried on every event that can
   plausibly unblock it. If it is still refused — iPhone Low Power Mode is the
   usual reason — the poster stays and a tap cue appears. */
const hero = document.querySelector<HTMLElement>('[data-hero]');
const video = document.querySelector<HTMLVideoElement>('[data-hero-video]');

if (hero && video) {
  const SRC = '/assets/video/shop.mp4';
  let settled = false;

  const attempt = () => {
    if (settled) return;
    const p = video.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        settled = true;
        hero.classList.add('is-playing');
        hero.classList.remove('needs-tap');
      }).catch(() => {
        hero.classList.add('needs-tap');
      });
    }
  };

  const attach = () => {
    // muted must be set in JS as well as in markup; some iOS builds ignore the
    // attribute alone and refuse the autoplay.
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    if (!video.querySelector('source')) {
      const source = document.createElement('source');
      source.src = SRC;
      source.type = 'video/mp4';
      video.appendChild(source);
      video.load();
    }
    attempt();
  };

  video.addEventListener('canplay', attempt);
  video.addEventListener('loadeddata', attempt);
  window.addEventListener('pageshow', attempt);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) attempt(); });
  ['touchstart', 'pointerdown', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, attempt, { once: true, passive: true });
  });

  document.querySelector('[data-hero-tap]')?.addEventListener('click', () => {
    settled = false;
    attempt();
  });

  // Do not compete with the LCP.
  if (document.readyState === 'complete') requestIdleCallbackShim(attach);
  else window.addEventListener('load', () => requestIdleCallbackShim(attach), { once: true });

  // Stop decoding while off-screen — it is decoration, not content.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { if (settled) video.play().catch(() => {}); }
        else video.pause();
      });
    }, { threshold: 0.05 }).observe(hero);
  }
}

function requestIdleCallbackShim(fn: () => void) {
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: object) => number };
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(fn, { timeout: 1800 });
  else setTimeout(fn, 320);
}

/* ---------------------------------------------------------------- motion
   Loaded dynamically and only where it earns its weight: never for a reader
   who asked for reduced motion, and Lenis only on a fine pointer. */
if (!prefersReduced) {
  const reveals = document.querySelectorAll<HTMLElement>('.js-reveal');
  const fine = window.matchMedia('(pointer: fine)').matches;

  if (reveals.length || fine) {
    const boot = async () => {
      try {
        const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
          import('gsap'),
          import('gsap/ScrollTrigger'),
        ]);
        gsap.registerPlugin(ScrollTrigger);

        if (fine) {
          const { default: Lenis } = await import('lenis');
          const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
          lenis.on('scroll', ScrollTrigger.update);
          gsap.ticker.add((t) => lenis.raf(t * 1000));
          gsap.ticker.lagSmoothing(0);
        }

        // Only hide things once we know we can animate them back in.
        document.documentElement.classList.add('has-motion');

        reveals.forEach((el) => {
          gsap.to(el, {
            opacity: 1, y: 0, duration: 0.75, ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          });
        });

        // Staggered groups: children of a grid reveal in sequence.
        document.querySelectorAll<HTMLElement>('[data-stagger]').forEach((group) => {
          const kids = Array.from(group.children) as HTMLElement[];
          kids.forEach((k) => k.classList.add('js-reveal'));
          gsap.set(kids, { opacity: 0, y: 18 });
          gsap.to(kids, {
            opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.07,
            scrollTrigger: { trigger: group, start: 'top 85%', once: true },
          });
        });
      } catch {
        // Motion is optional. If the chunk fails, the page is already readable.
        document.documentElement.classList.remove('has-motion');
      }
    };
    if (document.readyState === 'complete') requestIdleCallbackShim(boot);
    else window.addEventListener('load', () => requestIdleCallbackShim(boot), { once: true });
  }
}
