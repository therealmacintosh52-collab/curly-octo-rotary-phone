import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cali Tints — Job Log",
    short_name: "Cali Tints",
    description: "Log detailing jobs on the lot and invoice the dealership.",
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
      { name: "Log a job", url: "/jobs/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Job history", url: "/jobs" },
    ],
  };
}
