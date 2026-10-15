"use client";

import { useState } from "react";
import { ChevronDownIcon, EyeIcon, HistoryIcon } from "lucide-react";
import type { ActivityEntry } from "@/lib/db/types";
import { useSession } from "@/components/app/session-provider";
import { activityKindLabel } from "@/lib/retail/activity";
import { dayKeyIn, dayLabelIn, timeIn } from "@/lib/retail/slots";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SHOWN = 15;

/**
 * Everything that happened on this estimate, work order and invoice, newest first:
 * who opened it (staff by initials, the customer by link), who did what, and the date
 * and time of each. The history sits under the page; owner, admin, manager and advisor read it.
 */
export function ActivityCard({ entries }: { entries: ActivityEntry[] }) {
  const { company } = useSession();
  const tz = company.timezone || "America/Los_Angeles";
  const [all, setAll] = useState(false);
  const rows = all ? entries : entries.slice(0, SHOWN);
  const views = entries.filter((x) => x.kind === "view").length;
  const startsDay = rows.map((x, i) => i === 0 || dayKeyIn(x.at, tz) !== dayKeyIn(rows[i - 1].at, tz));
  return (
    <Card data-testid="activity-card">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <HistoryIcon className="size-4 text-primary" /> Activity
          <Badge variant="muted" data-testid="activity-count">{entries.length}</Badge>
          {views > 0 && <span className="inline-flex items-center gap-1 text-caption font-normal text-subtle"><EyeIcon className="size-3.5" /> {views} view{views === 1 ? "" : "s"}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ol className="grid gap-0" data-testid="activity-list">
            {rows.map((x, i) => {
              const head = startsDay[i];
              return (
                <li key={`${x.at}-${i}`}>
                  {head && <div className="mt-3 border-b border-border pb-1 text-label text-subtle first:mt-0">{dayLabelIn(x.at, tz, true)}, {new Date(x.at).toLocaleDateString("en-US", { year: "numeric", timeZone: tz })}</div>}
                  <div className="grid grid-cols-[4.5rem_3rem_1fr] items-baseline gap-2 border-b border-border/50 py-1.5 text-sm last:border-b-0" data-testid="activity-row" data-kind={x.kind}>
                    <span className="text-caption tabular-nums text-subtle">{timeIn(x.at, tz)}</span>
                    <span className={cn("text-caption font-semibold", x.who === "Customer" ? "text-primary" : x.who === "System" ? "text-subtle" : "text-foreground")} data-testid="activity-who">{x.who}</span>
                    <span className="min-w-0">
                      {x.text}
                      <span className="ml-2 text-caption text-subtle">{activityKindLabel(x.kind)}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {entries.length > SHOWN && (
          <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" data-testid="activity-toggle">
            {all ? "Show fewer" : `Show all ${entries.length}`} <ChevronDownIcon className={cn("size-4 transition-transform", all && "rotate-180")} />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
