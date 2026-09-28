import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cali Tints — Cars & Invoices",
    short_name: "Cali Tints",
    description: "Log a car on the lot; it becomes its invoice. Send it, collect it.",
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
      { name: "New car", url: "/jobs/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Invoices", url: "/invoices" },
    ],
  };
}
