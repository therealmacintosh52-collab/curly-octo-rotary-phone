import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your estimate", robots: { index: false, follow: false } };

/** Public, token-only pages the customer opens from a text or email. No app shell, no login. */
export default function PublicEstimateLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
