import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwind from "@tailwindcss/vite";

export const SITE_URL = "https://philsautofleet.com";

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "always",
  build: { format: "directory", inlineStylesheets: "auto" },
  integrations: [react(), sitemap({ filter: (p) => !/\/(thank-you|404)\//.test(p) })],
  vite: {
    plugins: [tailwind()],
    build: {
      // The WebGL island is its own chunk so it can be measured — and
      // excluded from — the page budget honestly.
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/three")) return "three";
            if (id.includes("@react-three")) return "r3f";
            if (id.includes("node_modules/gsap")) return "gsap";
          },
        },
      },
    },
  },
});
