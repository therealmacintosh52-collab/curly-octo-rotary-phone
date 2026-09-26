"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders `children` only once the placeholder scrolls near the viewport.
 * Used for below-the-fold charts so their JS and first render never compete
 * with the page's first paint. The placeholder keeps the final height so the
 * page does not shift when the content mounts.
 */
export function InView({ children, placeholder, rootMargin = "240px" }: { children: React.ReactNode; placeholder: React.ReactNode; rootMargin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setShown(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return <div ref={ref}>{shown ? children : placeholder}</div>;
}
