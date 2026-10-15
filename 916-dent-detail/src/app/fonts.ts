import localFont from 'next/font/local';

// Self-hosted, subset from @fontsource/michroma@5.3.0 + @fontsource/inter@5.3.0 by scripts/subset-fonts.sh (OFL-1.1).
export const michroma = localFont({
  src: '../fonts/michroma-400.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-michroma',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  adjustFontFallback: 'Arial',
});

export const inter = localFont({
  src: [
    { path: '../fonts/inter-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/inter-600.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-inter',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
  adjustFontFallback: 'Arial',
});
