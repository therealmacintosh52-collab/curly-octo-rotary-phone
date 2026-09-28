import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { SessionProvider } from "@/components/app/session-provider";

/**
 * Fixture previews for design review and screenshots. Development only:
 * production answers 404. No database is touched; the admin chrome is
 * rendered with a stand-in session.
 */
export default function PreviewLayout({ children }: LayoutProps<"/dev/preview">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <SessionProvider
      value={{
        userId: "00000000-0000-4000-8000-000000000000",
        email: "preview@example.test",
        isAdmin: true,
        profile: { id: "00000000-0000-4000-8000-000000000000", role: "admin", full_name: "Preview admin", email: "preview@example.test", active: true, created_at: "", updated_at: "" },
      }}
    >
      <div className="sticky top-0 z-40 bg-warning/15 px-4 py-1 text-center text-caption text-warning">Preview · fixture data · nothing is saved</div>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
