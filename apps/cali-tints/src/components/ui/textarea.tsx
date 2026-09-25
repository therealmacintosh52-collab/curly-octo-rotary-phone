import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-lg border border-border bg-input px-3.5 py-2.5 text-base text-foreground outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground/70",
        "focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/40",
        "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
