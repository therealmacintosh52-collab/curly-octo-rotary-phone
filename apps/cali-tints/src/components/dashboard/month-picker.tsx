"use client";

import { Segmented } from "@/components/ui/segmented";

/** Breakdown month: the last few months as segments; the choice lives in the URL (`bm=YYYY-MM`) next to the income range. */
export function MonthPicker({ months, value, baseQuery }: { months: { value: string; label: string }[]; value: string; baseQuery: string }) {
  return <Segmented aria-label="Breakdown month" size="sm" wrap items={months.map((mo) => ({ value: mo.value, label: mo.label, href: `/?${baseQuery ? `${baseQuery}&` : ""}bm=${mo.value}` }))} value={value} />;
}
