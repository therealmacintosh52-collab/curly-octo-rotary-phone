import type { NextConfig } from 'next';

const immutable = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // All imagery is pre-optimised by scripts/media.mjs (AVIF/WebP at fixed sizes),
  // so the runtime optimiser is not needed.
  images: { unoptimized: true },
  async headers() {
    return [
      { source: '/hero/:path*', headers: immutable },
      { source: '/beading/:path*', headers: immutable },
      { source: '/brand/:path*', headers: immutable },
    ];
  },
};

export default nextConfig;
