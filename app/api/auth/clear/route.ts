import { NextResponse } from 'next/server';

import { sessionCookieOptions } from '@/lib/server/auth';
import { SESSION_COOKIE_NAME } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/clear — drop a session cookie that no longer verifies, then
 * send the visitor to sign in.
 *
 * ── WHY THIS ROUTE EXISTS ──
 * Middleware runs on the Edge and can only see that a cookie is PRESENT. The
 * server, in the Node runtime, can see whether it is VALID. When those two
 * disagree — an expired, revoked, or forged cookie — each one bounces to the
 * other:
 *
 *   /today   → middleware: cookie present, allow → layout: invalid → /sign-in
 *   /sign-in → middleware: cookie present, allow → /today
 *   …ERR_TOO_MANY_REDIRECTS
 *
 * A Server Component cannot set cookies, so the layout cannot clear the bad
 * cookie itself. A Route Handler can. Redirecting here breaks the loop at its
 * source: the cookie goes away, so middleware stops seeing one, so nothing
 * bounces.
 *
 * ── ON CSRF ──
 * This is a GET with no same-origin check, deliberately: it is a redirect
 * target for browser navigation, and a check would defeat the purpose. The
 * worst a forged request achieves is signing someone out of this tab. It does
 * NOT revoke refresh tokens — that would let a third party invalidate every
 * session someone has, which is a real denial of service. Clearing one cookie
 * is not.
 */
export async function GET(req: Request) {
  const url = new URL('/sign-in', req.url);
  url.searchParams.set('expired', '1');

  const res = NextResponse.redirect(url);
  res.cookies.set({ ...sessionCookieOptions(0), name: SESSION_COOKIE_NAME, value: '' });
  // Belt and braces: some proxies mangle an empty Set-Cookie with Max-Age 0.
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
