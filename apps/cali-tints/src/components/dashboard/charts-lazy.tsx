"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/*
  recharts is the largest client dependency (~150 KB gz). Only the dashboard
  uses it, so the charts load after the page shell has painted, with
  same-height skeletons so nothing shifts.
*/
export const RevenueByDayChart = dynamic(() => import("./charts").then((mod) => mod.RevenueByDayChart), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full rounded-lg" />,
});

export const HorizontalBars = dynamic(() => import("./charts").then((mod) => mod.HorizontalBars), {
  ssr: false,
  loading: () => <Skeleton className="h-[152px] w-full rounded-lg" />,
});
