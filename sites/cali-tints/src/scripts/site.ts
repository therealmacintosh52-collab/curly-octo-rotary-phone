/**
 * Cali Tints — client behaviour.
 *
 * Everything here is an enhancement. With JS disabled the nav links work, the
 * form posts normally, the hero shows its poster, and every reveal is visible.
 */
import data from '../data/site.json';
import { openState } from '../lib/hours';

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

/* -------------------------------------------------------------- open now
   Every [data-open-now] gets the live state in the shop's own time zone,
   refreshed each minute so a pill left open flips at closing time. */
function paintOpen() {
  const st = openState();
  document.querySelectorAll<HTMLElement>('[data-open-now]').forEach((el) => {
    el.classList.toggle('is-open', st.open);
    el.classList.toggle('is-closed', !st.open);
    const label = el.querySelector<HTMLElement>('[data-open-label]');
    if (label) label.textContent = st.label;
    el.title = st.label;
  });
}
paintOpen();
setInterval(paintOpen, 60_000);

/* ------------------------------------------------------------ spotlight
   Pointer-following highlight on cards, and a light 3D tilt on the service
   cards. Fine pointers only; nothing runs on touch. */
if (window.matchMedia('(pointer: fine)').matches && !prefersReduced) {
  const spots = document.querySelectorAll<HTMLElement>('.card, .panel, .review, .book__svc, .iw, .quote-card, .book__form, .split-img__stage, .faq details, .stat');
  spots.forEach((el) => {
    el.classList.add('spot');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
      if (el.matches('a.card')) {
        el.classList.add('tilt');
        const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-dy * 6).toFixed(2)}deg) rotateY(${(dx * 8).toFixed(2)}deg) translateY(-4px)`;
      }
    });
    el.addEventListener('pointerleave', () => { if (el.matches('a.card')) el.style.transform = ''; });
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hp1 = form.querySelector<HTMLInputElement>('input[name="_gotcha"]');
    const hp2 = form.querySelector<HTMLInputElement>('input[name="_honey"]');
    if (hp1?.value || hp2?.value) return;

    // The CRM (Netlify function) gets every request first, so nothing is lost
    // even before an inbox is connected. Silently skipped where it does not run.
    let saved = false;
    try {
      const fd = new FormData(form);
      const payload = Object.fromEntries(Array.from(fd.entries()).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, String(v)]));
      const r = await fetch('/.netlify/functions/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, source: 'quote' }) });
      saved = r.ok;
    } catch { saved = false; }

    const action = form.getAttribute('action') || '';
    // Shipped with a placeholder inbox until the shop supplies a real address.
    // It must not pretend to have sent anything.
    if (action.includes('REPLACE-ME') || action.includes('example.com')) {
      if (saved) {
        form.reset();
        say(es ? `Recibido. Le llamamos con los siguientes pasos.` : `Got it — your request is with the shop. We'll call or text you back. Need us sooner? Call ${PHONE}.`, 'ok');
        track('generate_lead', { form_id: form.id || 'quote' });
      } else {
        say(es
          ? `Este formulario aún no está conectado. Por favor llame al ${PHONE}.`
          : `This form isn't connected to an inbox yet. Please call ${PHONE} — we'll take care of you.`,
          'err');
      }
      return;
    }

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
   The clip's source is attached after `load`, then autoplay is
   attempted and retried on every event that can
   plausibly unblock it. If it is still refused — iPhone Low Power Mode is the
   usual reason — the poster stays and a tap cue appears. */
const hero = document.querySelector<HTMLElement>('[data-hero]');
const video = document.querySelector<HTMLVideoElement>('[data-hero-video]');

