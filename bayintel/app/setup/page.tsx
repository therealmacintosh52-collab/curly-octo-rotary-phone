import { APP_NAME } from "@/lib/config";
import { missingConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Shown (with a 503, by proxy.ts) on every page while the deployment has no
 * Supabase keys, instead of an unstyled "Internal Server Error". Deliberately
 * imports nothing that touches Supabase.
 */
export default function SetupPage() {
  const missing = missingConfig();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-10 text-sm">
      <h1 className="text-xl font-semibold">{APP_NAME} isn&apos;t set up yet</h1>
      <p className="text-muted-foreground">
        This deployment has no database connection, so nothing can load. Add these environment variables to the hosting project (Vercel: Project → Settings → Environment Variables), then redeploy:
      </p>
      <ul className="rounded-xl border border-border bg-card p-4 font-mono text-xs leading-6" data-testid="missing-env">
        {missing.map((k) => (
          <li key={k}>{k}</li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        The values come from your Supabase project (Project Settings → API). The database itself needs the migrations and seed from <span className="font-mono">supabase/</span> applied once; see the README.
      </p>
    </main>
  );
}
