"use client";

import * as React from "react";
import Link from "next/link";
import { m, LayoutGroup } from "motion/react";
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
  const groupId = React.useId();
  const isNav = items.some((i) => i.href);
  const Wrapper = isNav ? "nav" : "div";
  return (
    <Wrapper
      aria-label={ariaLabel}
      role={isNav ? undefined : "group"}
      className={cn(
        "no-scrollbar inline-flex max-w-full gap-0.5 rounded-lg bg-muted p-1",
        wrap ? "flex-wrap" : "overflow-x-auto",
        className,
      )}
    >
      <LayoutGroup id={groupId}>
        {items.map((item) => {
          const active = item.value === value;
          const inner = (
            <>
              {active && <m.span layoutId="indicator" aria-hidden className="absolute inset-0 rounded-md bg-card surface-raised" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="relative">{item.label}</span>
            </>
          );
          const classes = cn(
            "relative shrink-0 rounded-md font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
            size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-3.5 text-sm",
            "inline-flex items-center justify-center",
            active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            wrap ? "flex-none" : "flex-1",
          );
          return item.href ? (
            <Link key={item.value} href={item.href} aria-current={active ? "page" : undefined} className={classes}>
              {inner}
            </Link>
          ) : (
            <button key={item.value} type="button" aria-pressed={active} onClick={() => onValueChange?.(item.value)} className={classes}>
              {inner}
            </button>
          );
        })}
      </LayoutGroup>
    </Wrapper>
  );
}
