"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown } from "lucide-react";
import type { ComponentGroup, TrendPoint } from "@/lib/vehicles/complaints";
import { SourceBadge } from "@/components/source-badge";
import { formatDate, titleCase } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function ComplaintTrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) return null;
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium">Complaints filed per year</figcaption>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} strokeDasharray="2 4" className="chart-grid" />
            <XAxis dataKey="year" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--accent)" }}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 13 }}
              labelStyle={{ color: "var(--muted-foreground)" }}
              formatter={(v) => [v, "complaints"]}
            />
            {/* Fill comes from CSS (.chart-bar) because SVG presentation attributes cannot resolve CSS variables in Chromium. */}
            <Bar dataKey="count" className="chart-bar" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function ComplaintGroups({ groups, total }: { groups: ComponentGroup[]; total: number }) {
  const [open, setOpen] = useState<string | null>(groups[0]?.component ?? null);
  const max = groups[0]?.count ?? 1;
  return (
    <ul className="space-y-2">
      {groups.map((g) => {
        const isOpen = open === g.component;
        return (
          <li key={g.component} className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
              onClick={() => setOpen(isOpen ? null : g.component)}
              aria-expanded={isOpen}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{titleCase(g.component)}</span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {g.count} <span className="text-xs">({Math.round((g.count / total) * 100)}%)</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (g.count / max) * 100)}%` }} />
                </div>
                {(g.crashes > 0 || g.fires > 0 || g.injuries > 0) && (
                  <p className="mt-1 text-xs text-destructive">
                    {[g.crashes && `${g.crashes} crash`, g.fires && `${g.fires} fire`, g.injuries && `${g.injuries} injur${g.injuries === 1 ? "y" : "ies"}`].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && <ComplaintList complaints={g.complaints} />}
          </li>
        );
      })}
    </ul>
  );
}

export function ComplaintList({ complaints, initial = 5 }: { complaints: ComponentGroup["complaints"]; initial?: number }) {
  const [shown, setShown] = useState(initial);
  return (
    <div className="border-t border-border">
      <ul className="divide-y divide-border">
        {complaints.slice(0, shown).map((c) => (
          <li key={c.odiNumber} className="space-y-1 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDate(c.dateOfIncident ?? c.dateComplaintFiled)}</span>
              {c.mileage && <span>{c.mileage.toLocaleString()} mi</span>}
              {c.components.length > 1 && <span>{c.components.map(titleCase).join(", ")}</span>}
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
        <button type="button" className="tap w-full border-t border-border text-sm text-primary" onClick={() => setShown((s) => s + 10)}>
          Show more ({complaints.length - shown} left)
        </button>
      )}
    </div>
  );
}
