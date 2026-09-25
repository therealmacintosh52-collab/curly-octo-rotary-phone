// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Static export. Every page is real HTML at build time; React is only
// hydrated for the islands that need it (the home hero and one image effect).
export default defineConfig({
  site: 'https://philsautofleet.com',
  output: 'static',
  trailingSlash: 'always',
  // one stylesheet, inlined: saves a render-blocking round trip on mobile
  build: { format: 'directory', inlineStylesheets: 'always', assets: 'static' },
  integrations: [
    react(),
    sitemap({
      filter: (page) => !/\/(thank-you|privacy|404)\/?$/.test(page),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      // keep three.js in its own chunk so the bundle report shows it clearly
      rollupOptions: { output: { manualChunks: { three: ['three'] } } },
    },
  },
});
