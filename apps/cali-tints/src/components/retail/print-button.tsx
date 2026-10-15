"use client";

import { useState } from "react";
import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Print a document: the PDF is loaded in a hidden frame and the print dialog opens on it.
 * Where a browser cannot print a frame (iPhone, iPad) the PDF opens in a tab instead and
 * the share sheet prints it. An unsigned estimate or invoice carries a blank signature line.
 */
export function PrintButton({ href, label = "Print", size = "default", variant = "outline", testId = "print-button", className }: { href: string; label?: string; size?: "sm" | "default"; variant?: "outline" | "ghost" | "default"; testId?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  function print() {
    const url = `${href}${href.includes("?") ? "&" : "?"}inline=1`;
    if (/iP(hone|ad|od)/.test(navigator.userAgent)) return void window.open(url, "_blank");
    setBusy(true);
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(url, "_blank");
      }
      setBusy(false);
      window.setTimeout(() => frame.remove(), 120000);
    };
    frame.src = url;
    document.body.appendChild(frame);
  }
  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={print} loading={busy} data-testid={testId} data-href={href}>
      <PrinterIcon /> {label}
    </Button>
  );
}
