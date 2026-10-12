import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your appointment", robots: { index: false, follow: false } };

/** The customer's appointment page: no app shell, no login. */
export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
