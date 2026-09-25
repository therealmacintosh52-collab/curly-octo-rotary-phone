import Image from "next/image";
import { cn } from "@/lib/utils";

/** Round Cali Tints mark. `src` lets the company override it with an uploaded logo. */
export function Logo({ size = 40, className, src }: { size?: number; className?: string; src?: string | null }) {
  return (
    <Image
      src={src ?? "/brand/logo.png"}
      alt="Cali Tints"
      width={size}
      height={size}
      priority
      className={cn("rounded-full", className)}
      unoptimized={!!src}
    />
  );
}
