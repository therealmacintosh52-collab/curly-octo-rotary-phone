"use client";

import { usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";

const ITEMS = [
  { value: "/settings", label: "Company", href: "/settings" },
  { value: "/settings/dealerships", label: "Dealerships", href: "/settings/dealerships" },
  { value: "/settings/services", label: "Services & prices", href: "/settings/services" },
  { value: "/settings/users", label: "Users", href: "/settings/users" },
  { value: "/settings/export", label: "Export", href: "/settings/export" },
];

export function SettingsNav() {
  const pathname = usePathname();
  const active = ITEMS.filter((i) => (i.value === "/settings" ? pathname === "/settings" : pathname.startsWith(i.value))).at(-1)?.value ?? "/settings";
  return <Segmented aria-label="Settings sections" items={ITEMS} value={active} className="w-full lg:w-auto" />;
}
