import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { KeyRoundIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEMO_COOKIE, demoKey, isDemoCookieValid } from "@/lib/demo";

export const metadata: Metadata = { title: "Guest preview", robots: { index: false, follow: false } };

/** Landing for the guest demo: paste the access key (or arrive via the secret link). */
export default async function DemoPage(props: PageProps<"/demo">) {
  const sp = await props.searchParams;
  const store = await cookies();
  const enabled = !!demoKey();
  const unlocked = isDemoCookieValid(store.get(DEMO_COOKIE)?.value);
  const wrong = sp.error === "1";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_18%,transparent)_0%,transparent_70%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size={88} className="glow-primary" />
          <div>
            <h1 className="text-title">Cali Tints · guest preview</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sample data. Nothing you do here is saved.</p>
          </div>
        </div>

        {!enabled ? (
          <p className="rounded-2xl border border-border bg-card p-6 surface-raised text-center text-sm text-muted-foreground">
            Guest mode is off on this deployment. Sign in at{" "}
            <Link href="/login" className="text-primary hover:underline">
              /login
            </Link>
            .
          </p>
        ) : unlocked ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 surface-raised text-center">
            <p className="text-sm">You&apos;re in.</p>
            <Button asChild size="lg">
              <Link href="/">Open the app</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/jobs/new">Try logging a job</Link>
            </Button>
          </div>
        ) : (
          <form method="get" action="/demo" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 surface-raised surface-gradient">
            {wrong && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">That key is not right.</p>}
            <label htmlFor="key" className="text-label text-muted-foreground">
              Access key
            </label>
            <Input id="key" name="key" type="password" autoComplete="off" required placeholder="Paste the key you were given" />
            <Button type="submit" size="lg">
              <KeyRoundIcon /> Enter
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
