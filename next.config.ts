import type { NextConfig } from 'next';

/**
 * Security headers.
 *
 * Content-Security-Policy is NOT here — it carries a per-request nonce and so
 * lives in middleware.ts. Two CSP headers on one response are intersected by
 * the browser, which produces a policy nobody wrote and failures nobody can
 * explain, so it must be set in exactly one place.
 *
 * Everything below is request-independent and belongs here, where it also
 * covers /api routes that middleware deliberately skips.
 */

const nextConfig: NextConfig = {
  // Ships only the files the server actually imports, so the Cloud Run image
  // carries a runtime rather than a workspace.
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          // A journal is private by definition. Nothing here should ever sit
          // in a shared cache.
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
