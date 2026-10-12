"use client";

import { usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";

/** The retail area's sections. Calendar arrives with the booking slice. */
const ITEMS = [
  { value: "/retail", label: "Today", href: "/retail" },
  { value: "/retail/customers", label: "Customers", href: "/retail/customers" },
  { value: "/retail/estimates", label: "Estimates", href: "/retail/estimates" },
];

export function RetailNav() {
  const pathname = usePathname();
  const active =
    ITEMS.filter((i) => (i.value === "/retail" ? pathname === "/retail" : pathname.startsWith(i.value) || (i.value === "/retail/customers" && pathname.startsWith("/retail/vehicles")))).at(-1)?.value ?? "/retail";
  return <Segmented aria-label="Retail sections" items={ITEMS} value={active} className="w-full sm:w-auto" />;
}
