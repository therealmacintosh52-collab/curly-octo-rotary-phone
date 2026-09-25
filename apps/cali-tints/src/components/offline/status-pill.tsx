"use client";

import Link from "next/link";
import { CloudOffIcon, CloudUploadIcon, LoaderCircleIcon } from "lucide-react";
import { useSync } from "./sync-provider";
import { cn } from "@/lib/utils";

/** Compact connectivity + outbox indicator for the header. Hidden when online with nothing queued. */
export function StatusPill({ className }: { className?: string }) {
  const { online, pending, syncing } = useSync();
  if (online && pending === 0 && !syncing) return null;

  return (
    <Link
      href="/jobs/outbox"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
        !online ? "border-warning/40 bg-warning/10 text-warning" : "border-info/40 bg-info/10 text-info",
        className,
      )}
    >
      {!online ? <CloudOffIcon className="size-3.5" /> : syncing ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <CloudUploadIcon className="size-3.5" />}
      {!online ? (pending > 0 ? `Offline · ${pending} queued` : "Offline") : syncing ? "Syncing…" : `${pending} to sync`}
    </Link>
  );
}
