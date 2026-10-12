import type { Metadata } from "next";

export const metadata: Metadata = { title: "Book online", robots: { index: false, follow: false } };

/** Public booking pages: no app shell, no login. */
export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
