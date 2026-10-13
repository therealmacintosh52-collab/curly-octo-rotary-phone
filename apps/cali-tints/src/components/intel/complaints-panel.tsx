"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDownIcon } from "lucide-react";
import type { ComponentGroup, TrendPoint } from "@/lib/intel/complaints";
import type { Complaint } from "@/lib/intel/types";
import { SourceBadge } from "./source-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";

const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// recharts stays out of the main bundle (same approach as the dashboard charts).
const TrendImpl = dynamic(() => import("./complaint-trend").then((m) => m.ComplaintTrend), { ssr: false, loading: () => <Skeleton className="h-44 w-full rounded-lg" /> });

export function ComplaintTrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) return null;
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium">Complaints filed per year</figcaption>
      <div className="h-44 w-full">
        <TrendImpl data={data} />
      </div>
    </figure>
  );
}

/** Complaints grouped by their primary component, biggest first; a group opens into its list. */
export function ComplaintGroups({ groups, total }: { groups: ComponentGroup[]; total: number }) {
  const [open, setOpen] = useState<string | null>(groups[0]?.component ?? null);
  const max = groups[0]?.count ?? 1;
  return (
    <ul className="space-y-2" data-testid="intel-complaint-groups">
      {groups.map((g) => {
        const isOpen = open === g.component;
        return (
          <li key={g.component} className="overflow-hidden rounded-xl border border-border bg-card">
            <button type="button" className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left" onClick={() => setOpen(isOpen ? null : g.component)} aria-expanded={isOpen}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{title(g.component)}</span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {g.count} <span className="text-caption">({Math.round((g.count / total) * 100)}%)</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (g.count / max) * 100)}%` }} />
                </div>
                {(g.crashes > 0 || g.fires > 0 || g.injuries > 0) && (
                  <p className="mt-1 text-caption text-destructive">{[g.crashes && `${g.crashes} crash`, g.fires && `${g.fires} fire`, g.injuries && `${g.injuries} injur${g.injuries === 1 ? "y" : "ies"}`].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <ChevronDownIcon className={cn("size-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && <ComplaintList complaints={g.complaints} />}
          </li>
        );
      })}
    </ul>
  );
}

export function ComplaintList({ complaints, initial = 5 }: { complaints: Complaint[]; initial?: number }) {
  const [shown, setShown] = useState(initial);
  return (
    <div className="border-t border-border">
      <ul className="divide-y divide-border" data-testid="intel-complaints">
        {complaints.slice(0, shown).map((c) => (
          <li key={c.odiNumber} className="space-y-1 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
              <span>{formatDateOnly(c.dateOfIncident ?? c.dateComplaintFiled)}</span>
              {c.mileage && <span>{c.mileage.toLocaleString()} mi</span>}
              {c.components.length > 1 && <span>{c.components.map(title).join(", ")}</span>}
              {c.crash && <span className="text-destructive">Crash</span>}
              {c.fire && <span className="text-destructive">Fire</span>}
              <span className="ml-auto font-mono">ODI {c.odiNumber}</span>
              <SourceBadge source="NHTSA" />
            </div>
            <p className="leading-relaxed">{c.summary.length > 600 ? c.summary.slice(0, 600) + "…" : c.summary}</p>
          </li>
        ))}
      </ul>
      {complaints.length > shown && (
        <button type="button" className="h-11 w-full border-t border-border text-sm text-primary" onClick={() => setShown((s) => s + 10)}>
          Show more ({complaints.length - shown} left)
        </button>
      )}
    </div>
  );
}
