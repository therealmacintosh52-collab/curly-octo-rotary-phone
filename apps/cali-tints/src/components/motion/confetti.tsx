"use client";

/*
  A short, dependency-free confetti burst for the moment money comes in.
  Respects prefers-reduced-motion (no-op) and cleans up after itself.
*/
const COLORS = ["#82d955", "#b8f28a", "#ffffff", "#ffd166", "#4d7f34"];

export function fireConfetti(origin: { x?: number; y?: number } = {}) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "9999" } as CSSStyleDeclaration);
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);

  const ox = (origin.x ?? 0.5) * window.innerWidth;
  const oy = (origin.y ?? 0.45) * window.innerHeight;
  const pieces = Array.from({ length: 90 }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const speed = 7 + Math.random() * 9;
    return { x: ox, y: oy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
  });
  const start = performance.now();
  const DURATION = 1300;
  function frame(now: number) {
    const t = now - start;
    ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const fade = t > DURATION - 350 ? Math.max(0, (DURATION - t) / 350) : 1;
    for (const p of pieces) {
      p.vy += 0.35;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx!.save();
      ctx!.globalAlpha = fade;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx!.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

/** A little buzz on phones that support it. */
export function haptic(pattern: number | number[] = [20, 30, 20]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
