import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Standalone output traces the whole repo so that the app's imports of
  // `next` internals resolve inside the traced tree; the runtime stage then
  // copies the generated .next/standalone tree.
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,

  eslint: {
    // Linting runs as a dedicated pipeline step, so it must not silently be
    // skipped or duplicated during `next build`.
    ignoreDuringBuilds: true,
  },

  // Standalone output bundles only the server runtime and the modules Next
  // traces, so the Docker runtime stage copies the generated tree instead of
  // node_modules. Without this the build stage has no .next/standalone and the
  // Dockerfile runtime COPY fails.
  output: 'standalone',

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
