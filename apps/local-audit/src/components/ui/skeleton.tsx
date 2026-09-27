import { cn } from "@/lib/utils";

/** Placeholder block with a slow shimmer; sized by the caller to match the real content. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("shimmer rounded-lg motion-reduce:animate-none", className)} {...props} />;
}

/** A line of text: pass a width class. */
function SkeletonText({ className, ...props }: React.ComponentProps<"div">) {
  return <Skeleton className={cn("h-3.5 rounded", className)} {...props} />;
}

export { Skeleton, SkeletonText };
