import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './admin.css';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | 916 Admin' },
  description: 'Private admin for 916 Dent & Detail.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  manifest: '/admin/manifest.webmanifest',
  alternates: { canonical: null },
  appleWebApp: { capable: true, title: '916 Admin', statusBarStyle: 'black-translucent' },
  icons: { apple: [{ url: '/admin/icon-192.png', sizes: '192x192' }], icon: [{ url: '/admin/icon-192.png', sizes: '192x192' }] },
  openGraph: null,
  twitter: null,
};

export const viewport: Viewport = {
  themeColor: '#0B0B0C', colorScheme: 'dark', width: 'device-width', initialScale: 1, viewportFit: 'cover',
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="adm">{children}</div>;
}
