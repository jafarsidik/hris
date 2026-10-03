import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Workspace packages ship compiled output; transpiling them again would slow
  // down every rebuild and can desynchronise their source maps.
  transpilePackages: [],

  output: 'standalone',
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,

  eslint: {
    // Linting runs as a dedicated pipeline step, so it must not silently be
    // skipped or duplicated during `next build`.
    ignoreDuringBuilds: true,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Geolocation is required by phase 6 attendance capture; camera and
          // microphone stay off. Widen deliberately, never by default.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // The Content-Security-Policy is set in middleware instead, because it
          // carries a per-request nonce that a static header cannot express.
        ],
      },
    ];
  },
};

export default nextConfig;
