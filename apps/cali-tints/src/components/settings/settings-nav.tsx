"use client";

import { usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";
import { useSession } from "@/components/app/session-provider";
import { isOwner } from "@/lib/roles";

/** Prices and the data export carry money: the owner's tabs only. */
const ITEMS = [
  { value: "/settings", label: "Company", href: "/settings" },
  { value: "/settings/dealerships", label: "Dealerships", href: "/settings/dealerships" },
  { value: "/settings/services", label: "Services & prices", href: "/settings/services", ownerOnly: true },
  { value: "/settings/users", label: "Users", href: "/settings/users" },
  { value: "/settings/export", label: "Export", href: "/settings/export", ownerOnly: true },
];

export function SettingsNav() {
  const pathname = usePathname();
  const { profile } = useSession();
  const items = ITEMS.filter((i) => !i.ownerOnly || isOwner(profile.role));
  const active = items.filter((i) => (i.value === "/settings" ? pathname === "/settings" : pathname.startsWith(i.value))).at(-1)?.value ?? "/settings";
  return <Segmented aria-label="Settings sections" items={items} value={active} className="w-full lg:w-auto" />;
}
