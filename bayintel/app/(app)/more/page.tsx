import Link from "next/link";
import { ChevronRight, ClipboardList, FileText, Settings, ShieldCheck, CreditCard, Scale, LogOut } from "lucide-react";
import { Page } from "@/components/shell/page";
import { getProfile } from "@/lib/supabase/server";

export const metadata = { title: "More" };

export default async function MorePage() {
  const profile = await getProfile();
  const items = [
    { href: "/repair-orders", label: "Repair orders", icon: ClipboardList },
    { href: "/estimates", label: "Estimates", icon: FileText },
    { href: "/settings", label: "Profile, shop & billing", icon: Settings },
    { href: "/pricing", label: "Plans", icon: CreditCard },
    { href: "/terms", label: "Terms & data sources", icon: Scale },
    ...(profile?.role === "admin" ? [{ href: "/admin/moderation", label: "Moderation queue", icon: ShieldCheck }] : []),
  ];
  return (
    <Page title="More">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-accent">
              <Icon className="size-5 text-muted-foreground" />
              <span className="flex-1 font-medium">{label}</span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
        <li>
          <form action="/auth/signout" method="post">
            <button type="submit" className="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-accent">
              <LogOut className="size-5 text-muted-foreground" />
              <span className="flex-1 font-medium">Sign out</span>
            </button>
          </form>
        </li>
      </ul>
    </Page>
  );
}
