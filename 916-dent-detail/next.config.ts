import type { NextConfig } from 'next';
import { redirectMap } from './src/config/redirects';

const immutable = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];

const nextConfig: NextConfig = {
  // NEXT_DIST_DIR lets parallel agents/CI build into separate folders (default .next).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  // All imagery is pre-optimised by scripts/media.mjs (AVIF/WebP at fixed sizes), so the runtime
  // optimiser is off (P-017). `formats` still pins AVIF-then-WebP for any next/image use later.
  images: { unoptimized: true, formats: ['image/avif', 'image/webp'] },
  async redirects() {
    return redirectMap.map((r) => ({ source: r.source, destination: r.destination, permanent: true }));
  },
  async headers() {
    return [
      { source: '/hero/:path*', headers: immutable },
      { source: '/beading/:path*', headers: immutable },
      { source: '/brand/:path*', headers: immutable },
    ];
  },
};

export default nextConfig;
