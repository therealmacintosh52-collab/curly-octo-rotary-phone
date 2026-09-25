import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Fixed by the blueprint; do not re-decide per project.
export default defineConfig({
  site: 'https://calitintsca.com',
  trailingSlash: 'always',
  build: { assets: 'static', inlineStylesheets: 'always', format: 'directory' },
  compressHTML: true,
  devToolbar: { enabled: false },
  integrations: [
    sitemap({
      // Thank-you, privacy and 404 carry noindex or no search value.
      filter: (page) =>
        !page.includes('/thank-you/') && !page.includes('/privacy/') && !page.includes('/404'),
    }),
  ],
});
