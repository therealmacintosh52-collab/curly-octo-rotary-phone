import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/admin";
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_18%,transparent)_0%,transparent_70%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <h1 className="text-title">Local Audit</h1>
          <p className="text-sm text-muted-foreground">Visibility &amp; revenue-leak audits</p>
        </div>
        <LoginForm next={next} initialError={error} />
        <p className="mt-8 text-center text-xs text-muted-foreground">Accounts are created by the agency admin.</p>
      </div>
    </main>
  );
}
