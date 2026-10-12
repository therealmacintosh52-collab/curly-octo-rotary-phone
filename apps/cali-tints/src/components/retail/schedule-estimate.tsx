"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RetailCatalog } from "@/lib/db/types";
import { AppointmentSheet, type EstimateForBooking } from "./appointment-sheet";

/** Opens the booking sheet for an approved estimate as soon as the calendar loads with `?estimate=`. */
export function ScheduleEstimate({ catalog, estimate, tz }: { catalog: RetailCatalog; estimate: EstimateForBooking; tz: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <AppointmentSheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) router.replace("/retail/calendar");
      }}
      catalog={catalog}
      recent={[]}
      tz={tz}
      estimate={estimate}
    />
  );
}
