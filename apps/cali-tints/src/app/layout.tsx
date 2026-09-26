import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "@/components/ui/sonner";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Cali Tints", template: "%s · Cali Tints" },
  description: "Job logging and invoicing for Cali Tints dealership detailing.",
  applicationName: "Cali Tints",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Cali Tints" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d0f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // No maximum-scale: pinch-zoom stays available (WCAG 1.4.4). iOS input zoom is prevented by 16px+ inputs instead.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className={`${GeistSans.variable} dark h-full`}>
      <body className="flex min-h-full flex-col">
        <MotionProvider>
          {children}
          <Toaster />
        </MotionProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
