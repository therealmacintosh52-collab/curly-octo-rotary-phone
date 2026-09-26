"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings", label: "Company" },
  { href: "/settings/dealerships", label: "Dealerships" },
  { href: "/settings/services", label: "Services & prices" },
  { href: "/settings/users", label: "Users" },
  { href: "/settings/export", label: "Export" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
      {ITEMS.map((i) => {
        const active = i.href === "/settings" ? pathname === "/settings" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "shrink-0 rounded-md px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
