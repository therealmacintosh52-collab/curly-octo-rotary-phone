"use client";

import { usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";
import { useSession } from "@/components/app/session-provider";

/** The retail area's sections. */
const ITEMS = [
  { value: "/retail", label: "Today", href: "/retail" },
  { value: "/retail/calendar", label: "Calendar", href: "/retail/calendar" },
  { value: "/retail/customers", label: "Customers", href: "/retail/customers" },
  { value: "/retail/estimates", label: "Estimates", href: "/retail/estimates" },
  { value: "/retail/jobs", label: "Jobs", href: "/retail/jobs" },
  { value: "/retail/invoices", label: "Invoices", href: "/retail/invoices" },
];

export function RetailNav() {
  const pathname = usePathname();
  const { canPrices } = useSession();
  // Invoices are money: owner, admin and advisor only.
  const items = canPrices ? ITEMS : ITEMS.filter((i) => i.value !== "/retail/invoices");
  const active =
    items.filter((i) => (i.value === "/retail" ? pathname === "/retail" : pathname.startsWith(i.value) || (i.value === "/retail/customers" && pathname.startsWith("/retail/vehicles")) || (i.value === "/retail/calendar" && pathname.startsWith("/retail/appointments")))).at(-1)?.value ?? "/retail";
  return <Segmented aria-label="Retail sections" items={items} value={active} wrap className="w-full sm:w-auto" />;
}
