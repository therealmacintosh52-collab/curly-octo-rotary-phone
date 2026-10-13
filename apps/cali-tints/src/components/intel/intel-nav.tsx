"use client";

import { usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";

/** The Intel area's sections: Codes · Garage · Fixes (the Assistant follows). */
const ITEMS = [
  { value: "/intel", label: "Codes", href: "/intel" },
  { value: "/intel/garage", label: "Garage", href: "/intel/garage" },
  { value: "/intel/fixes", label: "Fixes", href: "/intel/fixes" },
];

export function IntelNav() {
  const pathname = usePathname();
  const active =
    ITEMS.filter((i) => (i.value === "/intel" ? pathname === "/intel" || pathname.startsWith("/intel/dtc") : pathname.startsWith(i.value) || (i.value === "/intel/garage" && pathname.startsWith("/intel/vehicles")))).at(-1)?.value ?? "/intel";
  return <Segmented aria-label="Intel sections" items={ITEMS} value={active} className="w-full sm:w-auto" />;
}
