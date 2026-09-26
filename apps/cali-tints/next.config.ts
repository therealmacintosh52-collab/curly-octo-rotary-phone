import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF + XLSX renderers use Node APIs and ship their own bundles; keep them
  // out of the Turbopack server graph.
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
  images: { remotePatterns: [] },
  async headers() {
    return [
      {
        // The service worker must never be cached by the browser/CDN so updates roll out immediately.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
