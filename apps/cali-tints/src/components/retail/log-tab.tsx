"use client";

import { useState } from "react";
import { HistoryIcon } from "lucide-react";
import type { ActivityEntry } from "@/lib/db/types";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ActivityCard } from "./activity-card";

/** The "Log" handle on the right edge of a wide screen, under the Notes handle: the activity log slides in without leaving the page. */
export function LogTab({ entries }: { entries: ActivityEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open the log" className="fixed top-[19rem] right-0 z-30 hidden items-center gap-1.5 rounded-l-lg border border-r-0 border-border bg-card px-1.5 py-3 text-sm font-medium text-muted-foreground shadow-md hover:text-foreground xl:flex [writing-mode:vertical-rl]" data-testid="log-handle">
        <HistoryIcon className="size-4 text-primary" /> Log
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg" data-testid="log-sheet">
          <SheetHeader>
            <SheetTitle>Log</SheetTitle>
            <SheetDescription>Who opened it and who did what, newest first.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6"><ActivityCard entries={entries} /></div>
        </SheetContent>
      </Sheet>
    </>
  );
}
