"use client";

import { useRouter } from "next/navigation";
import { presetRange, type RangePreset } from "@/lib/dates";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "this_week", label: "Week" },
  { value: "this_month", label: "Month" },
  { value: "this_quarter", label: "Quarter" },
  { value: "ytd", label: "YTD" },
  { value: "last_month", label: "Last month" },
  { value: "last_quarter", label: "Last quarter" },
  { value: "last_90", label: "90 days" },
  { value: "last_year", label: "Last year" },
  { value: "all", label: "All time" },
];

/** One row of range controls above the breakdown charts; state lives in the URL. */
export function RangePicker({ preset, start, end }: { preset: RangePreset | "custom"; start: string; end: string }) {
  const router = useRouter();
  const go = (s: string, e: string, p?: RangePreset) => router.push(`/?from=${s}&to=${e}${p ? `&preset=${p}` : ""}`);
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <Tabs
        value={preset}
        onValueChange={(v) => {
          const r = presetRange(v as RangePreset);
          go(r.start, r.end, v as RangePreset);
        }}
        className="min-w-0"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start lg:w-auto">
          {PRESETS.map((p) => (
            <TabsTrigger key={p.value} value={p.value} className="h-9 flex-none">
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-2">
        <Input type="date" value={start} onChange={(e) => e.target.value && go(e.target.value, end)} className="h-9 w-40 text-sm" aria-label="From" />
        <span className="text-muted-foreground">–</span>
        <Input type="date" value={end} onChange={(e) => e.target.value && go(start, e.target.value)} className="h-9 w-40 text-sm" aria-label="To" />
      </div>
    </div>
  );
}
