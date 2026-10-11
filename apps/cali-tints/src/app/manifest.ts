import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cali Tints — Jobs & Invoices",
    short_name: "Cali Tints",
    description: "Log each car on the lot. One invoice per dealership a month, sent to QuickBooks.",
    start_url: "/jobs/new",
    id: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0d0f",
    theme_color: "#0b0d0f",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New job", url: "/jobs/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Jobs", url: "/jobs" },
    ],
  };
}
