import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { Badge } from "@/components/ui/badge";

export function AppHeader({ displayName, tier }: { displayName: string; tier: string }) {
  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur">
      <Link href="/garage" className="flex items-center gap-2 font-semibold tracking-tight">
        <span className="inline-block size-6 rounded-md bg-primary" aria-hidden />
        {APP_NAME}
      </Link>
      <Link href="/settings" className="tap flex items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground">
        <Badge variant={tier === "free" ? "muted" : "default"}>{tier.replace("_", " ")}</Badge>
        <span className="max-w-28 truncate">{displayName}</span>
      </Link>
    </header>
  );
}
