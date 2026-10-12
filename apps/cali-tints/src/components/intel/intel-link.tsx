"use client";

import { ScanSearchIcon } from "lucide-react";
import { openRetail } from "@/lib/intel/bridge";
import { Button } from "@/components/ui/button";

/**
 * A button that opens BayIntel on a screen, usable from a server component
 * (it only dispatches the open event; the window provider in the app shell
 * does the rest). `vin` opens the garage with the VIN prefilled; `codes`
 * opens the trouble-code lookup.
 */
export function IntelLink({ vin, codes, label = "Look up in BayIntel", size = "sm", variant = "outline", className, testId = "intel-link" }: { vin?: string | null; codes?: string[]; label?: string; size?: "sm" | "default"; variant?: "outline" | "ghost" | "default"; className?: string; testId?: string }) {
  const path = codes?.length ? `/dtc?codes=${encodeURIComponent(codes.join(","))}` : vin ? `/garage?vin=${encodeURIComponent(vin)}` : "/garage";
  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={() => openRetail(path)} data-testid={testId} data-path={path}>
      <ScanSearchIcon /> {label}
    </Button>
  );
}
