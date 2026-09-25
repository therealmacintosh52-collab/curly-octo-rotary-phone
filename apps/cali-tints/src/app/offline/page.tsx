import { WifiOffIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Served by the service worker when a navigation fails offline and the page is not cached. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-accent">
        <WifiOffIcon className="size-7 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">You are offline</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Job entry still works without signal. Anything you log is queued on this phone and syncs automatically when you are back online.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/jobs/new">Log a job</Link>
      </Button>
    </main>
  );
}
