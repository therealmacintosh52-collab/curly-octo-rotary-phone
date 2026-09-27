"use client";

import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** Field label: 13px medium, sentence case. Pair with `<Hint>` for helper text. */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("text-label flex select-none items-center gap-2 text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-50", className)}
      {...props}
    />
  );
}

/** Small helper or error line under a field. */
function Hint({ className, tone = "muted", ...props }: React.ComponentProps<"p"> & { tone?: "muted" | "error" | "warning" | "success" }) {
  return (
    <p
      data-slot="hint"
      className={cn(
        "text-caption",
        tone === "muted" && "text-subtle",
        tone === "error" && "text-destructive",
        tone === "warning" && "text-warning",
        tone === "success" && "text-success",
        className,
      )}
      {...props}
    />
  );
}

export { Hint, Label };
