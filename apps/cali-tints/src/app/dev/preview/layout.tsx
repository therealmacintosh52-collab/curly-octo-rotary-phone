import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { EyeIcon } from "lucide-react";
import { DEMO_COOKIE, demoKey, isDemoCookieValid } from "@/lib/demo";

/**
 * Fixture-driven preview screens. Open in local development; in production
 * only for guests holding the demo cookie (see lib/demo.ts). Everything else
 * is a 404 so the previews never leak on a real deployment.
 */
export default async function PreviewLayout({ children }: LayoutProps<"/dev/preview">) {
  const production = process.env.NODE_ENV === "production";
  if (production) {
    if (!demoKey()) notFound();
    const store = await cookies();
    if (!isDemoCookieValid(store.get(DEMO_COOKIE)?.value)) notFound();
  }
  return (
    <>
      <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-primary px-3 py-1.5 text-center text-xs font-medium text-primary-foreground">
        <EyeIcon className="size-3.5" />
        Guest preview · sample data · nothing is saved
      </div>
      {children}
    </>
  );
}
