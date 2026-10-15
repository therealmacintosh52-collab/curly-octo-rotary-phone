import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { inter, michroma } from './fonts';
import { site } from '@/config/site';
import { envScript } from '@/lib/env-script';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MobileCtaBar } from '@/components/MobileCtaBar';
import { SmoothScroll } from '@/components/SmoothScroll';
import { BusinessJsonLd } from '@/components/JsonLd';
import { Analytics } from '@vercel/analytics/next';
import { AnalyticsRoot } from '@/components/seo/AnalyticsRoot';
import { ConsentBanner } from '@/components/seo/ConsentBanner';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `Mobile Dent Repair & Detailing Sacramento | ${site.name}`, template: `%s | ${site.name}` },
  description: 'Mobile paintless dent repair and auto detailing across Sacramento. Dents removed without paint, paint corrected and coated, at your home, work or lot.',
  applicationName: site.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: site.name,
    title: `${site.name}: dents gone, paint glowing, we come to you`,
    description: site.description,
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: `${site.name} gold logo on black` }],
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image', images: ['/og-image.jpg'] },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0B0B0C',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${michroma.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Decides scrub vs static hero before first paint (see lib/env-script.ts). */}
        <script dangerouslySetInnerHTML={{ __html: envScript }} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <Header />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer />
        <MobileCtaBar />
        <SmoothScroll />
        <BusinessJsonLd />
        <AnalyticsRoot />
        <ConsentBanner />
        {/* Cookieless; only meaningful on Vercel, so it is off elsewhere (a missing /_vercel script would 404) */}
        {(process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ANALYTICS === '1') && <Analytics />}
      </body>
    </html>
  );
}
