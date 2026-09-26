"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { InView } from "@/components/motion/in-view";

/*
  recharts is the largest client dependency (~100 KB gz). Only the dashboard
  uses it, and the charts sit below the KPI tiles, so they load and render
  only when scrolled near the viewport, behind same-height skeletons so the
  page never shifts.
*/
const RevenueByDayChartImpl = dynamic(() => import("./charts").then((mod) => mod.RevenueByDayChart), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full rounded-lg" />,
});

const HorizontalBarsImpl = dynamic(() => import("./charts").then((mod) => mod.HorizontalBars), {
  ssr: false,
  loading: () => <Skeleton className="h-[152px] w-full rounded-lg" />,
});

export function RevenueByDayChart(props: ComponentProps<typeof RevenueByDayChartImpl>) {
  return (
    <InView placeholder={<Skeleton className="h-56 w-full rounded-lg" />}>
      <RevenueByDayChartImpl {...props} />
    </InView>
  );
}

export function HorizontalBars(props: ComponentProps<typeof HorizontalBarsImpl>) {
  const rows = Math.min(props.data.length, 8);
  const height = rows === 0 ? 96 : Math.max(120, rows * 34 + 16);
  return (
    <InView placeholder={<Skeleton className="w-full rounded-lg" style={{ height }} />}>
      <HorizontalBarsImpl {...props} />
    </InView>
  );
}
