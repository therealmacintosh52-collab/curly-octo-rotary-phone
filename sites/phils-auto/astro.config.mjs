import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwind from "@tailwindcss/vite";

export const SITE_URL = "https://philsautofleet.com";

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "always",
  build: { format: "directory", inlineStylesheets: "auto" },
  integrations: [sitemap({ filter: (p) => !/\/(thank-you|404)\//.test(p) })],
  vite: {
    plugins: [tailwind()],
  },
});
