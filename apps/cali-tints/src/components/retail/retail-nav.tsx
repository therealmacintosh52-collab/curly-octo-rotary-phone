"use client";

import { usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";
import { CarLookupBar } from "./car-lookup-bar";

/**
 * The retail area: it opens on the Dashboard, then Customers, then Estimates
 * (every visit, quote to signed invoice, in one list) and the Calendar. There
 * is no "Jobs" or "Work" in Retail: jobs belong to the dealerships.
 */
const ITEMS = [
  { value: "/retail", label: "Dashboard", href: "/retail" },
  { value: "/retail/customers", label: "Customers", href: "/retail/customers" },
  { value: "/retail/estimates", label: "Estimates", href: "/retail/estimates" },
  { value: "/retail/calendar", label: "Calendar", href: "/retail/calendar" },
];

export function RetailNav() {
  const pathname = usePathname();
  const items = ITEMS;
  const active =
    items.filter((i) => (i.value === "/retail" ? pathname === "/retail" : pathname.startsWith(i.value) || (i.value === "/retail/customers" && pathname.startsWith("/retail/vehicles")) || (i.value === "/retail/calendar" && pathname.startsWith("/retail/appointments")) || (i.value === "/retail/estimates" && (pathname.startsWith("/retail/invoices") || pathname.startsWith("/retail/jobs"))))).at(-1)?.value ?? "/retail";
  return (
    <>
      <Segmented aria-label="Retail sections" items={items} value={active} size="sm" className="w-full sm:w-auto" />
      <CarLookupBar />
    </>
  );
}
