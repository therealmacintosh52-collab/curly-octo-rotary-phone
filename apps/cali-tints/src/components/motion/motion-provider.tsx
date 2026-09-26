"use client";

import { LazyMotion, MotionConfig, domMax } from "motion/react";

/**
 * Loads motion's feature bundle once, lazily, so `m.*` components stay small.
 * `domMax` (over `domAnimation`) is needed for the shared-layout indicators in
 * the segmented controls and nav. `reducedMotion="user"` makes every animation
 * respect the OS setting without per-component checks.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
