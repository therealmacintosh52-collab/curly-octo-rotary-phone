import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/";
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_18%,transparent)_0%,transparent_70%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size={88} className="glow-primary" />
          <div>
            <h1 className="text-title">Cali Tints</h1>
            <p className="mt-1 text-sm text-muted-foreground">Dealer detailing · job log &amp; invoicing</p>
          </div>
        </div>
        <LoginForm next={next} initialError={error} />
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Accounts are created by the owner from Settings → Users.
        </p>
      </div>
    </main>
  );
}
