"use client";

import { useEffect } from "react";
import { m, useReducedMotion, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/*
  Motion rules (see the redesign spec):
  - motion communicates: entering, cause → effect, state change
  - 150–300 ms, ease-out enter, ease-in exit
  - transform + opacity only
  - reduced motion collapses everything to instant (MotionConfig reducedMotion="user")
*/

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Fade + 4px rise on mount. Used for page templates and late-arriving panels. */
export function FadeIn({ children, delay = 0, className, as = "div" }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "section" | "ul" | "li" | "span" }) {
  const Comp = m[as];
  return (
    <Comp initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE_OUT, delay }} className={className}>
      {children}
    </Comp>
  );
}

/**
 * Staggered list entrance: each item rises 20 ms after the previous one,
 * capped at 8 so long lists never feel slow. Pass the item's index.
 */
export function StaggerItem({ index, children, className, as = "div" }: { index: number; children: React.ReactNode; className?: string; as?: "div" | "li" | "tr" }) {
  const Comp = m[as];
  return (
    <Comp initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE_OUT, delay: Math.min(index, 8) * 0.02 }} className={className}>
      {children}
    </Comp>
  );
}

/**
 * Number that springs to a new value when data changes. Server-rendered with
 * the final text, so it never shifts layout or counts up on first paint.
 */
export function CountUp({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, { stiffness: 140, damping: 22, restDelta: 0.01 });
  const text = useTransform(spring, (v) => format(v));
  useEffect(() => {
    if (reduce) spring.jump(value);
    else spring.set(value);
  }, [value, reduce, spring]);
  return <m.span className={cn("tabular-nums", className)}>{text}</m.span>;
}

/** Press feedback for tappable cards and chips: a 2% scale on tap, 1px lift on hover. */
export const pressable = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.15, ease: EASE_OUT },
} as const;
