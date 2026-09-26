"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

/**
 * Loads motion's feature bundle once, lazily, so `m.*` components stay small.
 * `domAnimation` covers enter/exit, variants and gestures; the sliding nav and
 * segmented-control indicators are plain CSS transforms, so the heavier
 * `domMax` (layout animations) is not needed. `reducedMotion="user"` makes
 * every animation respect the OS setting without per-component checks.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
