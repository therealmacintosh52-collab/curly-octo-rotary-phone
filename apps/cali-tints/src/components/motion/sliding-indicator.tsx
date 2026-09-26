"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * One absolutely positioned highlight that slides to whichever child of
 * `containerRef` carries `data-active="true"`. Pure CSS transform, so it
 * costs nothing from the animation library and stays GPU-only; under reduced
 * motion it just jumps.
 *
 * The container must be `position: relative`. Re-measures when `watch`
 * changes and whenever the container resizes.
 */
export function SlidingIndicator({ containerRef, watch, className }: { containerRef: React.RefObject<HTMLElement | null>; watch: unknown; className?: string }) {
  const [box, setBox] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);

  React.useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const update = () => {
      const active = root.querySelector<HTMLElement>("[data-active='true']");
      if (!active) return setBox(null);
      setBox({ x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(root);
    return () => ro.disconnect();
  }, [containerRef, watch]);

  if (!box) return null;
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute top-0 left-0 transition-[transform,width,height] duration-200 ease-out motion-reduce:transition-none", className)}
      style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }}
    />
  );
}

/** True once the indicator has measured; lets the active item drop its own static background. */
export function useIndicatorReady() {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  return ready;
}
