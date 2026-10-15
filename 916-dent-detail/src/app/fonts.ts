import localFont from 'next/font/local';

// Self-hosted from @fontsource/michroma@5.3.0 and @fontsource/inter@5.3.0 (OFL-1.1, see src/fonts/LICENSE-*).
export const michroma = localFont({
  src: '../fonts/michroma-latin-400-normal.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-michroma',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  adjustFontFallback: 'Arial',
});

export const inter = localFont({
  src: [
    { path: '../fonts/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-inter',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
  adjustFontFallback: 'Arial',
});
