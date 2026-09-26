"use client";

import * as React from "react";
import Link from "next/link";
import { SlidingIndicator, useIndicatorReady } from "@/components/motion/sliding-indicator";
import { cn } from "@/lib/utils";

export interface SegmentedItem {
  value: string;
  label: React.ReactNode;
  /** Render as a link (navigation) instead of a button (selection). */
  href?: string;
}

/**
 * Segmented control with a sliding active indicator. Replaces Tabs where the
 * "tabs" are really filters or navigation: it renders links or buttons with
 * proper semantics (`aria-current` / `aria-pressed`) instead of an ARIA tab
 * list whose panels do not exist.
 */
export function Segmented({
  items,
  value,
  onValueChange,
  size = "default",
  wrap = false,
  className,
  "aria-label": ariaLabel,
}: {
  items: SegmentedItem[];
  value: string;
  onValueChange?: (value: string) => void;
  size?: "sm" | "default";
  /** Allow wrapping onto multiple rows instead of scrolling horizontally. */
  wrap?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const isNav = items.some((i) => i.href);
  const Wrapper = isNav ? "nav" : "div";
  const rootRef = React.useRef<HTMLDivElement>(null);
  const ready = useIndicatorReady();

  return (
    <Wrapper
      ref={rootRef}
      aria-label={ariaLabel}
      role={isNav ? undefined : "group"}
      className={cn("no-scrollbar relative inline-flex max-w-full gap-0.5 rounded-lg bg-muted p-1", wrap ? "flex-wrap" : "overflow-x-auto", className)}
    >
      <SlidingIndicator containerRef={rootRef} watch={value} className="rounded-md bg-card surface-raised" />
      {items.map((item) => {
        const active = item.value === value;
        const classes = cn(
          "relative shrink-0 rounded-md font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
          size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-3.5 text-sm",
          "inline-flex items-center justify-center",
          // Before the indicator has measured (and in server HTML) the active item paints its own background.
          active ? (ready ? "text-foreground" : "bg-card text-foreground surface-raised") : "text-muted-foreground hover:text-foreground",
          wrap ? "flex-none" : "flex-1",
        );
        return item.href ? (
          <Link key={item.value} href={item.href} data-active={active} aria-current={active ? "page" : undefined} className={classes}>
            {item.label}
          </Link>
        ) : (
          <button key={item.value} type="button" data-active={active} aria-pressed={active} onClick={() => onValueChange?.(item.value)} className={classes}>
            {item.label}
          </button>
        );
      })}
    </Wrapper>
  );
}
