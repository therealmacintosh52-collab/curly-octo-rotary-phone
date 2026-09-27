import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Surface levels:
 *  - default: the standard card (surface-1, hairline border, inner highlight)
 *  - raised: a panel that should lead (adds the surface gradient)
 *  - flat: grouped content with no border, for nesting inside another card
 */
function Card({ className, level = "default", ...props }: React.ComponentProps<"div"> & { level?: "default" | "raised" | "flat" }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-4 rounded-xl text-card-foreground",
        level === "default" && "border border-border bg-card surface-raised py-5",
        level === "raised" && "border border-border bg-card surface-raised surface-gradient py-5",
        level === "flat" && "bg-surface-2 py-4",
        className,
      )}
      {...props}
    />
  );
}
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("grid auto-rows-min items-start gap-1 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto]", className)} {...props} />;
}
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("text-base font-semibold leading-6 tracking-tight", className)} {...props} />;
}
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)} {...props} />;
}
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-5", className)} {...props} />;
}
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center px-5", className)} {...props} />;
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
