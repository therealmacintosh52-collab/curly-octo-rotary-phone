"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Activity, Wrench, Sparkles, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/garage", label: "Garage", icon: Car, match: ["/garage", "/vehicles"] },
  { href: "/dtc", label: "DTC", icon: Activity, match: ["/dtc"] },
  { href: "/fixes", label: "Fixes", icon: Wrench, match: ["/fixes"] },
  { href: "/assistant", label: "AI", icon: Sparkles, match: ["/assistant"] },
  { href: "/more", label: "More", icon: Menu, match: ["/more", "/estimates", "/repair-orders", "/settings", "/admin"] },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur safe-bottom md:hidden" aria-label="Primary">
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match.some((m) => pathname === m || pathname.startsWith(m + "/"));
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="no-print hidden w-56 shrink-0 border-r border-border p-3 md:block" aria-label="Primary">
      <ul className="space-y-1">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match.some((m) => pathname === m || pathname.startsWith(m + "/"));
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                  active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
