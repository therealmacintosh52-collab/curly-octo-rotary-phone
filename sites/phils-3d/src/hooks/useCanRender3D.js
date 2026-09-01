import { useEffect, useState } from "react";

/**
 * The 3D only mounts when the device can carry it and the page has already
 * painted. Everything below is a reason to stay on the poster instead.
 */
export function useCanRender3D() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 820px)").matches;
    // Genuinely low-end only. An earlier version cut at <= 4 cores, which
    // silently excluded ordinary laptops from ever seeing the scene.
    const weak =
      (navigator.hardwareConcurrency || 8) <= 2 ||
      (navigator.deviceMemory || 8) <= 2 ||
      Boolean(navigator.connection && navigator.connection.saveData);

    let gl = null;
    try {
      const c = document.createElement("canvas");
      gl = c.getContext("webgl2") || c.getContext("webgl");
    } catch (e) {
      gl = null;
    }
    if (reduced || small || weak || !gl) return;

    // Wait for LCP to land before spending main-thread time on three.js.
    const start = () => setReady(true);
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
    const id = idle(start, { timeout: 2500 });
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  return ready;
}
