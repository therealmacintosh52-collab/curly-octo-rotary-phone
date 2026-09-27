"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboardIcon, SettingsIcon } from "lucide-react";
import { SignOutButton } from "@/components/app/sign-out-button";
import { useSession } from "@/components/app/session-provider";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Match nested routes too. */
  prefix?: boolean;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Audits", icon: LayoutDashboardIcon },
  { href: "/admin/settings/providers", label: "Settings", icon: SettingsIcon, prefix: true },
];

function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true;
  return !!item.prefix && pathname.startsWith(item.href + "/");
}

/** Admin chrome: sidebar on desktop, compact header on phones. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, email } = useSession();

  return (
    <div className="flex min-h-dvh w-full">
      <aside className="print:hidden sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <Link href="/admin" className="mb-6 flex flex-col rounded-lg px-2 py-1 transition-colors hover:bg-accent/60">
          <span className="text-sm font-semibold">Local Audit</span>
          <span className="truncate text-caption text-muted-foreground">{profile.full_name ?? email}</span>
        </Link>
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                  active ? "bg-accent-soft text-primary" : "text-sidebar-foreground/75 hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <item.icon className="size-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-1">
          <SignOutButton variant="ghost" className="justify-start px-2 text-muted-foreground" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="print:hidden pt-safe sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/70 bg-background/85 px-4 backdrop-blur-md md:hidden">
          <Link href="/admin" className="text-sm font-semibold">
            Local Audit
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main">
            {NAV.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex size-9 items-center justify-center rounded-lg", active ? "bg-accent-soft text-primary" : "text-muted-foreground")}
                >
                  <item.icon className="size-5" />
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