if (hero && video) {
  // WebM/VP9 first (smaller, and what Chrome, Firefox, Edge and Android take),
  // H.264 MP4 second for Safari and iOS. canPlayType picks; if neither is
  // supported the poster simply stays, which is a perfectly good outcome.
  // The clip lives next to the poster (assets/img/ -> assets/video/), so its
  // URL is derived from the poster's resolved src rather than hard-coded from
  // the site root. That keeps the video working when the build is served from
  // a sub-path (scripts/preview-relative.mjs rewrites the poster's src to a
  // relative path; the JS cannot be rewritten the same way because one bundle
  // is shared by pages at different depths).
  const poster = hero.querySelector<HTMLImageElement>('.hero-v__poster');
  const videoBase = poster ? new URL('../video/', poster.src).href : '/assets/video/';
  const SOURCES: [string, string][] = [
    [videoBase + 'shop.webm', 'video/webm; codecs="vp9"'],
    [videoBase + 'shop.mp4', 'video/mp4; codecs="avc1.42E01E"'],
  ];
  let attached = false;
  let settled = false;

  const attempt = () => {
    // Never call play() before a source exists. Doing so fails the element's
    // resource-selection algorithm, leaves networkState at NETWORK_NO_SOURCE,
    // and raises a spurious "tap to play" before the clip has had any chance.
    if (!attached || settled) return;
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
    if (attached) return;
    // muted must be set in JS as well as in markup; some iOS builds ignore the
    // attribute alone and refuse the autoplay.
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    // Assigning .src directly rather than appending <source> children: with
    // preload="none" the child-element path leaves the element in a state
    // where selection has already failed and does not reliably re-run.
    const pick = SOURCES.find(([, type]) => video.canPlayType(type) !== '');
    if (!pick) return;                 // no decoder for either — keep the poster
    video.src = pick[0];
    attached = true;
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
  //
  // Worth knowing if this is ever revisited: the LCP element on the home page
  // is the <video>, not the poster — a video is an LCP candidate in its own
  // right and the clip is the largest thing on the page, so LCP is whenever its
  // first frame paints. Attaching the source once the poster has painted
  // instead was measured at the same LCP — median 2.9 s either way on throttled
  // mobile — so the later, quieter point stays.
  if (document.readyState === 'complete') requestIdleCallbackShim(attach);
  else window.addEventListener('load', () => requestIdleCallbackShim(attach), { once: true });

  // Stop decoding while off-screen — it is decoration, not content.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { if (settled) video.play().catch(() => {}); }
        else if (attached) video.pause();
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

  if (reveals.length || fine || document.querySelector('.sec-head')) {
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

        // Reveal more than the hand-tagged blocks: section heads, page heads,
        // split columns, panels, the difference lists and the glance card. Only
        // outermost candidates, so nothing animates twice. Tagged before
        // has-motion goes on, so they are hidden and shown in one pass.
        const more = document.querySelectorAll<HTMLElement>(
          '.sec-head, .page-head > .wrap, .split > *, .panel, .diff, .glance, .review, .faq, .table-scroll');
        more.forEach((el) => {
          if (el.closest('.js-reveal') || el.closest('[data-stagger]')) return;
          el.classList.add('js-reveal');
        });
        document.documentElement.classList.add('has-motion');

        document.querySelectorAll<HTMLElement>('.js-reveal').forEach((el) => {
          if (el.closest('[data-stagger]')) return;
          gsap.to(el, {
            opacity: 1, y: 0, duration: 0.8, ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          });
        });

        // Stat band: the numbers count up the first time the band is seen.
        document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
          const target = Number(el.dataset.count);
          if (!Number.isFinite(target)) return;
          const decimals = (el.dataset.count!.split('.')[1] || '').length;
          const o = { v: 0 };
          gsap.to(o, {
            v: target, duration: 1.4, ease: 'power2.out',
            onUpdate: () => { el.textContent = o.v.toFixed(decimals); },
            scrollTrigger: { trigger: el, start: 'top 92%', once: true },
          });
        });

        // Staggered groups: children of a grid or checklist reveal in sequence.
        document.querySelectorAll<HTMLElement>('[data-stagger], .checklist').forEach((group) => {
          const kids = Array.from(group.children) as HTMLElement[];
          if (!kids.length) return;
          kids.forEach((k) => k.classList.add('js-reveal'));
          gsap.set(kids, { opacity: 0, y: 18 });
          gsap.to(kids, {
            opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.08,
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
