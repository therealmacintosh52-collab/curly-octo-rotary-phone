"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardListIcon, FileTextIcon, LayoutDashboardIcon, PlusCircleIcon, SettingsIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { StatusPill } from "@/components/offline/status-pill";
import { SignOutButton } from "@/components/app/sign-out-button";
import { useSession } from "@/components/app/session-provider";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  /** Match nested routes too. */
  prefix?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon, adminOnly: true },
  { href: "/jobs/new", label: "Log job", icon: PlusCircleIcon },
  { href: "/jobs", label: "Jobs", icon: ClipboardListIcon, prefix: true },
  { href: "/invoices", label: "Invoices", icon: FileTextIcon, adminOnly: true, prefix: true },
  { href: "/settings", label: "Settings", icon: SettingsIcon, adminOnly: true, prefix: true },
];

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/") return pathname === "/";
  if (pathname === item.href) return true;
  if (item.prefix && pathname.startsWith(item.href + "/")) {
    // /jobs/new belongs to "Log job", not "Jobs".
    return !(item.href === "/jobs" && pathname === "/jobs/new");
  }
  return false;
}

/**
 * Responsive chrome: sidebar on desktop, bottom tab bar on phones.
 * Detailers only see Log job + Jobs.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, company, isAdmin } = useSession();
  const items = NAV.filter((i) => isAdmin || !i.adminOnly);

  return (
    <div className="flex min-h-dvh w-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <Link href={isAdmin ? "/" : "/jobs/new"} className="mb-6 flex items-center gap-3 px-2">
          <Logo size={40} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{company.name}</div>
            <div className="truncate text-xs text-muted-foreground">{profile.full_name}</div>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "bg-primary/12 text-primary" : "text-sidebar-foreground/80 hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-3 px-1">
          <StatusPill />
          <SignOutButton variant="ghost" className="justify-start px-2 text-muted-foreground" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="pt-safe sticky top-0 z-30 flex items-center justify-between border-b border-border/70 bg-background/85 px-4 py-2.5 backdrop-blur md:hidden">
          <Link href={isAdmin ? "/" : "/jobs/new"} className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-sm font-semibold">{company.name}</span>
          </Link>
          <StatusPill />
        </header>

        <main className="flex-1 pb-24 md:pb-0">{children}</main>

        {/* Mobile bottom tabs */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 grid border-t border-border/70 bg-background/90 backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            const active = isActive(pathname, item);
            const primary = item.href === "/jobs/new";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className={cn("size-6", primary && !active && "text-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
