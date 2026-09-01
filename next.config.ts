import type { NextConfig } from 'next';

/**
 * Security headers.
 *
 * The CSP below is a solid baseline, not the final form. It still permits
 * 'unsafe-inline' for scripts because Next.js emits inline bootstrap scripts;
 * the proper fix is a per-request nonce with 'strict-dynamic', which is a Day 4
 * hardening task rather than a Day 1 one. Written down here so it is a known
 * gap rather than an unnoticed one.
 *
 * The allowances that look odd are all Firebase Auth's sign-in popup:
 *   apis.google.com / gstatic.com   — the GIS client
 *   *.firebaseapp.com               — the auth handler iframe
 *   identitytoolkit / securetoken   — the token endpoints
 */

const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  `default-src 'self'`,
  // 'unsafe-eval' is required by React Fast Refresh in development only.
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} https://apis.google.com https://www.gstatic.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com`,
  `font-src 'self' data:`,
  `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.googleapis.com`,
  `frame-src 'self' https://*.firebaseapp.com https://accounts.google.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
]
  .filter(Boolean)
  .join('; ')
  .replace(/\s+/g, ' ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
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
          // The journal is private by definition. Nothing here should ever be
          // held in a shared cache.
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
