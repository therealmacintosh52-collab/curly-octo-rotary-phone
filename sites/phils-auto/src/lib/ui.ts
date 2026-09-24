/**
 * Everything the DOM needs, on every page. No Three.js, no React.
 * Guarded so it is inert under reduced motion and on touch.
 */
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

/* --- reveal on scroll ------------------------------------------------ */
const reveal = () => {
  const items = document.querySelectorAll<HTMLElement>("[data-reveal], .split");
  if (!items.length) return;
  if (reduced || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );
  items.forEach((el) => io.observe(el));
  /* Fail open: anything still hidden after 2.5s gets shown. A reveal that
     never fires is a blank page, which is far worse than no animation. */
  setTimeout(() => items.forEach((el) => el.classList.add("is-in")), 2500);
};

/* --- split text ------------------------------------------------------ */
const split = () => {
  document.querySelectorAll<HTMLElement>(".split").forEach((el) => {
    if (el.dataset.done) return;
    const text = el.textContent ?? "";
    el.setAttribute("aria-label", text);          // one sentence, not 47 letters
    const mode = el.dataset.split ?? "char";
    const parts = mode === "word" ? text.split(/(\s+)/) : [...text];
    el.textContent = "";
    parts.forEach((part, i) => {
      if (/^\s+$/.test(part)) return el.append(part);
      const s = document.createElement("span");
      s.textContent = part;
      s.setAttribute("aria-hidden", "true");
      s.style.setProperty("--i", String(i));
      el.append(s);
    });
    el.dataset.done = "1";
  });
};

/* --- custom cursor --------------------------------------------------- */
const cursor = () => {
  const dot = document.getElementById("cursor");
  if (!dot || !fine || reduced) { dot?.remove(); return; }
  const label = dot.querySelector("span")!;
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  /* Hidden until the pointer actually moves — otherwise it sits in the middle
     of the page looking like a bug, which is exactly what it is. */
  dot.style.opacity = "0";
  addEventListener("pointermove", (e) => {
    tx = e.clientX; ty = e.clientY;
    dot.style.opacity = "1";
  }, { passive: true });
  const loop = () => {
    x += (tx - x) * 0.2; y += (ty - y) * 0.2;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(loop);
  };
  loop();
  document.addEventListener("pointerover", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("a, button, [data-cursor]");
    if (!t) { dot.removeAttribute("data-big"); dot.removeAttribute("data-label"); return; }
    dot.setAttribute("data-big", "");
    const text = t.dataset.cursor;
    if (text) { label.textContent = text; dot.setAttribute("data-label", ""); }
    else dot.removeAttribute("data-label");
  });
};

/* --- magnetic buttons: transform only, so no layout is touched ------- */
const magnetic = () => {
  if (!fine || reduced) return;
  document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transform = `translate(${dx * 8}px, ${dy * 8}px)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  });
};

/* --- smooth scroll: only where it cannot hurt ------------------------ */
const smooth = async () => {
  if (reduced || !fine) return;   // never hijack scrolling on touch
  const { default: Lenis } = await import("lenis");
  const lenis = new Lenis({ duration: 0.9, smoothWheel: true });
  const raf = (t: number) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
};

const boot = () => { split(); reveal(); cursor(); magnetic(); smooth(); };
if (document.readyState !== "loading") boot();
else document.addEventListener("DOMContentLoaded", boot);
